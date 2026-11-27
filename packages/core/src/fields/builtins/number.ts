import { formatNumber } from '../../export/display.ts';
import { stripUndefined } from '../../internal/guards.ts';
import type { NumberField, ScaleField } from '../../schema/types.ts';
import { accept, reject } from '../../validation/errors.ts';
import { isNullish, type FieldTypeDefinition } from '../definition.ts';

const NUMERIC_OPS = [
	'eq',
	'neq',
	'gt',
	'gte',
	'lt',
	'lte',
	'in',
	'notIn',
	'answered',
	'notAnswered',
] as const;

export const numberFieldType: FieldTypeDefinition<NumberField, number> = {
	type: 'number',
	answerable: true,
	conditionOps: NUMERIC_OPS,
	parseConfig(reader) {
		const min = reader.number('min');
		const max = reader.number('max');
		if (min !== undefined && max !== undefined && min > max) {
			reader.issue('min', 'invalid_value', 'min > max');
		}
		return stripUndefined({
			min,
			max,
			integer: reader.boolean('integer'),
			placeholder: reader.text('placeholder'),
		});
	},
	isEmpty: isNullish,
	validate(value, field) {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return reject('invalid_type');
		}
		if (field.integer === true && !Number.isInteger(value)) {
			return reject('not_integer');
		}
		if (field.min !== undefined && value < field.min) {
			return reject('too_small', { min: field.min });
		}
		if (field.max !== undefined && value > field.max) {
			return reject('too_big', { max: field.max });
		}
		return accept(value);
	},
	isValidConditionValue: (_field, value) =>
		typeof value === 'number' && Number.isFinite(value),
	toDisplay: (value, _field, context) => formatNumber(value, context),
};

export const SCALE_DEFAULT_MIN = 1;
export const SCALE_DEFAULT_MAX = 5;

export function scaleBounds(field: ScaleField): { min: number; max: number } {
	return {
		min: field.min ?? SCALE_DEFAULT_MIN,
		max: field.max ?? SCALE_DEFAULT_MAX,
	};
}

export const scaleFieldType: FieldTypeDefinition<ScaleField, number> = {
	type: 'scale',
	answerable: true,
	conditionOps: NUMERIC_OPS,
	parseConfig(reader) {
		const min = reader.number('min', { integer: true });
		const max = reader.number('max', { integer: true });
		const effectiveMin = min ?? SCALE_DEFAULT_MIN;
		const effectiveMax = max ?? SCALE_DEFAULT_MAX;
		const steps = effectiveMax - effectiveMin;
		if (steps < 1) {
			reader.issue(
				'max',
				'invalid_value',
				'max must be greater than min',
			);
		} else if (steps > reader.limits.maxScaleSteps) {
			reader.issue(
				'max',
				'too_many',
				`scale can have at most ${reader.limits.maxScaleSteps} steps`,
			);
		}
		return stripUndefined({
			min,
			max,
			minLabel: reader.text('minLabel'),
			maxLabel: reader.text('maxLabel'),
		});
	},
	isEmpty: isNullish,
	validate(value, field) {
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return reject('invalid_type');
		}
		if (!Number.isInteger(value)) return reject('not_integer');
		const { min, max } = scaleBounds(field);
		if (value < min) return reject('too_small', { min });
		if (value > max) return reject('too_big', { max });
		return accept(value);
	},
	isValidConditionValue: (_field, value) =>
		typeof value === 'number' && Number.isFinite(value),
	toDisplay: (value, _field, context) => formatNumber(value, context),
};
