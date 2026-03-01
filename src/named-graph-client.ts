import { serializeStatements } from "./helpers.ts";
import type { HttpClient } from "./http-client.ts";
import { IRI, type Quad, type Triple } from "./model.ts";
import { ContentTypes } from "./types.ts";

/** Client for named graph operations */
export class NamedGraphClient {
	readonly iri: IRI;

	constructor(
		private readonly http: HttpClient,
		private readonly repositoryId: string,
		private readonly graphUri: string,
	) {
		this.iri = new IRI(graphUri);
	}

	private get basePath(): string {
		return `/repositories/${this.repositoryId}/statements`;
	}

	/** Get all statements in this named graph */
	async get(accept?: string): Promise<string> {
		return this.http.get<string>(this.basePath, {
			params: { context: `<${this.graphUri}>` },
			accept: accept ?? ContentTypes.NQUADS,
		});
	}

	/** Add statements to this named graph */
	async add(statements: Iterable<Triple | Quad>): Promise<void> {
		const data = serializeStatements(statements);
		await this.http.post<void>(this.basePath, {
			body: data,
			contentType: ContentTypes.NQUADS,
			params: { context: `<${this.graphUri}>` },
		});
	}

	/** Clear all statements in this named graph */
	async clear(): Promise<void> {
		await this.http.delete<void>(this.basePath, {
			params: { context: `<${this.graphUri}>` },
		});
	}
}
