import type { BooleanField, SectionField } from '../../schema/types.ts';
import { accept, reject } from '../../validation/errors.ts';
import { isNullish, type FieldTypeDefinition } from '../definition.ts';

export const booleanFieldType: FieldTypeDefinition<BooleanField, boolean> = {
	type: 'boolean',
	answerable: true,
	conditionOps: ['eq', 'neq', 'answered', 'notAnswered'],
	parseConfig: () => ({}),
	isEmpty: isNullish,
	validate: (value) =>
		typeof value === 'boolean' ? accept(value) : reject('invalid_type'),
	isValidConditionValue: (_field, value) => typeof value === 'boolean',
};

export const sectionFieldType: FieldTypeDefinition<SectionField, never> = {
	type: 'section',
	answerable: false,
	conditionOps: [],
	parseConfig: () => ({}),
	isEmpty: () => true,
	validate: () => reject('invalid_type'),
};
