"use client";

import { useId, type InputHTMLAttributes } from "react";

/**
 * Mild autofill resistance without readOnly (readOnly blocks typing/paste in many browsers).
 */
export default function NoAutofillInput({
  sensitive = false,
  name,
  autoComplete,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { sensitive?: boolean }) {
  const id = useId();

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
    />
  );
}
