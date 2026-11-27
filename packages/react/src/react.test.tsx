import {
	builtinFieldTypes,
	createRegistry,
	defineFieldType,
	defineForm,
	parseForm,
	accept,
	type FieldBase,
} from '@excalibur-form/core';
import {
	act,
	cleanup,
	render,
	renderHook,
	screen,
	waitFor,
} from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FieldInputProps } from './components.tsx';
import { FormRenderer } from './form-renderer.tsx';
import { defaultErrorMessage } from './messages.ts';
import { useExcaliburForm } from './use-excalibur-form.ts';

afterEach(cleanup);

const inspection = defineForm({
	id: 'inspection',
	version: 1,
	fields: [
		{
			id: 'intro',
			type: 'section',
			label: { en: 'Details', pt: 'Dados' },
			description: 'Fill in everything',
		},
		{
			id: 'plate',
			type: 'text',
			label: { en: 'Plate', pt: 'Placa' },
			required: true,
			description: 'Letters and digits only',
		},
		{ id: 'email', type: 'text', label: 'Email', format: 'email' },
		{ id: 'notes', type: 'longText', label: 'Notes' },
		{
			id: 'fuel',
			type: 'choice',
			label: 'Fuel',
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{
			id: 'extras',
			type: 'multiChoice',
			label: 'Extras',
			options: [
				{ id: 'ac', label: 'A/C' },
				{ id: 'sunroof', label: 'Sunroof' },
				{ id: 'stereo', label: 'Stereo' },
			],
		},
		{
			id: 'has_fines',
			type: 'boolean',
			label: 'Any fines?',
			required: true,
		},
		{
			id: 'fines_amount',
			type: 'number',
			label: 'Fines amount',
			required: true,
			min: 0,
			showIf: { field: 'has_fines', op: 'eq', value: true },
		},
		{
			id: 'rating',
			type: 'scale',
			label: 'Overall condition',
			max: 3,
			minLabel: 'Poor',
			maxLabel: 'Great',
		},
	],
});

describe('useExcaliburForm', () => {
	it('tracks answers, visibility and result', () => {
		const { result } = renderHook(() => useExcaliburForm(inspection));
		expect(result.current.visibleFieldIds.has('fines_amount')).toBe(false);
		act(() => result.current.setAnswer('has_fines', true));
		expect(result.current.visibleFieldIds.has('fines_amount')).toBe(true);
		expect(result.current.fieldState('has_fines')).toMatchObject({
			value: true,
			visible: true,
			touched: false,
		});
		act(() =>
			result.current.setAnswers((prev) => ({
				...prev,
				plate: 'ABC',
				fines_amount: 10,
			})),
		);
		expect(result.current.result).toEqual({
			ok: true,
			data: { plate: 'ABC', has_fines: true, fines_amount: 10 },
		});
	});

	it('setAnswer with the same value keeps the object', () => {
		const { result } = renderHook(() =>
			useExcaliburForm(inspection, { initialAnswers: { plate: 'A' } }),
		);
		const before = result.current.answers;
		act(() => result.current.setAnswer('plate', 'A'));
		expect(result.current.answers).toBe(before);
	});

	it('shows errors only after touch or submit (default)', async () => {
		const onInvalid = vi.fn<(errors: readonly unknown[]) => void>();
		const { result } = renderHook(() =>
			useExcaliburForm(inspection, { onInvalid }),
		);
		expect(result.current.result.ok).toBe(false);
		expect(result.current.errors.size).toBe(0);
		act(() => result.current.touch('plate'));
		act(() => result.current.touch('plate'));
		expect([...result.current.errors.keys()]).toEqual(['plate']);
		expect(result.current.fieldState('plate').invalid).toBe(true);
		await act(() => result.current.handleSubmit());
		expect([...result.current.errors.keys()]).toEqual([
			'plate',
			'has_fines',
		]);
		expect(onInvalid).toHaveBeenCalledOnce();
		expect(result.current.submitCount).toBe(1);
	});

	it("showErrors 'submit' and 'always'", () => {
		const submit = renderHook(() =>
			useExcaliburForm(inspection, { showErrors: 'submit' }),
		);
		act(() => submit.result.current.touch('plate'));
		expect(submit.result.current.errors.size).toBe(0);
		const always = renderHook(() =>
			useExcaliburForm(inspection, { showErrors: 'always' }),
		);
		expect(always.result.current.errors.size).toBe(2);
	});

	it('submits the validated data and tracks isSubmitting', async () => {
		let resolve = () => {};
		const onSubmit = vi.fn<() => Promise<void>>(
			() =>
				new Promise<void>((r) => {
					resolve = r;
				}),
		);
		const { result } = renderHook(() =>
			useExcaliburForm(inspection, {
				initialAnswers: { plate: 'X', has_fines: false, hack: 1 },
				onSubmit,
			}),
		);
		const preventDefault = vi.fn<() => void>();
		let done: Promise<void> = Promise.resolve();
		act(() => {
			done = result.current.handleSubmit({ preventDefault });
		});
		expect(preventDefault).toHaveBeenCalled();
		expect(result.current.isSubmitting).toBe(true);
		expect(onSubmit).toHaveBeenCalledWith({ plate: 'X', has_fines: false });
		await act(async () => {
			resolve();
			await done;
		});
		expect(result.current.isSubmitting).toBe(false);
	});

	it('submitting without onSubmit only validates', async () => {
		const { result } = renderHook(() =>
			useExcaliburForm(inspection, {
				initialAnswers: { plate: 'X', has_fines: false },
			}),
		);
		await act(() => result.current.handleSubmit());
		expect(result.current.isSubmitting).toBe(false);
	});

	it('reset goes back to the initial or given answers', () => {
		const { result } = renderHook(() =>
			useExcaliburForm(inspection, { initialAnswers: { plate: 'A' } }),
		);
		act(() => {
			result.current.setAnswer('plate', 'B');
			result.current.touch('plate');
		});
		act(() => result.current.reset());
		expect(result.current.answers).toEqual({ plate: 'A' });
		expect(result.current.touched.size).toBe(0);
		act(() => result.current.reset({ plate: 'C' }));
		expect(result.current.answers).toEqual({ plate: 'C' });
	});

	it('an id of "constructor" becomes an own key', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [{ id: 'constructor', type: 'text', label: 'C' }],
		});
		const { result } = renderHook(() => useExcaliburForm(form));
		act(() => result.current.setAnswer('constructor', 'x'));
		expect(Object.hasOwn(result.current.answers, 'constructor')).toBe(true);
		expect(result.current.result).toEqual({
			ok: true,
			data: { constructor: 'x' },
		});
	});
});

