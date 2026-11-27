# Plan: ExcaliburForm

**English** · [Português (Brasil)](PLAN.pt-BR.md)

> **Core idea:** forms that are **data**, not code. Users create the questions, the library validates the same way on front end and back end, and exports the answers in any format.

## Positioning

> If your form is fixed, use react-hook-form. If your users create the forms, use this.

The library pays off when:

1. **Whoever writes the questions isn't the developer**: an admin or customer creates the questions in a panel.
2. **The same form runs in many places**: the schema is JSON, so front end, back end, mobile and PDF share one definition.
3. **Answers go out in different formats**: question/answer list, JSON, CSV, FormData.
4. **Forms change over time**: with a versioned schema, old answers stay readable.
5. **Volume**: 30 checklists become 30 JSON documents, not 30 components.

Audience: SaaS products with configurable questions (checklists, inspections, medical intake, onboarding, surveys), internal form builders and per-customer/tenant forms.

## 1. Structure (pnpm monorepo)

```
packages/
  core/      @excalibur-form/core     → schema, field types, validation, conditions, exporters (zero deps, Node + browser)
  react/     @excalibur-form/react    → headless hooks + <FormRenderer> with a component map    (phase 3)
  builder/   @excalibur-form/builder  → <FormBuilder> to build the form visually               (phase 4)
apps/
  demo/      Vite + React: JSON schema ↔ form ↔ result side by side
```

Tooling: TS 7 strict (`isolatedDeclarations`, `exactOptionalPropertyTypes`), built with `tsc` (**ESM only**: current Node can `require()` ESM), vitest, oxlint + oxfmt, changesets, MIT license.

The `@excalibur-form` npm scope will be sorted out at publish time.

**Languages:** English is the base language of the project (code, comments, tests, docs and the library's default texts), with Brazilian Portuguese built in. Docs live in `*.md` (English) and `*.pt-BR.md` (Portuguese).

## 2. Core concepts

**Schema (plain JSON, stored in a database)**

```json
{
	"id": "inspection",
	"version": 3,
	"fields": [
		{
			"id": "has_fines",
			"type": "boolean",
			"label": { "en": "Any fines?", "pt": "Possui multas?" },
			"required": true
		},
		{
			"id": "extras",
			"type": "multiChoice",
			"label": "Extras",
			"options": [
				{ "id": "ac", "label": "A/C" },
				{ "id": "sunroof", "label": "Sunroof" }
			],
			"minSelected": 1
		},
		{
			"id": "km",
			"type": "number",
			"label": "KM",
			"showIf": { "field": "has_fines", "op": "eq", "value": false }
		}
	]
}
```

- **Stable IDs** on fields and options. Answers and conditions use the `id`. `key` (optional, default = `id`) is the name used in exports.
- **The schema itself is validated** (`parseSchema` / `parseForm`), because it comes from a database or a user. Unknown props are dropped and the result is frozen.
- **Field type registry**: each type defines `parseConfig`, `isEmpty`, `validate`, `conditionOps` and `isValidConditionValue`. Custom types use the same API (`defineFieldType` + `createRegistry`).

**Types in v1:** `text` (with `format: email | url`), `longText`, `number`, `boolean`, `choice`, `multiChoice`, `scale`, `section`.
**Later:** `date`, `file/image`, `group/repeater`, `matrix`, `signature`, `location`.

**Conditions:** a JSON DSL (`all` / `any` / `not`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `includes`, `answered`, `notAnswered`). No `eval`.

- Only **earlier** fields can be referenced, which prevents cycles.
- Comparisons only match answered, visible fields. Visibility cascades.
- Hidden fields aren't validated and are left out of the result.

**Validation:** `form.validate(answers)` returns `{ ok, data } | { ok: false, errors: [{ fieldId, code, params }] }`. These are **codes**, not messages, and each app translates them. `data` is typed via `InferAnswers` when the form comes from `defineForm`.

**i18n:** texts can be a `string` or `{ en: "...", pt: "..." }`, resolved with `resolveText` (`pt-BR` falls back to `pt`). The library's own texts ("Yes"/"No" in exports, React messages and button) are **English by default** and **Brazilian Portuguese** with `locale: 'pt-BR'` (Spanish is included too).

## 3. Exporters (phase 2, pluggable)

| Format              | Use                                                              |
| ------------------- | ---------------------------------------------------------------- |
| `json`              | `{ key: value }` for an API                                      |
| `qa-list`           | Readable `[{ question, answer }]`, for email or a summary screen |
| `formData`          | submitting with files                                            |
| `csv`               | several submissions become rows, with a header from the schema   |
| `markdown` / `html` | email and reports                                                |
| `json-schema`       | interop with other tools                                         |

Each field type gets a `toDisplay(value, field, context)` for this (`context` carries the language, fixed texts like "Yes"/"No" and `text()` to resolve a `LocalizedText`). Phase 2 shipped `json`, `qa-list`, `formData` (+ `toEntries`), `csv` and `markdown`; `html` and `json-schema` come later.

## 4. Versioning

- Each response stores `{ formId, version }`, and the app keeps a schema snapshot per version.
- `readAnswers(answers, schemaSnapshot)` shows old answers even when questions were removed.
- Later: `diffSchemas(v2, v3)`.

## 5. React (`/react`)

- `useExcaliburForm(schema)`: state, visibility, errors and submit (headless).
- `<FormRenderer form components={{ boolean: MySwitch }} />`: unstyled default components, each one swappable.
- Shipped in phase 3: the hook takes a `Form` (not raw JSON) and returns a `controller` that can also go to `<FormRenderer controller>`. Components ship no CSS, use `ef-*` classes and are accessible (`fieldset`/`legend`, `aria-describedby`, focus on the first error). Default error messages in en/pt/es (English without a `locale`).

## 6. Builder (`/builder`)

- `<FormBuilder value={schema} onChange={setSchema} />`: add and reorder fields, edit config, condition editor and preview.
- Generates stable IDs on its own and only emits valid schemas. This is the selling point.

## 7. Security (the schema comes from users)

- Labels are always rendered as text, never HTML.
- No user regex (ReDoS risk). Predefined formats with linear checks.
- Configurable limits (`SchemaLimits`): fields, options, text length, languages, condition depth and nodes, answer size, scale steps.
- The back end validates with the same core.

## 8. Roadmap

| Phase | Deliverable                                                                            | Status |
| ----- | -------------------------------------------------------------------------------------- | ------ |
| **0** | Monorepo, tooling, CI (format, lint, typecheck, test, build)                           | ✅     |
| **1** | Core: schema + parse, registry, 8 types, validation, conditions, type inference, tests | ✅     |
| **—** | Demo (`apps/demo`)                                                                     | ✅     |
| **2** | Exporters (json, qa-list, formData, csv, markdown)                                     | ✅     |
| **3** | `@excalibur-form/react` (the demo switches to it)                                      | ✅     |
| **4** | Builder                                                                                |        |
| **5** | Versioning, docs, publish **v0.1**                                                     |        |
| **6** | First real use: customizable sheets in Excalibur Notes                                 |        |

## 9. Open decisions

1. npm scope (to check at publish time).
2. ~~Default component styling in `/react`~~: decided, unstyled (`ef-*` classes).
3. Builder in v0.1 or v0.2.
4. ~~Project language~~: decided, English as the base (code, docs, library defaults) with Brazilian Portuguese built in; docs in `*.md` (English) and `*.pt-BR.md`.
