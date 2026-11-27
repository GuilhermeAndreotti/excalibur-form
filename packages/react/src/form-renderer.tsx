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
	/** Troca o componente de um ou mais tipos (os demais usam o padrão). */
	readonly components?: FieldComponents;
	/** Troca a moldura dos campos (label, descrição, erros). */
	readonly FieldWrapper?: ComponentType<FieldWrapperProps>;
	/** Idioma dos textos do schema e das mensagens padrão. */
	readonly locale?: string;
	readonly fallbackLocale?: string;
	/** Sobrescreve "Sim"/"Não" e afins. */
	readonly labels?: Partial<DisplayLabels>;
	/** Mensagem de cada erro. Padrão: `defaultErrorMessage` em pt/en/es. */
	readonly formatError?: (
		error: ValidationError,
		locale: string | undefined,
	) => string;
	/** Texto do botão padrão. Padrão: "Enviar" (ou o equivalente no idioma). */
	readonly submitLabel?: string;
	/** Substitui o botão padrão (ex.: seus próprios botões). */
	readonly children?: ReactNode;
	readonly disabled?: boolean;
	readonly className?: string;
	/** Foca o primeiro campo com erro quando o envio falha. Padrão: `true`. */
	readonly focusOnError?: boolean;
}

export type FormRendererProps<S extends FormSchema = FormSchema> =
	FormRendererBaseProps &
		(
			| {
					/** Estado vindo de `useExcaliburForm` (pra ler/controlar de fora). */
					readonly controller: ExcaliburFormController<S>;
			  }
			| ({ readonly form: Form<S> } & UseExcaliburFormOptions<S>)
		);

/** Tipos nativos cujo input tem vários controles (usa `<fieldset>`). */
const GROUP_TYPES: ReadonlySet<string> = new Set([
	'boolean',
	'choice',
	'multiChoice',
	'scale',
]);

const SUBMIT_LABELS: Readonly<Record<string, string>> = {
	pt: 'Enviar',
	en: 'Submit',
	es: 'Enviar',
};

function submitLabelFor(locale: string | undefined): string {
	const language = locale?.toLowerCase().split(/[-_]/)[0] ?? 'pt';
	return Object.hasOwn(SUBMIT_LABELS, language)
		? (SUBMIT_LABELS[language] as string)
		: 'Enviar';
}

/**
 * Renderiza um form inteiro: campos visíveis, erros e botão de envio.
 * Passe `form` (e as opções do hook) ou um `controller` de `useExcaliburForm`.
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

	// Depois de um envio inválido, leva o foco pro primeiro campo com erro.
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
