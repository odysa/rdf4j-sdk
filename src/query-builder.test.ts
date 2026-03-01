import { expect, test } from "bun:test";
import { IRI, Namespace } from "./model.ts";
import {
	AskQuery,
	ask,
	ConstructQuery,
	construct,
	DescribeQuery,
	describe,
	GraphPattern,
	SelectQuery,
	select,
} from "./query-builder.ts";

// ============================================
// Factory Function Tests
// ============================================

test("select() creates SelectQuery", () => {
	const q = select("?name", "?age");
	expect(q).toBeInstanceOf(SelectQuery);
});

test("ask() creates AskQuery", () => {
	const q = ask();
	expect(q).toBeInstanceOf(AskQuery);
});

test("construct() creates ConstructQuery", () => {
	const q = construct();
	expect(q).toBeInstanceOf(ConstructQuery);
});

test("describe() creates DescribeQuery", () => {
	const q = describe("<http://example.org/s>");
	expect(q).toBeInstanceOf(DescribeQuery);
});

// ============================================
// SelectQuery Tests
// ============================================

test("SELECT basic query", () => {
	const q = select("?s", "?p", "?o").where("?s", "?p", "?o").build();

	expect(q).toContain("SELECT ?s ?p ?o");
	expect(q).toContain("WHERE {");
	expect(q).toContain("?s ?p ?o .");
	expect(q).toContain("}");
});

test("SELECT with wildcard", () => {
	const q = select("*").where("?s", "?p", "?o").build();
	expect(q).toContain("SELECT *");
});

test("SELECT without variables defaults to *", () => {
	const q = select().where("?s", "?p", "?o").build();
	expect(q).toContain("SELECT *");
});

test("SELECT DISTINCT", () => {
	const q = select("?name")
		.distinct()
		.where("?s", "foaf:name", "?name")
		.build();
	expect(q).toContain("SELECT DISTINCT ?name");
});

test("SELECT with ORDER BY", () => {
	const q = select("?name")
		.where("?person", "foaf:name", "?name")
		.orderBy("?name")
		.build();
	expect(q).toContain("ORDER BY ?name");
});

test("SELECT with multiple ORDER BY", () => {
	const q = select("?name", "?age")
		.where("?person", "foaf:name", "?name")
		.orderBy("?name", "DESC(?age)")
		.build();
	expect(q).toContain("ORDER BY ?name DESC(?age)");
});

test("SELECT with GROUP BY", () => {
	const q = select("?type", "(COUNT(*) AS ?count)")
		.where("?s", "rdf:type", "?type")
		.groupBy("?type")
		.build();
	expect(q).toContain("GROUP BY ?type");
});

test("SELECT with HAVING", () => {
	const q = select("?type", "(COUNT(*) AS ?count)")
		.where("?s", "rdf:type", "?type")
		.groupBy("?type")
		.having("COUNT(*) > 5")
		.build();
	expect(q).toContain("HAVING (COUNT(*) > 5)");
});

test("SELECT with LIMIT", () => {
	const q = select("?s").where("?s", "?p", "?o").limit(10).build();
	expect(q).toContain("LIMIT 10");
});

test("SELECT with OFFSET", () => {
	const q = select("?s").where("?s", "?p", "?o").offset(20).build();
	expect(q).toContain("OFFSET 20");
});

test("SELECT with LIMIT and OFFSET", () => {
	const q = select("?s").where("?s", "?p", "?o").limit(10).offset(20).build();
	expect(q).toContain("LIMIT 10");
	expect(q).toContain("OFFSET 20");
});

test("SELECT auto-prefixes variable names without ?", () => {
	const q = select("name", "age")
		.where("?person", "foaf:name", "?name")
		.build();
	expect(q).toContain("SELECT ?name ?age");
});

