import { afterEach, beforeEach, expect, type Mock, mock, test } from "bun:test";
import { TransactionStateError } from "./errors.ts";
import { HttpClient } from "./http-client.ts";
import { IRI, Literal, Quad, Triple } from "./model.ts";
import { TransactionClient } from "./transaction-client.ts";
import { ContentTypes } from "./types.ts";

let mockFetchFn: Mock<
	(url: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function createTxn(): TransactionClient {
	const http = new HttpClient({ baseUrl: "http://localhost:8080/rdf4j" });
	return new TransactionClient(http, "test-repo", "tx123");
}

// ============================================
// Basic Properties
// ============================================

test("TransactionClient has correct id", () => {
	const txn = createTxn();
	expect(txn.id).toBe("tx123");
});

test("TransactionClient starts in ACTIVE state", () => {
	const txn = createTxn();
	expect(txn.isActive).toBe(true);
	expect(txn.currentState).toBe("ACTIVE");
});

// ============================================
// Query Operations
// ============================================

test("query sends SPARQL query with action=QUERY", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(
				JSON.stringify({
					head: { vars: ["s"] },
					results: { bindings: [] },
				}),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const txn = createTxn();
	const result = await txn.query("SELECT ?s WHERE { ?s ?p ?o }");

	expect(result.head.vars).toEqual(["s"]);
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=QUERY");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.SPARQL_QUERY,
	);
});

// ============================================
// Update Operations
// ============================================

test("update sends SPARQL update with action=UPDATE", async () => {
	const txn = createTxn();
	await txn.update("INSERT DATA { <http://s> <http://p> <http://o> }");

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=UPDATE");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.SPARQL_UPDATE,
	);
});

// ============================================
// Add Operations
// ============================================

test("add sends raw data with action=ADD", async () => {
	const txn = createTxn();
	await txn.add("<http://s> <http://p> <http://o> .", {
		contentType: ContentTypes.NTRIPLES,
	});

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=ADD");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NTRIPLES,
	);
});

test("addStatements sends typed statements with action=ADD", async () => {
	const txn = createTxn();
	const statements = [
		new Triple(
			new IRI("http://example.org/alice"),
			new IRI("http://xmlns.com/foaf/0.1/name"),
			new Literal("Alice"),
		),
	];

	await txn.addStatements(statements);

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=ADD");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NQUADS,
	);
	expect(options.body).toContain("http://example.org/alice");
	expect(options.body).toContain("Alice");
});

test("addStatements sends Quads", async () => {
	const txn = createTxn();
	const statements = [
		new Quad(
			new IRI("http://example.org/s"),
			new IRI("http://example.org/p"),
			new Literal("value"),
			new IRI("http://example.org/graph"),
		),
	];

	await txn.addStatements(statements);

	const body = (mockFetchFn.mock.calls[0]?.[1] as RequestInit).body as string;
	expect(body).toContain("http://example.org/graph");
});

// ============================================
// Delete Operations
// ============================================

test("delete sends pattern filter with action=DELETE", async () => {
	const txn = createTxn();
	await txn.delete({
		subj: "<http://example.org/s>",
		pred: "<http://example.org/p>",
	});

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=DELETE");
	expect(calledUrl).toContain("subj=");
	expect(calledUrl).toContain("pred=");
});

test("deleteStatements sends typed statements with action=DELETE", async () => {
	const txn = createTxn();
	const statements = [
		new Triple(
			new IRI("http://example.org/s"),
			new IRI("http://example.org/p"),
			new Literal("old-value"),
		),
	];

	await txn.deleteStatements(statements);

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=DELETE");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NQUADS,
	);
	expect(options.body).toContain("old-value");
});

// ============================================
// Get Statements
// ============================================

