export default function loadScript() {
  const cache = new Map();

  const generateKey = (url, namespace, token = '') => `${url}${namespace}${token}`;

  return async function (url, params, namespace = 'paypal', pageType = 'checkout', userIdToken = '') {
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      /* eslint-disable no-param-reassign */
      url = `${url}?${queryString}`;
    }

    const key = generateKey(url, namespace, userIdToken);

    // Return the cached promise if the key is already cached.
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Create a new promise and cache it.
    const scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.dataset.namespace = `paypal_${namespace}`;
      script.dataset.partnerAttributionId = 'BLUEFINCH_PPCP';
      script.dataset.pageType = pageType;

      if (userIdToken) {
        script.dataset.userIdToken = userIdToken;
      }

      script.onload = () => {
        // Emit a custom event when the script loads.
        const event = new CustomEvent('ppcpScriptLoaded', { detail: namespace });
        document.dispatchEvent(event);
        resolve();
      };

      script.onerror = () => {
        cache.delete(key);
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });

    cache.set(key, scriptPromise);

    return scriptPromise;
  };
}
