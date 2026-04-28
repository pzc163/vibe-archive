export function extractUserRequest(content) {
  const text = String(content || "").trim();
  if (!text) return "";

  const marker = "## My request for Codex:";
  const markerIndex = text.indexOf(marker);
  if (markerIndex >= 0) {
    const afterMarker = text.slice(markerIndex + marker.length).trim();
    if (afterMarker) return stripTrailingIdeSections(afterMarker);
  }

  return stripTrailingIdeSections(text);
}

export function compactTitle(content, maxLength = 80) {
  const request = extractUserRequest(content).replace(/\s+/g, " ").trim();
  return request.length > maxLength ? request.slice(0, maxLength) : request;
}

function stripTrailingIdeSections(text) {
  return text
    .replace(/\n+## Open tabs:[\s\S]*$/i, "")
    .replace(/\n+## Active file:[\s\S]*$/i, "")
    .trim();
}
