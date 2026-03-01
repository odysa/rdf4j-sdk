import { afterEach, beforeEach, expect, type Mock, mock, test } from "bun:test";
import { HttpClient } from "./http-client.ts";
import { IRI, Literal, Triple } from "./model.ts";
import { NamedGraphClient } from "./named-graph-client.ts";
import { ContentTypes } from "./types.ts";

let mockFetchFn: Mock<
	(url: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
const originalFetch = globalThis.fetch;

beforeEach(() => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("", {
				status: 200,
				headers: { "content-type": "application/n-quads" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function createClient(): NamedGraphClient {
	const http = new HttpClient({ baseUrl: "http://localhost:8080/rdf4j" });
	return new NamedGraphClient(http, "test-repo", "http://example.org/graph1");
}

test("NamedGraphClient.iri returns correct IRI", () => {
	const client = createClient();
	expect(client.iri).toBeInstanceOf(IRI);
	expect(client.iri.value).toBe("http://example.org/graph1");
});

test("NamedGraphClient.get fetches graph statements", async () => {
	const nquads = '<http://s> <http://p> "value" <http://example.org/graph1> .';
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response(nquads, {
				status: 200,
				headers: { "content-type": "application/n-quads" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = createClient();
	const result = await client.get();

	expect(result).toBe(nquads);
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("/repositories/test-repo/statements");
	expect(calledUrl).toContain("context=");
});

test("NamedGraphClient.get with custom accept format", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(
			new Response("<http://s> <http://p> <http://o> .", {
				status: 200,
				headers: { "content-type": "text/turtle" },
			}),
		),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = createClient();
	await client.get(ContentTypes.TURTLE);

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	const headers = options.headers as Record<string, string>;
	expect(headers.Accept).toBe(ContentTypes.TURTLE);
});

test("NamedGraphClient.add sends serialized statements", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = createClient();
	const statements = [
		new Triple(
			new IRI("http://example.org/alice"),
			new IRI("http://xmlns.com/foaf/0.1/name"),
			new Literal("Alice"),
		),
	];

	await client.add(statements);

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("POST");
	expect(options.body).toContain("http://example.org/alice");
	expect(options.body).toContain("Alice");
	expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
		ContentTypes.NQUADS,
	);
});

test("NamedGraphClient.clear deletes graph statements", async () => {
	mockFetchFn = mock(() =>
		Promise.resolve(new Response(null, { status: 204 })),
	);
	globalThis.fetch = mockFetchFn as unknown as typeof fetch;

	const client = createClient();
	await client.clear();

	const options = mockFetchFn.mock.calls[0]?.[1] as RequestInit;
	expect(options.method).toBe("DELETE");
	const calledUrl = mockFetchFn.mock.calls[0]?.[0] as string;
	expect(calledUrl).toContain("/repositories/test-repo/statements");
	expect(calledUrl).toContain("context=");
});
