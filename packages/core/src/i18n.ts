/**
 * Texto exibido ao usuário: uma string simples ou um mapa `locale → texto`
 * (ex.: `{ pt: 'Possui multas?', en: 'Any fines?' }`).
 */
export type LocalizedText = string | { readonly [locale: string]: string };

/**
 * Resolve um `LocalizedText` para uma string. Tenta `locale`, depois
 * `fallbackLocale`, depois o primeiro valor do mapa.
 */
export function resolveText(
	text: LocalizedText,
	locale?: string,
	fallbackLocale?: string,
): string {
	if (typeof text === 'string') return text;
	if (locale !== undefined && Object.hasOwn(text, locale)) {
		return text[locale] as string;
	}
	if (fallbackLocale !== undefined && Object.hasOwn(text, fallbackLocale)) {
		return text[fallbackLocale] as string;
	}
	return Object.values(text)[0] ?? '';
}
