/** Root error for all RDF4J operations */
export class Rdf4jError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

/** Base class for repository-related errors */
export class RepositoryError extends Rdf4jError {
	constructor(
		message: string,
		public readonly repositoryId?: string,
	) {
		super(message);
	}
}

/** Error creating a repository */
export class RepositoryCreationError extends RepositoryError {
	constructor(repositoryId: string, cause?: string) {
		super(
			`Failed to create repository '${repositoryId}'${cause ? `: ${cause}` : ""}`,
			repositoryId,
		);
	}
}

/** Error deleting a repository */
export class RepositoryDeletionError extends RepositoryError {
	constructor(repositoryId: string, cause?: string) {
		super(
			`Failed to delete repository '${repositoryId}'${cause ? `: ${cause}` : ""}`,
			repositoryId,
		);
	}
}

/** Repository not found */
export class RepositoryNotFoundError extends RepositoryError {
	constructor(repositoryId: string) {
		super(`Repository '${repositoryId}' not found`, repositoryId);
	}
}

/** Internal repository error */
export class RepositoryInternalError extends RepositoryError {
	constructor(repositoryId: string, cause?: string) {
		super(
			`Internal error in repository '${repositoryId}'${cause ? `: ${cause}` : ""}`,
			repositoryId,
		);
	}
}

/** Error updating a repository */
export class RepositoryUpdateError extends RepositoryError {
	constructor(repositoryId: string, cause?: string) {
		super(
			`Failed to update repository '${repositoryId}'${cause ? `: ${cause}` : ""}`,
			repositoryId,
		);
	}
}

/** Namespace operation error */
export class NamespaceError extends Rdf4jError {}

/** Network-level error */
export class NetworkError extends Rdf4jError {}

/** SPARQL query error */
export class QueryError extends Rdf4jError {}

/** Transaction error */
export class TransactionError extends Rdf4jError {}

/** Invalid transaction state transition */
export class TransactionStateError extends TransactionError {
	constructor(
		expected: import("./types.js").TransactionState,
		actual: import("./types.js").TransactionState,
	) {
		super(`Invalid transaction state: expected '${expected}', got '${actual}'`);
	}
}
