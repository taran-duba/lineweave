import { Cursor } from './Cursor';

const nodes = [
  { x: 40, y: 40, w: 120, h: 52, label: 'Browser', accent: true },
  { x: 220, y: 40, w: 120, h: 52, label: 'Yjs document' },
  { x: 400, y: 40, w: 130, h: 52, label: 'Realtime sync' },
  { x: 40, y: 154, w: 120, h: 52, label: 'Teammate' },
  { x: 400, y: 154, w: 130, h: 52, label: 'Google Drive', accent: true },
  { x: 220, y: 272, w: 120, h: 52, label: 'diagrams.net' },
];

// pathLength=1 lets every edge share the same dash animation.
const edges = [
  'M160 66 H220',
  'M340 66 H400',
  'M280 92 V140',
  'M160 180 H220',
  'M340 180 H400',
  'M280 220 V272',
];

/** A diagram that draws itself, with collaborators' cursors drifting across it. */
export function HeroDiagram() {
  return (
    <svg viewBox="0 0 570 350" className="h-auto w-full" role="img" aria-label="Animated diagram showing teammates editing a diagram that syncs to Google Drive">
      <defs>
        <pattern id="lw-dots" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="var(--grid-major)" />
        </pattern>
        <marker id="lw-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 1 L9 5 L0 9 Z" fill="var(--muted)" />
        </marker>
      </defs>
      <rect width="570" height="350" fill="url(#lw-dots)" opacity="0.7" />

      {edges.map((d, i) => (
        <path
          key={d}
          d={d}
          pathLength={1}
          className="lw-edge"
          style={{ animationDelay: `${700 + i * 220}ms` }}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="1.6"
          markerEnd="url(#lw-arrow)"
        />
      ))}

      {/* decision node */}
      <g className="lw-node" style={{ animationDelay: '450ms', transformOrigin: '280px 180px' }}>
        <path d="M280 140 L340 180 L280 220 L220 180 Z" fill="var(--panel)" stroke="var(--border)" strokeWidth="1.6" />
        <text x="280" y="184" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text)">
          Save leader
        </text>
      </g>

      {nodes.map((n, i) => (
        <g
          key={n.label}
          className="lw-node"
          style={{ animationDelay: `${i * 140}ms`, transformOrigin: `${n.x + n.w / 2}px ${n.y + n.h / 2}px` }}
        >
          <rect
            x={n.x}
            y={n.y}
            width={n.w}
            height={n.h}
            rx="10"
            fill={n.accent ? 'var(--accent-soft)' : 'var(--panel)'}
            stroke={n.accent ? 'var(--accent)' : 'var(--border)'}
            strokeWidth="1.6"
          />
          <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)">
            {n.label}
          </text>
        </g>
      ))}

      {/* live selection ring that hops between nodes */}
      <rect className="lw-select" x="216" y="36" width="128" height="60" rx="13" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="5 4" />

      <g className="lw-cursor lw-cursor-a">
        <Cursor color="#f97316" name="Maya" />
      </g>
      <g className="lw-cursor lw-cursor-b">
        <Cursor color="#3b82f6" name="Jonas" />
      </g>
      <g className="lw-cursor lw-cursor-c">
        <Cursor color="#e11d48" name="Priya" />
      </g>
    </svg>
  );
}
