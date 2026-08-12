import type { ReactNode } from "react";

/* small decorative icons for the nav section headings */
export function HeadIcon({ kind }: { kind: string }) {
  const shapes: Record<string, ReactNode> = {
    learn: <path d="M2 3.5c2-1.2 4-1.2 6 0v9c-2-1.2-4-1.2-6 0zM8 3.5c2-1.2 4-1.2 6 0v9c-2-1.2-4-1.2-6 0z" />,
    practice: (
      <>
        <circle cx="8" cy="8" r="5.5" />
        <circle cx="8" cy="8" r="2" />
      </>
    ),
    profile: (
      <>
        <circle cx="8" cy="5" r="3" />
        <path d="M2.5 14c1-3 3-4.5 5.5-4.5s4.5 1.5 5.5 4.5" />
      </>
    ),
    tools: (
      <>
        <path d="M2 4.5h6M12.5 4.5H14M2 11.5h1.5M8 11.5h6" />
        <circle cx="10" cy="4.5" r="1.8" />
        <circle cx="5.5" cy="11.5" r="1.8" />
      </>
    ),
  };
  return (
    <svg
      className="dicon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[kind]}
    </svg>
  );
}
