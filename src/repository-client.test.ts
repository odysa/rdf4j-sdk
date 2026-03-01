import { afterEach, beforeEach, expect, type Mock, mock, test } from "bun:test";
import { HttpClient } from "./http-client.ts";
import { IRI, Literal, Quad, Triple } from "./model.ts";
import { NamedGraphClient } from "./named-graph-client.ts";
import { RepositoryClient } from "./repository-client.ts";
import { TransactionClient } from "./transaction-client.ts";
import { ContentTypes } from "./types.ts";

let mockFetchFn: Mock<
	(url: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
const originalFetch = globalThis.fetch;

function setMockFetch(
	response: unknown,
	contentType = "application/json",
	status = 200,
) {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(
				typeof response === "string" ? response : JSON.stringify(response),
				{
					status,
					headers: { "content-type": contentType },
				},
			),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;
}

function createRepo(): RepositoryClient {
	const http = new HttpClient({ baseUrl: "http://localhost:8080/rdf4j" });
	return new RepositoryClient(http, "test-repo");
}

beforeEach(() => {
	setMockFetch({ test: "data" });
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

// ============================================
// Typed Statement Operations
// ============================================

test("addStatements sends N-Quads data", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	const statements = [
		new Triple(
			new IRI("http://example.org/alice"),
			new IRI("http://xmlns.com/foaf/0.1/name"),
			new Literal("Alice"),
		),
		new Triple(
			new IRI("http://example.org/bob"),
			new IRI("http://xmlns.com/foaf/0.1/name"),
			new Literal("Bob"),
		),
	];

	await repo.addStatements(statements);

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect(options.body).toContain("http://example.org/alice");
	expect(options.body).toContain("http://example.org/bob");
	expect(options.body).toContain("Alice");
	expect(options.body).toContain("Bob");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NQUADS,
	);
});

test("addStatements sends Quads with graph", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	const g = new IRI("http://example.org/graph1");
	const statements = [
		new Quad(
			new IRI("http://example.org/alice"),
			new IRI("http://xmlns.com/foaf/0.1/name"),
			new Literal("Alice"),
			g,
		),
	];

	await repo.addStatements(statements);

	const body = (mockFetchFn.mock.calls[0]?.[1] as RequestInit).body as string;
	expect(body).toContain("http://example.org/graph1");
});

test("addStatements with context parameter", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.addStatements(
		[
			new Triple(
				new IRI("http://example.org/s"),
				new IRI("http://example.org/p"),
				new Literal("value"),
			),
		],
		{ context: "<http://example.org/ctx>" },
	);

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("context=");
});

test("replaceStatements sends PUT with N-Quads", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	const statements = [
		new Triple(
			new IRI("http://example.org/s"),
			new IRI("http://example.org/p"),
			new Literal("new-value"),
		),
	];

	await repo.replaceStatements(statements);

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");
	expect(options.body).toContain("new-value");
});

// ============================================
// File Upload
// ============================================

test("uploadFile throws for unknown format without explicit rdfFormat", async () => {
	const repo = createRepo();
	await expect(repo.uploadFile("/tmp/data.unknown")).rejects.toThrow(
		"Cannot detect RDF format",
	);
});

// ============================================
// Named Graph
// ============================================

test("namedGraph returns NamedGraphClient", () => {
	const repo = createRepo();
	const ng = repo.namedGraph("http://example.org/graph1");
	expect(ng).toBeInstanceOf(NamedGraphClient);
});

// ============================================
// Transaction Operations
// ============================================

