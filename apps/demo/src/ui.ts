// Demo interface strings. The library itself only ships error codes and a few
// defaults; everything here belongs to the demo.

export type DemoLocale = 'en' | 'pt-BR';

export const UI = {
	en: {
		tagline:
			'The form is data: edit the JSON and the form, its conditions and its validation change with it.',
		example: 'Example',
		language: 'Language',
		invalidSchema: 'Invalid schema',
		showingLastValid: ' (showing the last valid version)',
		root: '(root)',
		formFallbackTitle: 'Form',
		submit: 'Submit',
		clear: 'Clear',
		success: 'All good! See the result on the right.',
		result: 'Result',
		valid: 'valid',
		invalid: 'invalid',
		export: 'Export',
		exportHint: 'Fill in the form with no errors to see the export.',
		rawAnswers: 'Raw answers (form state)',
		visibleFields: 'Visible fields',
	},
	'pt-BR': {
		tagline:
			'O form é dado: edite o JSON e o formulário, as condições e a validação mudam junto.',
		example: 'Exemplo',
		language: 'Idioma',
		invalidSchema: 'Schema inválido',
		showingLastValid: ' (mostrando a última versão válida)',
		root: '(raiz)',
		formFallbackTitle: 'Formulário',
		submit: 'Enviar',
		clear: 'Limpar',
		success: 'Tudo certo! Veja o resultado ao lado.',
		result: 'Resultado',
		valid: 'válido',
		invalid: 'inválido',
		export: 'Exportar',
		exportHint: 'Preencha o form sem erros pra ver a exportação.',
		rawAnswers: 'Respostas cruas (estado do form)',
		visibleFields: 'Campos visíveis',
	},
} as const satisfies Record<DemoLocale, Record<string, string>>;
