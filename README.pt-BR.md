<p align="center">
	<img src="assets/logo.svg" width="180" alt="Ícone do ExcaliburForm: formulário com checkboxes na frente de uma espada de guarda dourada, dentro de um círculo mágico" />
</p>

<h1 align="center">ExcaliburForm</h1>

<p align="center"><a href="README.md">English</a> · <strong>Português (Brasil)</strong></p>

**Formulários dinâmicos como dados.** Você descreve o formulário em JSON (dá pra salvar no banco, editar num painel, versionar), e a lib valida esse schema, decide quais campos aparecem, valida as respostas e devolve os dados tipados. O mesmo código roda no front e no back.

```
schema (JSON) ──► parseForm / defineForm ──► form
                                              ├─ visibleFieldIds(respostas)  → o que mostrar agora
                                              └─ validate(respostas)         → { ok, data } | { ok: false, errors }
```

- **Zero dependências**, roda em Node, browser, edge, React Native…
- **TypeScript primeiro**: o tipo das respostas é inferido do schema.
- **Seguro pra schema vindo de usuário**: tudo é validado e limitado, sem `eval` e sem regex vinda de fora.
- **Inglês e português de fábrica**: textos das exportações e mensagens de erro do React vêm em inglês (padrão) e português do Brasil (e espanhol). Os textos do próprio form podem ter quantos idiomas você quiser.
- **Headless**: o core não renderiza nada, então funciona com qualquer UI. Pra React tem o `@excalibur-form/react` (hook + renderer sem estilo).

