#!/usr/bin/env bun
/**
 * Map an upstream i18n en.json (Hellraiser28 layout: key -> English text,
 * possibly ICU plural arrays) onto our fork's English->zh-CN dictionary
 * (keyed by deterministic text slugs). Emits zh-CN.json in upstream key
 * order, plus a coverage report. Texts without a dictionary hit fall back
 * to OVERRIDES (hand translations), then are listed as missing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const [targetEnPath, outPath, overridesPath] = process.argv.slice(2);
if (!targetEnPath || !outPath) {
	console.error('usage: i18n-map.ts <target-en.json> <out-zh-CN.json> [overrides.json]');
	process.exit(1);
}
const externalOverrides = overridesPath
	? JSON.parse(readFileSync(overridesPath, 'utf8'))
	: {};

// text -> zh, from our fork's i18n branch dictionaries
const ourEn = JSON.parse(execSync('git show i18n:src/messages/en.json', { encoding: 'utf8' }));
const ourZh = JSON.parse(execSync('git show i18n:src/messages/zh-CN.json', { encoding: 'utf8' }));
const textToZh = new Map<string, string>();
for (const [key, enText] of Object.entries(ourEn)) {
	if (key === '$schema') continue;
	const zh = ourZh[key];
	if (typeof enText === 'string' && typeof zh === 'string' && !textToZh.has(enText)) {
		textToZh.set(enText, zh);
	}
}

// Hand translations for texts our fork never had (his PR reworded/added these)
// and context fixes where the same English needs a different zh under his keys.
const INLINE_OVERRIDES: Record<string, string> = {
	'Reorder {label}': '重新排序 {label}',
	'Show {label}': '显示 {label}',
	'Hide {label}': '隐藏 {label}',
	'Login failed': '登录失败',
	'An unexpected error occurred': '发生意外错误',
	'Failed to initiate SSO login': '无法发起 SSO 登录',
	'Passkey login is unavailable': '通行密钥登录不可用',
	'Passkey login failed': '通行密钥登录失败',
	'Passkey sign-in was cancelled or timed out': '通行密钥登录已取消或超时',
	'Continue with {provider}': '通过 {provider} 继续',
	'Verifying...': '正在验证…',
	'Signing in...': '正在登录…',
	Verify: '验证',
	'Sign in': '登录',
	'Environment {id}': '环境 {id}',
	'Cannot switch to "{name}" - environment is offline': '无法切换到「{name}」——环境离线',
	'Cannot switch to "{name}" - {error}': '无法切换到「{name}」:{error}',
	'Cannot switch to "{name}" - connection failed': '无法切换到「{name}」——连接失败',
	'{count} core': '{count} 核',
	'{count} cores': '{count} 核',
	'Live updates connected': '实时更新已连接',
	'Live updates disconnected': '实时更新已断开',
	'{timezone} - data refreshed at {time}': '{timezone} · 数据刷新于 {time}',
	'Theme: system': '主题:跟随系统',
	'Theme: dark': '主题:深色',
	'Theme: light': '主题:浅色',
	Confirm: '确认',
	connections: '连接',
	'{filtered} of {total}': '{filtered} / {total}',
	'Unlock tiles': '解锁磁贴',
	'Lock tiles': '锁定磁贴',
	'Edge connection': 'Edge 连接',
	'Unknown host': '未知主机',
	'Auto-update enabled': '已启用自动更新',
	'Update check enabled (notify only)': '已启用更新检查(仅通知)',
	'Images: {size}': '镜像:{size}',
	'Containers: {size}': '容器:{size}',
	'Volumes: {size}': '数据卷:{size}',
	'Build cache: {size}': '构建缓存:{size}',
	'{count} today': '今日 {count} 条',
	'{count} total': '共 {count} 条',
	now: '刚刚',
	'{count}m': '{count} 分钟',
	'{count}h': '{count} 小时',
	'{count}d': '{count} 天',
	'{count} unhealthy': '{count} 个不健康',
	'{count} restarting': '{count} 个重启中',
	'Switch environment': '切换环境',
	'Global default ({page})': '全局默认({page})',
	'Live updates active - grid will auto-refresh': '实时更新已启用——表格将自动刷新',
	'Connecting to live updates...': '正在连接实时更新…'
};
const OVERRIDES: Record<string, string> = { ...INLINE_OVERRIDES, ...externalOverrides };

// Auxiliary fallback indexes:
// 1) case-insensitive text match, 2) placeholder-name-normalized match
// (our codemod emits {arg1}..., upstream hand-writes {name}...; remap by
// position of appearance in the English source).
const lowerToZh = new Map<string, string>();
const skelToEntry = new Map<string, { enNames: string[]; zh: string }>();
const ph = /(?<!\\)\{([a-zA-Z_][\w]*)\}/g;
for (const [text, zh] of textToZh) {
	const lower = text.toLowerCase();
	if (!lowerToZh.has(lower)) lowerToZh.set(lower, zh);
	const enNames = [...text.matchAll(ph)].map((m) => m[1]);
	const skel = text.replace(ph, '{}');
	if (!skelToEntry.has(skel)) skelToEntry.set(skel, { enNames, zh });
}

function zhFor(text: string): string | null {
	if (OVERRIDES[text]) return OVERRIDES[text];
	const exact = textToZh.get(text);
	if (exact) return exact;
	const lower = lowerToZh.get(text.toLowerCase());
	if (lower) return lower;
	const targetNames = [...text.matchAll(ph)].map((m) => m[1]);
	const entry = skelToEntry.get(text.replace(ph, '{}'));
	if (entry && entry.enNames.length === targetNames.length) {
		let zh = entry.zh;
		entry.enNames.forEach((n, i) => {
			zh = zh.replaceAll(`{${n}}`, `{${targetNames[i]}}`);
		});
		return zh;
	}
	return null;
}

type PluralMsg = Array<{ declarations?: string[]; selectors?: string[]; match: Record<string, string> }>;

const en = JSON.parse(readFileSync(targetEnPath, 'utf8'));
const out: Record<string, unknown> = { $schema: en.$schema };
const missing: string[] = [];
let mapped = 0;
let plural = 0;

for (const [key, msg] of Object.entries(en)) {
	if (key === '$schema') continue;
	if (typeof msg === 'string') {
		const zh = zhFor(msg);
		if (zh == null) missing.push(`${key}: ${msg}`);
		else {
			out[key] = zh;
			mapped++;
		}
	} else if (Array.isArray(msg)) {
		// ICU plural/select: translate every variant's text
		const variants = msg as PluralMsg;
		const match: Record<string, string> = {};
		let ok = true;
		for (const v of variants) {
			for (const [cond, text] of Object.entries(v.match)) {
				const zh = zhFor(text);
				if (zh == null) {
					ok = false;
					missing.push(`${key}[${cond}]: ${text}`);
				} else match[cond] = zh;
			}
		}
		if (ok) {
			out[key] = variants.map((v) => ({ ...v, match }));
			mapped++;
			plural++;
		}
	}
}

writeFileSync(outPath, JSON.stringify(out, null, '\t') + '\n');
console.log(`total: ${Object.keys(en).length - 1}, mapped: ${mapped} (plural: ${plural}), missing: ${missing.length}`);
for (const m of missing) console.log(`  MISSING ${m}`);
