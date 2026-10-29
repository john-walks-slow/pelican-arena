import { useId } from "react";
import type { CatalogEntry } from "~/lib/catalog";

/**
 * A text field with catalog suggestions. Typing a name that is not in the
 * catalog adds it on submit.
 */
export function CatalogInput({
  name,
  label,
  options,
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  name: string;
  label: string;
  options: CatalogEntry[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
        {!required && <span className="ml-1 font-normal text-muted">可选</span>}
      </label>
      <input
        id={id}
        name={name}
        list={`${id}-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        placeholder={placeholder}
        required={required}
        maxLength={60}
        autoComplete="off"
      />
      <datalist id={`${id}-list`}>
        {options.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
