import { expect, test } from "bun:test";
import {
	BlankNode,
	DC,
	DCTERMS,
	DefaultGraph,
	DirectTypeHierarchyInferencerConfig,
	ElasticsearchStoreConfig,
	FOAF,
	HTTPRepositoryImplConfig,
	IRI,
	Literal,
	MemoryStoreConfig,
	Namespace,
	NativeStoreConfig,
	OWL,
	Quad,
	RDF,
	RDFS,
	RepositoryImplConfigBuilder,
	SailRepositoryImplConfig,
	SCHEMA,
	SchemaCachingRDFSInferencerConfig,
	SHACLSailConfig,
	SKOS,
	SPARQLRepositoryImplConfig,
	Triple,
	Variable,
	XSD,
} from "./model.ts";

// ============================================
// IRI Tests
// ============================================

test("IRI stores value and serializes to N-Triples format", () => {
	const iri = new IRI("http://example.org/resource");
	expect(iri.value).toBe("http://example.org/resource");
	expect(iri.toString()).toBe("<http://example.org/resource>");
	expect(iri.termType).toBe("NamedNode");
});

test("IRI equality", () => {
	const a = new IRI("http://example.org/a");
	const b = new IRI("http://example.org/a");
	const c = new IRI("http://example.org/b");
	expect(a.equals(b)).toBe(true);
	expect(a.equals(c)).toBe(false);
	expect(a.equals("not an IRI")).toBe(false);
});

// ============================================
// BlankNode Tests
// ============================================

test("BlankNode stores value and serializes", () => {
	const bn = new BlankNode("b1");
	expect(bn.value).toBe("b1");
	expect(bn.toString()).toBe("_:b1");
	expect(bn.termType).toBe("BlankNode");
});

test("BlankNode equality", () => {
	const a = new BlankNode("b1");
	const b = new BlankNode("b1");
	const c = new BlankNode("b2");
	expect(a.equals(b)).toBe(true);
	expect(a.equals(c)).toBe(false);
});

// ============================================
// Literal Tests
// ============================================

test("Literal plain string serialization", () => {
	const lit = new Literal("hello");
	expect(lit.value).toBe("hello");
	expect(lit.toString()).toBe('"hello"');
	expect(lit.termType).toBe("Literal");
});

test("Literal with language tag", () => {
	const lit = new Literal("bonjour", undefined, "fr");
	expect(lit.toString()).toBe('"bonjour"@fr');
	expect(lit.language).toBe("fr");
});

test("Literal with datatype", () => {
	const dt = new IRI("http://www.w3.org/2001/XMLSchema#integer");
	const lit = new Literal("42", dt);
	expect(lit.toString()).toBe(
		'"42"^^<http://www.w3.org/2001/XMLSchema#integer>',
	);
	expect(lit.datatype?.value).toBe("http://www.w3.org/2001/XMLSchema#integer");
});

test("Literal escapes special characters", () => {
	const lit = new Literal('hello "world"\nline2\ttab\\slash');
	expect(lit.toString()).toBe('"hello \\"world\\"\\nline2\\ttab\\\\slash"');
});

test("Literal equality", () => {
	const a = new Literal("hello", undefined, "en");
	const b = new Literal("hello", undefined, "en");
	const c = new Literal("hello", undefined, "fr");
	const d = new Literal("hello");
	expect(a.equals(b)).toBe(true);
	expect(a.equals(c)).toBe(false);
	expect(a.equals(d)).toBe(false);
});

// ============================================
// Variable Tests
// ============================================

test("Variable serialization", () => {
	const v = new Variable("name");
	expect(v.name).toBe("name");
	expect(v.toString()).toBe("?name");
	expect(v.termType).toBe("Variable");
});

test("Variable equality", () => {
	const a = new Variable("x");
	const b = new Variable("x");
	const c = new Variable("y");
	expect(a.equals(b)).toBe(true);
	expect(a.equals(c)).toBe(false);
});

// ============================================
// DefaultGraph Tests
// ============================================

test("DefaultGraph serialization", () => {
	const dg = new DefaultGraph();
	expect(dg.toString()).toBe("");
	expect(dg.termType).toBe("DefaultGraph");
});

test("DefaultGraph equality", () => {
	const a = new DefaultGraph();
	const b = new DefaultGraph();
	expect(a.equals(b)).toBe(true);
	expect(a.equals(new IRI("http://example.org"))).toBe(false);
});

// ============================================
// Triple Tests
// ============================================

