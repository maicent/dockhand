#!/usr/bin/env tsx
/**
 * i18n-extract - mechanical hardcoded-string extraction for paraglide-js.
 *
 * Scans src/**.svelte, replaces user-visible English text with m.key() calls
 * and records key -> text in messages/en.json.
 *
 * Design rules:
 *  - DETERMINISTIC keys: slug(text), suffixed with a content hash on collision,
 *    and existing en.json values always keep their key. Re-running after an
 *    upstream update regenerates identical keys for identical text, so
 *    translated locales (zh-CN) survive rebases.
 *  - CONSERVATIVE: only template text nodes, a whitelist of visible-text
 *    attributes, and toast.*('...') string literals. Logic strings, URLs,
 *    class names etc. are never touched.
 *  - Anything ambiguous is skipped and listed in the report for manual work.
 *
 * Usage:
 *   tsx scripts/i18n-extract.ts            # apply rewrites
 *   tsx scripts/i18n-extract.ts --dry-run  # report only, no file changes
 */
import { parse } from 'svelte/compiler';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const SRC_DIRS = ['src/routes', 'src/lib'];
const EN_PATH = 'src/messages/en.json';
const TRANSLATABLE_ATTRS: Record<string, true> = {
	placeholder: true,
	title: true,
	'aria-label': true,
	alt: true,
	// component props that render visible text in this codebase; none are
	// native HTML attributes, so this never touches real DOM semantics
	description: true,
	label: true,
	heading: true
};
const TOAST_METHODS: Record<string, true> = {
	success: true,
	error: true,
	info: true,
	warning: true,
	message: true
};
// object-literal properties in instance scripts that carry UI-visible text.
// `name` is deliberately excluded: it is also used for docker object names.
const SCRIPT_TEXT_PROPS: Record<string, true> = { label: true, description: true, title: true };
const DRY_RUN = process.argv.includes('--dry-run');

// ---------- key generation ----------