test("SELECT with PREFIX", () => {
	const foaf = new Namespace("foaf", "http://xmlns.com/foaf/0.1/");
	const q = select("?name")
		.prefix(foaf)
		.where("?person", "foaf:name", "?name")
		.build();
	expect(q).toContain("PREFIX foaf: <http://xmlns.com/foaf/0.1/>");
});

test("SELECT with string PREFIX", () => {
	const q = select("?name")
		.prefix("foaf", "http://xmlns.com/foaf/0.1/")
		.where("?person", "foaf:name", "?name")
		.build();
	expect(q).toContain("PREFIX foaf: <http://xmlns.com/foaf/0.1/>");
});

test("SELECT with FILTER", () => {
	const q = select("?name", "?age")
		.where("?person", "foaf:name", "?name")
		.where("?person", "foaf:age", "?age")
		.filter("?age > 30")
		.build();
	expect(q).toContain("FILTER (?age > 30)");
});

test("SELECT with OPTIONAL (triple)", () => {
	const q = select("?name", "?email")
		.where("?person", "foaf:name", "?name")
		.optional("?person", "foaf:mbox", "?email")
		.build();
	expect(q).toContain("OPTIONAL { ?person foaf:mbox ?email . }");
});

test("SELECT with OPTIONAL (pattern)", () => {
	const pattern = new GraphPattern()
		.where("?person", "foaf:mbox", "?email")
		.filter("BOUND(?email)");

	const q = select("?name", "?email")
		.where("?person", "foaf:name", "?name")
		.optional(pattern)
		.build();
	expect(q).toContain("OPTIONAL {");
	expect(q).toContain("foaf:mbox");
	expect(q).toContain("FILTER");
});

test("SELECT with BIND", () => {
	const q = select("?name", "?upperName")
		.where("?person", "foaf:name", "?name")
		.bind("UCASE(?name)", "upperName")
		.build();
	expect(q).toContain("BIND (UCASE(?name) AS ?upperName)");
});

test("SELECT with VALUES", () => {
	const q = select("?person")
		.where("?person", "rdf:type", "foaf:Person")
		.values("?person", [
			"<http://example.org/alice>",
			"<http://example.org/bob>",
		])
		.build();
	expect(q).toContain(
		"VALUES ?person { <http://example.org/alice> <http://example.org/bob> }",
	);
});

test("SELECT with IRI terms in where", () => {
	const s = new IRI("http://example.org/alice");
	const p = new IRI("http://xmlns.com/foaf/0.1/name");

	const q = select("?name").where(s, p, "?name").build();
	expect(q).toContain("<http://example.org/alice>");
	expect(q).toContain("<http://xmlns.com/foaf/0.1/name>");
});

test("SELECT with UNION", () => {
	const p1 = new GraphPattern().where("?person", "foaf:name", "?name");
	const p2 = new GraphPattern().where("?person", "rdfs:label", "?name");

	const q = select("?name").union(p1, p2).build();
	expect(q).toContain("UNION");
	expect(q).toContain("foaf:name");
	expect(q).toContain("rdfs:label");
});

test("SELECT with sub-query", () => {
	const subQ = select("?person")
		.where("?person", "rdf:type", "foaf:Person")
		.limit(10);

	const q = select("?person", "?name")
		.subQuery(subQ)
		.where("?person", "foaf:name", "?name")
		.build();

	expect(q).toContain("SELECT ?person ?name");
	expect(q).toContain("SELECT ?person");
	expect(q).toContain("LIMIT 10");
});

test("SELECT copy creates independent instance", () => {
	const original = select("?name")
		.where("?person", "foaf:name", "?name")
		.limit(10);

	const copied = original.copy().limit(20);

	expect(original.build()).toContain("LIMIT 10");
	expect(copied.build()).toContain("LIMIT 20");
});

// ============================================
// ASK Query Tests
// ============================================

test("ASK basic query", () => {
	const q = ask().where("?s", "rdf:type", "foaf:Person").build();
	expect(q).toContain("ASK");
	expect(q).toContain("WHERE {");
	expect(q).toContain("rdf:type");
});