test("getStatements sends action=GET", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("<http://s> <http://p> <http://o> .", {
				status: 200,
				headers: { "content-type": "text/turtle" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const txn = createTxn();
	const result = await txn.getStatements();

	expect(result).toContain("http://s");
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=GET");
});

// ============================================
// Size
// ============================================

test("size returns statement count", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("42", {
				status: 200,
				headers: { "content-type": "text/plain" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const txn = createTxn();
	const result = await txn.size();

	expect(result).toBe(42);
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=SIZE");
});

// ============================================
// Commit and Rollback
// ============================================

test("commit sends PUT with action=COMMIT", async () => {
	const txn = createTxn();
	await txn.commit();

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=COMMIT");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("PUT");
});

test("commit transitions to COMMITTED state", async () => {
	const txn = createTxn();
	await txn.commit();

	expect(txn.isActive).toBe(false);
	expect(txn.currentState).toBe("COMMITTED");
});

test("rollback sends DELETE", async () => {
	const txn = createTxn();
	await txn.rollback();

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("DELETE");
});

test("rollback transitions to ROLLED_BACK state", async () => {
	const txn = createTxn();
	await txn.rollback();

	expect(txn.isActive).toBe(false);
	expect(txn.currentState).toBe("ROLLED_BACK");
});

// ============================================
// Ping
// ============================================

test("ping sends POST with action=PING", async () => {
	const txn = createTxn();
	await txn.ping();

	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("action=PING");
	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
});

// ============================================
// State Machine Tests
// ============================================

test("operations throw TransactionStateError after commit", async () => {
	const txn = createTxn();
	await txn.commit();

	await expect(txn.query("SELECT * WHERE { ?s ?p ?o }")).rejects.toThrow(
		TransactionStateError,
	);
	await expect(txn.update("INSERT DATA { <s> <p> <o> }")).rejects.toThrow(
		TransactionStateError,
	);
	await expect(txn.add("data", { contentType: "text/turtle" })).rejects.toThrow(
		TransactionStateError,
	);
	await expect(txn.addStatements([])).rejects.toThrow(TransactionStateError);
	await expect(txn.delete()).rejects.toThrow(TransactionStateError);
	await expect(txn.deleteStatements([])).rejects.toThrow(TransactionStateError);
	await expect(txn.getStatements()).rejects.toThrow(TransactionStateError);
	await expect(txn.size()).rejects.toThrow(TransactionStateError);
	await expect(txn.commit()).rejects.toThrow(TransactionStateError);
	await expect(txn.rollback()).rejects.toThrow(TransactionStateError);
	await expect(txn.ping()).rejects.toThrow(TransactionStateError);
});

test("operations throw TransactionStateError after rollback", async () => {
	const txn = createTxn();
	await txn.rollback();

	await expect(txn.query("SELECT * WHERE { ?s ?p ?o }")).rejects.toThrow(
		TransactionStateError,
	);
	await expect(txn.commit()).rejects.toThrow(TransactionStateError);
});

test("TransactionStateError has correct message", async () => {
	const txn = createTxn();
	await txn.commit();

	try {
		await txn.query("SELECT * WHERE { ?s ?p ?o }");
		expect(true).toBe(false); // should not reach
	} catch (e) {
		expect(e).toBeInstanceOf(TransactionStateError);
		const err = e as TransactionStateError;
		expect(err.message).toBe(
			"Invalid transaction state: expected 'ACTIVE', got 'COMMITTED'",
		);
	}
});

test("cannot double commit", async () => {
	const txn = createTxn();
	await txn.commit();
	await expect(txn.commit()).rejects.toThrow(TransactionStateError);
});

test("cannot double rollback", async () => {
	const txn = createTxn();
	await txn.rollback();
	await expect(txn.rollback()).rejects.toThrow(TransactionStateError);
});

test("cannot rollback after commit", async () => {
	const txn = createTxn();
	await txn.commit();
	await expect(txn.rollback()).rejects.toThrow(TransactionStateError);
});

test("cannot commit after rollback", async () => {
	const txn = createTxn();
	await txn.rollback();
	await expect(txn.commit()).rejects.toThrow(TransactionStateError);
});
