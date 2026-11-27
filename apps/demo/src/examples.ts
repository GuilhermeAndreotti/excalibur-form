import type { LocalizedText } from '@excalibur-form/core';

export interface Example {
	readonly name: LocalizedText;
	readonly schema: unknown;
}

// Every text is in English and Brazilian Portuguese: switch the language in
// the demo toolbar to see the same schema in both.

const inspection = {
	id: 'vehicle-inspection',
	version: 1,
	title: { en: 'Vehicle inspection', pt: 'Vistoria de veículo' },
	fields: [
		{
			id: 'vehicle',
			type: 'section',
			label: { en: 'Vehicle', pt: 'Dados do veículo' },
		},
		{
			id: 'plate',
			type: 'text',
			label: { en: 'License plate', pt: 'Placa' },
			required: true,
			maxLength: 8,
		},
		{
			id: 'fuel',
			type: 'choice',
			label: { en: 'Fuel', pt: 'Combustível' },
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
				{ id: 'electric', label: { en: 'Electric', pt: 'Elétrico' } },
			],
		},
		{
			id: 'range',
			type: 'number',
			label: { en: 'Range (km)', pt: 'Autonomia (km)' },
			integer: true,
			min: 0,
			showIf: { field: 'fuel', op: 'eq', value: 'electric' },
		},
		{
			id: 'extras',
			type: 'multiChoice',
			label: { en: 'Extras', pt: 'Opcionais' },
			maxSelected: 3,
			options: [
				{
					id: 'ac',
					label: { en: 'Air conditioning', pt: 'Ar-condicionado' },
				},
				{ id: 'sunroof', label: { en: 'Sunroof', pt: 'Teto solar' } },
				{
					id: 'leather',
					label: { en: 'Leather seats', pt: 'Bancos de couro' },
				},
				{
					id: 'camera',
					label: { en: 'Rear camera', pt: 'Câmera de ré' },
				},
			],
		},
		{
			id: 'status',
			type: 'section',
			label: { en: 'Status', pt: 'Situação' },
		},
		{
			id: 'has_fines',
			type: 'boolean',
			label: { en: 'Any outstanding fines?', pt: 'Possui multas?' },
			required: true,
		},
		{
			id: 'fines_total',
			type: 'number',
			label: { en: 'Total fines amount', pt: 'Valor total das multas' },
			required: true,
			min: 0,
			showIf: { field: 'has_fines', op: 'eq', value: true },
		},
		{
			id: 'condition',
			type: 'scale',
			label: { en: 'Overall condition', pt: 'Estado geral' },
			min: 1,
			max: 10,
			minLabel: { en: 'Poor', pt: 'Ruim' },
			maxLabel: { en: 'Flawless', pt: 'Impecável' },
		},
		{
			id: 'notes',
			type: 'longText',
			label: { en: 'Notes', pt: 'Observações' },
			description: {
				en: 'Shows up when the rating is 5 or lower.',
				pt: 'Aparece quando a nota é 5 ou menos.',
			},
			required: true,
			showIf: { field: 'condition', op: 'lte', value: 5 },
		},
	],
};

const character = {
	id: 'character-sheet',
	version: 1,
	title: { en: 'Character sheet', pt: 'Ficha de personagem' },
	fields: [
		{
			id: 'name',
			type: 'text',
			label: { en: 'Character name', pt: 'Nome do personagem' },
			required: true,
		},
		{
			id: 'class',
			type: 'choice',
			label: { en: 'Class', pt: 'Classe' },
			required: true,
			options: [
				{ id: 'warrior', label: { en: 'Warrior', pt: 'Guerreiro' } },
				{ id: 'wizard', label: { en: 'Wizard', pt: 'Mago' } },
				{ id: 'rogue', label: { en: 'Rogue', pt: 'Ladino' } },
			],
		},
		{
			id: 'level',
			type: 'number',
			label: { en: 'Level', pt: 'Nível' },
			integer: true,
			min: 1,
			max: 20,
			required: true,
		},
		{
			id: 'school',
			type: 'choice',
			label: { en: 'School of magic', pt: 'Escola de magia' },
			showIf: { field: 'class', op: 'eq', value: 'wizard' },
			options: [
				{ id: 'evocation', label: { en: 'Evocation', pt: 'Evocação' } },
				{ id: 'illusion', label: { en: 'Illusion', pt: 'Ilusão' } },
			],
		},
		{
			id: 'skills',
			type: 'multiChoice',
			label: { en: 'Skills', pt: 'Perícias' },
			minSelected: 1,
			maxSelected: 2,
			options: [
				{ id: 'stealth', label: { en: 'Stealth', pt: 'Furtividade' } },
				{
					id: 'athletics',
					label: { en: 'Athletics', pt: 'Atletismo' },
				},
				{ id: 'arcana', label: { en: 'Arcana', pt: 'Arcanismo' } },
				{
					id: 'perception',
					label: { en: 'Perception', pt: 'Percepção' },
				},
			],
		},
		{
			id: 'sneaky',
			type: 'section',
			label: { en: 'Sneaky rogue', pt: 'Ladino furtivo' },
			description: {
				en: 'This section shows up for rogues with Stealth.',
				pt: 'Esta seção aparece pra ladinos com Furtividade.',
			},
			showIf: {
				all: [
					{ field: 'class', op: 'eq', value: 'rogue' },
					{ field: 'skills', op: 'includes', value: 'stealth' },
				],
			},
		},
		{
			id: 'backstory',
			type: 'longText',
			label: { en: 'Backstory', pt: 'História' },
			maxLength: 500,
		},
	],
};

const survey = {
	id: 'satisfaction-survey',
	version: 3,
	title: { en: 'Satisfaction survey', pt: 'Pesquisa de satisfação' },
	fields: [
		{
			id: 'nps',
			type: 'scale',
			label: {
				en: 'How likely are you to recommend us?',
				pt: 'Quanto você recomendaria a gente?',
			},
			min: 0,
			max: 10,
			required: true,
		},
		{
			id: 'improve',
			type: 'longText',
			label: {
				en: 'What could we improve?',
				pt: 'O que podemos melhorar?',
			},
			showIf: { field: 'nps', op: 'lt', value: 7 },
		},
		{
			id: 'contact',
			type: 'boolean',
			label: {
				en: 'May we contact you?',
				pt: 'Podemos entrar em contato?',
			},
		},
		{
			id: 'email',
			type: 'text',
			format: 'email',
			label: { en: 'Your email', pt: 'Seu e-mail' },
			required: true,
			showIf: { field: 'contact', op: 'eq', value: true },
		},
	],
};

export const EXAMPLES: readonly Example[] = [
	{
		name: { en: 'Vehicle inspection', pt: 'Vistoria de veículo' },
		schema: inspection,
	},
	{
		name: { en: 'RPG character sheet', pt: 'Ficha de RPG' },
		schema: character,
	},
	{
		name: { en: 'Satisfaction survey', pt: 'Pesquisa de satisfação' },
		schema: survey,
	},
];
