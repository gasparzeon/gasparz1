// Cabeçalho das páginas do painel: rótulo em mono, título que "decodifica"
// ao abrir e, à direita, números ou ações.
export function AdminPageHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="gz-admin-title">
      <div>
        <p className="gz-kicker" data-gz-intro="">
          <b>~/</b>
          {kicker}
        </p>
        <h1 className="gz-h1" data-gz-scramble="intro">
          {title}
        </h1>
        {description && <p className="gz-small">{description}</p>}
      </div>
      {children}
    </div>
  );
}
