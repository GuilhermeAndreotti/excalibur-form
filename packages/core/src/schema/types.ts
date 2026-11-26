import type { Condition } from '../conditions/types.ts';
import type { LocalizedText } from '../i18n.ts';

/** Propriedades que todo campo tem, de qualquer tipo (inclusive customizado). */
export interface FieldBase {
	/** ID estável (gerado pelo builder). Respostas e condições usam ele. */
	readonly id: string;
	/** Nome usado nas exportações. Padrão: o `id`. */
	readonly key?: string;
	readonly type: string;
	readonly label: LocalizedText;
	readonly description?: LocalizedText;
	readonly required?: boolean;
	/** O campo só aparece (e só é validado) quando a condição é verdadeira. */
	readonly showIf?: Condition;
}

export interface ChoiceOption {
	/** ID estável: é ele que vai na resposta, não o label. */
	readonly id: string;
	readonly label: LocalizedText;
}

export interface TextField extends FieldBase {
	readonly type: 'text';
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly format?: 'email' | 'url';
	readonly placeholder?: LocalizedText;
}

export interface LongTextField extends FieldBase {
	readonly type: 'longText';
	readonly minLength?: number;
	readonly maxLength?: number;
	readonly placeholder?: LocalizedText;
}

export interface NumberField extends FieldBase {
	readonly type: 'number';
	readonly min?: number;
	readonly max?: number;
	readonly integer?: boolean;
	readonly placeholder?: LocalizedText;
}

export interface BooleanField extends FieldBase {
	readonly type: 'boolean';
}

export interface ChoiceField extends FieldBase {
	readonly type: 'choice';
	readonly options: readonly ChoiceOption[];
}

export interface MultiChoiceField extends FieldBase {
	readonly type: 'multiChoice';
	readonly options: readonly ChoiceOption[];
	readonly minSelected?: number;
	readonly maxSelected?: number;
}

export interface ScaleField extends FieldBase {
	readonly type: 'scale';
	/** Padrão: 1. */
	readonly min?: number;
	/** Padrão: 5. */
	readonly max?: number;
	readonly minLabel?: LocalizedText;
	readonly maxLabel?: LocalizedText;
}

/** Bloco informativo (título/texto). Não tem resposta. */
export interface SectionField extends FieldBase {
	readonly type: 'section';
}

export type BuiltinField =
	| TextField
	| LongTextField
	| NumberField
	| BooleanField
	| ChoiceField
	| MultiChoiceField
	| ScaleField
	| SectionField;

export type BuiltinFieldType = BuiltinField['type'];

export interface FormSchema<F extends FieldBase = FieldBase> {
	readonly id: string;
	/** Inteiro >= 1. Incrementar quando o form mudar; respostas guardam a versão. */
	readonly version: number;
	readonly title?: LocalizedText;
	readonly description?: LocalizedText;
	readonly fields: readonly F[];
}
