export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

// Log allowlisted metadata only. Provider messages, request URLs, and prompts may contain secrets.
export function logGeminiError(error, attempt, retrying, logger = entry => console.warn(JSON.stringify(entry))) {
  const status = Number(error?.status ?? error?.code);
  logger({ event: 'gemini_request_failed', status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    reason: error?.name === 'TimeoutError' ? 'timeout' : 'api_failure', attempt, retrying });
}

export async function generateWithRetry(ai, request, {
  timeoutMs = 12000, attemptTimeoutMs = 6000,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random,
  logger, beforeAttempt = () => {},
} = {}) {
  const deadline = performance.now() + timeoutMs;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new DOMException('Gemini deadline exceeded', 'TimeoutError');
    beforeAttempt();
    const controller = new AbortController();
    let timer;
    try {
      // Disable SDK retries: this loop owns the four-attempt cap and total deadline.
      return await Promise.race([
        ai.models.generateContent({ ...request, config: { ...request.config,
          abortSignal: controller.signal, httpOptions: { retryOptions: { attempts: 1 } } } }),
        new Promise((_, reject) => { timer = setTimeout(() => {
          const error = new DOMException('Gemini attempt timed out', 'TimeoutError');
          reject(error); controller.abort(error);
        }, Math.min(remaining, attemptTimeoutMs)); }),
      ]);
    } catch (error) {
      const retrying = attempt < 3 && performance.now() < deadline &&
        (TRANSIENT.has(Number(error?.status ?? error?.code)) || error?.name === 'TimeoutError');
      logGeminiError(error, attempt + 1, retrying, logger);
      if (!retrying) throw error;
    } finally { clearTimeout(timer); }
    const delay = Math.floor(random() * Math.min(1600, 200 * 2 ** attempt));
    if (performance.now() + delay >= deadline) throw new DOMException('Gemini deadline exceeded', 'TimeoutError');
    await sleep(delay);
  }
}
