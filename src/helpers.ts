import type { Term } from "./model.ts";
import {
	BlankNode,
	IRI,
	Literal,
	type Quad,
	type Triple,
	Variable,
} from "./model.ts";
import { ContentTypes } from "./types.ts";

/** Serialize an RDF term to its SPARQL/N-Triples string representation */
export function serializeTerm(term: Term): string {
	if (typeof term === "string") {
		// Check if it's already a variable (?x), IRI (<...>), or prefixed name
		if (term.startsWith("?") || term.startsWith("$")) return term;
		if (term.startsWith("<") && term.endsWith(">")) return term;
		if (term.startsWith("_:")) return term;
		if (term.startsWith('"')) return term;
		// If contains ":", assume it's a prefixed name
		if (term.includes(":")) return term;
		// Otherwise treat as a variable name
		return `?${term}`;
	}

	return term.toString();
}

/** Serialize an iterable of Triples or Quads to N-Quads format */
export function serializeStatements(
	statements: Iterable<Triple | Quad>,
): string {
	const lines: string[] = [];
	for (const stmt of statements) {
		lines.push(stmt.toString());
	}
	return lines.join("\n");
}

/** Normalize a context parameter that may be a string or array */
export function normalizeContext(
	context?: string | string[],
): string | undefined {
	return Array.isArray(context) ? context.join(",") : context;
}

/** Remove SPARQL comments from a query string, preserving URIs and quoted strings */
export function removeSparqlComments(query: string): string {
	const result: string[] = [];
	let i = 0;

	while (i < query.length) {
		const char = query[i];
		if (!char) break;

		// Handle quoted strings (single or double quotes)
		if (char === '"' || char === "'") {
			// Check for triple-quoted strings
			const tripleQuote = query.slice(i, i + 3);
			if (tripleQuote === '"""' || tripleQuote === "'''") {
				const endIdx = query.indexOf(tripleQuote, i + 3);
				if (endIdx !== -1) {
					result.push(query.slice(i, endIdx + 3));
					i = endIdx + 3;
				} else {
					result.push(query.slice(i));
					break;
				}
			} else {
				// Single-quoted string
				let j = i + 1;
				while (j < query.length) {
					if (query[j] === "\\") {
						j += 2; // skip escaped character
					} else if (query[j] === char) {
						break;
					} else {
						j++;
					}
				}
				result.push(query.slice(i, j + 1));
				i = j + 1;
			}
		}
		// Handle URIs in angle brackets
		else if (char === "<") {
			const endIdx = query.indexOf(">", i);
			if (endIdx !== -1) {
				result.push(query.slice(i, endIdx + 1));
				i = endIdx + 1;
			} else {
				result.push(query.slice(i));
				break;
			}
		}
		// Handle comments
		else if (char === "#") {
			// Skip to end of line
			const endIdx = query.indexOf("\n", i);
			if (endIdx !== -1) {
				i = endIdx; // Keep the newline
			} else {
				break; // End of string
			}
		} else {
			result.push(char);
			i++;
		}
	}

	return result.join("");
}

/** SPARQL query type */
export type QueryType =
	| "SELECT"
	| "ASK"
	| "CONSTRUCT"
	| "DESCRIBE"
	| "INSERT"
	| "DELETE"
	| "UNKNOWN";

/** Detect the type of a SPARQL query */
export function detectQueryType(query: string): QueryType {
	// Remove comments first
	const cleaned = removeSparqlComments(query);

	// Remove PREFIX and BASE declarations
	const withoutPrologues = cleaned
		.replace(/\b(PREFIX|BASE)\s+[^\n]*/gi, "")
		.trim();

	// Find the first keyword
	const match = withoutPrologues.match(
		/\b(SELECT|ASK|CONSTRUCT|DESCRIBE|INSERT|DELETE)\b/i,
	);
	if (!match?.[1]) return "UNKNOWN";

	return match[1].toUpperCase() as QueryType;
}

/** File extension to RDF content type mapping */
const FORMAT_EXTENSIONS: Record<string, string> = {
	".ttl": ContentTypes.TURTLE,
	".nt": ContentTypes.NTRIPLES,
	".nq": ContentTypes.NQUADS,
	".rdf": ContentTypes.RDFXML,
	".xml": ContentTypes.RDFXML,
	".owl": ContentTypes.RDFXML,
	".jsonld": ContentTypes.JSONLD,
	".trig": ContentTypes.TRIG,
	".trix": ContentTypes.TRIX,
	".n3": ContentTypes.N3,
};

/** Detect RDF format from a file path extension. Returns undefined if unknown. */
export function detectRdfFormat(filePath: string): string | undefined {
	const dotIndex = filePath.lastIndexOf(".");
	if (dotIndex === -1) return undefined;
	const ext = filePath.slice(dotIndex).toLowerCase();
	return FORMAT_EXTENSIONS[ext];
}

/** Create a typed Literal with XSD datatype */
export function literal(value: string, datatypeOrLang?: IRI | string): Literal {
	if (typeof datatypeOrLang === "string") {
		return new Literal(value, undefined, datatypeOrLang);
	}
	return new Literal(value, datatypeOrLang);
}

/** Create an IRI */
export function iri(value: string): IRI {
	return new IRI(value);
}

/** Create a BlankNode */
export function blankNode(value: string): BlankNode {
	return new BlankNode(value);
}

/** Create a Variable */
export function variable(name: string): Variable {
	return new Variable(name);
}
