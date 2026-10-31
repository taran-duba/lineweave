/** SVG collaborator cursor with a name chip; position it with a wrapping <g>. */
export function Cursor({ color, name, className }: { color: string; name: string; className?: string }) {
  const w = name.length * 6.4 + 14;
  return (
    <g className={className}>
      <path d="M0 0 L0 16 L4.5 12 L8 19 L10.5 18 L7 11 L13 11 Z" fill={color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
      <rect x="12" y="16" width={w} height="18" rx="9" fill={color} />
      <text x={12 + w / 2} y="28.5" textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#fff">
        {name}
      </text>
    </g>
  );
}
