/**
 * Limites aplicados a schemas e respostas. O schema costuma vir de usuários
 * (salvo no banco), então tudo tem teto pra não virar vetor de abuso.
 */
export interface SchemaLimits {
	/** Máximo de campos em um formulário. */
	readonly maxFields: number;
	/** Máximo de opções em `choice` / `multiChoice`. */
	readonly maxOptions: number;
	/** Tamanho máximo de labels, descrições e placeholders. */
	readonly maxTextLength: number;
	/** Máximo de idiomas em um `LocalizedText`. */
	readonly maxLocales: number;
	/** Profundidade máxima de aninhamento em `showIf`. */
	readonly maxConditionDepth: number;
	/** Máximo de nós (grupos + comparações) em um `showIf`. */
	readonly maxConditionNodes: number;
	/** Teto de caracteres de uma resposta `text`. */
	readonly maxTextAnswerLength: number;
	/** Teto de caracteres de uma resposta `longText`. */
	readonly maxLongTextAnswerLength: number;
	/** Máximo de passos em uma `scale` (`max - min`). */
	readonly maxScaleSteps: number;
}

export const DEFAULT_LIMITS: Readonly<SchemaLimits> = Object.freeze({
	maxFields: 500,
	maxOptions: 200,
	maxTextLength: 2000,
	maxLocales: 20,
	maxConditionDepth: 8,
	maxConditionNodes: 64,
	maxTextAnswerLength: 10_000,
	maxLongTextAnswerLength: 100_000,
	maxScaleSteps: 100,
});
