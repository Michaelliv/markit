const XML_ENTITY_RE = /&(?:amp|lt|gt|quot|apos);/g;
const XML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

/**
 * Decode the five built-in XML entities in text extracted from XML parsers
 * running with `processEntities: false`.
 */
export function decodeXmlEntities(s: string): string {
  return s.replace(XML_ENTITY_RE, (m) => XML_ENTITY_MAP[m]);
}
