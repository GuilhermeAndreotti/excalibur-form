/**
 * User-facing text: a plain string or a `locale → text` map
 * (e.g. `{ en: 'Any fines?', pt: 'Possui multas?' }`).
 */
export type LocalizedText = string | { readonly [locale: string]: string };

function pick(
	text: { readonly [locale: string]: string },
	locale: string | undefined,
): string | undefined {
	if (locale === undefined) return undefined;
	if (Object.hasOwn(text, locale)) return text[locale];
	// `pt-BR` falls back to `pt`.
	const language = locale.split(/[-_]/)[0] ?? '';
	return language !== locale && Object.hasOwn(text, language)
		? text[language]
		: undefined;
}

/**
 * Resolves a `LocalizedText` to a string. Tries `locale` (and its language
 * without region, `pt-BR` → `pt`), then `fallbackLocale`, then the first value.
 */
export function resolveText(
	text: LocalizedText,
	locale?: string,
	fallbackLocale?: string,
): string {
	if (typeof text === 'string') return text;
	return (
		pick(text, locale) ??
		pick(text, fallbackLocale) ??
		Object.values(text)[0] ??
		''
	);
}
