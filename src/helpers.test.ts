import { expect, test } from "bun:test";
import {
	blankNode,
	detectQueryType,
	detectRdfFormat,
	iri,
	literal,
	removeSparqlComments,
	serializeStatements,
	serializeTerm,
	variable,
} from "./helpers.ts";
import { BlankNode, IRI, Literal, Quad, Triple, Variable } from "./model.ts";

// ============================================
// serializeTerm Tests
// ============================================

test("serializeTerm handles IRI", () => {
	const term = new IRI("http://example.org/resource");
	expect(serializeTerm(term)).toBe("<http://example.org/resource>");
});

test("serializeTerm handles BlankNode", () => {
	const term = new BlankNode("b1");
	expect(serializeTerm(term)).toBe("_:b1");
});

test("serializeTerm handles Literal", () => {
	const term = new Literal("hello");
	expect(serializeTerm(term)).toBe('"hello"');
});

test("serializeTerm handles Literal with language", () => {
	const term = new Literal("bonjour", undefined, "fr");
	expect(serializeTerm(term)).toBe('"bonjour"@fr');
});

test("serializeTerm handles Variable", () => {
	const term = new Variable("name");
	expect(serializeTerm(term)).toBe("?name");
});

test("serializeTerm handles string variable with ?", () => {
	expect(serializeTerm("?name")).toBe("?name");
});

test("serializeTerm handles string variable with $", () => {
	expect(serializeTerm("$name")).toBe("$name");
});

test("serializeTerm handles string IRI in angle brackets", () => {
	expect(serializeTerm("<http://example.org>")).toBe("<http://example.org>");
});

test("serializeTerm handles string blank node", () => {
	expect(serializeTerm("_:b1")).toBe("_:b1");
});

test("serializeTerm handles prefixed name", () => {
	expect(serializeTerm("foaf:name")).toBe("foaf:name");
});

test("serializeTerm handles bare string as variable", () => {
	expect(serializeTerm("name")).toBe("?name");
});

// ============================================
// serializeStatements Tests
// ============================================

test("serializeStatements serializes Triples", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const statements = [new Triple(s, p, o)];

	const result = serializeStatements(statements);
	expect(result).toBe(
		'<http://example.org/s> <http://example.org/p> "value" .',
	);
});

test("serializeStatements serializes Quads", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const g = new IRI("http://example.org/graph");
	const statements = [new Quad(s, p, o, g)];

	const result = serializeStatements(statements);
	expect(result).toBe(
		'<http://example.org/s> <http://example.org/p> "value" <http://example.org/graph> .',
	);
});

test("serializeStatements handles multiple statements", () => {
	const s = new IRI("http://example.org/s");
	const p1 = new IRI("http://example.org/name");
	const p2 = new IRI("http://example.org/age");
	const o1 = new Literal("Alice");
	const o2 = new Literal(
		"30",
		new IRI("http://www.w3.org/2001/XMLSchema#integer"),
	);

	const result = serializeStatements([
		new Triple(s, p1, o1),
		new Triple(s, p2, o2),
	]);

	const lines = result.split("\n");
	expect(lines).toHaveLength(2);
	expect(lines[0]).toContain("Alice");
	expect(lines[1]).toContain("30");
});

test("serializeStatements handles empty iterable", () => {
	expect(serializeStatements([])).toBe("");
});

// ============================================
// removeSparqlComments Tests
// ============================================

test("removeSparqlComments removes line comments", () => {
	const query = "SELECT * # get everything\nWHERE { ?s ?p ?o }";
	const result = removeSparqlComments(query);
	expect(result).toBe("SELECT * \nWHERE { ?s ?p ?o }");
});

test("removeSparqlComments preserves URIs", () => {
	const query = "SELECT * WHERE { ?s <http://example.org/p#value> ?o }";
	const result = removeSparqlComments(query);
	expect(result).toBe("SELECT * WHERE { ?s <http://example.org/p#value> ?o }");
});

test("removeSparqlComments preserves quoted strings", () => {
	const query = 'SELECT * WHERE { ?s ?p "value # not a comment" }';
	const result = removeSparqlComments(query);
	expect(result).toBe('SELECT * WHERE { ?s ?p "value # not a comment" }');
});

test("removeSparqlComments handles multiple comments", () => {
	const query =
		"# first comment\nSELECT * # select all\nWHERE { ?s ?p ?o } # pattern";
	const result = removeSparqlComments(query);
	expect(result).toContain("SELECT *");
	expect(result).toContain("WHERE { ?s ?p ?o }");
	expect(result).not.toContain("first comment");
	expect(result).not.toContain("select all");
	expect(result).not.toContain("pattern");
});

test("removeSparqlComments handles empty input", () => {
	expect(removeSparqlComments("")).toBe("");
});

// ============================================
// detectQueryType Tests
// ============================================

test("detectQueryType identifies SELECT", () => {
	expect(detectQueryType("SELECT ?s WHERE { ?s ?p ?o }")).toBe("SELECT");
});

test("detectQueryType identifies ASK", () => {
	expect(detectQueryType("ASK { ?s ?p ?o }")).toBe("ASK");
});

