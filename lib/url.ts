// Пропускаем в href только http/https-ссылки. Ссылки-источники и ссылки в
// досье формирует модель по итогам веб-поиска над открытым интернетом, поэтому
// возможен вредоносный `javascript:`-URI из prompt-injection на проиндексированной
// странице. Всё, что не http(s), считаем небезопасным и не делаем ссылкой.
export function safeHref(url: string | undefined | null): string | null {
  if (!url) return null;
  const s = url.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}
