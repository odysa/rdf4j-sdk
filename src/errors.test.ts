import { expect, test } from "bun:test";
import {
	NamespaceError,
	NetworkError,
	QueryError,
	Rdf4jError,
	RepositoryCreationError,
	RepositoryDeletionError,
	RepositoryError,
	RepositoryInternalError,
	RepositoryNotFoundError,
	RepositoryUpdateError,
	TransactionError,
	TransactionStateError,
} from "./errors.ts";

test("Rdf4jError is the root error class", () => {
	const err = new Rdf4jError("test error");
	expect(err).toBeInstanceOf(Error);
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.message).toBe("test error");
	expect(err.name).toBe("Rdf4jError");
});

test("RepositoryError extends Rdf4jError with repositoryId", () => {
	const err = new RepositoryError("repo error", "my-repo");
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.repositoryId).toBe("my-repo");
	expect(err.name).toBe("RepositoryError");
});

test("RepositoryCreationError includes repository ID and cause", () => {
	const err = new RepositoryCreationError("my-repo", "already exists");
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.message).toBe(
		"Failed to create repository 'my-repo': already exists",
	);
	expect(err.repositoryId).toBe("my-repo");
});

test("RepositoryCreationError works without cause", () => {
	const err = new RepositoryCreationError("my-repo");
	expect(err.message).toBe("Failed to create repository 'my-repo'");
});

test("RepositoryDeletionError formats message correctly", () => {
	const err = new RepositoryDeletionError("test-repo", "in use");
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.message).toBe("Failed to delete repository 'test-repo': in use");
	expect(err.name).toBe("RepositoryDeletionError");
});

test("RepositoryNotFoundError formats message correctly", () => {
	const err = new RepositoryNotFoundError("missing-repo");
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.message).toBe("Repository 'missing-repo' not found");
	expect(err.repositoryId).toBe("missing-repo");
});

test("RepositoryInternalError formats message correctly", () => {
	const err = new RepositoryInternalError("broken-repo", "disk full");
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.message).toBe(
		"Internal error in repository 'broken-repo': disk full",
	);
});

test("RepositoryUpdateError formats message correctly", () => {
	const err = new RepositoryUpdateError("my-repo", "conflict");
	expect(err).toBeInstanceOf(RepositoryError);
	expect(err.message).toBe("Failed to update repository 'my-repo': conflict");
});

test("NamespaceError extends Rdf4jError", () => {
	const err = new NamespaceError("unknown prefix");
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.name).toBe("NamespaceError");
});

test("NetworkError extends Rdf4jError", () => {
	const err = new NetworkError("connection refused");
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.name).toBe("NetworkError");
});

test("QueryError extends Rdf4jError", () => {
	const err = new QueryError("malformed SPARQL");
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.name).toBe("QueryError");
});

test("TransactionError extends Rdf4jError", () => {
	const err = new TransactionError("timeout");
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.name).toBe("TransactionError");
});

test("TransactionStateError includes expected and actual state", () => {
	const err = new TransactionStateError("ACTIVE", "COMMITTED");
	expect(err).toBeInstanceOf(TransactionError);
	expect(err).toBeInstanceOf(Rdf4jError);
	expect(err.message).toBe(
		"Invalid transaction state: expected 'ACTIVE', got 'COMMITTED'",
	);
	expect(err.name).toBe("TransactionStateError");
});

test("Error hierarchy is catchable at different levels", () => {
	const err = new RepositoryNotFoundError("test");

	// Can catch as any level of the hierarchy
	try {
		throw err;
	} catch (e) {
		expect(e).toBeInstanceOf(Error);
		expect(e).toBeInstanceOf(Rdf4jError);
		expect(e).toBeInstanceOf(RepositoryError);
		expect(e).toBeInstanceOf(RepositoryNotFoundError);
	}
});
