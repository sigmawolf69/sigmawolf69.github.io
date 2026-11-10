import blockerConfig from "./network-blocker-config.json";

const blockedHosts = new Set(
    blockerConfig.blockedHosts.map((host) => host.trim().toLowerCase()),
  ),
  blockedUrlPrefixes = blockerConfig.blockedUrlPrefixes.map((prefix) =>
    prefix.trim().toLowerCase(),
  ),
  allowedHosts = new Set(
    blockerConfig.essentialAllowedHosts.map((host) => host.trim().toLowerCase()),
  ),
  allowedUrlPrefixes: string[] = [];

function addRules(target: Set<string> | string[], values: string[]) {
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (target instanceof Set) target.add(normalized);
    else target.push(normalized);
  }
}

function loadCommunityBlocklist() {
  void import("./generated/brave-site-blocklist.json").then(({ default: list }) => {
    addRules(blockedHosts, list.blockedHosts);
    addRules(blockedUrlPrefixes, list.blockedUrlPrefixes);
    addRules(allowedHosts, list.allowedHosts);
    addRules(allowedUrlPrefixes, list.allowedUrlPrefixes);
  });
}

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(loadCommunityBlocklist, { timeout: 2500 });
} else {
  window.setTimeout(loadCommunityBlocklist, 750);
}

function hostMatches(hostname: string, candidates: Set<string>): boolean {
  if (candidates.has(hostname)) return true;
  for (let index = hostname.indexOf("."); index >= 0; index = hostname.indexOf(".", index + 1)) {
    if (candidates.has(hostname.slice(index + 1))) return true;
  }
  return false;
}

function urlOf(value: unknown): URL | null {
  try {
    const raw =
      value instanceof Request
        ? value.url
        : value instanceof URL
          ? value.href
          : typeof value === "string"
            ? value
            : null;
    return raw ? new URL(raw, window.location.href) : null;
  } catch {
    return null;
  }
}

function hostnameOf(value: unknown): string | null {
  return urlOf(value)?.hostname.toLowerCase() || null;
}

function isBlocked(value: unknown): boolean {
  const url = urlOf(value),
    hostname = url?.hostname.toLowerCase(),
    comparableUrl = url ? `${url.origin}${url.pathname}`.toLowerCase() : "";
  if (
    (hostname && hostMatches(hostname, allowedHosts)) ||
    allowedUrlPrefixes.some((prefix) => comparableUrl.startsWith(prefix))
  ) {
    return false;
  }
  return Boolean(
    blockerConfig.enabled &&
      ((hostname && hostMatches(hostname, blockedHosts)) ||
        blockedUrlPrefixes.some((prefix) => comparableUrl.startsWith(prefix))),
  );
}

function blockedError(value: unknown): DOMException {
  return new DOMException(
    `Request blocked by site policy: ${hostnameOf(value) || "blocked host"}`,
    "SecurityError",
  );
}

if (blockerConfig.enabled && (blockedHosts.size || blockedUrlPrefixes.length)) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    isBlocked(input)
      ? Promise.reject(blockedError(input))
      : nativeFetch(input, init)) as typeof window.fetch;

  const nativeXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    async = true,
    username?: string | null,
    password?: string | null,
  ) {
    if (isBlocked(url)) throw blockedError(url);
    return Reflect.apply(nativeXhrOpen, this, [
      method,
      url,
      async,
      username ?? null,
      password ?? null,
    ]) as void;
  };

  const nativeBeacon = navigator.sendBeacon?.bind(navigator);
  if (nativeBeacon) {
    navigator.sendBeacon = ((url: string | URL, data?: BodyInit | null) =>
      isBlocked(url)
        ? false
        : nativeBeacon(url, data)) as typeof navigator.sendBeacon;
  }

  const protectConstructor = <T extends typeof WebSocket | typeof EventSource>(
    NativeConstructor: T,
  ): T =>
    new Proxy(NativeConstructor, {
      construct(target, argumentsList, newTarget) {
        if (isBlocked(argumentsList[0])) throw blockedError(argumentsList[0]);
        return Reflect.construct(target, argumentsList, newTarget);
      },
    });

  window.WebSocket = protectConstructor(window.WebSocket);
  window.EventSource = protectConstructor(window.EventSource);

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    if ((name === "src" || name === "href") && isBlocked(value)) return;
    nativeSetAttribute.call(this, name, value);
  };

  const protectUrlProperty = (prototype: object, property: "src" | "href") => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor?.get || !descriptor.set) return;
    Object.defineProperty(prototype, property, {
      ...descriptor,
      set(value: string) {
        if (!isBlocked(value)) descriptor.set?.call(this, value);
      },
    });
  };

  protectUrlProperty(HTMLScriptElement.prototype, "src");
  protectUrlProperty(HTMLImageElement.prototype, "src");
  protectUrlProperty(HTMLIFrameElement.prototype, "src");
  protectUrlProperty(HTMLMediaElement.prototype, "src");
  protectUrlProperty(HTMLSourceElement.prototype, "src");
  protectUrlProperty(HTMLLinkElement.prototype, "href");
}
