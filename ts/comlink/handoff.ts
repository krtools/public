type ReadyMessage = { type: "search:ready" };
type PayloadMessage = { type: "search:payload"; payload: SearchPayload };

interface SearchPayload {
  query: string;
  filters?: Record<string, unknown>;
}


// SOURCE PAGE — the allowlisted partner sending users to your search

const SEARCH_URL = "https://search.example.com/search";
const SEARCH_ORIGIN = "https://search.example.com";

function sendToSearch(payload: SearchPayload): void {
  const popup = window.open(SEARCH_URL, "_blank");
  if (!popup) throw new Error("Popup blocked");

  const onMessage = (event: MessageEvent<ReadyMessage>) => {
    // Must be the window we opened, from the expected origin, saying ready.
    if (event.source !== popup) return;
    if (event.origin !== SEARCH_ORIGIN) return;
    if (event.data?.type !== "search:ready") return;

    window.removeEventListener("message", onMessage);

    // Explicit targetOrigin — never "*" when sending real data.
    popup.postMessage(
      { type: "search:payload", payload } satisfies PayloadMessage,
      SEARCH_ORIGIN,
    );
  };

  window.addEventListener("message", onMessage);
}


// DESTINATION PAGE — your search page

const ALLOWED_ORIGINS = new Set([
  "https://partner-a.example.com",
  "https://partner-b.example.com",
]);

function listenForPayload(): void {
  const opener = window.opener as Window | null;
  if (!opener) return; // direct navigation, no handoff to receive

  const onMessage = (event: MessageEvent<PayloadMessage>) => {
    if (event.source !== opener) return;
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    if (event.data?.type !== "search:payload") return;

    window.removeEventListener("message", onMessage);
    handleSearchPayload(event.data.payload);
  };

  window.addEventListener("message", onMessage);

  // "*" is fine here — "ready" carries no sensitive data, it's just a ping.
  // We don't yet know the opener's origin to target it precisely.
  opener.postMessage({ type: "search:ready" } satisfies ReadyMessage, "*");
}

function handleSearchPayload(payload: SearchPayload): void {
  // TODO: validate payload shape, then run the search
  console.log("got payload", payload);
}

listenForPayload();
