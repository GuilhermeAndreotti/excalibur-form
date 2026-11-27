import {
	scaleBounds,
	type BooleanField,
	type ChoiceField,
	type DisplayLabels,
	type FieldBase,
	type LocalizedText,
	type LongTextField,
	type MultiChoiceField,
	type NumberField,
	type ScaleField,
	type SectionField,
	type TextField,
} from '@excalibur-form/core';
import { useState, type ComponentType, type ReactNode } from 'react';

/** Props que o componente de entrada de um tipo de campo recebe. */
export interface FieldInputProps<F extends FieldBase = FieldBase> {
	readonly field: F;
	/** `id` do elemento principal (o `<label>` aponta pra ele). */
	readonly id: string;
	readonly value: unknown;
	readonly onChange: (value: unknown) => void;
	readonly onBlur: () => void;
	readonly invalid: boolean;
	readonly required: boolean;
	readonly disabled: boolean;
	/** Ids da descrição e dos erros, pra `aria-describedby`. */
	readonly describedBy: string | undefined;
	/** Resolve um `LocalizedText` no idioma atual. */
	readonly t: (text: LocalizedText) => string;
	readonly labels: DisplayLabels;
	readonly locale: string | undefined;
}

export interface SectionProps {
	readonly field: SectionField;
	readonly title: string;
	readonly description: string | undefined;
}

/** Moldura de um campo: label, descrição, o input e os erros. */
export interface FieldWrapperProps {
	readonly field: FieldBase;
	readonly id: string;
	readonly label: string;
	readonly description: string | undefined;
	readonly descriptionId: string;
	readonly errors: readonly string[];
	readonly errorId: string;
	readonly required: boolean;
	/**
	 * `true` quando o input tem vários controles (radios, checkboxes): a
	 * moldura padrão usa `<fieldset>`/`<legend>` em vez de `<label>`.
	 */
	readonly group: boolean;
	readonly children: ReactNode;
}

/**
 * Componentes por tipo de campo. `section` recebe `SectionProps`; os demais,
 * `FieldInputProps`. Tipos customizados entram pelo nome do tipo.
 */
export type FieldComponents = {
	readonly text?: ComponentType<FieldInputProps<TextField>>;
	readonly longText?: ComponentType<FieldInputProps<LongTextField>>;
	readonly number?: ComponentType<FieldInputProps<NumberField>>;
	readonly boolean?: ComponentType<FieldInputProps<BooleanField>>;
	readonly choice?: ComponentType<FieldInputProps<ChoiceField>>;
	readonly multiChoice?: ComponentType<FieldInputProps<MultiChoiceField>>;
	readonly scale?: ComponentType<FieldInputProps<ScaleField>>;
	readonly section?: ComponentType<SectionProps>;
} & {
	readonly [type: string]:
		| ComponentType<FieldInputProps<never>>
		| ComponentType<SectionProps>
		| undefined;
};

function aria(props: FieldInputProps) {
	return {
		'aria-invalid': props.invalid || undefined,
		'aria-required': props.required || undefined,
		'aria-describedby': props.describedBy,
	};
}

export function TextInput(props: FieldInputProps<TextField>): ReactNode {
	const { field, id, value, onChange, onBlur, disabled, t } = props;
	const type =
		field.format === 'email'
			? 'email'
			: field.format === 'url'
				? 'url'
				: 'text';
	return (
		<input
			id={id}
			name={field.id}
			className="ef-input"
			type={type}
			value={typeof value === 'string' ? value : ''}
			placeholder={
				field.placeholder === undefined
					? undefined
					: t(field.placeholder)
			}
			maxLength={field.maxLength}
			disabled={disabled}
			onChange={(e) => onChange(e.target.value)}
			onBlur={onBlur}
			{...aria(props)}
		/>
	);
}

export function LongTextInput(
	props: FieldInputProps<LongTextField>,
): ReactNode {
	const { field, id, value, onChange, onBlur, disabled, t } = props;
	return (
		<textarea
			id={id}
			name={field.id}
			className="ef-input"
			rows={4}
			value={typeof value === 'string' ? value : ''}
			placeholder={
				field.placeholder === undefined
					? undefined
					: t(field.placeholder)
			}
			maxLength={field.maxLength}
			disabled={disabled}
			onChange={(e) => onChange(e.target.value)}
			onBlur={onBlur}
			{...aria(props)}
		/>
	);
}

const toDraft = (value: unknown): string =>
	typeof value === 'number' && !Number.isNaN(value) ? String(value) : '';

export function NumberInput(props: FieldInputProps<NumberField>): ReactNode {
	const { field, id, value, onChange, onBlur, disabled, t } = props;
	// O texto digitado fica local: "1." ou "-" ainda não são números.
	const [draft, setDraft] = useState(() => toDraft(value));
	// Valor trocado de fora (reset, rascunho carregado): ajusta o texto.
	const [seen, setSeen] = useState(value);
	if (!Object.is(seen, value)) {
		setSeen(value);
		const sameNumber =
			draft === '' ? value === undefined : Number(draft) === value;
		if (!sameNumber) setDraft(toDraft(value));
	}
	return (
		<input
			id={id}
			name={field.id}
			className="ef-input"
			type="number"
			inputMode={field.integer === true ? 'numeric' : 'decimal'}
			step={field.integer === true ? 1 : 'any'}
			min={field.min}
			max={field.max}
			value={draft}
			placeholder={
				field.placeholder === undefined
					? undefined
					: t(field.placeholder)
			}
			disabled={disabled}
			onChange={(e) => {
				const raw = e.target.value;
				setDraft(raw);
				// Entrada que o browser não entende vira NaN: a validação
				// acusa "valor inválido" em vez de tratar como vazio.
				onChange(
					raw === ''
						? e.target.validity.badInput
							? Number.NaN
							: undefined
						: Number(raw),
				);
			}}
			onBlur={onBlur}
			{...aria(props)}
		/>
	);
}