describe('FormRenderer', () => {
	it('fills in and submits a full form', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn<(data: unknown) => void>();
		render(<FormRenderer form={inspection} onSubmit={onSubmit} />);

		expect(screen.getByRole('heading', { name: 'Details' })).toBeDefined();
		expect(screen.getByText('Fill in everything')).toBeDefined();
		expect(screen.queryByLabelText(/Fines amount/)).toBeNull();

		await user.type(screen.getByLabelText(/Plate/), 'ABC1D23');
		await user.type(screen.getByLabelText('Email'), 'a@b.co');
		await user.type(screen.getByLabelText('Notes'), 'ok');
		await user.click(screen.getByLabelText('Diesel'));
		await user.click(screen.getByLabelText('Stereo'));
		await user.click(screen.getByLabelText('A/C'));
		await user.click(screen.getByLabelText('Sunroof'));
		await user.click(screen.getByLabelText('Sunroof'));
		await user.click(screen.getByLabelText('Yes'));
		await user.type(screen.getByLabelText(/Fines amount/), '12.5');
		await user.click(screen.getByLabelText('3'));
		expect(screen.getByText('Poor')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Submit' }));

		expect(onSubmit).toHaveBeenCalledWith({
			plate: 'ABC1D23',
			email: 'a@b.co',
			notes: 'ok',
			fuel: 'diesel',
			extras: ['ac', 'stereo'],
			has_fines: true,
			fines_amount: 12.5,
			rating: 3,
		});
	});

	it('shows accessible errors and focuses the first invalid field', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={inspection} />);
		const plate = screen.getByLabelText(/Plate/);
		expect(plate.getAttribute('aria-invalid')).toBeNull();

		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(plate.getAttribute('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(plate);
		const describedBy = plate.getAttribute('aria-describedby') ?? '';
		const texts = describedBy
			.split(' ')
			.map((id) => document.getElementById(id)?.textContent);
		expect(texts).toEqual(['Letters and digits only', 'Required']);

		const group = screen.getByRole('group', { name: /Any fines/ });
		expect(group.tagName).toBe('FIELDSET');
		expect(group.textContent).toContain('Required');

		await user.type(plate, 'X');
		expect(plate.getAttribute('aria-invalid')).toBeNull();
	});

	it('shows the format error after leaving the field', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={inspection} />);
		await user.type(screen.getByLabelText('Email'), 'not-an-email');
		expect(screen.queryByText('Invalid email')).toBeNull();
		await user.tab();
		expect(screen.getByText('Invalid email')).toBeDefined();
	});

	it('focusOnError false does not move focus', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={inspection} focusOnError={false} />);
		const button = screen.getByRole('button', { name: 'Submit' });
		await user.click(button);
		expect(document.activeElement).toBe(button);
	});

	it('uses the language, custom labels and messages', async () => {
		const user = userEvent.setup();
		render(
			<FormRenderer
				form={inspection}
				locale="pt-BR"
				labels={{ yes: 'Claro' }}
				formatError={(error) => `error:${error.code}`}
			/>,
		);
		expect(screen.getByLabelText(/Placa/)).toBeDefined();
		expect(screen.getByLabelText('Claro')).toBeDefined();
		expect(screen.getByLabelText('Não')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Enviar' }));
		expect(screen.getAllByText('error:required')).toHaveLength(2);
	});

	it('replaces components by type, the frame and the buttons', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn<(data: unknown) => void>();
		function Switch({ id, value, onChange, labels }: FieldInputProps) {
			return (
				<button
					id={id}
					type="button"
					role="switch"
					aria-checked={value === true}
					onClick={() => onChange(value !== true)}
				>
					{value === true ? labels.yes : labels.no}
				</button>
			);
		}
		render(
			<FormRenderer
				form={inspection}
				initialAnswers={{ plate: 'X' }}
				onSubmit={onSubmit}
				components={{
					boolean: Switch,
					section: ({ title }) => <h1>{title}!</h1>,
				}}
				FieldWrapper={({ label, children }) => (
					<div data-testid="wrap">
						<span>{label}</span>
						{children}
					</div>
				)}
			>
				<button type="submit">Save</button>
			</FormRenderer>,
		);
		expect(screen.getByRole('heading', { name: 'Details!' })).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull();
		await user.click(screen.getByRole('switch'));
		await user.click(screen.getByRole('switch'));
		await user.click(screen.getByRole('button', { name: 'Save' }));
		expect(onSubmit).toHaveBeenCalledWith({ plate: 'X', has_fines: false });
		// 8 answerable fields, minus fines_amount (hidden)
		expect(screen.getAllByTestId('wrap')).toHaveLength(7);
	});

	it('accepts a controller and disables while submitting', async () => {
		const user = userEvent.setup();
		let resolve = () => {};
		function Controlled() {
			const controller = useExcaliburForm(inspection, {
				initialAnswers: { plate: 'X', has_fines: false },
				onSubmit: () =>
					new Promise<void>((r) => {
						resolve = r;
					}),
			});
			return (
				<>
					<FormRenderer controller={controller} submitLabel="Go" />
					<output>{JSON.stringify(controller.answers)}</output>
				</>
			);
		}
		render(<Controlled />);
		await user.clear(screen.getByLabelText(/Plate/));
		await user.type(screen.getByLabelText(/Plate/), 'Y');
		expect(screen.getByRole('status').textContent).toContain('"plate":"Y"');
		await user.click(screen.getByRole('button', { name: 'Go' }));
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Go' })
				.disabled,
		).toBe(true);
		expect(screen.getByLabelText<HTMLInputElement>(/Plate/).disabled).toBe(
			true,
		);
		await act(async () => resolve());
		await waitFor(() =>
			expect(
				screen.getByRole<HTMLButtonElement>('button', { name: 'Go' })
					.disabled,
			).toBe(false),
		);
	});

	it('number field: clearing goes back to empty and reset updates the text', async () => {
		const user = userEvent.setup();
		let reset: (answers?: Record<string, unknown>) => void = () => {};
		const form = defineForm({
			id: 'n',
			version: 1,
			fields: [{ id: 'n', type: 'number', label: 'N', integer: true }],
		});
		function Controlled() {
			const controller = useExcaliburForm(form);
			reset = controller.reset;
			return (
				<>
					<FormRenderer controller={controller} />
					<output>{JSON.stringify(controller.answers)}</output>
				</>
			);
		}
		render(<Controlled />);
		const input = screen.getByLabelText<HTMLInputElement>('N');
		await user.type(input, '42');
		expect(screen.getByRole('status').textContent).toBe('{"n":42}');
		await user.clear(input);
		expect(screen.getByRole('status').textContent).toBe('{}');
		act(() => reset({ n: 7 }));
		expect(input.value).toBe('7');
		act(() => reset());
		expect(input.value).toBe('');
	});

	it('custom type: rendered with a component, skipped without one', async () => {
		interface ColorField extends FieldBase {
			readonly type: 'color';
		}
		interface GeoField extends FieldBase {
			readonly type: 'geo';
		}
		const color = defineFieldType<ColorField, string>({
			type: 'color',
			answerable: true,
			conditionOps: [],
			parseConfig: () => ({}),
			isEmpty: (v) => v === undefined,
			validate: (v) => accept(String(v)),
		});
		const geo = defineFieldType<GeoField, unknown>({
			type: 'geo',
			answerable: true,
			conditionOps: [],
			parseConfig: () => ({}),
			isEmpty: (v) => v === undefined,
			validate: (v) => accept(v),
		});
		const parsed = parseForm(
			{
				id: 'c',
				version: 1,
				fields: [
					{ id: 'color', type: 'color', label: 'Color' },
					{ id: 'location', type: 'geo', label: 'Location' },
				],
			},
			{ registry: createRegistry([...builtinFieldTypes, color, geo]) },
		);
		if (!parsed.ok) throw new Error('invalid schema');
		function Swatches({ onChange }: FieldInputProps) {
			return (
				<div>
					<button type="button" onClick={() => onChange('red')}>
						red
					</button>
				</div>
			);
		}
		Swatches.group = true;
		const onSubmit = vi.fn<(data: unknown) => void>();
		const user = userEvent.setup();
		render(
			<FormRenderer
				form={parsed.value}
				onSubmit={onSubmit}
				components={{ color: Swatches }}
			/>,
		);
		expect(screen.getByRole('group', { name: 'Color' })).toBeDefined();
		expect(screen.queryByText('Location')).toBeNull();
		await user.click(screen.getByText('red'));
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(onSubmit).toHaveBeenCalledWith({ color: 'red' });
	});

	it('an error on the whole object shows at the end of the form', async () => {
		const user = userEvent.setup();
		function Broken() {
			const controller = useExcaliburForm(inspection, {
				initialAnswers: [] as never,
			});
			return <FormRenderer controller={controller} />;
		}
		render(<Broken />);
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(screen.getByRole('alert').textContent).toBe('Invalid value');
	});
});

