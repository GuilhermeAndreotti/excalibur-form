# Plano: ExcaliburForm

> **Ideia central:** formulários que são **dados**, não código. Os usuários criam as perguntas, a lib valida igual no front e no back e exporta as respostas em qualquer formato.

## Posicionamento

> Se seu form é fixo, use react-hook-form. Se seus usuários criam os forms, use isso.

A lib vale a pena quando:

1. **Quem cria as perguntas não é o dev**: um admin ou cliente cadastra as perguntas num painel.
2. **O mesmo form roda em vários lugares**: o schema é JSON, então front, back, mobile e PDF usam a mesma definição.
3. **A resposta sai em formatos diferentes**: lista pergunta/resposta, JSON, CSV, FormData.
4. **Os forms mudam com o tempo**: com o schema versionado, respostas antigas continuam legíveis.
5. **Volume**: 30 checklists viram 30 JSONs, não 30 componentes.

Público: SaaS com perguntas configuráveis (checklists, vistorias, anamnese, onboarding, pesquisas), form builders internos e formulários por cliente/tenant.

## 1. Estrutura (pnpm monorepo)

```
packages/
  core/      @excalibur-form/core     → schema, tipos de campo, validação, condições, exporters (zero deps, Node + browser)
  react/     @excalibur-form/react    → hooks headless + <FormRenderer> com mapa de componentes   (fase 3)
  builder/   @excalibur-form/builder  → <FormBuilder> pra montar o form visualmente              (fase 4)
apps/
  demo/      Vite + React: schema JSON ↔ form ↔ resultado lado a lado
```

Tooling: TS 7 strict (`isolatedDeclarations`, `exactOptionalPropertyTypes`), build com `tsc` (**só ESM**: o Node atual faz `require()` de ESM), vitest, oxlint + oxfmt, changesets, licença MIT.

O scope `@excalibur-form` no npm fica pra quando for publicar.

## 2. Conceitos do core

**Schema (JSON puro, salvo no banco)**

```json
{
	"id": "vistoria",
	"version": 3,
	"fields": [
		{
			"id": "tem_multa",
			"type": "boolean",
			"label": "Possui multas?",
			"required": true
		},
		{
			"id": "opcionais",
			"type": "multiChoice",
			"label": "Opcionais",
			"options": [
				{ "id": "ar", "label": "Ar" },
				{ "id": "teto", "label": "Teto" }
			],
			"minSelected": 1
		},
		{
			"id": "km",
			"type": "number",
			"label": "KM",
			"showIf": { "field": "tem_multa", "op": "eq", "value": false }
		}
	]
}
```

- **IDs estáveis** em campos e opções. Respostas e condições usam o `id`. `key` (opcional, padrão = `id`) é o nome usado nas exportações.
- **O próprio schema é validado** (`parseSchema` / `parseForm`), porque vem do banco ou de usuário. Props desconhecidas são descartadas e o resultado vem congelado.
- **Registry de tipos de campo**: cada tipo define `parseConfig`, `isEmpty`, `validate`, `conditionOps` e `isValidConditionValue`. Tipos customizados usam a mesma API (`defineFieldType` + `createRegistry`).

**Tipos no v1:** `text` (com `format: email | url`), `longText`, `number`, `boolean`, `choice`, `multiChoice`, `scale`, `section`.
**Depois:** `date`, `file/image`, `group/repeater`, `matrix`, `signature`, `location`.

**Condições:** DSL em JSON (`all` / `any` / `not`, `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `notIn`, `includes`, `answered`, `notAnswered`). Sem `eval`.

- Só pode referenciar campos **anteriores**, o que evita ciclos.
- Comparações só batem com campos respondidos e visíveis. Visibilidade cascateia.
- Campo escondido não é validado e sai do resultado.

**Validação:** `form.validate(answers)` devolve `{ ok, data } | { ok: false, errors: [{ fieldId, code, params }] }`. São **códigos**, não mensagens, e cada app traduz. `data` é tipado via `InferAnswers` quando o form vem de `defineForm`.

**i18n:** textos podem ser `string` ou `{ pt: "...", en: "..." }`, resolvidos com `resolveText`.

## 3. Exporters (fase 2, plugáveis)

| Formato             | Uso                                                              |
| ------------------- | ---------------------------------------------------------------- |
| `json`              | `{ key: valor }` pra API                                         |
| `qa-list`           | `[{ question, answer }]` legível, pra email ou tela de resumo    |
| `formData`          | envio com arquivos                                               |
| `csv`               | várias submissões viram linhas, com cabeçalho a partir do schema |
| `markdown` / `html` | email e relatório                                                |
| `json-schema`       | interoperar com outras ferramentas                               |

Cada tipo de campo ganha um `toDisplay(value, field, locale)` pra isso.

## 4. Versionamento

- Cada resposta guarda `{ formId, version }`, e o app guarda um snapshot do schema por versão.
- `readAnswers(answers, schemaSnapshot)` exibe respostas antigas mesmo com perguntas removidas.
- Depois: `diffSchemas(v2, v3)`.

## 5. React (`/react`)

- `useExcaliburForm(schema)`: estado, visibilidade, erros e submit (headless).
- `<FormRenderer schema components={{ boolean: MeuSwitch }} />`: componentes padrão sem estilo e cada um pode ser trocado.

## 6. Builder (`/builder`)

- `<FormBuilder value={schema} onChange={setSchema} />`: adicionar e reordenar campos, editar config, editor de condições e preview.
- Gera IDs estáveis sozinho e só emite schemas válidos. É o argumento de venda.

## 7. Segurança (o schema vem de usuário)

- Labels sempre renderizados como texto, nunca HTML.
- Sem regex de usuário (risco de ReDoS). Formatos pré-definidos com checagem linear.
- Limites configuráveis (`SchemaLimits`): campos, opções, tamanho de textos, idiomas, profundidade e nós das condições, tamanho das respostas, passos da escala.
- O back valida com o mesmo core.

## 8. Roadmap

| Fase  | Entrega                                                                                    | Status |
| ----- | ------------------------------------------------------------------------------------------ | ------ |
| **0** | Monorepo, tooling, CI (format, lint, typecheck, test, build)                               | ✅     |
| **1** | Core: schema + parse, registry, 8 tipos, validação, condições, inferência de tipos, testes | ✅     |
| **—** | Demo (`apps/demo`)                                                                         | ✅     |
| **2** | Exporters (json, qa-list, formData, csv, markdown)                                         |        |
| **3** | `@excalibur-form/react` (a demo passa a usar ele)                                          |        |
| **4** | Builder                                                                                    |        |
| **5** | Versionamento, docs, publicar **v0.1**                                                     |        |
| **6** | Primeiro uso real: fichas customizáveis no Excalibur Notes                                 |        |

## 9. Decisões em aberto

1. Scope no npm (ver quando for publicar).
2. Estilo dos componentes padrão do `/react`: sem estilo (recomendado) ou Tailwind.
3. Builder no v0.1 ou v0.2.
