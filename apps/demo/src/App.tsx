import {
	defineForm,
	formatPath,
	parseForm,
	resolveText,
	toCSV,
	toEntries,
	toJSON,
	toMarkdown,
	toQAList,
	type ParseResult,
	type Form,
} from '@excalibur-form/core';
import { FormRenderer, useExcaliburForm } from '@excalibur-form/react';
import { useMemo, useState } from 'react';

import { EXAMPLES } from './examples.ts';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const EXPORTERS = {
	json: {
		label: 'toJSON',
		run: (form: Form, data: Answers) => pretty(toJSON(form, data)),
	},
	qa: {
		label: 'toQAList',
		run: (form: Form, data: Answers, locale: string) =>
			pretty(toQAList(form, data, { locale, includeSections: true })),
	},
	markdown: {
		label: 'toMarkdown',
		run: (form: Form, data: Answers, locale: string) =>
			toMarkdown(form, data, { locale }),
	},
	csv: {
		label: 'toCSV',
		run: (form: Form, data: Answers, locale: string) =>
			toCSV(form, [data], { locale, newline: '\n' }),
	},
	entries: {
		label: 'toEntries (FormData)',
		run: (form: Form, data: Answers) => pretty(toEntries(form, data)),
	},
} satisfies Record<
	string,
	{
		label: string;
		run: (form: Form, data: Answers, locale: string) => string;
	}
>;

type Answers = Record<string, unknown>;

// Enquanto não há nenhum schema válido, o hook usa um form vazio.
const EMPTY_FORM: Form = defineForm({ id: 'vazio', version: 1, fields: [] });
type ExporterId = keyof typeof EXPORTERS;

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
	const [locale, setLocale] = useState('pt');
	const [exporter, setExporter] = useState<ExporterId>('qa');
	const [sent, setSent] = useState(false);

	const parsed = useMemo(() => parseText(schemaText), [schemaText]);
	// Mantém o último form válido na tela enquanto o JSON está sendo editado.
	const [lastForm, setLastForm] = useState<Form | null>(null);
	const form = parsed.ok ? parsed.value : lastForm;
	if (parsed.ok && parsed.value !== lastForm) setLastForm(parsed.value);

	const controller = useExcaliburForm(form ?? EMPTY_FORM, {
		onSubmit: () => setSent(true),
	});
	const { answers, result, visibleFieldIds: visible } = controller;

	const loadExample = (index: number) => {
		setExampleIndex(index);
		setSchemaText(pretty(EXAMPLES[index]?.schema));
		controller.reset({});
		setSent(false);
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
						<FormRenderer
							controller={controller}
							locale={locale}
							fallbackLocale="pt"
						>
							<div className="actions">
								<button type="submit">
									{locale === 'en' ? 'Submit' : 'Enviar'}
								</button>
								<button
									type="button"
									className="secondary"
									onClick={() => {
										controller.reset({});
										setSent(false);
									}}
								>
									{locale === 'en' ? 'Clear' : 'Limpar'}
								</button>
							</div>
							{sent && result.ok && (
								<p className="success">
									Tudo certo! Veja o resultado ao lado.
								</p>
							)}
						</FormRenderer>
					)}
				</section>

				<section className="panel">
					<h2>Resultado</h2>
					<h3 className="sub">
						form.validate(respostas){' '}
						<span className={`badge ${result.ok ? 'ok' : 'bad'}`}>
							{result.ok ? 'válido' : 'inválido'}
						</span>
					</h3>
					<pre className="code">{pretty(result)}</pre>
					<h3 className="sub">
						Exportar{' '}
						<select
							value={exporter}
							onChange={(e) =>
								setExporter(e.target.value as ExporterId)
							}
						>
							{Object.entries(EXPORTERS).map(
								([id, { label }]) => (
									<option key={id} value={id}>
										{label}
									</option>
								),
							)}
						</select>
					</h3>
					<pre className="code">
						{form && result.ok
							? EXPORTERS[exporter].run(form, result.data, locale)
							: 'Preencha o form sem erros pra ver a exportação.'}
					</pre>
					<h3 className="sub">Respostas cruas (estado do form)</h3>
					<pre className="code">{pretty(answers)}</pre>
					<h3 className="sub">Campos visíveis</h3>
					<pre className="code">{pretty([...visible])}</pre>
				</section>
			</main>
		</div>
	);
}
