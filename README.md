<p align="center">
	<img src="assets/logo.svg" width="180" alt="ExcaliburForm icon: a form with checkboxes in front of a golden-hilted sword, inside a magic circle" />
</p>

<h1 align="center">ExcaliburForm</h1>

<p align="center"><strong>English</strong> · <a href="README.pt-BR.md">Português (Brasil)</a></p>

**Dynamic forms as data.** You describe the form in JSON (store it in a database, edit it in an admin panel, version it), and the library validates that schema, decides which fields show up, validates the answers and hands back typed data. The same code runs on the front end and the back end.

```
schema (JSON) ──► parseForm / defineForm ──► form
                                              ├─ visibleFieldIds(answers)  → what to show right now
                                              └─ validate(answers)         → { ok, data } | { ok: false, errors }
```

- **Zero dependencies**, runs in Node, the browser, edge runtimes, React Native…
- **TypeScript first**: the answer types are inferred from the schema.
- **Safe for user-provided schemas**: everything is validated and capped, with no `eval` and no user-supplied regex.
- **English and Portuguese built in**: export texts and React error messages ship in English (default) and Brazilian Portuguese (plus Spanish). The form's own texts can have as many languages as you like.
- **Headless**: the core renders nothing, so it works with any UI. For React there's `@excalibur-form/react` (a hook plus an unstyled renderer).

> **Status:** in development (phase 3 of 6, see the [roadmap](docs/PLAN.md)). The core works and is tested, but it isn't on npm yet and the API may change.

---

## Contents

