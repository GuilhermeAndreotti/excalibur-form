import type { AnswerIssue } from '@excalibur-form/core';

// A lib devolve só códigos; cada app traduz do seu jeito. Isto é o da demo.
export function errorMessage(issue: AnswerIssue): string {
	const p = issue.params ?? {};
	switch (issue.code) {
		case 'required':
			return 'Campo obrigatório';
		case 'invalid_type':
			return 'Valor inválido';
		case 'too_short':
			return `Mínimo de ${p.min} caracteres`;
		case 'too_long':
			return `Máximo de ${p.max} caracteres`;
		case 'too_small':
			return `O mínimo é ${p.min}`;
		case 'too_big':
			return `O máximo é ${p.max}`;
		case 'not_integer':
			return 'Use um número inteiro';
		case 'invalid_format':
			return p.format === 'email'
				? 'E-mail inválido'
				: 'URL inválida (use http/https)';
		case 'invalid_option':
			return 'Opção inválida';
		case 'duplicate_option':
			return 'Opção repetida';
		case 'too_few':
			return `Selecione pelo menos ${p.min}`;
		case 'too_many':
			return `Selecione no máximo ${p.max}`;
	}
}
