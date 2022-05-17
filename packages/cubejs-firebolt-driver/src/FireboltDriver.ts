import {
  BaseDriver,
  DriverInterface,
  StreamTableData,
  DownloadTableCSVData,
} from '@cubejs-backend/query-orchestrator';
import {
  Firebolt,
  ConnectionOptions,
  Connection,
  OutputFormat,
} from 'firebolt-sdk';
import { FireboltQuery } from './FireboltQuery';

export type FireboltDriverConfiguration = {
  readOnly?: boolean;
};

const FireboltTypeToGeneric: Record<string, string> = {
  long: 'bigint'
};

const COMPLEX_TYPE = /(nullable|array)\((.+)\)/;

export class FireboltDriver extends BaseDriver implements DriverInterface {
  private readonly connectionParams: ConnectionOptions;

  private readonly config: FireboltDriverConfiguration;

  private readonly firebolt;

  protected connection: Promise<Connection> | null = null;

  public constructor(config: Partial<FireboltDriverConfiguration> = {}) {
    super(config);

    this.config = {
      readOnly: true,
      ...config
    };

    this.connectionParams = {
      username: <string>process.env.CUBEJS_DB_USER,
      password: <string>process.env.CUBEJS_DB_PASS,
      database: <string>process.env.CUBEJS_DB_NAME,
      engineEndpoint: <string>process.env.CUBEJS_FIREBOLT_ENGINE_ENDPOINT,
    };

    const apiEndpoint = process.env.CUBEJS_FIREBOLT_API_ENDPOINT;

    this.firebolt = Firebolt({
      apiEndpoint,
    });
  }

  public quoteIdentifier(identifier: string): string {
    return `"${identifier}"`;
  }

  protected async initConnection() {
    try {
      const connection = await this.firebolt.connect(this.connectionParams);
      return connection;
    } catch (e) {
      this.connection = null;
      throw e;
    }
  }

  public createTableSql(
    quotedTableName: string,
    columns: { name: string; type: string }[]
  ) {
    const cols = columns
      .map(
        (c) => `${this.quoteIdentifier(c.name)} ${this.fromGenericType(c.type)}`
      )
      .join(', ');

    return `CREATE DIMENSION TABLE ${quotedTableName} (${cols})`;
  }

  public dropTable(tableName: string) {
    if (tableName.match(/\./)) {
      const [_, name] = tableName.split('.');
      tableName = name;
    }
    return this.query(`DROP TABLE ${tableName}`, []);
  }

  protected async getConnection(): Promise<Connection> {
    if (this.connection) {
      const connection = await this.connection;
      return connection;
    }

    this.connection = this.initConnection();
    return this.connection;
  }

  public static dialectClass() {
    return FireboltQuery;
  }

  public async createSchemaIfNotExists(_schemaName: string): Promise<any> {
    // no-op
  }

  public async testConnection(): Promise<void> {
    try {
      await this.query('select 1');
    } catch (error) {
      throw new Error('Unable to connect');
    }
  }

  public async query<R = Record<string, unknown>>(
    query: string,
    parameters?: unknown[]
  ): Promise<R[]> {
    const result = await this.queryResponse(query, parameters);
    return result.data as R[];
  }

  public async stream(
    query: string,
    parameters: unknown[]
  ): Promise<StreamTableData> {
    const connection = await this.getConnection();

    const statement = await connection.execute(query, {
      settings: { output_format: OutputFormat.JSON },
      parameters,
    });

    const { data: rowStream, meta: metaPromise } = await statement.streamResult();
    const meta = await metaPromise;
    const types = meta.map(({ type, name }) => ({ name, type: this.toGenericType(type) }));

    return {
      rowStream,
      types,
    };
  }

  public async unload(): Promise<DownloadTableCSVData> {
    throw new Error('Unload is not supported');
  }

  private async queryResponse(query: string, parameters?: unknown[]) {
    const connection = await this.getConnection();

    const statement = await connection.execute(query, {
      settings: { output_format: OutputFormat.JSON },
      parameters,
    });
    const response = await statement.fetchResult();
    return response;
  }

  /* eslint-disable camelcase */
  public async getTablesQuery(): Promise<
    { table_name?: string; TABLE_NAME?: string }[]
    > {
    const data = await this.query<{ table_name: string }>('SHOW TABLES', []);
    return data.map(({ table_name }) => ({ table_name }));
  }
  /* eslint-enable camelcase */

  public async downloadQueryResults<R = Record<string, unknown>>(
    query: string,
    values: unknown[]
  ) {
    const response = await this.queryResponse(query, values);
    const { data, meta } = response;
    const rows = data as R[];
    const types = meta.map(({ type, name }) => ({ name, type: this.toGenericType(type) }));
    return {
      rows,
      types,
    };
  }

  /* eslint-disable camelcase */
  public async tableColumnTypes(table: string) {
    const response = await this.query<{ column_name: string; data_type: string }>(`DESCRIBE ${table}`, []);
    return response.map((row) => ({ name: row.column_name, type: this.toGenericType(row.data_type) }));
  }
  /* eslint-enable camelcase */

  public toGenericType(columnType: string) {
    if (columnType in FireboltTypeToGeneric) {
      return FireboltTypeToGeneric[columnType];
    }

    const match = columnType.match(COMPLEX_TYPE);
    if (match) {
      const [_, outerType, innerType] = match;
      if (columnType in FireboltTypeToGeneric) {
        return FireboltTypeToGeneric[columnType];
      }
    }
    return super.toGenericType(columnType);
  }

  public readOnly() {
    return !!this.config.readOnly;
  }

  public async isUnloadSupported() {
    return false;
  }

  public async release() {
    if (this.connection) {
      const connection = await this.connection;
      connection.destroy();
      this.connection = null;
    }
  }
}
