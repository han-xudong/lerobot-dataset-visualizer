// Utility to post a message to the parent window with custom URLSearchParams
function getParentOrigin(): string | null {
  if (typeof window === "undefined" || window.parent === window) {
    return null;
  }

  if (!document.referrer) {
    return null;
  }

  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

export function postParentMessageWithParams(
  setParams: (params: URLSearchParams) => void,
) {
  const parentOrigin = getParentOrigin();
  if (!parentOrigin) {
    return;
  }

  const searchParams = new URLSearchParams();
  setParams(searchParams);
  window.parent.postMessage(
    { queryString: searchParams.toString() },
    parentOrigin,
  );
}
