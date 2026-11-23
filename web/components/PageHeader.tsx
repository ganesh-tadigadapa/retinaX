/**
 * The one page header used across the site: a small label pill, the page title, an
 * optional description, and optional actions aligned to the right. Every page starts
 * the same way, at the same position, with the same spacing below it.
 */
import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow, icon, title, children, actions,
}: {
  eyebrow?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {eyebrow && (
          <span className="page-eyebrow">
            {icon && <span aria-hidden="true">{icon}</span>}
            {eyebrow}
          </span>
        )}
        <h1 className="page-title">{title}</h1>
        {children && <div className="page-lede">{children}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
