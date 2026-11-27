import {
	createDisplayContext,
	type DisplayLabels,
	type FieldBase,
	type Form,
	type FormSchema,
	type SectionField,
	type ValidationError,
} from '@excalibur-form/core';
import {
	useEffect,
	useId,
	useRef,
	type ComponentType,
	type ReactNode,
} from 'react';

import {
	FieldWrapper as DefaultFieldWrapper,
	type FieldComponents,
	type FieldInputProps,
	type FieldWrapperProps,
	type SectionProps,
} from './components.tsx';
import { defaultComponents } from './default-components.ts';
import { defaultErrorMessage } from './messages.ts';
import {
	useExcaliburForm,
	type ExcaliburFormController,
	type UseExcaliburFormOptions,
} from './use-excalibur-form.ts';

export interface FormRendererBaseProps {
	/** Replaces the component of one or more types (the rest use the defaults). */
	readonly components?: FieldComponents;
	/** Replaces the field frame (label, description, errors). */
	readonly FieldWrapper?: ComponentType<FieldWrapperProps>;
	/** Language for the schema texts and the default messages. */
	readonly locale?: string;
	readonly fallbackLocale?: string;
	/** Overrides "Yes"/"No" and the like. */
	readonly labels?: Partial<DisplayLabels>;
	/** Message for each error. Default: `defaultErrorMessage` in en/pt/es. */
	readonly formatError?: (
		error: ValidationError,
		locale: string | undefined,
	) => string;
	/** Default button text. Default: "Submit" (or its equivalent in the language). */
	readonly submitLabel?: string;
	/** Replaces the default button (e.g. with your own buttons). */
	readonly children?: ReactNode;
	readonly disabled?: boolean;
	readonly className?: string;
	/** Focuses the first invalid field when a submit fails. Default: `true`. */
	readonly focusOnError?: boolean;
}

export type FormRendererProps<S extends FormSchema = FormSchema> =
	FormRendererBaseProps &
		(
			| {
					/** State from `useExcaliburForm` (to read/control it from outside). */
					readonly controller: ExcaliburFormController<S>;
			  }
			| ({ readonly form: Form<S> } & UseExcaliburFormOptions<S>)
		);

/** Built-in types whose input has several controls (uses `<fieldset>`). */
const GROUP_TYPES: ReadonlySet<string> = new Set([
	'boolean',
	'choice',
	'multiChoice',
	'scale',
]);

const SUBMIT_LABELS: Readonly<Record<string, string>> = {
	en: 'Submit',
	pt: 'Enviar',
	es: 'Enviar',
};

function submitLabelFor(locale: string | undefined): string {
	const language = locale?.toLowerCase().split(/[-_]/)[0] ?? 'en';
	return Object.hasOwn(SUBMIT_LABELS, language)
		? (SUBMIT_LABELS[language] as string)
		: 'Submit';
}

/**
 * Renders a whole form: visible fields, errors and the submit button.
 * Pass `form` (plus the hook options) or a `controller` from `useExcaliburForm`.
 */
export function FormRenderer<S extends FormSchema>(
	props: FormRendererProps<S>,
): ReactNode {
	return 'controller' in props ? (
		<FormView {...props} />
	) : (
		<UncontrolledFormRenderer {...props} />
	);
}

function UncontrolledFormRenderer<S extends FormSchema>(
	props: FormRendererBaseProps & {
		readonly form: Form<S>;
	} & UseExcaliburFormOptions<S>,
): ReactNode {
	const controller = useExcaliburForm(props.form, props);
	return <FormView {...props} controller={controller} />;
}

function FormView<S extends FormSchema>(
	props: FormRendererBaseProps & {
		readonly controller: ExcaliburFormController<S>;
	},
): ReactNode {
	const { controller, locale, fallbackLocale } = props;
	const prefix = useId();
	const formRef = useRef<HTMLFormElement>(null);
	const display = createDisplayContext({
		locale,
		fallbackLocale,
		labels: props.labels,
	});
	const components = { ...defaultComponents, ...props.components };
	const Wrapper = props.FieldWrapper ?? DefaultFieldWrapper;
	const formatError = props.formatError ?? defaultErrorMessage;
	const disabled = props.disabled === true || controller.isSubmitting;

	// After an invalid submit, move focus to the first invalid field.
	const { submitCount, result } = controller;
	const lastSubmit = useRef(submitCount);
	useEffect(() => {
		if (submitCount === lastSubmit.current) return;
		lastSubmit.current = submitCount;
		if (result.ok || props.focusOnError === false) return;
		formRef.current
			?.querySelector<HTMLElement>('[aria-invalid="true"]')
			?.focus();
	}, [submitCount, result, props.focusOnError]);

	const renderField = (field: FieldBase): ReactNode => {
		const state = controller.fieldState(field.id);
		if (!state.visible) return null;
		const Component = components[field.type];
		if (Component === undefined) return null;

		if (field.type === 'section') {
			const SectionComponent = Component as ComponentType<SectionProps>;
			return (
				<SectionComponent
					key={field.id}
					field={field as SectionField}
					title={display.text(field.label)}
					description={
						field.description === undefined
							? undefined
							: display.text(field.description)
					}
				/>
			);
		}

		const Input = Component as ComponentType<FieldInputProps>;
		const id = `${prefix}-${field.id}`;
		const descriptionId = `${id}-description`;
		const errorId = `${id}-errors`;
		const errors = state.errors.map((error) => formatError(error, locale));
		const describedBy =
			[
				field.description === undefined ? undefined : descriptionId,
				errors.length > 0 ? errorId : undefined,
			]
				.filter((part) => part !== undefined)
				.join(' ') || undefined;
		const required = field.required === true;
		return (
			<Wrapper
				key={field.id}
				field={field}
				id={id}
				label={display.text(field.label)}
				description={
					field.description === undefined
						? undefined
						: display.text(field.description)
				}
				descriptionId={descriptionId}
				errors={errors}
				errorId={errorId}
				required={required}
				group={
					GROUP_TYPES.has(field.type) ||
					(Input as { group?: boolean }).group === true
				}
			>
				<Input
					field={field}
					id={id}
					value={state.value}
					onChange={state.onChange}
					onBlur={state.onBlur}
					invalid={state.invalid}
					required={required}
					disabled={disabled}
					describedBy={describedBy}
					t={display.text}
					labels={display.labels}
					locale={locale}
				/>
			</Wrapper>
		);
	};

	const formErrors = controller.errors.get('') ?? [];
	return (
		<form
			ref={formRef}
			className={props.className ?? 'ef-form'}
			noValidate
			onSubmit={(event) => void controller.handleSubmit(event)}
		>
			{controller.form.schema.fields.map(renderField)}
			{formErrors.length > 0 && (
				<div className="ef-errors" role="alert">
					{formErrors.map((error) => (
						<p key={error.code} className="ef-error">
							{formatError(error, locale)}
						</p>
					))}
				</div>
			)}
			{props.children ?? (
				<button type="submit" className="ef-submit" disabled={disabled}>
					{props.submitLabel ?? submitLabelFor(locale)}
				</button>
			)}
		</form>
	);
}