test("ASK with PREFIX", () => {
	const foaf = new Namespace("foaf", "http://xmlns.com/foaf/0.1/");
	const q = ask().prefix(foaf).where("?s", "rdf:type", "foaf:Person").build();
	expect(q).toContain("PREFIX foaf:");
	expect(q).toContain("ASK");
});

test("ASK with FILTER", () => {
	const q = ask()
		.where("?person", "foaf:age", "?age")
		.filter("?age > 100")
		.build();
	expect(q).toContain("ASK");
	expect(q).toContain("FILTER (?age > 100)");
});

test("ASK copy creates independent instance", () => {
	const original = ask().where("?s", "rdf:type", "foaf:Person");
	const copied = original.copy().filter("?s != ?s");

	expect(original.build()).not.toContain("FILTER");
	expect(copied.build()).toContain("FILTER");
});

// ============================================
// CONSTRUCT Query Tests
// ============================================

test("CONSTRUCT basic query", () => {
	const q = construct(["?s", "?p", "?o"]).where("?s", "?p", "?o").build();
	expect(q).toContain("CONSTRUCT {");
	expect(q).toContain("?s ?p ?o .");
	expect(q).toContain("WHERE {");
});

test("CONSTRUCT with multiple templates", () => {
	const q = construct(
		["?s", "rdf:type", "foaf:Person"],
		["?s", "foaf:name", "?name"],
	)
		.where("?s", "foaf:name", "?name")
		.build();
	expect(q).toContain("rdf:type foaf:Person");
	expect(q).toContain("foaf:name ?name");
});

