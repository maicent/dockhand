/**
 * Display-value fallback for i18n message params.
 *
 * Message params are typed as non-nullish; optional properties and computed
 * access can be undefined at runtime. Wrap interpolated values with this so
 * undefined/null render as empty string while 0 and '' pass through intact.
 */
export function orEmpty<T>(value: T): NonNullable<T> | '' {
	return value ?? '';
}
