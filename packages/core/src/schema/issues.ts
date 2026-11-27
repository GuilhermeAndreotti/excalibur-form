export type PathSegment = string | number;

export type SchemaIssueCode =
	| 'invalid_type'
	| 'required'
	| 'invalid_value'
	| 'invalid_id'
	| 'too_long'
	| 'too_many'
	| 'too_few'
	| 'duplicate_id'
	| 'duplicate_key'
	| 'unknown_field_type'
	| 'invalid_condition'
	| 'unknown_reference'
	| 'forward_reference'
	| 'unsupported_operator';

/** Problem found while validating a schema. `message` is meant for developers. */
export interface SchemaIssue {
	readonly path: readonly PathSegment[];
	readonly code: SchemaIssueCode;
	readonly message: string;
}

export function formatPath(path: readonly PathSegment[]): string {
	return path
		.map((segment, i) =>
			typeof segment === 'number'
				? `[${segment}]`
				: i === 0
					? segment
					: `.${segment}`,
		)
		.join('');
}

export class FormSchemaError extends Error {
	readonly issues: readonly SchemaIssue[];

	constructor(issues: readonly SchemaIssue[]) {
		const lines = issues.map(
			(issue) =>
				`  - ${formatPath(issue.path) || '(root)'}: ${issue.message} [${issue.code}]`,
		);
		super(`Invalid form schema:\n${lines.join('\n')}`);
		this.name = 'FormSchemaError';
		this.issues = issues;
	}
}