test("CONSTRUCT with IRI terms in templates", () => {
	const rdfType = new IRI("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
	const q = construct(["?s", rdfType, "?type"])
		.where("?s", rdfType, "?type")
		.build();
	expect(q).toContain("<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>");
});

test("CONSTRUCT copy creates independent instance", () => {
	const original = construct(["?s", "?p", "?o"]).where("?s", "?p", "?o");
	const copied = original.copy().filter("?s != ?p");

	expect(original.build()).not.toContain("FILTER");
	expect(copied.build()).toContain("FILTER");
});

// ============================================
// DESCRIBE Query Tests
// ============================================

test("DESCRIBE single resource", () => {
	const q = describe("<http://example.org/alice>").build();
	expect(q).toBe("DESCRIBE <http://example.org/alice>");
});

test("DESCRIBE multiple resources", () => {
	const q = describe(
		"<http://example.org/alice>",
		"<http://example.org/bob>",
	).build();
	expect(q).toContain(
		"DESCRIBE <http://example.org/alice> <http://example.org/bob>",
	);
});

test("DESCRIBE with IRI term", () => {
	const alice = new IRI("http://example.org/alice");
	const q = describe(alice).build();
	expect(q).toBe("DESCRIBE <http://example.org/alice>");
});

test("DESCRIBE with WHERE clause", () => {
	const q = describe("?person")
		.where("?person", "rdf:type", "foaf:Person")
		.build();
	expect(q).toContain("DESCRIBE ?person");
	expect(q).toContain("WHERE {");
	expect(q).toContain("rdf:type");
});

test("DESCRIBE copy creates independent instance", () => {
	const original = describe("<http://example.org/alice>");
	const copied = original.copy().where("?s", "?p", "?o");

	expect(original.build()).not.toContain("WHERE");
	expect(copied.build()).toContain("WHERE");
});

// ============================================
// GraphPattern Tests
// ============================================

test("GraphPattern where adds triple", () => {
	const p = new GraphPattern().where("?s", "?p", "?o");
	expect(p.toSparql()).toContain("?s ?p ?o .");
	expect(p.length).toBe(1);
});

test("GraphPattern is immutable", () => {
	const p1 = new GraphPattern();
	const p2 = p1.where("?s", "?p", "?o");
	expect(p1.length).toBe(0);
	expect(p2.length).toBe(1);
});

test("GraphPattern filter", () => {
	const p = new GraphPattern().where("?s", "?p", "?o").filter("?o > 5");
	expect(p.toSparql()).toContain("FILTER (?o > 5)");
});

test("GraphPattern optional with triple", () => {
	const p = new GraphPattern()
		.where("?s", "foaf:name", "?name")
		.optional("?s", "foaf:mbox", "?email");
	expect(p.toSparql()).toContain("OPTIONAL { ?s foaf:mbox ?email . }");
});

test("GraphPattern optional with pattern", () => {
	const inner = new GraphPattern().where("?s", "foaf:mbox", "?email");
	const p = new GraphPattern()
		.where("?s", "foaf:name", "?name")
		.optional(inner);
	expect(p.toSparql()).toContain("OPTIONAL {");
	expect(p.toSparql()).toContain("foaf:mbox");
});

test("GraphPattern union", () => {
	const p1 = new GraphPattern().where("?s", "foaf:name", "?name");
	const p2 = new GraphPattern().where("?s", "rdfs:label", "?name");

	const combined = new GraphPattern().union(p1, p2);
	expect(combined.toSparql()).toContain("UNION");
});

test("GraphPattern bind", () => {
	const p = new GraphPattern()
		.where("?person", "foaf:name", "?name")
		.bind("UCASE(?name)", "upper");
	expect(p.toSparql()).toContain("BIND (UCASE(?name) AS ?upper)");
});

test("GraphPattern values", () => {
	const p = new GraphPattern().values("?x", [
		"<http://example.org/a>",
		"<http://example.org/b>",
	]);
	expect(p.toSparql()).toContain(
		"VALUES ?x { <http://example.org/a> <http://example.org/b> }",
	);
});

test("GraphPattern sub-query", () => {
	const sub = select("?person").where("?person", "rdf:type", "foaf:Person");
	const p = new GraphPattern()
		.subQuery(sub)
		.where("?person", "foaf:name", "?name");
	const sparql = p.toSparql();
	expect(sparql).toContain("SELECT ?person");
	expect(sparql).toContain("foaf:name");
});

test("GraphPattern copy creates independent instance", () => {
	const original = new GraphPattern().where("?s", "?p", "?o");
	const copied = original.copy().filter("?o > 5");
	expect(original.length).toBe(1);
	expect(copied.length).toBe(2);
});

test("GraphPattern toSparql with custom indent", () => {
	const p = new GraphPattern().where("?s", "?p", "?o");
	const result = p.toSparql(4);
	expect(result).toMatch(/^ {4}/);
});

// ============================================
// Complex Query Tests
// ============================================

test("Complex query with all features", () => {
	const foaf = new Namespace("foaf", "http://xmlns.com/foaf/0.1/");
	const rdf = new Namespace(
		"rdf",
		"http://www.w3.org/1999/02/22-rdf-syntax-ns#",
	);

	const q = select("?name", "?age")
		.prefix(foaf)
		.prefix(rdf)
		.where("?person", "rdf:type", "foaf:Person")
		.where("?person", "foaf:name", "?name")
		.where("?person", "foaf:age", "?age")
		.optional("?person", "foaf:mbox", "?email")
		.filter("?age > 21")
		.distinct()
		.orderBy("?name")
		.limit(100)
		.offset(0)
		.build();

	expect(q).toContain("PREFIX foaf:");
	expect(q).toContain("PREFIX rdf:");
	expect(q).toContain("SELECT DISTINCT ?name ?age");
	expect(q).toContain("rdf:type foaf:Person");
	expect(q).toContain("OPTIONAL");
	expect(q).toContain("FILTER (?age > 21)");
	expect(q).toContain("ORDER BY ?name");
	expect(q).toContain("LIMIT 100");
	expect(q).toContain("OFFSET 0");
});
