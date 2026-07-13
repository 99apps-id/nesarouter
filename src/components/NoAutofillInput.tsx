"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

/**
 * Input that resists browser/password-manager autofill on sensitive provider fields.
 */
export default function NoAutofillInput({
  sensitive = false,
  onFocus,
  readOnly,
  name,
  autoComplete,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { sensitive?: boolean }) {
  const id = useId();
  const [armed, setArmed] = useState(false);

  return (
    <input
      {...props}
      id={props.id ?? id}
      name={name ?? `nesa-${sensitive ? "secret" : "field"}-${id.replace(/:/g, "")}`}
      autoComplete={autoComplete ?? (sensitive ? "new-password" : "off")}
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      readOnly={readOnly ?? !armed}
      onFocus={(event) => {
        if (!readOnly && !armed) setArmed(true);
        onFocus?.(event);
      }}
    />
  );
}