test("Triple creation and serialization", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const t = new Triple(s, p, o);

	expect(t.subject).toBe(s);
	expect(t.predicate).toBe(p);
	expect(t.object).toBe(o);
	expect(t.toString()).toBe(
		'<http://example.org/s> <http://example.org/p> "value" .',
	);
});

test("Triple equality", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const a = new Triple(s, p, o);
	const b = new Triple(
		new IRI("http://example.org/s"),
		new IRI("http://example.org/p"),
		new Literal("value"),
	);
	expect(a.equals(b)).toBe(true);
});

// ============================================
// Quad Tests
// ============================================

test("Quad creation and serialization", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const g = new IRI("http://example.org/graph");
	const q = new Quad(s, p, o, g);

	expect(q.graph).toBe(g);
	expect(q.toString()).toBe(
		'<http://example.org/s> <http://example.org/p> "value" <http://example.org/graph> .',
	);
});

test("Quad without graph omits graph in serialization", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new IRI("http://example.org/o");
	const q = new Quad(s, p, o);

	expect(q.toString()).toBe(
		"<http://example.org/s> <http://example.org/p> <http://example.org/o> .",
	);
});

test("Quad with DefaultGraph omits graph in serialization", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new IRI("http://example.org/o");
	const q = new Quad(s, p, o, new DefaultGraph());

	expect(q.toString()).toBe(
		"<http://example.org/s> <http://example.org/p> <http://example.org/o> .",
	);
});

test("Quad equality", () => {
	const s = new IRI("http://example.org/s");
	const p = new IRI("http://example.org/p");
	const o = new Literal("value");
	const g = new IRI("http://example.org/graph");
	const a = new Quad(s, p, o, g);
	const b = new Quad(
		new IRI("http://example.org/s"),
		new IRI("http://example.org/p"),
		new Literal("value"),
		new IRI("http://example.org/graph"),
	);
	expect(a.equals(b)).toBe(true);
});

// ============================================
// Namespace Tests
// ============================================

test("Namespace creates IRIs from local names", () => {
	const ns = new Namespace("ex", "http://example.org/");
	const iri = ns.term("Person");
	expect(iri).toBeInstanceOf(IRI);
	expect(iri.value).toBe("http://example.org/Person");
});

test("Namespace stores prefix and value", () => {
	const ns = new Namespace("foaf", "http://xmlns.com/foaf/0.1/");
	expect(ns.prefix).toBe("foaf");
	expect(ns.value).toBe("http://xmlns.com/foaf/0.1/");
	expect(ns.toString()).toBe("http://xmlns.com/foaf/0.1/");
});

// ============================================
// Standard Vocabulary Tests
// ============================================

