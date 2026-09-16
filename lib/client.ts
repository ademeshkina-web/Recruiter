// Клиентский POST-помощник: жёсткий таймаут через AbortController, чтобы кнопки
// не висели в состоянии «Формирую…» бесконечно при зависшем запросе, и понятные
// сообщения об ошибке вместо сырого текста SDK/сети.
//
// Долгие роуты (анализ, поиск, сравнение, досье, письма) СТРИМЯТ: сразу шлют 200
// и «пульс» (пробелы), пока идёт работа, чтобы прокси не оборвал соединение по
// таймауту простоя, а в конце — финальный JSON. Поэтому:
//  - таймаут держим на ВЕСЬ цикл (fetch + чтение тела), а не только до заголовков;
//  - ошибку читаем из тела (у стрима статус всегда 200), а не только из res.ok.
export async function postJson<T>(
  url: string,
  body: unknown,
  timeoutMs = 300_000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
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
    }

    let data: unknown = null;
    try {
      // Читает всё тело (включая «пульс»-пробелы стрима); JSON.parse их игнорирует.
      data = await res.json();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new Error("Слишком долго нет ответа — попробуйте ещё раз.");
      }
      // тело пустое/не JSON — обрабатываем ниже по статусу
    }

    const err = (data as { error?: string } | null)?.error;
    if (!res.ok || err) {
      throw new Error(err || `Ошибка сервера (${res.status}).`);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
