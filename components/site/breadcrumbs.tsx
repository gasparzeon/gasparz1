import Link from 'next/link';

export type Crumb = { label: string; href?: string };

// Trilha "Você está em": sempre começa no Início e termina na página atual
// (texto com aria-current, sem link). Os itens do meio levam de volta.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="gz-crumbs" aria-label="Você está em">
      <ol>
        <li>
          <Link href="/">Início</Link>
        </li>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`}>
              <span aria-hidden="true">›</span>
              {item.href && !last ? (
                <Link href={item.href}>{item.label}</Link>
              ) : (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