> **Status:** em desenvolvimento (fase 3 de 6, veja o [roadmap](docs/PLAN.pt-BR.md)). O core funciona e é testado, mas ainda não está publicado no npm e a API pode mudar.

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
- [React (`@excalibur-form/react`)](#react-excalibur-formreact)
- [Usando no backend](#usando-no-backend)
- [Exportando respostas](#exportando-respostas)
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

O repositório tem uma demo onde você edita o schema em JSON e vê o formulário (renderizado pelo `@excalibur-form/react`), as condições, a validação e as exportações mudando ao vivo.

Pré-requisitos: **Node 24+** e **pnpm** (`corepack enable` já instala a versão certa).

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form
pnpm install
pnpm dev
```

Abra http://localhost:5173. Tem três exemplos prontos (vistoria de veículo, ficha de RPG e pesquisa de satisfação), todos com textos em inglês e português: troque o idioma na barra do topo.

---

## Instalação

Os pacotes ainda não estão no npm. Por enquanto, pra usar em outro projeto:

```bash
git clone https://github.com/GuilhermeAndreotti/excalibur-form.git
cd excalibur-form && pnpm install && pnpm build
```

E no seu projeto, aponte pra pasta do pacote:

```bash
pnpm add /caminho/para/excalibur-form/packages/core
pnpm add /caminho/para/excalibur-form/packages/react   # se for usar React
```

Quando for publicado, vai ser só:

```bash
pnpm add @excalibur-form/core
pnpm add @excalibur-form/react   # opcional
```

Os pacotes são **ESM** e exige Node 20.19+ (ou qualquer bundler moderno).

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

## React (`@excalibur-form/react`)

Pacote opcional com duas peças: um **hook headless** (estado, visibilidade, erros e envio, sem renderizar nada) e um **`<FormRenderer>`** com componentes padrão **sem estilo**, cada um trocável.

```bash
pnpm add @excalibur-form/react   # quando publicado; peer: react 18 ou 19
```

### O jeito rápido

```tsx
import { defineForm } from '@excalibur-form/core';
import { FormRenderer } from '@excalibur-form/react';

const vistoria = defineForm({ ... });

export function Vistoria() {
	return (
		<FormRenderer
			form={vistoria}
			locale="pt-BR"
			onSubmit={async (data) => {
				// `data` já validado e tipado
				await fetch('/api/vistorias', {
					method: 'POST',
					body: JSON.stringify(data),
				});
			}}
		/>
	);
}
```

O renderer cuida de:

- mostrar só os campos visíveis (as condições reagem enquanto a pessoa preenche);
- erros depois que o campo perde o foco, ou de todos ao tentar enviar, e **foco no primeiro campo com erro**;
- acessibilidade: `<label>` ligado ao input, `<fieldset>`/`<legend>` pra radios e checkboxes, `aria-invalid`, `aria-describedby` apontando pra descrição e pros erros;
- mensagens de erro padrão em inglês, português e espanhol, escolhidas pelo `locale` (sem `locale`, inglês; `formatError` pra usar as suas);
- desabilitar o form enquanto o `onSubmit` assíncrono roda.

Com schema vindo do banco, monte o `Form` com `parseForm` dentro de um `useMemo` e trate o `ok: false`.

### Trocando componentes

Qualquer tipo pode usar o seu componente; os outros continuam com o padrão.

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
	components={{ boolean: Switch, cpf: MeuInputDeCpf }} // tipos customizados entram pelo nome
	FieldWrapper={MinhaMoldura} // label + descrição + erros
>
	<button type="submit">Salvar</button> {/* substitui o botão padrão */}
</FormRenderer>;
```

Cada componente recebe `FieldInputProps`: `field`, `id`, `value`, `onChange`, `onBlur`, `invalid`, `required`, `disabled`, `describedBy`, `t` (resolve `LocalizedText`), `labels` ("Sim"/"Não") e `locale`. A `section` recebe `{ field, title, description }`. Componente com vários controles (tipo radios) pode declarar `MeuComponente.group = true` pra moldura padrão usar `<fieldset>`.

Os componentes padrão não trazem CSS, mas têm classes estáveis pra estilizar: `ef-form`, `ef-field` (com `data-invalid` quando há erro), `ef-label`, `ef-required`, `ef-description`, `ef-input`, `ef-options`, `ef-option`, `ef-boolean`, `ef-scale`, `ef-scale-steps`, `ef-scale-label`, `ef-section`, `ef-errors`, `ef-error` e `ef-submit`. A demo tem um exemplo em [`apps/demo/src/styles.css`](apps/demo/src/styles.css).

### Só o hook

Pra montar a UI do zero (ou ler o estado de fora do renderer):

```tsx
import { useExcaliburForm } from '@excalibur-form/react';

const ctl = useExcaliburForm(form, {
	initialAnswers: rascunho,
	onSubmit: salvar,
	showErrors: 'touched', // 'touched' (padrão) | 'submit' | 'always'
});

ctl.answers; // respostas cruas (inclusive de campos escondidos agora)
ctl.visibleFieldIds; // Set
ctl.result; // form.validate(answers), sempre atualizado
ctl.errors; // Map fieldId → erros que devem aparecer agora
ctl.fieldState('placa'); // { field, visible, value, errors, invalid, touched, onChange, onBlur }
ctl.setAnswer('placa', 'ABC1D23');
ctl.reset();
ctl.handleSubmit; // use no onSubmit do <form>
ctl.isSubmitting;
ctl.submitCount;
```

O mesmo `ctl` pode ir pro renderer: `<FormRenderer controller={ctl} />`. É assim que a demo mostra as respostas cruas e o resultado ao lado do form.

> **Segurança:** os componentes padrão renderizam labels e descrições como texto. Se fizer os seus, nunca use `dangerouslySetInnerHTML` com textos do schema.

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

## Exportando respostas

Depois de validar, `result.data` pode sair em vários formatos. Os exporters recebem o `form` e os dados **já validados** (eles não validam de novo, mas descartam campos escondidos e chaves desconhecidas). Todos seguem a ordem do schema e usam a `key` do campo (padrão: o `id`).

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
	// { placa: 'ABC1D23', opcionais: ['teto', 'ar'], tem_multa: true }

	toQAList(form, result.data, { locale: 'pt-BR' });
	// [{ kind: 'answer', question: 'Placa', answer: 'ABC1D23', value: 'ABC1D23', ... },
	//  { kind: 'answer', question: 'Opcionais', answer: 'Teto solar, Ar', value: ['teto', 'ar'], ... },
	//  { kind: 'answer', question: 'Possui multas?', answer: 'Sim', value: true, ... }]

	toMarkdown(form, result.data, { locale: 'pt-BR' });
	// # Vistoria
	//
	// ## Dados do veículo
	//
	// - **Placa:** ABC1D23
	// - **Opcionais:** Teto solar, Ar
	// - **Possui multas?:** Sim

	toFormData(form, result.data); // FormData: listas viram várias entradas com a mesma chave
	toEntries(form, result.data); // os mesmos pares [key, valor], ex.: new URLSearchParams(...)
}

// Várias submissões viram linhas de um CSV
toCSV(form, submissions, { delimiter: ';', bom: true }); // pronto pro Excel em português
```

| Função                          | Saída                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `toJSON(form, data)`            | `{ key: valor }` com os valores crus (ids das opções)                         |
| `toQAList(form, data, opts?)`   | `[{ question, answer, value, ... }]` legível; com seções, se pedir            |
| `toMarkdown(form, data, opts?)` | Markdown com título, seções e lista; texto do usuário escapado                |
| `toCSV(form, rows, opts?)`      | CSV (RFC 4180), uma coluna por campo; campo escondido vira célula vazia       |
| `toFormData(form, data)`        | `FormData` pronto pra `fetch`                                                 |
| `toEntries(form, data)`         | `[key, string][]`: booleanos viram `"true"`/`"false"` e listas, várias linhas |

Opções:

- **Todos os legíveis** (`toQAList`, `toMarkdown`, `toCSV`): `locale`, `fallbackLocale` e `labels` (`{ yes, no, listSeparator }`, pra trocar "Sim"/"Não"). Números são formatados no idioma pedido (`1.234,5` em `pt-BR`). Sem `locale`, os textos fixos saem em inglês ("Yes"/"No") e os números sem formatação, então passe `locale: 'pt-BR'` pra ter "Sim"/"Não".
- **`toQAList`**: `includeUnanswered` (campos visíveis sem resposta, com `emptyAnswer`), `includeSections` (`section` vira item de título; seção sem nenhuma resposta depois some).
- **`toMarkdown`**: as mesmas, mais `title` (padrão `true`). Seções entram por padrão e `emptyAnswer` é `—`.
- **`toCSV`**: `header: 'label' | 'key'`, `values: 'display' | 'raw'`, `delimiter`, `newline`, `bom` e `escapeFormulas` (padrão `true`: texto que começa com `=`, `+`, `-` ou `@` ganha um `'` na frente pra planilha não executar como fórmula).

O texto legível de cada tipo vem do `toDisplay` dele: `choice` mostra o label da opção, `boolean` mostra "Sim"/"Não" e por aí vai. Tipos customizados podem definir o seu (veja abaixo).

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

	// Opcional: texto legível nos exporters (qa-list, CSV, Markdown)
	toDisplay: (value) =>
		`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`,
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
| `form.schema` / `form.limits` / `form.registry`                  | Schema parseado (congelado), limites e registry em uso                                          |
| `toJSON` / `toQAList` / `toMarkdown` / `toCSV`                   | Exporters (veja [Exportando respostas](#exportando-respostas))                                  |
| `toFormData` / `toEntries`                                       | Respostas no formato de envio de formulário                                                     |
| `escapeMarkdown(text)`                                           | Escapa texto pra aparecer literal em Markdown                                                   |
| `createDisplayContext(opts?)` / `DISPLAY_LABELS`                 | Contexto que o `toDisplay` recebe e textos padrão ("Sim"/"Não") por idioma                      |
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

**`@excalibur-form/react`**

| Export                                  | O que faz                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `useExcaliburForm(form, options?)`      | Estado headless do form; devolve o `controller`                              |
| `<FormRenderer form \| controller … />` | Renderiza o form inteiro com componentes trocáveis                           |
| `defaultComponents`                     | Componentes padrão por tipo (`TextInput`, `BooleanInput`… também exportados) |
| `FieldWrapper` / `Section`              | Moldura e seção padrão                                                       |
| `defaultErrorMessage(issue, locale?)`   | Mensagem padrão de um erro (en, pt, es; padrão en)                           |
| `FieldInputProps` / `FieldWrapperProps` | Tipos pra escrever componentes próprios                                      |

`options` do hook = `{ initialAnswers?, onSubmit?, onInvalid?, showErrors? }`. O `<FormRenderer>` aceita as mesmas mais `components`, `FieldWrapper`, `locale`, `fallbackLocale`, `labels`, `formatError`, `submitLabel`, `disabled`, `className`, `focusOnError` e `children`.

---

## Desenvolvimento

```
packages/core   @excalibur-form/core: a lib
packages/react  @excalibur-form/react: hook e renderer pra React
apps/demo       demo em Vite + React (usa o pacote react)
docs/PLAN.md    plano e roadmap (PLAN.pt-BR.md em português)
```

```bash
pnpm install
pnpm dev            # demo
pnpm test           # testes (vitest)
pnpm test:cov       # com cobertura
pnpm check          # format + lint + typecheck + testes + build (o mesmo que o CI roda)
pnpm format         # formata (oxfmt)
```

Stack: TypeScript 7 (strict, `isolatedDeclarations`, `exactOptionalPropertyTypes`), vitest (+ Testing Library e jsdom no pacote React), oxlint, oxfmt, changesets e GitHub Actions.

**Idiomas:** código, comentários, testes e a documentação principal são em inglês. A documentação tem versão em português do Brasil (`*.pt-BR.md`); ao mudar uma, atualize a outra.

---

## Roadmap

- [x] **Fase 0**: monorepo, tooling, CI
- [x] **Fase 1**: core (schema, 8 tipos de campo, condições, validação, tipos inferidos)
- [x] Demo
- [x] **Fase 2**: exportadores (JSON por `key`, lista pergunta/resposta, CSV, FormData, Markdown)
- [x] **Fase 3**: `@excalibur-form/react` (renderer headless com componentes trocáveis)
- [ ] **Fase 4**: `@excalibur-form/builder` (montar o form visualmente)
- [ ] **Fase 5**: versionamento de respostas, docs e publicação no npm
- [ ] Mais tipos: `date`, `file`/`image`, grupos repetíveis, matriz

Detalhes em [docs/PLAN.pt-BR.md](docs/PLAN.pt-BR.md).

---

## Licença

[MIT](LICENSE)
