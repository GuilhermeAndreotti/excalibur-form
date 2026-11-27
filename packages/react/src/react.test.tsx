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

const vistoria = defineForm({
	id: 'vistoria',
	version: 1,
	fields: [
		{
			id: 'intro',
			type: 'section',
			label: { pt: 'Dados', en: 'Data' },
			description: 'Preencha tudo',
		},
		{
			id: 'placa',
			type: 'text',
			label: { pt: 'Placa', en: 'Plate' },
			required: true,
			description: 'Só letras e números',
		},
		{ id: 'email', type: 'text', label: 'E-mail', format: 'email' },
		{ id: 'obs', type: 'longText', label: 'Observações' },
		{
			id: 'combustivel',
			type: 'choice',
			label: 'Combustível',
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{
			id: 'opcionais',
			type: 'multiChoice',
			label: 'Opcionais',
			options: [
				{ id: 'ar', label: 'Ar' },
				{ id: 'teto', label: 'Teto solar' },
				{ id: 'som', label: 'Som' },
			],
		},
		{
			id: 'tem_multa',
			type: 'boolean',
			label: 'Possui multas?',
			required: true,
		},
		{
			id: 'valor_multas',
			type: 'number',
			label: 'Valor das multas',
			required: true,
			min: 0,
			showIf: { field: 'tem_multa', op: 'eq', value: true },
		},
		{
			id: 'nota',
			type: 'scale',
			label: 'Estado geral',
			max: 3,
			minLabel: 'Ruim',
			maxLabel: 'Ótimo',
		},
	],
});

describe('useExcaliburForm', () => {
	it('controla respostas, visibilidade e resultado', () => {
		const { result } = renderHook(() => useExcaliburForm(vistoria));
		expect(result.current.visibleFieldIds.has('valor_multas')).toBe(false);
		act(() => result.current.setAnswer('tem_multa', true));
		expect(result.current.visibleFieldIds.has('valor_multas')).toBe(true);
		expect(result.current.fieldState('tem_multa')).toMatchObject({
			value: true,
			visible: true,
			touched: false,
		});
		act(() =>
			result.current.setAnswers((prev) => ({
				...prev,
				placa: 'ABC',
				valor_multas: 10,
			})),
		);
		expect(result.current.result).toEqual({
			ok: true,
			data: { placa: 'ABC', tem_multa: true, valor_multas: 10 },
		});
	});

	it('setAnswer com o mesmo valor não troca o objeto', () => {
		const { result } = renderHook(() =>
			useExcaliburForm(vistoria, { initialAnswers: { placa: 'A' } }),
		);
		const before = result.current.answers;
		act(() => result.current.setAnswer('placa', 'A'));
		expect(result.current.answers).toBe(before);
	});

	it('mostra erros só depois de tocar ou enviar (padrão)', async () => {
		const onInvalid = vi.fn<(errors: readonly unknown[]) => void>();
		const { result } = renderHook(() =>
			useExcaliburForm(vistoria, { onInvalid }),
		);
		expect(result.current.result.ok).toBe(false);
		expect(result.current.errors.size).toBe(0);
		act(() => result.current.touch('placa'));
		act(() => result.current.touch('placa'));
		expect([...result.current.errors.keys()]).toEqual(['placa']);
		expect(result.current.fieldState('placa').invalid).toBe(true);
		await act(() => result.current.handleSubmit());
		expect([...result.current.errors.keys()]).toEqual([
			'placa',
			'tem_multa',
		]);
		expect(onInvalid).toHaveBeenCalledOnce();
		expect(result.current.submitCount).toBe(1);
	});

	it("showErrors 'submit' e 'always'", () => {
		const submit = renderHook(() =>
			useExcaliburForm(vistoria, { showErrors: 'submit' }),
		);
		act(() => submit.result.current.touch('placa'));
		expect(submit.result.current.errors.size).toBe(0);
		const always = renderHook(() =>
			useExcaliburForm(vistoria, { showErrors: 'always' }),
		);
		expect(always.result.current.errors.size).toBe(2);
	});

	it('envia os dados validados e controla isSubmitting', async () => {
		let resolve = () => {};
		const onSubmit = vi.fn<() => Promise<void>>(
			() =>
				new Promise<void>((r) => {
					resolve = r;
				}),
		);
		const { result } = renderHook(() =>
			useExcaliburForm(vistoria, {
				initialAnswers: { placa: 'X', tem_multa: false, hack: 1 },
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
		expect(onSubmit).toHaveBeenCalledWith({ placa: 'X', tem_multa: false });
		await act(async () => {
			resolve();
			await done;
		});
		expect(result.current.isSubmitting).toBe(false);
	});

	it('enviar sem onSubmit só valida', async () => {
		const { result } = renderHook(() =>
			useExcaliburForm(vistoria, {
				initialAnswers: { placa: 'X', tem_multa: false },
			}),
		);
		await act(() => result.current.handleSubmit());
		expect(result.current.isSubmitting).toBe(false);
	});

	it('reset volta pro inicial ou pras respostas dadas', () => {
		const { result } = renderHook(() =>
			useExcaliburForm(vistoria, { initialAnswers: { placa: 'A' } }),
		);
		act(() => {
			result.current.setAnswer('placa', 'B');
			result.current.touch('placa');
		});
		act(() => result.current.reset());
		expect(result.current.answers).toEqual({ placa: 'A' });
		expect(result.current.touched.size).toBe(0);
		act(() => result.current.reset({ placa: 'C' }));
		expect(result.current.answers).toEqual({ placa: 'C' });
	});

	it('id "constructor" vira chave própria', () => {
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
	it('preenche e envia um form completo', async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn<(data: unknown) => void>();
		render(<FormRenderer form={vistoria} onSubmit={onSubmit} />);

		expect(screen.getByRole('heading', { name: 'Dados' })).toBeDefined();
		expect(screen.getByText('Preencha tudo')).toBeDefined();
		expect(screen.queryByLabelText(/Valor das multas/)).toBeNull();

		await user.type(screen.getByLabelText(/Placa/), 'ABC1D23');
		await user.type(screen.getByLabelText('E-mail'), 'a@b.co');
		await user.type(screen.getByLabelText('Observações'), 'ok');
		await user.click(screen.getByLabelText('Diesel'));
		await user.click(screen.getByLabelText('Som'));
		await user.click(screen.getByLabelText('Ar'));
		await user.click(screen.getByLabelText('Teto solar'));
		await user.click(screen.getByLabelText('Teto solar'));
		await user.click(screen.getByLabelText('Sim'));
		await user.type(screen.getByLabelText(/Valor das multas/), '12.5');
		await user.click(screen.getByLabelText('3'));
		expect(screen.getByText('Ruim')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Enviar' }));

		expect(onSubmit).toHaveBeenCalledWith({
			placa: 'ABC1D23',
			email: 'a@b.co',
			obs: 'ok',
			combustivel: 'diesel',
			opcionais: ['ar', 'som'],
			tem_multa: true,
			valor_multas: 12.5,
			nota: 3,
		});
	});

	it('mostra erros acessíveis e foca o primeiro campo inválido', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={vistoria} />);
		const placa = screen.getByLabelText(/Placa/);
		expect(placa.getAttribute('aria-invalid')).toBeNull();

		await user.click(screen.getByRole('button', { name: 'Enviar' }));
		expect(placa.getAttribute('aria-invalid')).toBe('true');
		expect(document.activeElement).toBe(placa);
		const describedBy = placa.getAttribute('aria-describedby') ?? '';
		const texts = describedBy
			.split(' ')
			.map((id) => document.getElementById(id)?.textContent);
		expect(texts).toEqual(['Só letras e números', 'Campo obrigatório']);

		const group = screen.getByRole('group', { name: /Possui multas/ });
		expect(group.tagName).toBe('FIELDSET');
		expect(group.textContent).toContain('Campo obrigatório');

		await user.type(placa, 'X');
		expect(placa.getAttribute('aria-invalid')).toBeNull();
	});

	it('mostra o erro de formato depois de sair do campo', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={vistoria} />);
		await user.type(screen.getByLabelText('E-mail'), 'nao-e-email');
		expect(screen.queryByText('E-mail inválido')).toBeNull();
		await user.tab();
		expect(screen.getByText('E-mail inválido')).toBeDefined();
	});

	it('focusOnError false não move o foco', async () => {
		const user = userEvent.setup();
		render(<FormRenderer form={vistoria} focusOnError={false} />);
		const button = screen.getByRole('button', { name: 'Enviar' });
		await user.click(button);
		expect(document.activeElement).toBe(button);
	});

	it('usa o idioma, labels e mensagens próprias', async () => {
		const user = userEvent.setup();
		render(
			<FormRenderer
				form={vistoria}
				locale="en-US"
				labels={{ yes: 'Yep' }}
				formatError={(error) => `erro:${error.code}`}
			/>,
		);
		expect(screen.getByLabelText(/Plate/)).toBeDefined();
		expect(screen.getByLabelText('Yep')).toBeDefined();
		expect(screen.getByLabelText('No')).toBeDefined();
		await user.click(screen.getByRole('button', { name: 'Submit' }));
		expect(screen.getAllByText('erro:required')).toHaveLength(2);
	});

	it('troca componentes por tipo, moldura e botões', async () => {
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
				form={vistoria}
				initialAnswers={{ placa: 'X' }}
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
				<button type="submit">Salvar</button>
			</FormRenderer>,
		);
		expect(screen.getByRole('heading', { name: 'Dados!' })).toBeDefined();
		expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
		await user.click(screen.getByRole('switch'));
		await user.click(screen.getByRole('switch'));
		await user.click(screen.getByRole('button', { name: 'Salvar' }));
		expect(onSubmit).toHaveBeenCalledWith({ placa: 'X', tem_multa: false });
		// 8 campos com resposta, menos valor_multas (escondido)
		expect(screen.getAllByTestId('wrap')).toHaveLength(7);
	});

	it('aceita um controller e desabilita durante o envio', async () => {
		const user = userEvent.setup();
		let resolve = () => {};
		function Controlled() {
			const controller = useExcaliburForm(vistoria, {
				initialAnswers: { placa: 'X', tem_multa: false },
				onSubmit: () =>
					new Promise<void>((r) => {
						resolve = r;
					}),
			});
			return (
				<>
					<FormRenderer controller={controller} submitLabel="Ir" />
					<output>{JSON.stringify(controller.answers)}</output>
				</>
			);
		}
		render(<Controlled />);
		await user.clear(screen.getByLabelText(/Placa/));
		await user.type(screen.getByLabelText(/Placa/), 'Y');
		expect(screen.getByRole('status').textContent).toContain('"placa":"Y"');
		await user.click(screen.getByRole('button', { name: 'Ir' }));
		expect(
			screen.getByRole<HTMLButtonElement>('button', { name: 'Ir' })
				.disabled,
		).toBe(true);
		expect(screen.getByLabelText<HTMLInputElement>(/Placa/).disabled).toBe(
			true,
		);
		await act(async () => resolve());
		await waitFor(() =>
			expect(
				screen.getByRole<HTMLButtonElement>('button', { name: 'Ir' })
					.disabled,
			).toBe(false),
		);
	});

	it('campo numérico: apagar volta pra vazio e reset atualiza o texto', async () => {
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

	it('tipo customizado: com componente renderiza, sem componente omite', async () => {
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
					{ id: 'cor', type: 'color', label: 'Cor' },
					{ id: 'local', type: 'geo', label: 'Local' },
				],
			},
			{ registry: createRegistry([...builtinFieldTypes, color, geo]) },
		);
		if (!parsed.ok) throw new Error('schema inválido');
		function Swatches({ onChange }: FieldInputProps) {
			return (
				<div>
					<button type="button" onClick={() => onChange('red')}>
						vermelho
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
		expect(screen.getByRole('group', { name: 'Cor' })).toBeDefined();
		expect(screen.queryByText('Local')).toBeNull();
		await user.click(screen.getByText('vermelho'));
		await user.click(screen.getByRole('button', { name: 'Enviar' }));
		expect(onSubmit).toHaveBeenCalledWith({ cor: 'red' });
	});

	it('erro no objeto todo aparece no fim do form', async () => {
		const user = userEvent.setup();
		function Broken() {
			const controller = useExcaliburForm(vistoria, {
				initialAnswers: [] as never,
			});
			return <FormRenderer controller={controller} />;
		}
		render(<Broken />);
		await user.click(screen.getByRole('button', { name: 'Enviar' }));
		expect(screen.getByRole('alert').textContent).toBe('Valor inválido');
	});
});

describe('defaultErrorMessage', () => {
	it('traduz por idioma e cai em pt', () => {
		const issue = { code: 'too_few', params: { min: 2 } } as const;
		expect(defaultErrorMessage(issue)).toBe('Selecione pelo menos 2');
		expect(defaultErrorMessage(issue, 'en-GB')).toBe('Select at least 2');
		expect(defaultErrorMessage(issue, 'es')).toBe('Selecciona al menos 2');
		expect(defaultErrorMessage(issue, 'fr')).toBe('Selecione pelo menos 2');
		expect(
			defaultErrorMessage({ code: 'nope' } as unknown as typeof issue),
		).toBe('Valor inválido');
	});

	it('todas as mensagens de todos os idiomas', () => {
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
