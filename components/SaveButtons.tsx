/* round star button: fills when the current thing is already in the Bank */
export function StarSave({ saved, onClick, label }: { saved: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`starsave ${saved ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={saved}
      data-tip={saved ? "In your Bank" : "Save to Bank"}
      aria-label={saved ? `${label} is saved to your Bank` : `Save ${label} to your Bank`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.2l2.6 5.7 6.2.6-4.7 4.2 1.4 6.1L12 16.8 6.5 19.8l1.4-6.1L3.2 9.5l6.2-.6z" />
      </svg>
    </button>
  );
}

/* the lightbulb: mark a scale/chord/arpeggio as something you know, which feeds
   the practice-routine builder */
export function BulbSave({ known, onClick, label }: { known: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={`bulbsave ${known ? "on" : ""}`}
      onClick={onClick}
      aria-pressed={known}
      data-tip={known ? "You know this" : "Mark as known"}
      aria-label={known ? `${label} is marked as known` : `Mark ${label} as known`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill={known ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.1v.4h6v-.4c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />
      </svg>
    </button>
  );
}

/* the same "known" toggle, but labelled and prominent at the top of a view */
export function KnownButton({ known, onClick }: { known: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`knownbtn ${known ? "on" : ""}`} aria-pressed={known} onClick={onClick}>
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill={known ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.1v.4h6v-.4c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3z" />
      </svg>
      {known ? "You know this" : "Mark as known"}
    </button>
  );
}