test("Standard vocabularies have correct URIs", () => {
	expect(RDF.value).toBe("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
	expect(RDFS.value).toBe("http://www.w3.org/2000/01/rdf-schema#");
	expect(OWL.value).toBe("http://www.w3.org/2002/07/owl#");
	expect(XSD.value).toBe("http://www.w3.org/2001/XMLSchema#");
	expect(FOAF.value).toBe("http://xmlns.com/foaf/0.1/");
	expect(SKOS.value).toBe("http://www.w3.org/2004/02/skos/core#");
	expect(DC.value).toBe("http://purl.org/dc/elements/1.1/");
	expect(DCTERMS.value).toBe("http://purl.org/dc/terms/");
	expect(SCHEMA.value).toBe("https://schema.org/");
});

test("Standard vocabularies create correct IRIs", () => {
	expect(RDF.term("type").value).toBe(
		"http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
	);
	expect(RDFS.term("label").value).toBe(
		"http://www.w3.org/2000/01/rdf-schema#label",
	);
	expect(FOAF.term("name").value).toBe("http://xmlns.com/foaf/0.1/name");
	expect(XSD.term("integer").value).toBe(
		"http://www.w3.org/2001/XMLSchema#integer",
	);
});

// ============================================
// Repository Configuration Tests
// ============================================

test("MemoryStoreConfig generates Turtle", () => {
	const config = new MemoryStoreConfig(true, 1000);
	const turtle = config.toTurtle(6);
	expect(turtle).toContain('sail:sailType "openrdf:MemoryStore"');
	expect(turtle).toContain("ms:persist true");
	expect(turtle).toContain("ms:syncDelay 1000");
});

test("MemoryStoreConfig defaults", () => {
	const config = new MemoryStoreConfig();
	expect(config.persist).toBe(false);
	expect(config.syncDelay).toBe(0);
});

test("NativeStoreConfig generates Turtle", () => {
	const config = new NativeStoreConfig("spoc,posc");
	const turtle = config.toTurtle();
	expect(turtle).toContain('sail:sailType "openrdf:NativeStore"');
	expect(turtle).toContain('ns:tripleIndexes "spoc,posc"');
});

test("ElasticsearchStoreConfig generates Turtle", () => {
	const config = new ElasticsearchStoreConfig(
		"eshost",
		9201,
		"mycluster",
		"myindex",
	);
	const turtle = config.toTurtle();
	expect(turtle).toContain('ess:hostname "eshost"');
	expect(turtle).toContain("ess:port 9201");
	expect(turtle).toContain('ess:clusterName "mycluster"');
	expect(turtle).toContain('ess:index "myindex"');
});

test("SchemaCachingRDFSInferencerConfig wraps delegate", () => {
	const delegate = new MemoryStoreConfig();
	const config = new SchemaCachingRDFSInferencerConfig(delegate);
	const turtle = config.toTurtle();
	expect(turtle).toContain("openrdf:SchemaCachingRDFSInferencer");
	expect(turtle).toContain("sail:delegate");
	expect(turtle).toContain("openrdf:MemoryStore");
});

test("DirectTypeHierarchyInferencerConfig wraps delegate", () => {
	const delegate = new NativeStoreConfig();
	const config = new DirectTypeHierarchyInferencerConfig(delegate);
	const turtle = config.toTurtle();
	expect(turtle).toContain("openrdf:DirectTypeHierarchyInferencer");
	expect(turtle).toContain("openrdf:NativeStore");
});

test("SHACLSailConfig wraps delegate", () => {
	const delegate = new MemoryStoreConfig(true);
	const config = new SHACLSailConfig(delegate);
	const turtle = config.toTurtle();
	expect(turtle).toContain("openrdf:SHACLSail");
	expect(turtle).toContain("openrdf:MemoryStore");
	expect(turtle).toContain("ms:persist true");
});

test("SailRepositoryImplConfig generates Turtle", () => {
	const sail = new MemoryStoreConfig();
	const impl = new SailRepositoryImplConfig(sail);
	const turtle = impl.toTurtle();
	expect(turtle).toContain("openrdf:SailRepository");
	expect(turtle).toContain("sr:sailImpl");
	expect(turtle).toContain("openrdf:MemoryStore");
});

test("SPARQLRepositoryImplConfig generates Turtle", () => {
	const impl = new SPARQLRepositoryImplConfig(
		"http://dbpedia.org/sparql",
		"http://dbpedia.org/sparql/update",
	);
	const turtle = impl.toTurtle();
	expect(turtle).toContain("openrdf:SPARQLRepository");
	expect(turtle).toContain('sparql:query-endpoint "http://dbpedia.org/sparql"');
	expect(turtle).toContain(
		'sparql:update-endpoint "http://dbpedia.org/sparql/update"',
	);
});

test("SPARQLRepositoryImplConfig without update endpoint", () => {
	const impl = new SPARQLRepositoryImplConfig("http://dbpedia.org/sparql");
	const turtle = impl.toTurtle();
	expect(turtle).toContain("openrdf:SPARQLRepository");
	expect(turtle).not.toContain("update-endpoint");
});

test("HTTPRepositoryImplConfig generates Turtle", () => {
	const impl = new HTTPRepositoryImplConfig(
		"http://remote.example.org/rdf4j-server",
	);
	const turtle = impl.toTurtle();
	expect(turtle).toContain("openrdf:HTTPRepository");
	expect(turtle).toContain(
		'hr:repositoryURL "http://remote.example.org/rdf4j-server"',
	);
});

test("RepositoryImplConfigBuilder generates complete Turtle config", () => {
	const builder = new RepositoryImplConfigBuilder(
		"my-repo",
		"My Repository",
		new SailRepositoryImplConfig(new MemoryStoreConfig(false, 0)),
	);
	const turtle = builder.toTurtle();
	expect(turtle).toContain("@prefix rep:");
	expect(turtle).toContain("@prefix sr:");
	expect(turtle).toContain("@prefix sail:");
	expect(turtle).toContain('rep:repositoryID "my-repo"');
	expect(turtle).toContain('rdfs:label "My Repository"');
	expect(turtle).toContain("openrdf:SailRepository");
	expect(turtle).toContain("openrdf:MemoryStore");
});

test("RepositoryImplConfigBuilder defaults to memory store", () => {
	const builder = new RepositoryImplConfigBuilder("default-repo");
	const turtle = builder.toTurtle();
	expect(turtle).toContain("openrdf:MemoryStore");
	expect(turtle).toContain('rep:repositoryID "default-repo"');
	expect(turtle).toContain('rdfs:label "default-repo"');
});
