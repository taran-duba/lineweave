import { LUCIDE_ICONS } from './lucideIcons';

/** An icon as the draw.io-style image URL stored in a shape's style (no ";base64", ";" separates keys). */
export function iconUrl(name: string, color = '#2f6fed'): string {
  const nodes = LUCIDE_ICONS[name];
  if (!nodes) throw new Error(`Unknown icon: ${name}`);
  const body = nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const b64 = typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml,${b64}`;
}

export function iconStyle(name: string, color?: string): string {
  return `shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=${iconUrl(name, color)};`;
}

export const ICON_LABELS: Record<string, string> = {
  server: 'Server', database: 'Database', 'hard-drive': 'Storage', laptop: 'Laptop', monitor: 'Desktop', smartphone: 'Phone', tablet: 'Tablet',
  router: 'Router', wifi: 'Wi-Fi', globe: 'Internet', cloud: 'Cloud', shield: 'Firewall', lock: 'Secure', 'key-round': 'Key', user: 'User', users: 'Users',
  mail: 'Email', cpu: 'Compute', container: 'Container', box: 'Package', layers: 'Layers', zap: 'Function', inbox: 'Queue', 'git-branch': 'Repository',
  terminal: 'Terminal', printer: 'Printer', network: 'Network', 'radio-tower': 'Tower', bell: 'Alerts', 'credit-card': 'Payments', 'shopping-cart': 'Cart',
  'file-text': 'Document', folder: 'Folder', image: 'Image', video: 'Video', activity: 'Monitoring', 'chart-column': 'Analytics', workflow: 'Workflow', bot: 'Bot', webhook: 'Webhook',
};