interface RadioOption {
	readonly key: string;
	readonly value: unknown;
	readonly label: ReactNode;
}

function RadioGroup({
	props,
	options,
	className,
}: {
	props: FieldInputProps;
	options: readonly RadioOption[];
	className: string;
}): ReactNode {
	const { id, value, onChange, onBlur, disabled } = props;
	return (
		<div className={className}>
			{options.map((option, index) => (
				<label key={option.key} className="ef-option">
					<input
						// O primeiro recebe o id: é ele que ganha foco em erro.
						id={index === 0 ? id : `${id}-${option.key}`}
						type="radio"
						name={id}
						value={option.key}
						checked={Object.is(value, option.value)}
						disabled={disabled}
						onChange={() => onChange(option.value)}
						onBlur={onBlur}
						{...aria(props)}
					/>
					<span>{option.label}</span>
				</label>
			))}
		</div>
	);
}

export function BooleanInput(props: FieldInputProps<BooleanField>): ReactNode {
	return (
		<RadioGroup
			props={props}
			className="ef-options ef-boolean"
			options={[
				{ key: 'true', value: true, label: props.labels.yes },
				{ key: 'false', value: false, label: props.labels.no },
			]}
		/>
	);
}

export function ChoiceInput(props: FieldInputProps<ChoiceField>): ReactNode {
	return (
		<RadioGroup
			props={props}
			className="ef-options"
			options={props.field.options.map((option) => ({
				key: option.id,
				value: option.id,
				label: props.t(option.label),
			}))}
		/>
	);
}

export function MultiChoiceInput(
	props: FieldInputProps<MultiChoiceField>,
): ReactNode {
	const { field, id, value, onChange, onBlur, disabled, t } = props;
	const selected = new Set(
		Array.isArray(value)
			? value.filter((v): v is string => typeof v === 'string')
			: [],
	);
	return (
		<div className="ef-options">
			{field.options.map((option, index) => (
				<label key={option.id} className="ef-option">
					<input
						id={index === 0 ? id : `${id}-${option.id}`}
						type="checkbox"
						name={id}
						value={option.id}
						checked={selected.has(option.id)}
						disabled={disabled}
						onChange={(e) => {
							const next = new Set(selected);
							if (e.target.checked) next.add(option.id);
							else next.delete(option.id);
							// Na ordem das opções, não na ordem dos cliques.
							onChange(
								field.options
									.map((o) => o.id)
									.filter((optionId) => next.has(optionId)),
							);
						}}
						onBlur={onBlur}
						{...aria(props)}
					/>
					<span>{t(option.label)}</span>
				</label>
			))}
		</div>
	);
}

export function ScaleInput(props: FieldInputProps<ScaleField>): ReactNode {
	const { field, t } = props;
	const { min, max } = scaleBounds(field);
	const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
	return (
		<div className="ef-scale">
			{field.minLabel !== undefined && (
				<span className="ef-scale-label">{t(field.minLabel)}</span>
			)}
			<RadioGroup
				props={props}
				className="ef-options ef-scale-steps"
				options={steps.map((step) => ({
					key: String(step),
					value: step,
					label: step,
				}))}
			/>
			{field.maxLabel !== undefined && (
				<span className="ef-scale-label">{t(field.maxLabel)}</span>
			)}
		</div>
	);
}

export function Section({ title, description }: SectionProps): ReactNode {
	return (
		<div className="ef-section">
			<h3>{title}</h3>
			{description !== undefined && <p>{description}</p>}
		</div>
	);
}

export function FieldWrapper(props: FieldWrapperProps): ReactNode {
	const { id, label, description, descriptionId, errors, errorId } = props;
	const labelContent = (
		<>
			{label}
			{props.required && (
				<span className="ef-required" aria-hidden="true">
					{' *'}
				</span>
			)}
		</>
	);
	const rest = (
		<>
			{description !== undefined && (
				<p id={descriptionId} className="ef-description">
					{description}
				</p>
			)}
			{props.children}
			<div id={errorId} className="ef-errors" aria-live="polite">
				{errors.map((message) => (
					<p key={message} className="ef-error">
						{message}
					</p>
				))}
			</div>
		</>
	);
	const invalid = errors.length > 0 || undefined;
	return props.group ? (
		<fieldset className="ef-field" data-invalid={invalid}>
			<legend className="ef-label">{labelContent}</legend>
			{rest}
		</fieldset>
	) : (
		<div className="ef-field" data-invalid={invalid}>
			<label htmlFor={id} className="ef-label">
				{labelContent}
			</label>
			{rest}
		</div>
	);
}
