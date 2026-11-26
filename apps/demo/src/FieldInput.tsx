import {
	resolveText,
	scaleBounds,
	type BuiltinField,
	type LocalizedText,
} from '@excalibur-form/core';

interface Props {
	readonly field: BuiltinField;
	readonly value: unknown;
	readonly locale: string;
	readonly onChange: (value: unknown) => void;
}

export function FieldInput({ field, value, locale, onChange }: Props) {
	const t = (text: LocalizedText | undefined) =>
		text === undefined ? undefined : resolveText(text, locale, 'pt');
	const name = field.id;

	switch (field.type) {
		case 'section':
			return null;
		case 'text':
			return (
				<input
					id={name}
					type={
						field.format === 'email'
							? 'email'
							: field.format === 'url'
								? 'url'
								: 'text'
					}
					value={typeof value === 'string' ? value : ''}
					placeholder={t(field.placeholder)}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
		case 'longText':
			return (
				<textarea
					id={name}
					rows={3}
					value={typeof value === 'string' ? value : ''}
					placeholder={t(field.placeholder)}
					onChange={(e) => onChange(e.target.value)}
				/>
			);
		case 'number':
			return (
				<input
					id={name}
					type="number"
					step={field.integer === true ? 1 : 'any'}
					min={field.min}
					max={field.max}
					value={typeof value === 'number' ? value : ''}
					placeholder={t(field.placeholder)}
					onChange={(e) =>
						onChange(
							e.target.value === ''
								? undefined
								: e.target.valueAsNumber,
						)
					}
				/>
			);
		case 'boolean':
			return (
				<div className="segmented" role="radiogroup">
					{[true, false].map((option) => (
						<button
							key={String(option)}
							type="button"
							role="radio"
							aria-checked={value === option}
							className={value === option ? 'active' : ''}
							onClick={() =>
								onChange(value === option ? undefined : option)
							}
						>
							{option
								? locale === 'en'
									? 'Yes'
									: 'Sim'
								: locale === 'en'
									? 'No'
									: 'Não'}
						</button>
					))}
				</div>
			);
		case 'choice':
			return (
				<div className="options">
					{field.options.map((option) => (
						<label key={option.id} className="option">
							<input
								type="radio"
								name={name}
								checked={value === option.id}
								onChange={() => onChange(option.id)}
							/>
							{t(option.label)}
						</label>
					))}
				</div>
			);
		case 'multiChoice': {
			const selected = Array.isArray(value) ? (value as string[]) : [];
			return (
				<div className="options">
					{field.options.map((option) => (
						<label key={option.id} className="option">
							<input
								type="checkbox"
								checked={selected.includes(option.id)}
								onChange={(e) =>
									onChange(
										e.target.checked
											? [...selected, option.id]
											: selected.filter(
													(id) => id !== option.id,
												),
									)
								}
							/>
							{t(option.label)}
						</label>
					))}
				</div>
			);
		}
		case 'scale': {
			const { min, max } = scaleBounds(field);
			const steps = Array.from(
				{ length: max - min + 1 },
				(_, i) => min + i,
			);
			return (
				<div>
					<div className="scale" role="radiogroup">
						{steps.map((step) => (
							<button
								key={step}
								type="button"
								role="radio"
								aria-checked={value === step}
								className={value === step ? 'active' : ''}
								onClick={() =>
									onChange(value === step ? undefined : step)
								}
							>
								{step}
							</button>
						))}
					</div>
					{(field.minLabel ?? field.maxLabel) && (
						<div className="scale-labels">
							<span>{t(field.minLabel)}</span>
							<span>{t(field.maxLabel)}</span>
						</div>
					)}
				</div>
			);
		}
	}
}
