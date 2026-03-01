import { TransactionStateError } from "./errors.js";
import { normalizeContext, serializeStatements } from "./helpers.js";
import type { HttpClient } from "./http-client.js";
import type { Quad, Triple } from "./model.js";
import type {
	QueryOptions,
	SparqlBindings,
	StatementOptions,
} from "./repository-client.js";
import { ContentTypes, type TransactionState } from "./types.js";

/** Client for transaction operations */
export class TransactionClient {
	private state: TransactionState = "ACTIVE";

	private readonly basePath: string;

	constructor(
		private readonly http: HttpClient,
		repositoryId: string,
		private readonly transactionId: string,
	) {
		this.basePath = `/repositories/${repositoryId}/transactions/${transactionId}`;
	}

	/** Get the transaction ID */
	get id(): string {
		return this.transactionId;
	}

	/** Check if transaction is still active */
	get isActive(): boolean {
		return this.state === "ACTIVE";
	}

	/** Get the current transaction state */
	get currentState(): TransactionState {
		return this.state;
	}

	/** Execute a SPARQL query within the transaction */
	async query(sparql: string, options?: QueryOptions): Promise<SparqlBindings> {
		this.ensureActive();
		return this.http.post<SparqlBindings>(this.basePath, {
			body: sparql,
			contentType: ContentTypes.SPARQL_QUERY,
			params: {
				action: "QUERY",
				infer: options?.infer,
			},
			accept: ContentTypes.SPARQL_RESULTS_JSON,
			timeout: options?.timeout,
		});
	}

	/** Execute a SPARQL update within the transaction */
	async update(sparql: string, options?: { timeout?: number }): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			body: sparql,
			contentType: ContentTypes.SPARQL_UPDATE,
			params: { action: "UPDATE" },
			timeout: options?.timeout,
		});
	}

	/** Add RDF statements within the transaction (raw string) */
	async add(
		data: string,
		options: {
			contentType: string;
			context?: string;
			baseURI?: string;
		},
	): Promise<void> {
		this.ensureActive();
		await this.http.put<void>(this.basePath, {
			body: data,
			contentType: options.contentType,
			params: {
				action: "ADD",
				context: options.context,
				baseURI: options.baseURI,
			},
		});
	}

	/** Add typed Triple/Quad statements within the transaction */
	async addStatements(statements: Iterable<Triple | Quad>): Promise<void> {
		return this.add(serializeStatements(statements), {
			contentType: ContentTypes.NQUADS,
		});
	}

	/** Delete statements within the transaction (by pattern) */
	async delete(options?: StatementOptions): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			params: {
				action: "DELETE",
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: normalizeContext(options?.context),
			},
		});
	}

	/** Delete typed Triple/Quad statements within the transaction */
	async deleteStatements(statements: Iterable<Triple | Quad>): Promise<void> {
		this.ensureActive();
		const data = serializeStatements(statements);
		await this.http.post<void>(this.basePath, {
			body: data,
			contentType: ContentTypes.NQUADS,
			params: { action: "DELETE" },
		});
	}

	/** Get statements within the transaction */
	async getStatements(
		options?: StatementOptions & { accept?: string },
	): Promise<string> {
		this.ensureActive();
		return this.http.post<string>(this.basePath, {
			params: {
				action: "GET",
				subj: options?.subj,
				pred: options?.pred,
				obj: options?.obj,
				context: normalizeContext(options?.context),
				infer: options?.infer,
			},
			accept: options?.accept ?? ContentTypes.TURTLE,
		});
	}

	/** Get size within the transaction */
	async size(context?: string): Promise<number> {
		this.ensureActive();
		const result = await this.http.post<string>(this.basePath, {
			params: {
				action: "SIZE",
				context,
			},
			accept: ContentTypes.TEXT,
		});
		return parseInt(result, 10);
	}

	/** Commit the transaction */
	async commit(): Promise<void> {
		this.ensureActive();
		await this.http.put<void>(this.basePath, {
			params: { action: "COMMIT" },
		});
		this.state = "COMMITTED";
	}

	/** Rollback the transaction */
	async rollback(): Promise<void> {
		this.ensureActive();
		await this.http.delete<void>(this.basePath);
		this.state = "ROLLED_BACK";
	}

	/** Ping to keep transaction alive */
	async ping(): Promise<void> {
		this.ensureActive();
		await this.http.post<void>(this.basePath, {
			params: { action: "PING" },
		});
	}

	private ensureActive(): void {
		if (this.state !== "ACTIVE") {
			throw new TransactionStateError("ACTIVE", this.state);
		}
	}
}
