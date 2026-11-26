import {
	formatPath,
	parseForm,
	resolveText,
	type BuiltinField,
	type ParseResult,
	type Form,
} from '@excalibur-form/core';
import { useMemo, useState } from 'react';

import { EXAMPLES } from './examples.ts';
import { FieldInput } from './FieldInput.tsx';
import { errorMessage } from './messages.ts';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

function parseText(
	text: string,
): ParseResult<Form> | { ok: false; json: string } {
	try {
		return parseForm(JSON.parse(text));
	} catch (error) {
		return { ok: false, json: (error as Error).message };
	}
}

export function App() {
	const [exampleIndex, setExampleIndex] = useState(0);
	const [schemaText, setSchemaText] = useState(() =>
		pretty(EXAMPLES[0]?.schema),
	);
	const [answers, setAnswers] = useState<Record<string, unknown>>({});
	const [submitted, setSubmitted] = useState(false);
	const [locale, setLocale] = useState('pt');

	const parsed = useMemo(() => parseText(schemaText), [schemaText]);
	// Mantém o último form válido na tela enquanto o JSON está sendo editado.
	const [lastForm, setLastForm] = useState<Form | null>(null);
	const form = parsed.ok ? parsed.value : lastForm;
	if (parsed.ok && parsed.value !== lastForm) setLastForm(parsed.value);

	const visible = form?.visibleFieldIds(answers) ?? new Set<string>();
	const result = form?.validate(answers);
	const errorsByField = new Map<string, string[]>();
	if (result && !result.ok) {
		for (const error of result.errors) {
			const key = error.fieldId ?? '';
			errorsByField.set(key, [
				...(errorsByField.get(key) ?? []),
				errorMessage(error),
			]);
		}
	}

	const loadExample = (index: number) => {
		setExampleIndex(index);
		setSchemaText(pretty(EXAMPLES[index]?.schema));
		setAnswers({});
		setSubmitted(false);
	};

	return (
		<div className="app">
			<header>
				<div>
					<h1>ExcaliburForm</h1>
					<p>
						O form é dado: edite o JSON e o formulário, as condições
						e a validação mudam junto.
					</p>
				</div>
				<div className="toolbar">
					<label>
						Exemplo
						<select
							value={exampleIndex}
							onChange={(e) =>
								loadExample(Number(e.target.value))
							}
						>
							{EXAMPLES.map((example, i) => (
								<option key={example.name} value={i}>
									{example.name}
								</option>
							))}
						</select>
					</label>
					<label>
						Idioma
						<select
							value={locale}
							onChange={(e) => setLocale(e.target.value)}
						>
							<option value="pt">Português</option>
							<option value="en">English</option>
						</select>
					</label>
				</div>
			</header>

			<main>
				<section className="panel">
					<h2>Schema (JSON)</h2>
					<textarea
						className="code"
						spellCheck={false}
						value={schemaText}
						onChange={(e) => setSchemaText(e.target.value)}
					/>
					{!parsed.ok && (
						<div className="issues">
							<strong>
								Schema inválido
								{form
									? ' (mostrando a última versão válida)'
									: ''}
							</strong>
							<ul>
								{'json' in parsed ? (
									<li>JSON: {parsed.json}</li>
								) : (
									parsed.issues.map((issue) => (
										<li
											key={`${formatPath(issue.path)}:${issue.code}:${issue.message}`}
										>
											<code>
												{formatPath(issue.path) ||
													'(raiz)'}
											</code>{' '}
											{issue.message}
										</li>
									))
								)}
							</ul>
						</div>
					)}
				</section>

				<section className="panel">
					<h2>
						{form?.schema.title
							? resolveText(form.schema.title, locale, 'pt')
							: 'Formulário'}
					</h2>
					{form && (
						<form
							noValidate
							onSubmit={(e) => {
								e.preventDefault();
								setSubmitted(true);
							}}
						>
							{form.schema.fields.map((raw) => {
								const field = raw as BuiltinField;
								if (!visible.has(field.id)) return null;
								const label = resolveText(
									field.label,
									locale,
									'pt',
								);
								const description =
									field.description &&
									resolveText(
										field.description,
										locale,
										'pt',
									);
								if (field.type === 'section') {
									return (
										<div key={field.id} className="section">
											<h3>{label}</h3>
											{description && (
												<p className="hint">
													{description}
												</p>
											)}
										</div>
									);
								}
								const errors = submitted
									? errorsByField.get(field.id)
									: undefined;
								return (
									<div
										key={field.id}
										className={`field${errors ? ' invalid' : ''}`}
									>
										<label
											htmlFor={field.id}
											className="label"
										>
											{label}
											{field.required && (
												<span className="required">
													*
												</span>
											)}
										</label>
										{description && (
											<p className="hint">
												{description}
											</p>
										)}
										<FieldInput
											field={field}
											value={answers[field.id]}
											locale={locale}
											onChange={(value) =>
												setAnswers((prev) => ({
													...prev,
													[field.id]: value,
												}))
											}
										/>
										{errors?.map((message) => (
											<p key={message} className="error">
												{message}
											</p>
										))}
									</div>
								);
							})}
							<div className="actions">
								<button type="submit">Enviar</button>
								<button
									type="button"
									className="secondary"
									onClick={() => {
										setAnswers({});
										setSubmitted(false);
									}}
								>
									Limpar
								</button>
							</div>
							{submitted && result?.ok && (
								<p className="success">
									Tudo certo! Veja o resultado ao lado.
								</p>
							)}
						</form>
					)}
				</section>

				<section className="panel">
					<h2>Resultado</h2>
					<h3 className="sub">
						form.validate(respostas){' '}
						<span className={`badge ${result?.ok ? 'ok' : 'bad'}`}>
							{result?.ok ? 'válido' : 'inválido'}
						</span>
					</h3>
					<pre className="code">{pretty(result ?? null)}</pre>
					<h3 className="sub">Respostas cruas (estado do form)</h3>
					<pre className="code">{pretty(answers)}</pre>
					<h3 className="sub">Campos visíveis</h3>
					<pre className="code">{pretty([...visible])}</pre>
				</section>
			</main>
		</div>
	);
}
