# ExcaliburForm

**Formulários dinâmicos como dados.** Você descreve o formulário em JSON (dá pra salvar no banco, editar num painel, versionar), e a lib valida esse schema, decide quais campos aparecem, valida as respostas e devolve os dados tipados. O mesmo código roda no front e no back.

```
schema (JSON) ──► parseForm / defineForm ──► form
                                              ├─ visibleFieldIds(respostas)  → o que mostrar agora
                                              └─ validate(respostas)         → { ok, data } | { ok: false, errors }
```

- **Zero dependências**, roda em Node, browser, edge, React Native…
- **TypeScript primeiro**: o tipo das respostas é inferido do schema.
- **Seguro pra schema vindo de usuário**: tudo é validado e limitado, sem `eval` e sem regex vinda de fora.
- **Headless**: não renderiza nada, então funciona com qualquer UI.

> **Status:** em desenvolvimento (fase 1 de 6, veja o [roadmap](docs/PLAN.md)). O core funciona e é testado, mas ainda não está publicado no npm e a API pode mudar.

---

## Sumário

- [Quando usar (e quando não usar)](#quando-usar-e-quando-não-usar)
- [Rodando a demo](#rodando-a-demo)
- [Instalação](#instalação)
- [Guia rápido](#guia-rápido)
- [O schema](#o-schema)
- [Tipos de campo](#tipos-de-campo)
- [Condições (`showIf`)](#condições-showif)
- [Validando respostas](#validando-respostas)
- [Erros de schema](#erros-de-schema)
- [Tipos inferidos](#tipos-inferidos)
- [Textos em vários idiomas](#textos-em-vários-idiomas)
- [Renderizando o form (exemplo em React)](#renderizando-o-form-exemplo-em-react)
- [Usando no backend](#usando-no-backend)
- [Tipos de campo customizados](#tipos-de-campo-customizados)
- [Limites e segurança](#limites-e-segurança)
- [Referência da API](#referência-da-api)
- [Desenvolvimento](#desenvolvimento)
- [Roadmap](#roadmap)

---

## Quando usar (e quando não usar)

**Se o seu formulário é fixo** (contato, login, cadastro), **não use esta lib**. React Hook Form + Zod resolve melhor.

**Use quando o formulário é dado, não código:**

| Situação                                                    | Por que ajuda                                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Um admin ou cliente **cadastra as perguntas** num painel    | Você não precisa inventar o modelo de "pergunta", o `switch` por tipo, a validação dinâmica e a lógica de "mostrar se" |
| O mesmo form precisa ser **validado no front e no back**    | O schema é JSON e a validação é a mesma função nos dois lados                                                          |
| Você tem **dezenas de checklists/questionários**            | Cada um é um JSON, não um componente                                                                                   |
| Os forms **mudam com o tempo** e respostas antigas importam | IDs estáveis: renomear um label ou reordenar campos não quebra nada                                                    |

Exemplos: checklists de vistoria, anamnese, pesquisas de satisfação, onboarding configurável, fichas de RPG customizáveis, formulários por cliente/tenant.

---

## Rodando a demo

O repositório tem uma demo onde você edita o schema em JSON e vê o formulário, as condições e a validação mudando ao vivo.

Pré-requisitos: **Node 24+** e **pnpm** (`corepack enable` já instala a versão certa).

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form
pnpm install
pnpm dev
```

Abra http://localhost:5173. Tem três exemplos prontos (vistoria de veículo, ficha de RPG e uma pesquisa em pt/en).

---

## Instalação

O pacote ainda não está no npm. Por enquanto, pra usar em outro projeto:

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form && pnpm install && pnpm build
```

E no seu projeto, aponte pra pasta do pacote:

```bash
pnpm add /caminho/para/excalibur-form/packages/core
```

Quando for publicado, vai ser só:

```bash
pnpm add @excalibur-form/core
```

O pacote é **ESM** e exige Node 20.19+ (ou qualquer bundler moderno).

---

## Guia rápido

### 1. Defina um formulário

Em código (com tipos inferidos):

```ts
import { defineForm } from '@excalibur-form/core';

const vistoria = defineForm({
	id: 'vistoria',
	version: 1,
	title: 'Vistoria de veículo',
	fields: [
		{
			id: 'placa',
			type: 'text',
			label: 'Placa',
			required: true,
			maxLength: 8,
		},
		{
			id: 'combustivel',
			type: 'choice',
			label: 'Combustível',
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
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
			label: 'Valor das multas (R$)',
			required: true,
			min: 0,
			showIf: { field: 'tem_multa', op: 'eq', value: true },
		},
	],
});
```

Ou a partir de um JSON vindo do banco/API (o caso mais comum):

```ts
import { parseForm } from '@excalibur-form/core';

const parsed = parseForm(JSON.parse(schemaSalvoNoBanco));

if (!parsed.ok) {
	// schema inválido: veja "Erros de schema"
	console.error(parsed.issues);
} else {
	const form = parsed.value;
}
```

> `defineForm` **lança** `FormSchemaError` se o schema for inválido (bom pra código, onde é bug). `parseForm` **devolve** os problemas (bom pra dado externo).

### 2. Descubra o que mostrar

```ts
vistoria.visibleFieldIds({ tem_multa: false });
// Set { 'placa', 'combustivel', 'tem_multa' }

vistoria.visibleFieldIds({ tem_multa: true });
// Set { 'placa', 'combustivel', 'tem_multa', 'valor_multas' }
```

### 3. Valide as respostas

```ts
const result = vistoria.validate({
	placa: 'ABC1D23',
	combustivel: 'flex',
	tem_multa: false,
	valor_multas: 500, // ignorado: o campo está escondido
	qualquerCoisa: 1, // ignorado: não existe no schema
});

if (result.ok) {
	result.data;
	// { placa: 'ABC1D23', combustivel: 'flex', tem_multa: false }
} else {
	result.errors;
	// [{ fieldId: 'placa', code: 'required' }, ...]
}
```

Pronto: esse é o ciclo todo. O resto deste README detalha cada parte.

---

## O schema

```ts
interface FormSchema {
	id: string; // identificador do formulário
	version: number; // inteiro >= 1; incremente quando o form mudar
	title?: LocalizedText;
	description?: LocalizedText;
	fields: Field[];
}
```

Todo campo tem estas propriedades comuns:

| Propriedade   | Tipo            | Obrigatória | Descrição                                                                                                             |
| ------------- | --------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`          | `string`        | sim         | ID **estável**. As respostas e as condições usam ele. Começa com letra; letras, números, `_` e `-`, até 64 caracteres |
| `type`        | `string`        | sim         | Tipo do campo (veja abaixo)                                                                                           |
| `label`       | `LocalizedText` | sim         | Pergunta exibida                                                                                                      |
| `description` | `LocalizedText` | não         | Texto de ajuda                                                                                                        |
| `required`    | `boolean`       | não         | Se precisa ser respondido (quando visível)                                                                            |
| `showIf`      | `Condition`     | não         | O campo só aparece (e só é validado) quando a condição é verdadeira                                                   |
| `key`         | `string`        | não         | Nome usado nas exportações (padrão: o `id`). Útil pra manter o `id` estável e mudar o nome externo                    |

**Por que `id` estável?** Num painel de perguntas, o usuário vai renomear labels e reordenar campos. Como as respostas são guardadas pelo `id` (e as opções de escolha também pelo `id` delas), nada quebra.

Regras que o `parseForm` garante:

- `id`s de campos únicos, `id`s de opções únicos dentro do campo, e `key`s de exportação únicas.
- Propriedades desconhecidas são **descartadas**, e o schema devolvido vem **congelado** (`Object.freeze`).

---

## Tipos de campo

### `text`: texto curto

```json
{
	"id": "email",
	"type": "text",
	"label": "E-mail",
	"format": "email",
	"required": true
}
```

| Config        | Tipo               | Descrição                                     |
| ------------- | ------------------ | --------------------------------------------- |
| `minLength`   | `number`           | Mínimo de caracteres                          |
| `maxLength`   | `number`           | Máximo de caracteres (teto padrão: 10.000)    |
| `format`      | `'email' \| 'url'` | Valida o formato (`url` aceita só http/https) |
| `placeholder` | `LocalizedText`    |                                               |

Resposta: `string`. Texto só com espaços conta como **não respondido**.

### `longText`: texto longo

Igual ao `text`, sem `format`. Teto padrão de 100.000 caracteres. Resposta: `string`.

### `number`

```json
{
	"id": "idade",
	"type": "number",
	"label": "Idade",
	"integer": true,
	"min": 0,
	"max": 130
}
```

| Config        | Tipo            | Descrição            |
| ------------- | --------------- | -------------------- |
| `min` / `max` | `number`        | Limites (inclusivos) |
| `integer`     | `boolean`       | Só aceita inteiros   |
| `placeholder` | `LocalizedText` |                      |

Resposta: `number` finito. **Strings como `"5"` são rejeitadas**: converta no input (veja o exemplo em React).

### `boolean`

```json
{
	"id": "aceita",
	"type": "boolean",
	"label": "Aceita os termos?",
	"required": true
}
```

Resposta: `true` ou `false`. **`false` conta como respondido** (só `null`/`undefined` contam como vazio).

### `choice`: escolha única

```json
{
	"id": "cor",
	"type": "choice",
	"label": "Cor",
	"options": [
		{ "id": "azul", "label": "Azul" },
		{ "id": "verde", "label": "Verde" }
	]
}
```

| Config    | Tipo                                     | Descrição                      |
| --------- | ---------------------------------------- | ------------------------------ |
| `options` | `{ id: string; label: LocalizedText }[]` | Obrigatório, de 1 a 200 opções |

Resposta: o **`id` da opção** (`'azul'`), nunca o label.

### `multiChoice`: múltipla escolha

```json
{
	"id": "opcionais",
	"type": "multiChoice",
	"label": "Opcionais",
	"minSelected": 1,
	"maxSelected": 2,
	"options": [
		{ "id": "ar", "label": "Ar-condicionado" },
		{ "id": "teto", "label": "Teto solar" },
		{ "id": "couro", "label": "Couro" }
	]
}
```

| Config        | Tipo              | Descrição                 |
| ------------- | ----------------- | ------------------------- |
| `options`     | igual ao `choice` | Obrigatório               |
| `minSelected` | `number`          | Mínimo de opções marcadas |
| `maxSelected` | `number`          | Máximo de opções marcadas |

Resposta: `string[]` de `id`s, sem repetição. Array vazio conta como **não respondido**.

### `scale`: escala numérica

```json
{
	"id": "nps",
	"type": "scale",
	"label": "Nota",
	"min": 0,
	"max": 10,
	"minLabel": "Nada provável",
	"maxLabel": "Muito provável"
}
```

| Config                  | Tipo            | Descrição                                  |
| ----------------------- | --------------- | ------------------------------------------ |
| `min` / `max`           | `number`        | Inteiros, padrão `1` a `5`, até 100 passos |
| `minLabel` / `maxLabel` | `LocalizedText` | Rótulos das pontas                         |

Resposta: inteiro entre `min` e `max`. Use `scaleBounds(field)` pra ler os limites já com os padrões aplicados.

### `section`: bloco informativo

```json
{
	"id": "dados_pessoais",
	"type": "section",
	"label": "Dados pessoais",
	"description": "Preencha com atenção."
}
```

Título/texto entre perguntas. **Não tem resposta**: não aceita `required` nem `key`, e não pode ser referenciado em condições. Pode ter `showIf`.

---

## Condições (`showIf`)

Condições são JSON puro, avaliado sem `eval`. Um campo com `showIf` só aparece quando a condição é verdadeira.

### Comparações

```json
{ "field": "<id de um campo anterior>", "op": "<operador>", "value": <valor> }
```

| Operador                    | `value`            | Significado                                     | Tipos de campo                                  |
| --------------------------- | ------------------ | ----------------------------------------------- | ----------------------------------------------- |
| `eq` / `neq`                | string/number/bool | igual / diferente                               | todos (menos `multiChoice`)                     |
| `gt` / `gte` / `lt` / `lte` | `number`           | maior / maior ou igual / menor / menor ou igual | `number`, `scale`                               |
| `in` / `notIn`              | array              | está / não está na lista                        | `text`, `longText`, `number`, `scale`, `choice` |
| `includes`                  | `string` (id)      | a resposta (array) contém a opção               | `multiChoice`                                   |
| `answered` / `notAnswered`  | (nenhum)           | foi / não foi respondido                        | todos                                           |

### Combinando

```json
{
	"all": [
		{ "field": "classe", "op": "eq", "value": "ladino" },
		{
			"any": [
				{ "field": "nivel", "op": "gte", "value": 5 },
				{
					"field": "pericias",
					"op": "includes",
					"value": "furtividade"
				}
			]
		},
		{ "not": { "field": "banido", "op": "eq", "value": true } }
	]
}
```

- `all`: todas verdadeiras (E)
- `any`: pelo menos uma verdadeira (OU)
- `not`: inverte

### Regras importantes

1. **Só dá pra referenciar campos que vêm antes** no schema. Isso impede ciclos (A depende de B que depende de A). Referenciar o próprio campo ou um posterior dá erro `forward_reference`.
2. **Comparações só batem com campos respondidos e visíveis.** Se o campo não foi respondido, `eq`, `neq`, `in`, `notIn` etc. dão `false`. Pra incluir o caso vazio, use `notAnswered`:
    ```json
    {
    	"any": [
    		{ "field": "x", "op": "neq", "value": "a" },
    		{ "field": "x", "op": "notAnswered" }
    	]
    }
    ```
3. **A visibilidade cascateia.** Se B depende de A e C depende de B, esconder B também esconde C, mesmo que B tenha um valor guardado.
4. O `parseForm` confere se o operador faz sentido pro tipo do campo e se o valor é válido (ex.: em `choice`, o `value` precisa ser o `id` de uma opção que existe).

---

## Validando respostas

```ts
const result = form.validate(respostas);
```

- `respostas` é um objeto `{ [idDoCampo]: valor }`.
- **Campos escondidos são ignorados**: não são validados e não aparecem em `data`.
- **Chaves desconhecidas são ignoradas.**
- Campos vazios e opcionais simplesmente não aparecem em `data`.
- Todos os erros são retornados de uma vez (não para no primeiro).

```ts
type ValidationResult<T> =
	| { ok: true; data: T }
	| { ok: false; errors: ValidationError[] };

interface ValidationError {
	fieldId: string | null; // null = o objeto de respostas em si é inválido
	code: ValidationCode;
	params?: Record<string, string | number>;
}
```

### Códigos de erro

A lib devolve **códigos**, não mensagens: cada app traduz como quiser.

| Código             | `params`     | Quando                                  |
| ------------------ | ------------ | --------------------------------------- |
| `required`         | (nenhum)     | Campo obrigatório visível e vazio       |
| `invalid_type`     | (nenhum)     | Tipo errado (ex.: string num `number`)  |
| `too_short`        | `{ min }`    | Texto menor que `minLength`             |
| `too_long`         | `{ max }`    | Texto maior que `maxLength` (ou o teto) |
| `too_small`        | `{ min }`    | Número abaixo de `min`                  |
| `too_big`          | `{ max }`    | Número acima de `max`                   |
| `not_integer`      | (nenhum)     | Decimal onde só inteiro é aceito        |
| `invalid_format`   | `{ format }` | `email` ou `url` inválido               |
| `invalid_option`   | `{ option }` | `id` de opção que não existe            |
| `duplicate_option` | `{ option }` | Opção repetida no `multiChoice`         |
| `too_few`          | `{ min }`    | Menos opções que `minSelected`          |
| `too_many`         | `{ max }`    | Mais opções que `maxSelected`           |

Exemplo de tradução:

```ts
import type { AnswerIssue } from '@excalibur-form/core';

function mensagem(issue: AnswerIssue): string {
	const p = issue.params ?? {};
	switch (issue.code) {
		case 'required':
			return 'Campo obrigatório';
		case 'too_long':
			return `Máximo de ${p.max} caracteres`;
		case 'invalid_format':
			return p.format === 'email' ? 'E-mail inválido' : 'URL inválida';
		// ...
		default:
			return 'Valor inválido';
	}
}
```

---

## Erros de schema

Quando o schema em si é inválido, `parseForm` devolve `{ ok: false, issues }`:

```ts
interface SchemaIssue {
	path: (string | number)[]; // onde está o problema
	code: SchemaIssueCode;
	message: string; // em inglês, pra devs
}
```

```ts
import { formatPath, parseForm } from '@excalibur-form/core';

const parsed = parseForm({
	id: 'f',
	version: 1,
	fields: [
		{
			id: 'cor',
			type: 'choice',
			label: 'Cor',
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

Códigos: `invalid_type`, `required`, `invalid_value`, `invalid_id`, `too_long`, `too_many`, `too_few`, `duplicate_id`, `duplicate_key`, `unknown_field_type`, `invalid_condition`, `unknown_reference`, `forward_reference`, `unsupported_operator`.

Num builder/painel, use isso pra mostrar o erro no lugar certo antes de salvar o schema.

---

## Tipos inferidos

Com `defineForm`, o TypeScript sabe o formato exato das respostas válidas:

```ts
import { defineForm, type InferAnswers } from '@excalibur-form/core';

const form = defineForm({
	id: 'f',
	version: 1,
	fields: [
		{ id: 'nome', type: 'text', label: 'Nome', required: true },
		{
			id: 'cor',
			type: 'choice',
			label: 'Cor',
			options: [
				{ id: 'azul', label: 'Azul' },
				{ id: 'verde', label: 'Verde' },
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
			showIf: { field: 'nome', op: 'answered' },
		},
	],
});

type Respostas = InferAnswers<typeof form.schema>;
// {
//   nome: string;               ← obrigatório e sem showIf: sempre presente
//   cor?: 'azul' | 'verde';     ← union dos ids das opções
//   tags?: 'a'[];
//   extra?: number;             ← obrigatório, mas tem showIf: pode estar escondido
// }

const result = form.validate(input);
if (result.ok) result.data.cor; // 'azul' | 'verde' | undefined
```

Com `parseForm` (schema desconhecido em tempo de compilação), `data` é `Record<string, unknown>`.

---

## Textos em vários idiomas

Qualquer texto (`label`, `description`, `placeholder`, labels de opções, `title`…) pode ser uma string ou um mapa de idiomas:

```json
{
	"id": "nome",
	"type": "text",
	"label": { "pt": "Seu nome", "en": "Your name" }
}
```

```ts
import { resolveText } from '@excalibur-form/core';

resolveText(field.label, 'en'); // 'Your name'
resolveText(field.label, 'es', 'pt'); // 'Seu nome' (fallback)
resolveText(field.label, 'es'); // 'Seu nome' (primeiro disponível)
resolveText('Texto simples', 'en'); // 'Texto simples'
```

---

## Renderizando o form (exemplo em React)

A lib não renderiza nada (um pacote `@excalibur-form/react` está no roadmap). Mas montar um renderer é simples: percorra `form.schema.fields`, mostre só os visíveis e faça um `switch` por tipo.

```tsx
import {
	resolveText,
	type BuiltinField,
	type Form,
} from '@excalibur-form/core';
import { useState } from 'react';

export function DynamicForm({
	form,
	onSubmit,
}: {
	form: Form;
	onSubmit: (data: unknown) => void;
}) {
	const [answers, setAnswers] = useState<Record<string, unknown>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const set = (id: string, value: unknown) =>
		setAnswers((prev) => ({ ...prev, [id]: value }));

	const visible = form.visibleFieldIds(answers);

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				const result = form.validate(answers);
				if (result.ok) return onSubmit(result.data);
				setErrors(
					Object.fromEntries(
						result.errors.map((err) => [err.fieldId, err.code]),
					),
				);
			}}
		>
			{form.schema.fields.map((raw) => {
				const field = raw as BuiltinField;
				if (!visible.has(field.id)) return null;
				const label = resolveText(field.label, 'pt');
				if (field.type === 'section')
					return <h3 key={field.id}>{label}</h3>;

				return (
					<div key={field.id}>
						<label>{label}</label>
						{field.type === 'text' && (
							<input
								value={(answers[field.id] as string) ?? ''}
								onChange={(e) => set(field.id, e.target.value)}
							/>
						)}
						{field.type === 'number' && (
							<input
								type="number"
								value={(answers[field.id] as number) ?? ''}
								// converta: a lib não aceita "5" como número
								onChange={(e) =>
									set(
										field.id,
										e.target.value === ''
											? undefined
											: e.target.valueAsNumber,
									)
								}
							/>
						)}
						{field.type === 'boolean' && (
							<input
								type="checkbox"
								checked={answers[field.id] === true}
								onChange={(e) =>
									set(field.id, e.target.checked)
								}
							/>
						)}
						{field.type === 'choice' &&
							field.options.map((option) => (
								<label key={option.id}>
									<input
										type="radio"
										checked={
											answers[field.id] === option.id
										}
										onChange={() =>
											set(field.id, option.id)
										}
									/>
									{resolveText(option.label, 'pt')}
								</label>
							))}
						{/* longText, multiChoice, scale: veja apps/demo/src/FieldInput.tsx */}
						{errors[field.id] && <small>{errors[field.id]}</small>}
					</div>
				);
			})}
			<button type="submit">Enviar</button>
		</form>
	);
}
```

Um renderer completo, com todos os tipos, está em [`apps/demo/src/FieldInput.tsx`](apps/demo/src/FieldInput.tsx).

> **Segurança:** renderize labels e descrições sempre como texto (como o React já faz por padrão). Nunca use `dangerouslySetInnerHTML` com textos do schema.

---

## Usando no backend

O ponto principal: **o back valida com a mesma função do front**. Nunca confie no que o front mandou.

```ts
import { parseForm } from '@excalibur-form/core';

// 1. Ao SALVAR um schema (vindo do painel/builder)
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

// 2. Ao RECEBER respostas
app.post('/forms/:id/responses', async (req, res) => {
	const row = await db.forms.findLatest(req.params.id);
	const parsed = parseForm(row.schema);
	if (!parsed.ok) throw new Error('schema salvo está inválido');

	const result = parsed.value.validate(req.body);
	if (!result.ok) return res.status(422).json({ errors: result.errors });

	// salve a versão junto: assim respostas antigas continuam legíveis
	await db.responses.insert({
		formId: row.id,
		formVersion: row.version,
		answers: result.data,
	});
	res.status(201).end();
});
```

Dicas:

- **Guarde `formVersion` em cada resposta** e mantenha um snapshot do schema por versão. Assim dá pra exibir respostas antigas mesmo depois de editar o form.
- Faça cache do `form` montado por `(id, version)` se o volume for alto. O `parseForm` é rápido, mas não precisa rodar a cada request.
- Salve `result.data` (o valor limpo), não o `req.body`.

---

## Tipos de campo customizados

Os tipos nativos são implementados com a mesma API que você usa pra criar os seus.

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

// 1. O formato do campo no schema
interface CpfField extends FieldBase {
	readonly type: 'cpf';
	readonly allowFormatted?: boolean;
}

// 2. A definição do tipo
const cpfType = defineFieldType<CpfField, string>({
	type: 'cpf',
	answerable: true, // false pra blocos sem resposta, tipo `section`
	conditionOps: ['answered', 'notAnswered'], // operadores que outras condições podem usar com este campo

	// Valida e limpa a config específica do tipo. As props comuns (id, label, showIf…) a lib já trata.
	parseConfig: (reader) => {
		const allowFormatted = reader.boolean('allowFormatted');
		return allowFormatted === undefined ? {} : { allowFormatted };
	},

	isEmpty: (value) => value === undefined || value === null || value === '',

	// Recebe só valores não vazios. Devolve o valor normalizado ou os erros.
	validate: (value, field) => {
		if (typeof value !== 'string') return reject('invalid_type');
		const digits = field.allowFormatted
			? value.replace(/[.-]/g, '')
			: value;
		return /^\d{11}$/.test(digits)
			? accept(digits)
			: reject('invalid_format', { format: 'cpf' });
	},
});

// 3. Registre junto com os nativos
const registry = createRegistry([...builtinFieldTypes, cpfType]);

const parsed = parseForm(schema, { registry });
```

O `reader` em `parseConfig` tem helpers que já reportam erros com o caminho certo: `number(key, { integer, min, max })`, `boolean(key)`, `text(key)`, `requiredText(key)`, `oneOf(key, valores)`, `id(key)`, `options(key)` e `issue(key, code, message)` pra problemas próprios. O registry precisa ser o mesmo no front e no back.

---

## Limites e segurança

Como o schema costuma vir de usuários, tudo tem teto. Os padrões:

| Limite                    | Padrão  | O que limita                                |
| ------------------------- | ------- | ------------------------------------------- |
| `maxFields`               | 500     | Campos por formulário                       |
| `maxOptions`              | 200     | Opções por `choice` / `multiChoice`         |
| `maxTextLength`           | 2.000   | Tamanho de labels, descrições, placeholders |
| `maxLocales`              | 20      | Idiomas por texto                           |
| `maxConditionDepth`       | 8       | Aninhamento de `all`/`any`/`not`            |
| `maxConditionNodes`       | 64      | Tamanho total de um `showIf`                |
| `maxTextAnswerLength`     | 10.000  | Resposta de `text`                          |
| `maxLongTextAnswerLength` | 100.000 | Resposta de `longText`                      |
| `maxScaleSteps`           | 100     | Passos de uma `scale`                       |

Pra mudar, passe o mesmo `limits` no front e no back:

```ts
parseForm(schema, { limits: { maxFields: 50, maxTextAnswerLength: 500 } });
```

O que a lib faz por você:

- **Nada de `eval`**: condições são dados.
- **Nada de regex vinda do usuário** (evita ReDoS). Os formatos são pré-definidos e checados em tempo linear.
- **Propriedades herdadas são ignoradas**: `constructor` e `__proto__` nas respostas não fazem nada.
- **Schema congelado** depois do parse.

O que é com você:

- Renderizar textos do schema **como texto**, nunca como HTML.
- **Validar no back** sempre, com o mesmo schema.

---

## Referência da API

| Export                                                           | O que faz                                                                                       |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `defineForm(schema, options?)`                                   | Cria um `Form` com tipos inferidos; lança `FormSchemaError`                                     |
| `parseForm(raw, options?)`                                       | Cria um `Form` a partir de dado não confiável; devolve `{ ok, value } \| { ok: false, issues }` |
| `parseSchema(raw, options?)`                                     | Só valida/limpa o schema, sem montar o `Form`                                                   |
| `form.validate(answers)`                                         | Valida respostas                                                                                |
| `form.visibleFieldIds(answers)`                                  | `Set` com os ids visíveis (inclui `section`)                                                    |
| `form.field(id)`                                                 | Campo pelo id                                                                                   |
| `form.answerableFields`                                          | Campos com resposta (sem `section`), em ordem                                                   |
| `form.schema` / `form.limits`                                    | Schema parseado (congelado) e limites em uso                                                    |
| `evaluateCondition(condition, lookup)`                           | Avalia uma condição isolada                                                                     |
| `resolveText(text, locale?, fallback?)`                          | Resolve um `LocalizedText`                                                                      |
| `scaleBounds(field)`                                             | `{ min, max }` de uma `scale` com padrões aplicados                                             |
| `formatPath(path)`                                               | `['fields', 0, 'id']` → `'fields[0].id'`                                                        |
| `defineFieldType(def)`                                           | Helper de tipagem pra tipos customizados                                                        |
| `createRegistry(defs)` / `builtinFieldTypes` / `defaultRegistry` | Registry de tipos de campo                                                                      |
| `accept(value)` / `reject(code, params?)`                        | Retornos de `validate` em tipos customizados                                                    |
| `FormSchemaError`                                                | Erro lançado por `defineForm` (tem `.issues`)                                                   |
| `DEFAULT_LIMITS`                                                 | Limites padrão                                                                                  |
| `InferAnswers<S>` / `AnswerOf<F>`                                | Tipos inferidos                                                                                 |

`options` = `{ registry?: FieldRegistry; limits?: Partial<SchemaLimits> }`.

---

## Desenvolvimento

```
packages/core   @excalibur-form/core: a lib
apps/demo       demo em Vite + React
docs/PLAN.md    plano e roadmap
```

```bash
pnpm install
pnpm dev            # demo
pnpm test           # testes (vitest)
pnpm test:cov       # com cobertura
pnpm check          # format + lint + typecheck + testes + build (o mesmo que o CI roda)
pnpm format         # formata (oxfmt)
```

Stack: TypeScript 7 (strict, `isolatedDeclarations`, `exactOptionalPropertyTypes`), vitest, oxlint, oxfmt, changesets e GitHub Actions.

---

## Roadmap

- [x] **Fase 0**: monorepo, tooling, CI
- [x] **Fase 1**: core (schema, 8 tipos de campo, condições, validação, tipos inferidos)
- [x] Demo
- [ ] **Fase 2**: exportadores (JSON por `key`, lista pergunta/resposta, CSV, FormData, Markdown)
- [ ] **Fase 3**: `@excalibur-form/react` (renderer headless com componentes trocáveis)
- [ ] **Fase 4**: `@excalibur-form/builder` (montar o form visualmente)
- [ ] **Fase 5**: versionamento de respostas, docs e publicação no npm
- [ ] Mais tipos: `date`, `file`/`image`, grupos repetíveis, matriz

Detalhes em [docs/PLAN.md](docs/PLAN.md).

---

## Licença

[MIT](LICENSE)
