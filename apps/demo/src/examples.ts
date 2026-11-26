export interface Example {
	readonly name: string;
	readonly schema: unknown;
}

const vistoria = {
	id: 'vistoria',
	version: 1,
	title: 'Vistoria de veículo',
	fields: [
		{ id: 'intro', type: 'section', label: 'Dados do veículo' },
		{
			id: 'placa',
			type: 'text',
			label: 'Placa',
			required: true,
			maxLength: 8,
		},
		{
			id: 'combustivel',
			type: 'choice',
			label: 'Combustível',
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
				{ id: 'eletrico', label: 'Elétrico' },
			],
		},
		{
			id: 'autonomia',
			type: 'number',
			label: 'Autonomia (km)',
			integer: true,
			min: 0,
			showIf: { field: 'combustivel', op: 'eq', value: 'eletrico' },
		},
		{
			id: 'opcionais',
			type: 'multiChoice',
			label: 'Opcionais',
			maxSelected: 3,
			options: [
				{ id: 'ar', label: 'Ar-condicionado' },
				{ id: 'teto', label: 'Teto solar' },
				{ id: 'couro', label: 'Bancos de couro' },
				{ id: 'camera', label: 'Câmera de ré' },
			],
		},
		{ id: 'situacao', type: 'section', label: 'Situação' },
		{
			id: 'tem_multa',
			type: 'boolean',
			label: 'Possui multas?',
			required: true,
		},
		{
			id: 'valor_multas',
			type: 'number',
			label: 'Valor total das multas (R$)',
			required: true,
			min: 0,
			showIf: { field: 'tem_multa', op: 'eq', value: true },
		},
		{
			id: 'estado',
			type: 'scale',
			label: 'Estado geral',
			min: 1,
			max: 10,
			minLabel: 'Ruim',
			maxLabel: 'Impecável',
		},
		{
			id: 'obs',
			type: 'longText',
			label: 'Observações',
			description: 'Aparece quando a nota é 5 ou menos.',
			required: true,
			showIf: { field: 'estado', op: 'lte', value: 5 },
		},
	],
};

const ficha = {
	id: 'ficha',
	version: 1,
	title: 'Ficha de personagem',
	fields: [
		{
			id: 'nome',
			type: 'text',
			label: 'Nome do personagem',
			required: true,
		},
		{
			id: 'classe',
			type: 'choice',
			label: 'Classe',
			required: true,
			options: [
				{ id: 'guerreiro', label: 'Guerreiro' },
				{ id: 'mago', label: 'Mago' },
				{ id: 'ladino', label: 'Ladino' },
			],
		},
		{
			id: 'nivel',
			type: 'number',
			label: 'Nível',
			integer: true,
			min: 1,
			max: 20,
			required: true,
		},
		{
			id: 'escola',
			type: 'choice',
			label: 'Escola de magia',
			showIf: { field: 'classe', op: 'eq', value: 'mago' },
			options: [
				{ id: 'evocacao', label: 'Evocação' },
				{ id: 'ilusao', label: 'Ilusão' },
			],
		},
		{
			id: 'pericias',
			type: 'multiChoice',
			label: 'Perícias',
			minSelected: 1,
			maxSelected: 2,
			options: [
				{ id: 'furtividade', label: 'Furtividade' },
				{ id: 'atletismo', label: 'Atletismo' },
				{ id: 'arcanismo', label: 'Arcanismo' },
				{ id: 'percepcao', label: 'Percepção' },
			],
		},
		{
			id: 'subterfugio',
			type: 'section',
			label: 'Ladino furtivo',
			description: 'Esta seção aparece pra ladinos com Furtividade.',
			showIf: {
				all: [
					{ field: 'classe', op: 'eq', value: 'ladino' },
					{ field: 'pericias', op: 'includes', value: 'furtividade' },
				],
			},
		},
		{ id: 'historia', type: 'longText', label: 'História', maxLength: 500 },
	],
};

const pesquisa = {
	id: 'pesquisa',
	version: 3,
	title: { pt: 'Pesquisa de satisfação', en: 'Satisfaction survey' },
	fields: [
		{
			id: 'nps',
			type: 'scale',
			label: {
				pt: 'Quanto você recomendaria a gente?',
				en: 'How likely are you to recommend us?',
			},
			min: 0,
			max: 10,
			required: true,
		},
		{
			id: 'motivo',
			type: 'longText',
			label: {
				pt: 'O que podemos melhorar?',
				en: 'What could we improve?',
			},
			showIf: { field: 'nps', op: 'lt', value: 7 },
		},
		{
			id: 'contato',
			type: 'boolean',
			label: {
				pt: 'Podemos entrar em contato?',
				en: 'May we contact you?',
			},
		},
		{
			id: 'email',
			type: 'text',
			format: 'email',
			label: { pt: 'Seu e-mail', en: 'Your email' },
			required: true,
			showIf: { field: 'contato', op: 'eq', value: true },
		},
	],
};

export const EXAMPLES: readonly Example[] = [
	{ name: 'Vistoria de veículo', schema: vistoria },
	{ name: 'Ficha de RPG', schema: ficha },
	{ name: 'Pesquisa (pt/en)', schema: pesquisa },
];
