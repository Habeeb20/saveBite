// Gives up waiting for a slow call (like Paylony) so it can never hang the signup request.
export const withTimeout = (promise, ms, label = "operation") => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};