describe('defaultErrorMessage', () => {
	it('translates by language and falls back to English', () => {
		const issue = { code: 'too_few', params: { min: 2 } } as const;
		expect(defaultErrorMessage(issue)).toBe('Select at least 2');
		expect(defaultErrorMessage(issue, 'pt-BR')).toBe(
			'Selecione pelo menos 2',
		);
		expect(defaultErrorMessage(issue, 'es')).toBe('Selecciona al menos 2');
		expect(defaultErrorMessage(issue, 'fr')).toBe('Select at least 2');
		expect(
			defaultErrorMessage({ code: 'nope' } as unknown as typeof issue),
		).toBe('Invalid value');
	});

	it('every message in every language', () => {
		const codes = [
			'required',
			'invalid_type',
			'too_short',
			'too_long',
			'too_small',
			'too_big',
			'not_integer',
			'invalid_option',
			'duplicate_option',
			'too_few',
			'too_many',
		] as const;
		for (const locale of ['pt', 'en', 'es']) {
			for (const code of codes) {
				expect(
					defaultErrorMessage(
						{ code, params: { min: 1, max: 2 } },
						locale,
					),
				).not.toMatch(/undefined/);
			}
			for (const format of ['email', 'url', 'cpf']) {
				expect(
					defaultErrorMessage(
						{ code: 'invalid_format', params: { format } },
						locale,
					),
				).toBeTruthy();
			}
		}
	});
});
