// Стартовые админы задаются через ADMIN_EMAILS (e-mail через запятую). Держим
// проверку в отдельном модуле без зависимостей, чтобы её могли использовать и
// auth.ts, и db.ts без циклического импорта.
export function isAdminEmail(email: string): boolean {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
