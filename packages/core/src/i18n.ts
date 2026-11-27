/**
 * Texto exibido ao usuário: uma string simples ou um mapa `locale → texto`
 * (ex.: `{ pt: 'Possui multas?', en: 'Any fines?' }`).
 */
export type LocalizedText = string | { readonly [locale: string]: string };

function pick(
	text: { readonly [locale: string]: string },
	locale: string | undefined,
): string | undefined {
	if (locale === undefined) return undefined;
	if (Object.hasOwn(text, locale)) return text[locale];
	// `pt-BR` cai em `pt`.
	const language = locale.split(/[-_]/)[0] ?? '';
	return language !== locale && Object.hasOwn(text, language)
		? text[language]
		: undefined;
}

/**
 * Resolve um `LocalizedText` para uma string. Tenta `locale` (e o idioma sem
 * região, `pt-BR` → `pt`), depois `fallbackLocale`, depois o primeiro valor.
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
