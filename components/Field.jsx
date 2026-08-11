import React from "react";
import { Seg } from "./Seg.jsx";

export function Field({ label, children, id, tip }) {
  /* Borrow the Field's label for a Seg child that has no ariaLabel of its own, so
     its mobile <select> and its button group are named for screen readers. */
  const kid =
    React.isValidElement(children) && children.type === Seg && !children.props.ariaLabel && typeof label === "string"
      ? React.cloneElement(children, { ariaLabel: label })
      : children;
  return (
    <div className="field">
      {id ? (
        <label className="flabel" htmlFor={id} data-tip={tip}>
          {label}
        </label>
      ) : (
        <span className="flabel" data-tip={tip}>
          {label}
        </span>
      )}
      {kid}
    </div>
  );
}
