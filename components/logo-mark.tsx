export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 1.5L25.5 6V13.5C25.5 20.5 20.7 25.8 14 26.5C7.3 25.8 2.5 20.5 2.5 13.5V6L14 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M14 8V19M8.5 11.2L14 8L19.5 11.2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="14" cy="14.2" r="1.4" fill="currentColor" />
    </svg>
  );
}
