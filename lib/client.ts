// Клиентский POST-помощник: жёсткий таймаут через AbortController, чтобы кнопки
// не висели в состоянии «Формирую…» бесконечно при зависшем/отфильтрованном
// запросе, и понятные сообщения об ошибке вместо сырого текста SDK/сети.
export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = 300_000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Слишком долго нет ответа — попробуйте ещё раз.");
    }
    throw new Error("Нет связи с сервером. Проверьте интернет и повторите.");
  } finally {
    clearTimeout(timer);
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* тело может быть пустым/не-JSON */
  }
  const err = (data as { error?: string } | null)?.error;
  if (!res.ok) {
    throw new Error(err || `Ошибка сервера (${res.status}).`);
  }
  return data as T;
}