function slugify(text: string): string {
	let slug = text
		.toLowerCase()
		.replace(/['\u2019]/g, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 48)
		.replace(/_+$/g, '');
	if (!slug || /^[0-9]/.test(slug)) slug = 't_' + slug;
	// `default` cannot be re-exported through the generated message barrel
	if (slug === 'default') slug = 'default_label';
	return slug || 't_text';
}

// ---------- message table ----------

type MessageTable = Map<string, string>; // key -> english text

function loadEn(): MessageTable {
	try {
		const raw = JSON.parse(readFileSync(EN_PATH, 'utf8')) as Record<string, string>;
		return new Map(Object.entries(raw).filter(([k]) => k !== '$schema'));
	} catch {
		return new Map();
	}
}

// ---------- collection ----------

type Param = { placeholder: string; expr: string };
// span: [start, end) in file source; kind drives the replacement shape
type Found = { text: string; params: Param[]; span: [number, number] };
type AttrFound = Found & { attr: string };
type FileBag = {
	source: string;
	hasM: boolean; // identifier `m` already in use -> rewrite with alias
	hasOrEmpty: boolean; // identifier `orEmpty` already in use -> skip file
	existingM: string | null; // local name of an already-present paraglide messages import
	text: Found[];
	attr: AttrFound[];
	toast: Found[];
	// where to insert the m import: offset just after the instance <script> tag,
	// or null when the file has no instance script (then a new tag is created,
	// placed after the module script whose end offset moduleScriptEnd gives)
	instanceImportAt: number | null;
	moduleScriptEnd: number | null;
};

const skipped: { file: string; reason: string; sample: string }[] = [];
const fileData = new Map<string, FileBag>();

function skip(file: string, reason: string, sample: string) {
	skipped.push({ file, reason, sample: sample.replace(/\s+/g, ' ').trim().slice(0, 80) });
}

// ---------- svelte AST walking ----------

// Svelte AST nodes are heterogeneous; we only rely on a handful of fields and
// guard everything at access time.
type AnyNode = { type: string; start?: number; end?: number } & Record<string, unknown>;

function isNode(v: unknown): v is AnyNode {
	if (typeof v !== 'object' || v === null || !('type' in v)) return false;
	return typeof v.type === 'string';
}

function* walk(node: AnyNode): Generator<AnyNode> {
	yield node;
	for (const key of Object.keys(node)) {
		if (key === 'start' || key === 'end' || key === 'metadata') continue;
		// non-computed member properties / object keys (`obj.m`, `{m: 1}`) are
		// not binding references - skipping avoids false `m` collisions
		if (node.type === 'MemberExpression' && key === 'property' && node.computed !== true) continue;
		if ((node.type === 'Property' || node.type === 'ObjectProperty') && key === 'key' && node.computed !== true)
			continue;
		const child = node[key];
		if (Array.isArray(child)) {
			for (const c of child) if (isNode(c)) yield* walk(c);
		} else if (isNode(child)) {
			yield* walk(child);
		}
	}
}

/** Numeric position fields are always present on real AST nodes; assert via guard. */
function pos(node: AnyNode): { start: number; end: number } {
	if (typeof node.start !== 'number' || typeof node.end !== 'number') {
		throw new Error('AST node missing position: ' + node.type);
	}
	return { start: node.start, end: node.end };
}

type RunPart = {
	start: number;
	end: number;
	text?: string; // literal text (Text node)
	expr?: string; // expression source (ExpressionTag)
	exprName?: string; // placeholder name if derivable
};

/** Build ICU text + params from a mixed run of Text/ExpressionTag siblings. */
function buildIcu(parts: RunPart[], file: string): { text: string; params: Param[] } | null {
	const params: Param[] = [];
	let icu = '';
	let hasComplex = false;
	let hasTextLetter = false;
	const usedNames = new Set<string>();
	for (const p of parts) {
		if (p.text !== undefined) {
			if (/[a-zA-Z]/.test(p.text)) hasTextLetter = true;
			icu += p.text.replace(/\s+/g, ' ');
		} else {
			let name = p.exprName ?? 'arg' + (usedNames.size + 1);
			if (usedNames.has(name)) name = 'arg' + (usedNames.size + 1);
			if (!p.exprName) hasComplex = true;
			usedNames.add(name);
			// message params are typed as non-nullish, but optional properties
			// and computed access can be undefined without any marker. Route
			// every value through orEmpty(): single evaluation (no duplicated
			// narrowing diagnostics), legal in JS and TS templates, keeps 0.
			params.push({ placeholder: name, expr: 'orEmpty(' + (p.expr ?? "''") + ')' });
			icu += '{' + name + '}';
		}
	}
	icu = icu.trim();
	// runs without letters in their literal text (pure punctuation/numbers/
	// expressions) carry no translatable content - drop silently
	if (!icu || !hasTextLetter) return null;
	if (hasComplex) skip(file, 'review-interpolation', parts.map((p) => p.text ?? '{' + p.expr + '}').join(''));
	return { text: icu, params };
}

/** Group consecutive Text/ExpressionTag siblings and extract messages. */
function extractFromChildren(children: AnyNode[], source: string, file: string, add: (f: Found) => void) {
	let run: RunPart[] = [];
	const flush = () => {
		if (run.length === 0) return;
		const f = buildIcu(run, file);
		if (f) add({ ...f, span: [run[0].start, run[run.length - 1].end] });
		run = [];
	};
	for (const ch of children) {
		if (ch.type === 'Text' && typeof ch.data === 'string') {
			const p = pos(ch);
			run.push({ start: p.start, end: p.end, text: ch.data });
		} else if (ch.type === 'ExpressionTag' && isNode(ch.expression)) {
			const e = ch.expression;
			const p = pos(ch);
			const ep = pos(e);
			const expr = source.slice(ep.start, ep.end);
			// name the placeholder after simple identifiers/member properties so
			// generated messages stay readable: {user.name} -> {name}
			let exprName: string | undefined;
			if (e.type === 'Identifier' && typeof e.name === 'string') {
				exprName = e.name;
			} else if (e.type === 'MemberExpression' && isNode(e.property)) {
				const prop = e.property;
				if (prop.type === 'Identifier' && typeof prop.name === 'string' && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(prop.name)) {
					exprName = prop.name;
				}
			}
			run.push({ start: p.start, end: p.end, expr, exprName });
		} else {
			flush();
		}
	}
	flush();
}

function collectFile(path: string) {
	const source = readFileSync(path, 'utf8');
	let ast;
	try {
		ast = parse(source, { modern: true });
	} catch (e) {
		skip(path, 'parse-error', String(e));
		return;
	}
	const rel = relative(ROOT, path);
	const bag: FileBag = {
		source,
		hasM: false,
		hasOrEmpty: false,
		existingM: null,
		text: [],
		attr: [],
		toast: [],
		// Program nodes carry no position, so derive the import offset from the
		// instance <script> tag end instead
		instanceImportAt:
			ast.instance && typeof ast.instance.start === 'number'
				? source.indexOf('>', ast.instance.start) + 1
				: null,
		moduleScriptEnd: typeof ast.module?.end === 'number' ? ast.module.end : null
	};

	// svelte's AST types lack an index signature; the walker only needs
	// type/start/end plus guarded dynamic access
	const root = ast as unknown as AnyNode;
	for (const node of walk(root)) {
		if (node.type === 'Fragment' && Array.isArray(node.nodes)) {
			extractFromChildren(node.nodes.filter(isNode), source, rel, (f) => bag.text.push(f));
		}
		if (Array.isArray(node.attributes)) {
			for (const a of node.attributes) {
				if (!isNode(a) || a.type !== 'Attribute' || typeof a.name !== 'string' || !TRANSLATABLE_ATTRS[a.name]) continue;
				const v = a.value;
				const first = Array.isArray(v) && v.length === 1 && isNode(v[0]) ? v[0] : null;
				const ap = pos(a);
				if (first?.type === 'Text' && typeof first.data === 'string' && /[a-zA-Z]/.test(first.data)) {
					bag.attr.push({
						text: first.data.replace(/\s+/g, ' ').trim(),
						params: [],
						attr: a.name,
						span: [ap.start, ap.end]
					});
				} else if (
					first?.type === 'ExpressionTag' &&
					isNode(first.expression) &&
					first.expression.type === 'Literal' &&
					typeof first.expression.value === 'string' &&
					/[a-zA-Z]/.test(first.expression.value)
				) {
					// title={'Static text'}
					bag.attr.push({
						text: first.expression.value.replace(/\s+/g, ' ').trim(),
						params: [],
						attr: a.name,
						span: [ap.start, ap.end]
					});
				} else if (v !== true) {
					skip(rel, 'attr-nonliteral', a.name);
				}
			}
		}
		// standalone `m` identifier anywhere in template/scripts blocks the import
		if (node.type === 'Identifier' && node.name === 'm') bag.hasM = true;
		if (node.type === 'Identifier' && node.name === 'orEmpty') bag.hasOrEmpty = true;
	}

	// toast.*('...') and label/description/title: '...' in the instance script
	if (ast.instance?.content) {
		// estree Program from svelte parse: nodes carry start/end, but the
		// Program wrapper lacks the index signature the walker needs
		const program = ast.instance.content as unknown as AnyNode;
		for (const node of walk(program)) {
			// idempotency: reuse an existing paraglide import instead of adding one
			if (node.type === 'ImportDeclaration') {
				const src = isNode(node.source) ? node.source : null;
				if (src?.type === 'Literal' && src.value === '$lib/paraglide/messages.js' && Array.isArray(node.specifiers)) {
					for (const spec of node.specifiers) {
						if (!isNode(spec) || spec.type !== 'ImportSpecifier') continue;
						const imported = isNode(spec.imported) ? spec.imported : null;
						const local = isNode(spec.local) ? spec.local : null;
						if (imported?.type === 'Identifier' && imported.name === 'm' && local?.type === 'Identifier' && typeof local.name === 'string') {
							bag.existingM = local.name;
						}
					}
				}
				continue;
			}
			const callee = isNode(node.callee) ? node.callee : null;
			const calleeObject = callee && isNode(callee.object) ? callee.object : null;
			const calleeProp = callee && isNode(callee.property) ? callee.property : null;
			const args = Array.isArray(node.arguments) ? node.arguments : null;
			const arg0 = args && isNode(args[0]) ? args[0] : null;
			if (
				node.type === 'CallExpression' &&
				callee?.type === 'MemberExpression' &&
				calleeObject?.type === 'Identifier' &&
				calleeObject.name === 'toast' &&
				calleeProp?.type === 'Identifier' &&
				typeof calleeProp.name === 'string' &&
				TOAST_METHODS[calleeProp.name] &&
				arg0?.type === 'Literal' &&
				typeof arg0.value === 'string' &&
				/[a-zA-Z]/.test(arg0.value)
			) {
				const p = pos(arg0);
				bag.toast.push({
					text: arg0.value.replace(/\s+/g, ' ').trim(),
					params: [],
					span: [p.start, p.end]
				});
			}
			// { label: 'Visible text' } style UI config objects
			const keyNode = isNode(node.key) ? node.key : null;
			const valueNode = isNode(node.value) ? node.value : null;
			if (
				(node.type === 'Property' || node.type === 'ObjectProperty') &&
				keyNode?.type === 'Identifier' &&
				typeof keyNode.name === 'string' &&
				SCRIPT_TEXT_PROPS[keyNode.name] &&
				valueNode?.type === 'Literal' &&
				typeof valueNode.value === 'string' &&
				/[a-zA-Z]/.test(valueNode.value)
			) {
				const p = pos(valueNode);
				bag.toast.push({
					text: valueNode.value.replace(/\s+/g, ' ').trim(),
					params: [],
					span: [p.start, p.end]
				});
			}
		}
	}

	if (bag.text.length + bag.attr.length + bag.toast.length > 0) fileData.set(rel, bag);
}

// ---------- rewrite ----------

function callExpr(ns: string, key: string, params: Param[]): string {
	if (params.length === 0) return ns + '.' + key + '()';
	const args = params.map((p) => p.placeholder + ': ' + p.expr).join(', ');
	return ns + '.' + key + '({ ' + args + ' })';
}

function rewriteFile(rel: string, bag: FileBag, keyOf: (text: string) => string | undefined) {
	// Files that already use `m` (e.g. `const [y, m, d] = date.split('-')`, or a
	// template `{#each ... as m}`) get an aliased import: shadowing would be
	// legal JS, but a template-local `m` could silently change the meaning of
	// an inserted `m.key()` call, so we never rely on scoping rules.
	const needsOrEmpty = [...bag.text, ...bag.attr, ...bag.toast].some((f) => f.params.length > 0);
	if (needsOrEmpty && bag.hasOrEmpty && !bag.source.includes("from '$lib/i18n.js'")) {
		skip(rel, 'name-collision-orEmpty', 'file already uses identifier orEmpty');
		return;
	}
	const importName =
		bag.existingM ?? (bag.hasM ? (/\bm_i18n\b/.test(bag.source) ? 'm_i18n2' : 'm_i18n') : 'm');
	if (bag.hasM && !bag.existingM) skip(rel, 'aliased-import', 'identifier m in use, imported as ' + importName);
	let mImport =
		importName === 'm'
			? "import { m } from '$lib/paraglide/messages.js';"
			: "import { m as " + importName + " } from '$lib/paraglide/messages.js';";
	const orEmptyLine = "\n\timport { orEmpty } from '$lib/i18n.js';";
	const needsOrEmptyImport = needsOrEmpty && !bag.source.includes("from '$lib/i18n.js'");
	if (needsOrEmptyImport) mImport += orEmptyLine;
	const edits: { start: number; end: number; repl: string }[] = [];
	for (const f of bag.text) {
		const key = keyOf(f.text);
		if (!key) continue;
		// keep surrounding layout whitespace for a clean diff
		const raw = bag.source.slice(f.span[0], f.span[1]);
		const lead = raw.match(/^\s*/)?.[0] ?? '';
		const trail = raw.match(/\s*$/)?.[0] ?? '';
		edits.push({ start: f.span[0], end: f.span[1], repl: lead + '{' + callExpr(importName, key, f.params) + '}' + trail });
	}
	for (const f of bag.attr) {
		const key = keyOf(f.text);
		if (!key) continue;
		edits.push({ start: f.span[0], end: f.span[1], repl: f.attr + '={' + callExpr(importName, key, f.params) + '}' });
	}
	for (const f of bag.toast) {
		const key = keyOf(f.text);
		if (!key) continue;
		edits.push({ start: f.span[0], end: f.span[1], repl: callExpr(importName, key, f.params) });
	}
	if (edits.length === 0) return;

	// insert imports as a zero-width edit so every offset stays in
	// original-source coordinates; descending splice keeps all of them valid
	// even when a rewritten text node precedes the <script> tag.
	// Idempotent: files already importing m get at most the orEmpty line added.
	const importRepl = bag.existingM ? (needsOrEmptyImport ? orEmptyLine : null) : '\n\t' + mImport;
	if (importRepl !== null) {
		if (bag.instanceImportAt !== null) {
			edits.push({ start: bag.instanceImportAt, end: bag.instanceImportAt, repl: importRepl });
		} else {
			const tag = '<script lang="ts">\n\t' + mImport + '\n</' + 'script>\n\n';
			if (bag.moduleScriptEnd !== null) {
				edits.push({ start: bag.moduleScriptEnd, end: bag.moduleScriptEnd, repl: '\n\n' + tag.trimEnd() + '\n' });
			} else {
				edits.push({ start: 0, end: 0, repl: tag });
			}
		}
	}

	let out = bag.source;
	for (const e of edits.sort((a, b) => b.start - a.start)) {
		out = out.slice(0, e.start) + e.repl + out.slice(e.end);
	}
	if (!DRY_RUN) writeFileSync(rel, out);
}

// ---------- main ----------

function* svelteFiles(dir: string): Generator<string> {
	for (const entry of readdirSync(dir)) {
		if (entry === 'paraglide' || entry === 'node_modules') continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) yield* svelteFiles(full);
		else if (entry.endsWith('.svelte')) yield full;
	}
}

const en = loadEn();
// text -> key, so unchanged text keeps its existing key across re-runs
const textIndex = new Map<string, string>();
for (const [k, v] of en) textIndex.set(v, k);
const newKeys: [string, string][] = [];

for (const dir of SRC_DIRS) {
	for (const file of svelteFiles(dir)) collectFile(file);
}

let totalFound = 0;
for (const [file, bag] of fileData) {
	for (const f of [...bag.text, ...bag.attr, ...bag.toast]) {
		totalFound++;
		if (textIndex.has(f.text)) continue; // existing key reused
		let key = slugify(f.text);
		if (en.has(key) && en.get(key) !== f.text) {
			key = key + '_' + createHash('sha1').update(f.text).digest('hex').slice(0, 4);
		}
		if (en.has(key) && en.get(key) !== f.text) {
			skip(file, 'key-collision-unresolved', f.text);
			continue;
		}
		en.set(key, f.text);
		textIndex.set(f.text, key);
		newKeys.push([key, f.text]);
	}
}

// rewrite sources (no-op under --dry-run)
let rewritten = 0;
for (const [file, bag] of fileData) {
	const before = skipped.length;
	rewriteFile(file, bag, (text) => textIndex.get(text));
	if (skipped.length === before) rewritten++;
}

// ---------- report ----------

const byCat = new Map<string, number>();
for (const s of skipped) byCat.set(s.reason, (byCat.get(s.reason) ?? 0) + 1);

console.log('files with translatable content: ' + fileData.size + (DRY_RUN ? ' (dry-run, no writes)' : ', rewritten: ' + rewritten));
console.log('texts found: ' + totalFound + ', new keys: ' + newKeys.length + ', existing reused: ' + (totalFound - newKeys.length));
console.log('skipped by reason:');
for (const [r, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) console.log('  ' + r + ': ' + n);
const samples = new Map<string, string[]>();
for (const s of skipped) {
	const arr = samples.get(s.reason) ?? [];
	if (arr.length < 8) arr.push('    ' + s.file + ' :: ' + s.sample);
	samples.set(s.reason, arr);
}
for (const [r, arr] of samples) {
	console.log('  --- ' + r + ' ---');
	arr.forEach((a) => console.log(a));
}

if (!DRY_RUN && newKeys.length > 0) {
	const out: Record<string, string> = { $schema: 'https://inlang.com/schema/inlang-message-format' };
	for (const [k, v] of [...en.entries()].sort((a, b) => a[0].localeCompare(b[0]))) out[k] = v;
	writeFileSync(EN_PATH, JSON.stringify(out, null, '\t') + '\n');
	console.log('en.json updated (' + en.size + ' keys total)');
}
