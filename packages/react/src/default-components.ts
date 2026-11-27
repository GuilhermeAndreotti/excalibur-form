import {
	BooleanInput,
	ChoiceInput,
	LongTextInput,
	MultiChoiceInput,
	NumberInput,
	ScaleInput,
	Section,
	TextInput,
	type FieldComponents,
} from './components.tsx';

/** Componentes padrão de cada tipo nativo. */
export const defaultComponents: FieldComponents = Object.freeze({
	text: TextInput,
	longText: LongTextInput,
	number: NumberInput,
	boolean: BooleanInput,
	choice: ChoiceInput,
	multiChoice: MultiChoiceInput,
	scale: ScaleInput,
	section: Section,
});