test("detectQueryType identifies CONSTRUCT", () => {
	expect(detectQueryType("CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }")).toBe(
		"CONSTRUCT",
	);
});

test("detectQueryType identifies DESCRIBE", () => {
	expect(detectQueryType("DESCRIBE <http://example.org/s>")).toBe("DESCRIBE");
});

test("detectQueryType identifies INSERT", () => {
	expect(
		detectQueryType("INSERT DATA { <http://s> <http://p> <http://o> }"),
	).toBe("INSERT");
});

test("detectQueryType identifies DELETE", () => {
	expect(
		detectQueryType("DELETE DATA { <http://s> <http://p> <http://o> }"),
	).toBe("DELETE");
});

test("detectQueryType handles case insensitive queries", () => {
	expect(detectQueryType("select * where { ?s ?p ?o }")).toBe("SELECT");
	expect(detectQueryType("ask { ?s ?p ?o }")).toBe("ASK");
});

test("detectQueryType handles queries with PREFIX", () => {
	const query =
		"PREFIX foaf: <http://xmlns.com/foaf/0.1/>\nSELECT ?name WHERE { ?person foaf:name ?name }";
	expect(detectQueryType(query)).toBe("SELECT");
});

test("detectQueryType handles queries with multiple PREFIXes", () => {
	const query = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
ASK { ?person rdf:type foaf:Person }`;
	expect(detectQueryType(query)).toBe("ASK");
});

test("detectQueryType handles queries with comments", () => {
	const query = "# This is a comment\nSELECT * WHERE { ?s ?p ?o }";
	expect(detectQueryType(query)).toBe("SELECT");
});

test("detectQueryType returns UNKNOWN for empty string", () => {
	expect(detectQueryType("")).toBe("UNKNOWN");
});

test("detectQueryType returns UNKNOWN for nonsense", () => {
	expect(detectQueryType("not a query")).toBe("UNKNOWN");
});

// ============================================
// detectRdfFormat Tests
// ============================================

test("detectRdfFormat identifies Turtle", () => {
	expect(detectRdfFormat("data.ttl")).toBe("text/turtle");
});

test("detectRdfFormat identifies N-Triples", () => {
	expect(detectRdfFormat("data.nt")).toBe("application/n-triples");
});

test("detectRdfFormat identifies N-Quads", () => {
	expect(detectRdfFormat("data.nq")).toBe("application/n-quads");
});

test("detectRdfFormat identifies RDF/XML from .rdf", () => {
	expect(detectRdfFormat("data.rdf")).toBe("application/rdf+xml");
});

test("detectRdfFormat identifies RDF/XML from .owl", () => {
	expect(detectRdfFormat("ontology.owl")).toBe("application/rdf+xml");
});

test("detectRdfFormat identifies JSON-LD", () => {
	expect(detectRdfFormat("data.jsonld")).toBe("application/ld+json");
});

test("detectRdfFormat identifies TriG", () => {
	expect(detectRdfFormat("data.trig")).toBe("application/trig");
});

test("detectRdfFormat identifies TriX", () => {
	expect(detectRdfFormat("data.trix")).toBe("application/trix");
});

test("detectRdfFormat identifies N3", () => {
	expect(detectRdfFormat("data.n3")).toBe("text/rdf+n3");
});

test("detectRdfFormat returns undefined for unknown extension", () => {
	expect(detectRdfFormat("data.csv")).toBeUndefined();
});

test("detectRdfFormat returns undefined for no extension", () => {
	expect(detectRdfFormat("datafile")).toBeUndefined();
});

test("detectRdfFormat handles path with directory", () => {
	expect(detectRdfFormat("/path/to/data.ttl")).toBe("text/turtle");
});

test("detectRdfFormat is case insensitive", () => {
	expect(detectRdfFormat("data.TTL")).toBe("text/turtle");
});

// ============================================
// Factory Function Tests
// ============================================

test("iri() factory creates IRI", () => {
	const result = iri("http://example.org");
	expect(result).toBeInstanceOf(IRI);
	expect(result.value).toBe("http://example.org");
});

test("literal() factory creates plain Literal", () => {
	const result = literal("hello");
	expect(result).toBeInstanceOf(Literal);
	expect(result.value).toBe("hello");
});

test("literal() factory creates Literal with language", () => {
	const result = literal("bonjour", "fr");
	expect(result.language).toBe("fr");
	expect(result.datatype).toBeUndefined();
});

test("literal() factory creates Literal with datatype", () => {
	const dt = new IRI("http://www.w3.org/2001/XMLSchema#integer");
	const result = literal("42", dt);
	expect(result.datatype?.value).toBe(
		"http://www.w3.org/2001/XMLSchema#integer",
	);
});

test("blankNode() factory creates BlankNode", () => {
	const result = blankNode("b1");
	expect(result).toBeInstanceOf(BlankNode);
	expect(result.value).toBe("b1");
});

test("variable() factory creates Variable", () => {
	const result = variable("x");
	expect(result).toBeInstanceOf(Variable);
	expect(result.name).toBe("x");
});
