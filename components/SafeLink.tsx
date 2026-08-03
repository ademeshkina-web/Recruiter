import type { ReactNode } from "react";
import { safeHref } from "@/lib/url";

// Ссылка, безопасная для URL из ответа модели (веб-поиск над открытым интернетом).
// Если URL не http(s) — не делаем кликабельную ссылку: рендерим whenUnsafe
// (если задан) либо тот же контент обычным текстом.
export function SafeLink({
  url,
  children,
  className,
  whenUnsafe,
}: {
  url?: string | null;
  children: ReactNode;
  className?: string;
  whenUnsafe?: ReactNode;
}) {
  const href = safeHref(url);
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <>{whenUnsafe !== undefined ? whenUnsafe : <span>{children}</span>}</>;
}