test("beginTransaction creates TransactionClient", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("", {
				status: 201,
				headers: {
					"content-type": "text/plain",
					location:
						"http://localhost:8080/rdf4j/repositories/test-repo/transactions/tx123",
				},
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	const txn = await repo.beginTransaction();

	expect(txn).toBeInstanceOf(TransactionClient);
	expect(txn.id).toBe("tx123");
	expect(txn.isActive).toBe(true);
});

test("beginTransaction with isolation level", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("", {
				status: 201,
				headers: {
					"content-type": "text/plain",
					location:
						"http://localhost:8080/rdf4j/repositories/test-repo/transactions/tx456",
				},
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.beginTransaction("SERIALIZABLE");

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("isolation-level=SERIALIZABLE");
});

test("withTransaction commits on success", async () => {
	let callCount = 0;
	mockFetchFn = mock(() => {
		callCount++;
		if (callCount === 1) {
			// beginTransaction
			return Promise.resolve(
				new Response("", {
					status: 201,
					headers: {
						"content-type": "text/plain",
						location:
							"http://localhost:8080/rdf4j/repositories/test-repo/transactions/tx789",
					},
				}),
			);
		}
		// commit
		return Promise.resolve(new Response(null, { status: 204 }));
	});
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	const result = await repo.withTransaction(async (txn) => {
		expect(txn.isActive).toBe(true);
		return "done";
	});

	expect(result).toBe("done");
	// Verify commit was called (PUT with action=COMMIT)
	const lastCall = mockFetchFn.mock.calls[mockFetchFn.mock.calls.length - 1];
	const lastOptions = lastCall?.[1] as RequestInit;
	expect(lastOptions.method).toBe("PUT");
	const lastUrl = lastCall?.[0] as string;
	expect(lastUrl).toContain("action=COMMIT");
});

test("withTransaction rolls back on error", async () => {
	let callCount = 0;
	mockFetchFn = mock(() => {
		callCount++;
		if (callCount === 1) {
			return Promise.resolve(
				new Response("", {
					status: 201,
					headers: {
						"content-type": "text/plain",
						location:
							"http://localhost:8080/rdf4j/repositories/test-repo/transactions/tx-err",
					},
				}),
			);
		}
		return Promise.resolve(new Response(null, { status: 204 }));
	});
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();

	await expect(
		repo.withTransaction(async () => {
			throw new Error("something failed");
		}),
	).rejects.toThrow("something failed");

	// Verify rollback was called (DELETE)
	const lastCall = mockFetchFn.mock.calls[mockFetchFn.mock.calls.length - 1];
	const lastOptions = lastCall?.[1] as RequestInit;
	expect(lastOptions.method).toBe("DELETE");
});

// ============================================
// SPARQL Query Operations
// ============================================

test("query sends SPARQL SELECT and returns bindings", async () => {
	const sparqlResult = {
		head: { vars: ["s"] },
		results: {
			bindings: [
				{ s: { type: "uri" as const, value: "http://example.org/s" } },
			],
		},
	};
	setMockFetch(sparqlResult);

	const repo = createRepo();
	const result = await repo.query("SELECT ?s WHERE { ?s ?p ?o }");

	expect(result.results.bindings).toHaveLength(1);
	expect(result.results.bindings[0]?.s?.value).toBe("http://example.org/s");
});

test("queryPost sends query via POST body", async () => {
	setMockFetch({
		head: { vars: ["s"] },
		results: { bindings: [] },
	});

	const repo = createRepo();
	await repo.queryPost("SELECT ?s WHERE { ?s ?p ?o }");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect(options.body).toBe("SELECT ?s WHERE { ?s ?p ?o }");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.SPARQL_QUERY,
	);
});

test("construct returns RDF string", async () => {
	const turtle = "<http://s> <http://p> <http://o> .";
	setMockFetch(turtle, "text/turtle");

	const repo = createRepo();
	const result = await repo.construct(
		"CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }",
	);
	expect(result).toBe(turtle);
});

test("describe returns RDF string", async () => {
	const turtle = '<http://s> <http://p> "value" .';
	setMockFetch(turtle, "text/turtle");

	const repo = createRepo();
	const result = await repo.describe("http://example.org/s");
	expect(result).toContain("http://s");
});

test("ask returns boolean", async () => {
	setMockFetch({ head: {}, boolean: true });

	const repo = createRepo();
	const result = await repo.ask("ASK { ?s ?p ?o }");
	expect(result).toBe(true);
});

// ============================================
// Statement Operations
// ============================================

test("add sends POST with content type", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.add("<http://s> <http://p> <http://o> .", {
		contentType: ContentTypes.NTRIPLES,
	});

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NTRIPLES,
	);
});

test("getStatements filters by subject/predicate/object", async () => {
	setMockFetch("<http://s> <http://p> <http://o> .", "text/turtle");

	const repo = createRepo();
	await repo.getStatements({
		subj: "<http://example.org/s>",
		pred: "<http://example.org/p>",
	});

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("subj=");
	expect(calledUrl).toContain("pred=");
});

test("size returns number", async () => {
	setMockFetch("42", "text/plain");

	const repo = createRepo();
	const result = await repo.size();
	expect(result).toBe(42);
});

test("contexts returns array of URIs", async () => {
	setMockFetch({
		head: { vars: ["contextID"] },
		results: {
			bindings: [
				{ contextID: { type: "uri", value: "http://example.org/g1" } },
			],
		},
	});

	const repo = createRepo();
	const result = await repo.contexts();
	expect(result).toEqual(["http://example.org/g1"]);
});

// ============================================
// Namespace Operations
// ============================================

test("namespaces returns prefix map", async () => {
	setMockFetch({
		head: { vars: ["prefix", "namespace"] },
		results: {
			bindings: [
				{
					prefix: { type: "literal", value: "ex" },
					namespace: { type: "uri", value: "http://example.org/" },
				},
			],
		},
	});

	const repo = createRepo();
	const result = await repo.namespaces();
	expect(result).toEqual({ ex: "http://example.org/" });
});

test("setNamespace sends PUT", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.setNamespace("ex", "http://example.org/");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");
	expect(options.body).toBe("http://example.org/");
});

test("deleteNamespace sends DELETE", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.deleteNamespace("ex");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("DELETE");
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("/namespaces/ex");
});

test("clearNamespaces sends DELETE to namespaces endpoint", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.clearNamespaces();

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("DELETE");
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("/namespaces");
});

// ============================================
// Update Operations
// ============================================

test("update sends SPARQL UPDATE", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const repo = createRepo();
	await repo.update("INSERT DATA { <http://s> <http://p> <http://o> }");

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.SPARQL_UPDATE,
	);
});

test("export returns RDF string", async () => {
	const turtle = "@prefix ex: <http://example.org/> .\nex:s ex:p ex:o .";
	setMockFetch(turtle, "text/turtle");

	const repo = createRepo();
	const result = await repo.export();
	expect(result).toBe(turtle);
});