- [When to use it (and when not to)](#when-to-use-it-and-when-not-to)
- [Running the demo](#running-the-demo)
- [Installation](#installation)
- [Quick start](#quick-start)
- [The schema](#the-schema)
- [Field types](#field-types)
- [Conditions (`showIf`)](#conditions-showif)
- [Validating answers](#validating-answers)
- [Schema errors](#schema-errors)
- [Inferred types](#inferred-types)
- [Multilingual texts](#multilingual-texts)
- [React (`@excalibur-form/react`)](#react-excalibur-formreact)
- [Using it on the back end](#using-it-on-the-back-end)
- [Exporting answers](#exporting-answers)
- [Custom field types](#custom-field-types)
- [Limits and security](#limits-and-security)
- [API reference](#api-reference)
- [Development](#development)
- [Roadmap](#roadmap)

---

## When to use it (and when not to)

**If your form is fixed** (contact, login, sign-up), **don't use this library**. React Hook Form + Zod does that better.

**Use it when the form is data, not code:**

| Situation                                                     | Why it helps                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| An admin or customer **creates the questions** in a panel     | You don't have to invent the "question" model, the per-type `switch`, dynamic validation and "show if" logic |
| The same form must be **validated on front end and back end** | The schema is JSON and validation is the same function on both sides                                         |
| You have **dozens of checklists/questionnaires**              | Each one is a JSON document, not a component                                                                 |
| Forms **change over time** and old answers matter             | Stable IDs: renaming a label or reordering fields breaks nothing                                             |

Examples: inspection checklists, medical intake forms, satisfaction surveys, configurable onboarding, customizable RPG character sheets, per-customer/tenant forms.

---

## Running the demo

The repository has a demo where you edit the JSON schema and watch the form (rendered by `@excalibur-form/react`), its conditions, validation and exports update live.

Requirements: **Node 24+** and **pnpm** (`corepack enable` installs the right version).

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form
pnpm install
pnpm dev
```

Open http://localhost:5173. There are three ready-made examples (vehicle inspection, RPG character sheet and a satisfaction survey), all with texts in English and Portuguese: switch the language in the top bar.

---

## Installation

The packages aren't on npm yet. For now, to use them in another project:

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form && pnpm install && pnpm build
```

Then point your project at the package folder:

```bash
pnpm add /path/to/excalibur-form/packages/core
pnpm add /path/to/excalibur-form/packages/react   # if you use React
```

Once published, it will just be:

```bash
pnpm add @excalibur-form/core
pnpm add @excalibur-form/react   # optional
```

The packages are **ESM only** and need Node 20.19+ (or any modern bundler).

---

## Quick start

### 1. Define a form

In code (with inferred types):

```ts
import { defineForm } from '@excalibur-form/core';

const inspection = defineForm({
	id: 'inspection',
	version: 1,
	title: 'Vehicle inspection',
	fields: [
		{
			id: 'plate',
			type: 'text',
			label: 'License plate',
			required: true,
			maxLength: 8,
		},
		{
			id: 'fuel',
			type: 'choice',
			label: 'Fuel',
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{
			id: 'has_fines',
			type: 'boolean',
			label: 'Any outstanding fines?',
			required: true,
		},
		{
			id: 'fines_total',
			type: 'number',
			label: 'Total fines amount',
			required: true,
			min: 0,
			showIf: { field: 'has_fines', op: 'eq', value: true },
		},
	],
});
```

Or from JSON coming from a database/API (the most common case):

```ts
import { parseForm } from '@excalibur-form/core';

const parsed = parseForm(JSON.parse(schemaFromDatabase));

if (!parsed.ok) {
	// invalid schema: see "Schema errors"
	console.error(parsed.issues);
} else {
	const form = parsed.value;
}
```

> `defineForm` **throws** `FormSchemaError` if the schema is invalid (good for code, where it's a bug). `parseForm` **returns** the problems (good for external data).

### 2. Find out what to show

```ts
inspection.visibleFieldIds({ has_fines: false });
// Set { 'plate', 'fuel', 'has_fines' }

inspection.visibleFieldIds({ has_fines: true });
// Set { 'plate', 'fuel', 'has_fines', 'fines_total' }
```

### 3. Validate the answers

```ts
const result = inspection.validate({
	plate: 'ABC1D23',
	fuel: 'flex',
	has_fines: false,
	fines_total: 500, // ignored: the field is hidden
	whatever: 1, // ignored: not in the schema
});

if (result.ok) {
	result.data;
	// { plate: 'ABC1D23', fuel: 'flex', has_fines: false }
} else {
	result.errors;
	// [{ fieldId: 'plate', code: 'required' }, ...]
}
```

That's the whole cycle. The rest of this README covers each part in detail.

---

## The schema

```ts
interface FormSchema {
	id: string; // form identifier
	version: number; // integer >= 1; bump it when the form changes
	title?: LocalizedText;
	description?: LocalizedText;
	fields: Field[];
}
```

Every field has these common properties:

| Property      | Type            | Required | Description                                                                                                      |
| ------------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`        | yes      | **Stable** ID. Answers and conditions use it. Starts with a letter; letters, digits, `_` and `-`, up to 64 chars |
| `type`        | `string`        | yes      | Field type (see below)                                                                                           |
| `label`       | `LocalizedText` | yes      | The question shown                                                                                               |
| `description` | `LocalizedText` | no       | Help text                                                                                                        |
| `required`    | `boolean`       | no       | Whether it must be answered (when visible)                                                                       |
| `showIf`      | `Condition`     | no       | The field only shows up (and is only validated) when the condition is true                                       |
| `key`         | `string`        | no       | Name used in exports (default: the `id`). Handy to keep the `id` stable while changing the external name         |

**Why stable IDs?** In a question builder, users will rename labels and reorder fields. Since answers are stored by `id` (and choice options by their own `id` too), nothing breaks.

Rules `parseForm` enforces:

- Unique field `id`s, unique option `id`s within a field, and unique export `key`s.
- Unknown properties are **dropped**, and the returned schema is **frozen** (`Object.freeze`).

---

## Field types

### `text`: short text

```json
{
	"id": "email",
	"type": "text",
	"label": "Email",
	"format": "email",
	"required": true
}
```

| Config        | Type               | Description                                         |
| ------------- | ------------------ | --------------------------------------------------- |
| `minLength`   | `number`           | Minimum characters                                  |
| `maxLength`   | `number`           | Maximum characters (default cap: 10,000)            |
| `format`      | `'email' \| 'url'` | Validates the format (`url` only allows http/https) |
| `placeholder` | `LocalizedText`    |                                                     |

Answer: `string`. Whitespace-only text counts as **unanswered**.

### `longText`: long text

Same as `text`, without `format`. Default cap of 100,000 characters. Answer: `string`.

### `number`

```json
{
	"id": "age",
	"type": "number",
	"label": "Age",
	"integer": true,
	"min": 0,
	"max": 130
}
```

| Config        | Type            | Description           |
| ------------- | --------------- | --------------------- |
| `min` / `max` | `number`        | Bounds (inclusive)    |
| `integer`     | `boolean`       | Only accepts integers |
| `placeholder` | `LocalizedText` |                       |

Answer: a finite `number`. **Strings like `"5"` are rejected**: convert in the input (the React package does this for you).

### `boolean`

```json
{
	"id": "accepts",
	"type": "boolean",
	"label": "Do you accept the terms?",
	"required": true
}
```

Answer: `true` or `false`. **`false` counts as answered** (only `null`/`undefined` count as empty).

### `choice`: single choice

```json
{
	"id": "color",
	"type": "choice",
	"label": "Color",
	"options": [
		{ "id": "blue", "label": "Blue" },
		{ "id": "green", "label": "Green" }
	]
}
```

| Config    | Type                                     | Description                |
| --------- | ---------------------------------------- | -------------------------- |
| `options` | `{ id: string; label: LocalizedText }[]` | Required, 1 to 200 options |

Answer: the **option `id`** (`'blue'`), never the label.

### `multiChoice`: multiple choice

```json
{
	"id": "extras",
	"type": "multiChoice",
	"label": "Extras",
	"minSelected": 1,
	"maxSelected": 2,
	"options": [
		{ "id": "ac", "label": "Air conditioning" },
		{ "id": "sunroof", "label": "Sunroof" },
		{ "id": "leather", "label": "Leather seats" }
	]
}
```

| Config        | Type             | Description              |
| ------------- | ---------------- | ------------------------ |
| `options`     | same as `choice` | Required                 |
| `minSelected` | `number`         | Minimum options selected |
| `maxSelected` | `number`         | Maximum options selected |

Answer: `string[]` of `id`s, no duplicates. An empty array counts as **unanswered**.

### `scale`: numeric scale

```json
{
	"id": "nps",
	"type": "scale",
	"label": "Score",
	"min": 0,
	"max": 10,
	"minLabel": "Not likely",
	"maxLabel": "Very likely"
}
```

| Config                  | Type            | Description                                   |
| ----------------------- | --------------- | --------------------------------------------- |
| `min` / `max`           | `number`        | Integers, default `1` to `5`, up to 100 steps |
| `minLabel` / `maxLabel` | `LocalizedText` | Labels for the ends                           |

Answer: an integer between `min` and `max`. Use `scaleBounds(field)` to read the bounds with defaults applied.

### `section`: informational block

```json
{
	"id": "personal_data",
	"type": "section",
	"label": "Personal data",
	"description": "Please fill in carefully."
}
```

A title/text between questions. **It has no answer**: it accepts neither `required` nor `key`, and can't be referenced in conditions. It can have `showIf`.

---

## Conditions (`showIf`)

Conditions are plain JSON, evaluated without `eval`. A field with `showIf` only shows up when the condition is true.

### Comparisons

```json
{ "field": "<id of an earlier field>", "op": "<operator>", "value": <value> }
```

| Operator                    | `value`            | Meaning                                           | Field types                                     |
| --------------------------- | ------------------ | ------------------------------------------------- | ----------------------------------------------- |
| `eq` / `neq`                | string/number/bool | equal / not equal                                 | all (except `multiChoice`)                      |
| `gt` / `gte` / `lt` / `lte` | `number`           | greater / greater or equal / less / less or equal | `number`, `scale`                               |
| `in` / `notIn`              | array              | is / isn't in the list                            | `text`, `longText`, `number`, `scale`, `choice` |
| `includes`                  | `string` (id)      | the answer (array) contains the option            | `multiChoice`                                   |
| `answered` / `notAnswered`  | (none)             | was / wasn't answered                             | all                                             |

### Combining

```json
{
	"all": [
		{ "field": "class", "op": "eq", "value": "rogue" },
		{
			"any": [
				{ "field": "level", "op": "gte", "value": 5 },
				{
					"field": "skills",
					"op": "includes",
					"value": "stealth"
				}
			]
		},
		{ "not": { "field": "banned", "op": "eq", "value": true } }
	]
}
```

- `all`: every one is true (AND)
- `any`: at least one is true (OR)
- `not`: negates

### Important rules

1. **Only fields that come earlier** in the schema can be referenced. This prevents cycles (A depends on B which depends on A). Referencing the field itself or a later one gives a `forward_reference` error.
2. **Comparisons only match answered, visible fields.** If the field wasn't answered, `eq`, `neq`, `in`, `notIn` etc. are `false`. To include the empty case, use `notAnswered`:
    ```json
    {
    	"any": [
    		{ "field": "x", "op": "neq", "value": "a" },
    		{ "field": "x", "op": "notAnswered" }
    	]
    }
    ```
3. **Visibility cascades.** If B depends on A and C depends on B, hiding B also hides C, even if B has a stored value.
4. `parseForm` checks that the operator makes sense for the field type and that the value is valid (e.g. for `choice`, `value` must be the `id` of an existing option).

---

## Validating answers

```ts
const result = form.validate(answers);
```

- `answers` is an object `{ [fieldId]: value }`.
- **Hidden fields are ignored**: they aren't validated and don't appear in `data`.
- **Unknown keys are ignored.**
- Empty optional fields simply don't appear in `data`.
- Every error is returned at once (it doesn't stop at the first).

```ts
type ValidationResult<T> =
	| { ok: true; data: T }
	| { ok: false; errors: ValidationError[] };

interface ValidationError {
	fieldId: string | null; // null = the answers object itself is invalid
	code: ValidationCode;
	params?: Record<string, string | number>;
}
```

### Error codes

The library returns **codes**, not messages: each app translates them its own way (the React package ships default messages in English, Portuguese and Spanish).

| Code               | `params`     | When                                      |
| ------------------ | ------------ | ----------------------------------------- |
| `required`         | (none)       | Required visible field is empty           |
| `invalid_type`     | (none)       | Wrong type (e.g. a string in a `number`)  |
| `too_short`        | `{ min }`    | Text shorter than `minLength`             |
| `too_long`         | `{ max }`    | Text longer than `maxLength` (or the cap) |
| `too_small`        | `{ min }`    | Number below `min`                        |
| `too_big`          | `{ max }`    | Number above `max`                        |
| `not_integer`      | (none)       | Decimal where only integers are allowed   |
| `invalid_format`   | `{ format }` | Invalid `email` or `url`                  |
| `invalid_option`   | `{ option }` | Option `id` that doesn't exist            |
| `duplicate_option` | `{ option }` | Repeated option in a `multiChoice`        |
| `too_few`          | `{ min }`    | Fewer options than `minSelected`          |
| `too_many`         | `{ max }`    | More options than `maxSelected`           |

Translation example:

```ts
import type { AnswerIssue } from '@excalibur-form/core';

function message(issue: AnswerIssue): string {
	const p = issue.params ?? {};
	switch (issue.code) {
		case 'required':
			return 'This field is required';
		case 'too_long':
			return `At most ${p.max} characters`;
		case 'invalid_format':
			return p.format === 'email' ? 'Invalid email' : 'Invalid URL';
		// ...
		default:
			return 'Invalid value';
	}
}
```

---

## Schema errors

When the schema itself is invalid, `parseForm` returns `{ ok: false, issues }`:

```ts
interface SchemaIssue {
	path: (string | number)[]; // where the problem is
	code: SchemaIssueCode;
	message: string; // for developers
}
```

```ts
import { formatPath, parseForm } from '@excalibur-form/core';

const parsed = parseForm({
	id: 'f',
	version: 1,
	fields: [
		{
			id: 'color',
			type: 'choice',
			label: 'Color',
			options: [
				{ id: 'a', label: 'A' },
				{ id: 'a', label: 'B' },
			],
		},
	],
});

if (!parsed.ok) {
	for (const issue of parsed.issues) {
		console.log(`${formatPath(issue.path)}: ${issue.message}`);
		// fields[0].options[1].id: duplicate option id "a"
	}
}
```

Codes: `invalid_type`, `required`, `invalid_value`, `invalid_id`, `too_long`, `too_many`, `too_few`, `duplicate_id`, `duplicate_key`, `unknown_field_type`, `invalid_condition`, `unknown_reference`, `forward_reference`, `unsupported_operator`.

In a builder/admin panel, use these to show the error in the right place before saving the schema.

---

## Inferred types

With `defineForm`, TypeScript knows the exact shape of valid answers:

```ts
import { defineForm, type InferAnswers } from '@excalibur-form/core';

const form = defineForm({
	id: 'f',
	version: 1,
	fields: [
		{ id: 'name', type: 'text', label: 'Name', required: true },
		{
			id: 'color',
			type: 'choice',
			label: 'Color',
			options: [
				{ id: 'blue', label: 'Blue' },
				{ id: 'green', label: 'Green' },
			],
		},
		{
			id: 'tags',
			type: 'multiChoice',
			label: 'Tags',
			options: [{ id: 'a', label: 'A' }],
		},
		{
			id: 'extra',
			type: 'number',
			label: 'Extra',
			required: true,
			showIf: { field: 'name', op: 'answered' },
		},
	],
});

type Answers = InferAnswers<typeof form.schema>;
// {
//   name: string;               ← required and no showIf: always present
//   color?: 'blue' | 'green';   ← union of the option ids
//   tags?: 'a'[];
//   extra?: number;             ← required, but has showIf: may be hidden
// }

const result = form.validate(input);
if (result.ok) result.data.color; // 'blue' | 'green' | undefined
```

With `parseForm` (schema unknown at compile time), `data` is `Record<string, unknown>`.

---

## Multilingual texts

Any text (`label`, `description`, `placeholder`, option labels, `title`…) can be a string or a language map:

```json
{
	"id": "name",
	"type": "text",
	"label": { "en": "Your name", "pt": "Seu nome" }
}
```

```ts
import { resolveText } from '@excalibur-form/core';

resolveText(field.label, 'pt'); // 'Seu nome'
resolveText(field.label, 'pt-BR'); // 'Seu nome' (region falls back to the language)
resolveText(field.label, 'es', 'en'); // 'Your name' (fallback)
resolveText(field.label, 'es'); // 'Your name' (first available)
resolveText('Plain text', 'pt'); // 'Plain text'
```

The library's own texts (export labels like "Yes"/"No" and the React package's default messages and button) are in **English by default** and switch to **Brazilian Portuguese** with `locale: 'pt'` or `'pt-BR'` (Spanish is built in too, with `'es'`).

---

## React (`@excalibur-form/react`)

An optional package with two pieces: a **headless hook** (state, visibility, errors and submit, rendering nothing) and a **`<FormRenderer>`** with **unstyled** default components, each one swappable.

```bash
pnpm add @excalibur-form/react   # once published; peer: react 18 or 19
```

### The quick way

```tsx
import { defineForm } from '@excalibur-form/core';
import { FormRenderer } from '@excalibur-form/react';

const inspection = defineForm({ ... });

export function Inspection() {
	return (
		<FormRenderer
			form={inspection}
			locale="en" // or "pt-BR"
			onSubmit={async (data) => {
				// `data` is validated and typed
				await fetch('/api/inspections', {
					method: 'POST',
					body: JSON.stringify(data),
				});
			}}
		/>
	);
}
```

The renderer takes care of:

- showing only visible fields (conditions react while the user fills in the form);
- errors once a field loses focus, or all of them on a submit attempt, and **focus on the first invalid field**;
- accessibility: `<label>` tied to the input, `<fieldset>`/`<legend>` for radios and checkboxes, `aria-invalid`, and `aria-describedby` pointing to the description and the errors;
- default error messages in English, Portuguese and Spanish, picked by `locale` (English when there's none; `formatError` to use your own);
- disabling the form while an async `onSubmit` runs.

With a schema from the database, build the `Form` with `parseForm` inside a `useMemo` and handle `ok: false`.

### Swapping components

Any type can use your own component; the others keep the default.

```tsx
import type { BooleanField } from '@excalibur-form/core';
import { FormRenderer, type FieldInputProps } from '@excalibur-form/react';

function Switch({
	id,
	value,
	onChange,
	onBlur,
	labels,
}: FieldInputProps<BooleanField>) {
	return (
		<button
			id={id}
			type="button"
			role="switch"
			aria-checked={value === true}
			onClick={() => onChange(value !== true)}
			onBlur={onBlur}
		>
			{value === true ? labels.yes : labels.no}
		</button>
	);
}

<FormRenderer
	form={form}
	components={{ boolean: Switch, cpf: MyCpfInput }} // custom types go in by name
	FieldWrapper={MyFrame} // label + description + errors
>
	<button type="submit">Save</button> {/* replaces the default button */}
</FormRenderer>;
```

Each component receives `FieldInputProps`: `field`, `id`, `value`, `onChange`, `onBlur`, `invalid`, `required`, `disabled`, `describedBy`, `t` (resolves `LocalizedText`), `labels` ("Yes"/"No") and `locale`. A `section` receives `{ field, title, description }`. A component with several controls (like radios) can set `MyComponent.group = true` so the default frame uses `<fieldset>`.

The default components ship no CSS, but have stable class names to style: `ef-form`, `ef-field` (with `data-invalid` when there's an error), `ef-label`, `ef-required`, `ef-description`, `ef-input`, `ef-options`, `ef-option`, `ef-boolean`, `ef-scale`, `ef-scale-steps`, `ef-scale-label`, `ef-section`, `ef-errors`, `ef-error` and `ef-submit`. The demo has an example in [`apps/demo/src/styles.css`](apps/demo/src/styles.css).

### Just the hook

To build the UI from scratch (or read the state from outside the renderer):

```tsx
import { useExcaliburForm } from '@excalibur-form/react';

const ctl = useExcaliburForm(form, {
	initialAnswers: draft,
	onSubmit: save,
	showErrors: 'touched', // 'touched' (default) | 'submit' | 'always'
});

ctl.answers; // raw answers (including fields hidden right now)
ctl.visibleFieldIds; // Set
ctl.result; // form.validate(answers), always up to date
ctl.errors; // Map fieldId → errors that should show right now
ctl.fieldState('plate'); // { field, visible, value, errors, invalid, touched, onChange, onBlur }
ctl.setAnswer('plate', 'ABC1D23');
ctl.reset();
ctl.handleSubmit; // use it as the <form> onSubmit
ctl.isSubmitting;
ctl.submitCount;
```

The same `ctl` can go to the renderer: `<FormRenderer controller={ctl} />`. That's how the demo shows the raw answers and the result next to the form.

> **Security:** the default components render labels and descriptions as text. If you write your own, never use `dangerouslySetInnerHTML` with schema texts.

---

## Using it on the back end

The main point: **the back end validates with the same function as the front end**. Never trust what the front end sent.

```ts
import { parseForm } from '@excalibur-form/core';

// 1. When SAVING a schema (from the admin panel/builder)
app.post('/forms', async (req, res) => {
	const parsed = parseForm(req.body);
	if (!parsed.ok) return res.status(400).json({ issues: parsed.issues });
	await db.forms.insert({
		id: parsed.value.schema.id,
		version: parsed.value.schema.version,
		schema: parsed.value.schema,
	});
	res.status(201).end();
});

// 2. When RECEIVING answers
app.post('/forms/:id/responses', async (req, res) => {
	const row = await db.forms.findLatest(req.params.id);
	const parsed = parseForm(row.schema);
	if (!parsed.ok) throw new Error('stored schema is invalid');

	const result = parsed.value.validate(req.body);
	if (!result.ok) return res.status(422).json({ errors: result.errors });

	// store the version too, so old answers stay readable
	await db.responses.insert({
		formId: row.id,
		formVersion: row.version,
		answers: result.data,
	});
	res.status(201).end();
});
```

Tips:

- **Store `formVersion` with every response** and keep a schema snapshot per version. That way you can show old answers even after editing the form.
- Cache the built `form` by `(id, version)` if traffic is high. `parseForm` is fast, but there's no need to run it on every request.
- Store `result.data` (the clean value), not `req.body`.

---

## Exporting answers

After validating, `result.data` can go out in several formats. The exporters take the `form` and the **already validated** data (they don't validate again, but they drop hidden fields and unknown keys). They all follow schema order and use the field's `key` (default: its `id`).

```ts
import {
	toCSV,
	toEntries,
	toFormData,
	toJSON,
	toMarkdown,
	toQAList,
} from '@excalibur-form/core';

const result = form.validate(answers);
if (result.ok) {
	toJSON(form, result.data);
	// { plate: 'ABC1D23', extras: ['sunroof', 'ac'], has_fines: true }

	toQAList(form, result.data);
	// [{ kind: 'answer', question: 'License plate', answer: 'ABC1D23', value: 'ABC1D23', ... },
	//  { kind: 'answer', question: 'Extras', answer: 'Sunroof, Air conditioning', value: ['sunroof', 'ac'], ... },
	//  { kind: 'answer', question: 'Any outstanding fines?', answer: 'Yes', value: true, ... }]

	toMarkdown(form, result.data);
	// # Vehicle inspection
	//
	// ## Vehicle
	//
	// - **License plate:** ABC1D23
	// - **Extras:** Sunroof, Air conditioning
	// - **Any outstanding fines?:** Yes

	toQAList(form, result.data, { locale: 'pt-BR' });
	// same list with pt texts from the schema, "Sim"/"Não" and numbers like 1.234,5

	toFormData(form, result.data); // FormData: lists become several entries with the same key
	toEntries(form, result.data); // the same [key, value] pairs, e.g. new URLSearchParams(...)
}

// Several submissions become rows of a CSV
toCSV(form, submissions, { delimiter: ';', bom: true }); // ready for Excel in decimal-comma locales
```

| Function                        | Output                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `toJSON(form, data)`            | `{ key: value }` with raw values (option ids)                                |
| `toQAList(form, data, opts?)`   | Readable `[{ question, answer, value, ... }]`; with sections, if asked       |
| `toMarkdown(form, data, opts?)` | Markdown with title, sections and a list; user text escaped                  |
| `toCSV(form, rows, opts?)`      | CSV (RFC 4180), one column per field; hidden fields become empty cells       |
| `toFormData(form, data)`        | A `FormData` ready for `fetch`                                               |
| `toEntries(form, data)`         | `[key, string][]`: booleans become `"true"`/`"false"`, lists several entries |

Options:

- **All readable ones** (`toQAList`, `toMarkdown`, `toCSV`): `locale`, `fallbackLocale` and `labels` (`{ yes, no, listSeparator }`, to replace "Yes"/"No"). Numbers are formatted for the requested language (`1,234.5` in `en-US`, `1.234,5` in `pt-BR`). With no `locale`, fixed texts are in English and numbers are left unformatted.
- **`toQAList`**: `includeUnanswered` (visible fields with no answer, using `emptyAnswer`), `includeSections` (a `section` becomes a heading item; sections with no answers after them are skipped).
- **`toMarkdown`**: the same, plus `title` (default `true`). Sections are included by default and `emptyAnswer` is `—`.
- **`toCSV`**: `header: 'label' | 'key'`, `values: 'display' | 'raw'`, `delimiter`, `newline`, `bom` and `escapeFormulas` (default `true`: text starting with `=`, `+`, `-` or `@` gets a leading `'` so spreadsheets don't run it as a formula).

Each type's readable text comes from its `toDisplay`: `choice` shows the option label, `boolean` shows "Yes"/"No", and so on. Custom types can define their own (see below).

---

## Custom field types

The built-in types are implemented with the same API you use to create your own.

```ts
import {
	accept,
	builtinFieldTypes,
	createRegistry,
	defineFieldType,
	parseForm,
	reject,
	type FieldBase,
} from '@excalibur-form/core';

// 1. The field's shape in the schema (a Brazilian CPF tax id here)
interface CpfField extends FieldBase {
	readonly type: 'cpf';
	readonly allowFormatted?: boolean;
}

// 2. The type definition
const cpfType = defineFieldType<CpfField, string>({
	type: 'cpf',
	answerable: true, // false for blocks without an answer, like `section`
	conditionOps: ['answered', 'notAnswered'], // operators other conditions may use with this field

	// Validates and cleans the type-specific config. The library handles common props (id, label, showIf…).
	parseConfig: (reader) => {
		const allowFormatted = reader.boolean('allowFormatted');
		return allowFormatted === undefined ? {} : { allowFormatted };
	},

	isEmpty: (value) => value === undefined || value === null || value === '',

	// Only receives non-empty values. Returns the normalized value or the errors.
	validate: (value, field) => {
		if (typeof value !== 'string') return reject('invalid_type');
		const digits = field.allowFormatted
			? value.replace(/[.-]/g, '')
			: value;
		return /^\d{11}$/.test(digits)
			? accept(digits)
			: reject('invalid_format', { format: 'cpf' });
	},

	// Optional: readable text in the exporters (qa-list, CSV, Markdown)
	toDisplay: (value) =>
		`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`,
});

// 3. Register it alongside the built-ins
const registry = createRegistry([...builtinFieldTypes, cpfType]);

const parsed = parseForm(schema, { registry });
```

The `reader` in `parseConfig` has helpers that report errors with the right path: `number(key, { integer, min, max })`, `boolean(key)`, `text(key)`, `requiredText(key)`, `oneOf(key, values)`, `id(key)`, `options(key)` and `issue(key, code, message)` for your own problems. The registry must be the same on front end and back end.

---

## Limits and security

Since schemas usually come from users, everything is capped. The defaults:

| Limit                     | Default | What it limits                               |
| ------------------------- | ------- | -------------------------------------------- |
| `maxFields`               | 500     | Fields per form                              |
| `maxOptions`              | 200     | Options per `choice` / `multiChoice`         |
| `maxTextLength`           | 2,000   | Length of labels, descriptions, placeholders |
| `maxLocales`              | 20      | Languages per text                           |
| `maxConditionDepth`       | 8       | Nesting of `all`/`any`/`not`                 |
| `maxConditionNodes`       | 64      | Total size of a `showIf`                     |
| `maxTextAnswerLength`     | 10,000  | `text` answer                                |
| `maxLongTextAnswerLength` | 100,000 | `longText` answer                            |
| `maxScaleSteps`           | 100     | Steps in a `scale`                           |

To change them, pass the same `limits` on front end and back end:

```ts
parseForm(schema, { limits: { maxFields: 50, maxTextAnswerLength: 500 } });
```

What the library does for you:

- **No `eval`**: conditions are data.
- **No user-supplied regex** (avoids ReDoS). Formats are predefined and checked in linear time.
- **Inherited properties are ignored**: `constructor` and `__proto__` in the answers do nothing.
- **Frozen schema** after parsing.

What's up to you:

- Render schema texts **as text**, never as HTML.
- **Always validate on the back end**, with the same schema.

---

## API reference

| Export                                                           | What it does                                                                           |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `defineForm(schema, options?)`                                   | Creates a `Form` with inferred types; throws `FormSchemaError`                         |
| `parseForm(raw, options?)`                                       | Creates a `Form` from untrusted data; returns `{ ok, value } \| { ok: false, issues }` |
| `parseSchema(raw, options?)`                                     | Only validates/cleans the schema, without building the `Form`                          |
| `form.validate(answers)`                                         | Validates answers                                                                      |
| `form.visibleFieldIds(answers)`                                  | `Set` of visible ids (includes `section`)                                              |
| `form.field(id)`                                                 | Field by id                                                                            |
| `form.answerableFields`                                          | Answerable fields (no `section`), in order                                             |
| `form.schema` / `form.limits` / `form.registry`                  | Parsed (frozen) schema, limits and registry in use                                     |
| `toJSON` / `toQAList` / `toMarkdown` / `toCSV`                   | Exporters (see [Exporting answers](#exporting-answers))                                |
| `toFormData` / `toEntries`                                       | Answers in form-submission format                                                      |
| `escapeMarkdown(text)`                                           | Escapes text so it shows up literally in Markdown                                      |
| `createDisplayContext(opts?)` / `DISPLAY_LABELS`                 | Context that `toDisplay` receives, and the default "Yes"/"No" texts per language       |
| `evaluateCondition(condition, lookup)`                           | Evaluates a single condition                                                           |
| `resolveText(text, locale?, fallback?)`                          | Resolves a `LocalizedText`                                                             |
| `scaleBounds(field)`                                             | `{ min, max }` of a `scale` with defaults applied                                      |
| `formatPath(path)`                                               | `['fields', 0, 'id']` → `'fields[0].id'`                                               |
| `defineFieldType(def)`                                           | Typing helper for custom types                                                         |
| `createRegistry(defs)` / `builtinFieldTypes` / `defaultRegistry` | Field type registry                                                                    |
| `accept(value)` / `reject(code, params?)`                        | Return values for `validate` in custom types                                           |
| `FormSchemaError`                                                | Error thrown by `defineForm` (has `.issues`)                                           |
| `DEFAULT_LIMITS`                                                 | Default limits                                                                         |
| `InferAnswers<S>` / `AnswerOf<F>`                                | Inferred types                                                                         |

`options` = `{ registry?: FieldRegistry; limits?: Partial<SchemaLimits> }`.

**`@excalibur-form/react`**

| Export                                  | What it does                                                               |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `useExcaliburForm(form, options?)`      | Headless form state; returns the `controller`                              |
| `<FormRenderer form \| controller … />` | Renders the whole form with swappable components                           |
| `defaultComponents`                     | Default components by type (`TextInput`, `BooleanInput`… exported as well) |
| `FieldWrapper` / `Section`              | Default frame and section                                                  |
| `defaultErrorMessage(issue, locale?)`   | Default message for an error (en, pt, es; English by default)              |
| `FieldInputProps` / `FieldWrapperProps` | Types for writing your own components                                      |

Hook `options` = `{ initialAnswers?, onSubmit?, onInvalid?, showErrors? }`. `<FormRenderer>` takes the same plus `components`, `FieldWrapper`, `locale`, `fallbackLocale`, `labels`, `formatError`, `submitLabel`, `disabled`, `className`, `focusOnError` and `children`.

---

## Development

```
packages/core   @excalibur-form/core: the library
packages/react  @excalibur-form/react: hook and renderer for React
apps/demo       Vite + React demo (uses the react package), in English and pt-BR
docs/PLAN.md    plan and roadmap (PLAN.pt-BR.md in Portuguese)
```

```bash
pnpm install
pnpm dev            # demo
pnpm test           # tests (vitest)
pnpm test:cov       # with coverage
pnpm check          # format + lint + typecheck + tests + build (same as CI)
pnpm format         # format (oxfmt)
```

Stack: TypeScript 7 (strict, `isolatedDeclarations`, `exactOptionalPropertyTypes`), vitest (+ Testing Library and jsdom in the React package), oxlint, oxfmt, changesets and GitHub Actions.

**Languages:** code, comments, tests and the main docs are in English. Docs have a Brazilian Portuguese version (`*.pt-BR.md`); when you change one, update the other.

---

## Roadmap

- [x] **Phase 0**: monorepo, tooling, CI
- [x] **Phase 1**: core (schema, 8 field types, conditions, validation, inferred types)
- [x] Demo
- [x] **Phase 2**: exporters (JSON by `key`, question/answer list, CSV, FormData, Markdown)
- [x] **Phase 3**: `@excalibur-form/react` (headless renderer with swappable components)
- [ ] **Phase 4**: `@excalibur-form/builder` (build the form visually)
- [ ] **Phase 5**: answer versioning, docs and npm release
- [ ] More types: `date`, `file`/`image`, repeatable groups, matrix

Details in [docs/PLAN.md](docs/PLAN.md).

---

## License

[MIT](LICENSE)
