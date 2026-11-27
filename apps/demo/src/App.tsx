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
import { UI, type DemoLocale } from './ui.ts';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

type Answers = Record<string, unknown>;

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

type ExporterId = keyof typeof EXPORTERS;

// Until there is a valid schema, the hook gets an empty form.
const EMPTY_FORM: Form = defineForm({ id: 'empty', version: 1, fields: [] });

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
	const [locale, setLocale] = useState<DemoLocale>('en');
	const [exporter, setExporter] = useState<ExporterId>('qa');
	const [sent, setSent] = useState(false);
	const ui = UI[locale];

	const parsed = useMemo(() => parseText(schemaText), [schemaText]);
	// Keeps the last valid form on screen while the JSON is being edited.
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

	const changeLocale = (next: DemoLocale) => {
		setLocale(next);
		document.documentElement.lang = next;
	};

	return (
		<div className="app">
			<header>
				<div>
					<h1>ExcaliburForm</h1>
					<p>{ui.tagline}</p>
				</div>
				<div className="toolbar">
					<label>
						{ui.example}
						<select
							value={exampleIndex}
							onChange={(e) =>
								loadExample(Number(e.target.value))
							}
						>
							{EXAMPLES.map((example, i) => (
								<option
									key={resolveText(example.name, 'en')}
									value={i}
								>
									{resolveText(example.name, locale, 'en')}
								</option>
							))}
						</select>
					</label>
					<label>
						{ui.language}
						<select
							value={locale}
							onChange={(e) =>
								changeLocale(e.target.value as DemoLocale)
							}
						>
							<option value="en">English</option>
							<option value="pt-BR">Português (Brasil)</option>
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
								{ui.invalidSchema}
								{form ? ui.showingLastValid : ''}
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
													ui.root}
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
							? resolveText(form.schema.title, locale, 'en')
							: ui.formFallbackTitle}
					</h2>
					{form && (
						<FormRenderer
							controller={controller}
							locale={locale}
							fallbackLocale="en"
						>
							<div className="actions">
								<button type="submit">{ui.submit}</button>
								<button
									type="button"
									className="secondary"
									onClick={() => {
										controller.reset({});
										setSent(false);
									}}
								>
									{ui.clear}
								</button>
							</div>
							{sent && result.ok && (
								<p className="success">{ui.success}</p>
							)}
						</FormRenderer>
					)}
				</section>

				<section className="panel">
					<h2>{ui.result}</h2>
					<h3 className="sub">
						form.validate(answers){' '}
						<span className={`badge ${result.ok ? 'ok' : 'bad'}`}>
							{result.ok ? ui.valid : ui.invalid}
						</span>
					</h3>
					<pre className="code">{pretty(result)}</pre>
					<h3 className="sub">
						{ui.export}{' '}
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
							: ui.exportHint}
					</pre>
					<h3 className="sub">{ui.rawAnswers}</h3>
					<pre className="code">{pretty(answers)}</pre>
					<h3 className="sub">{ui.visibleFields}</h3>
					<pre className="code">{pretty([...visible])}</pre>
				</section>
			</main>
		</div>
	);
}
