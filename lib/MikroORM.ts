import chalk from 'chalk';

import { EntityManager } from './EntityManager';
import { AbstractSqlDriver, IDatabaseDriver } from './drivers';
import { MetadataDiscovery, MetadataStorage } from './metadata';
import { Configuration, Logger, Options } from './utils';
import { SchemaGenerator } from './schema';
import { EntityGenerator } from './schema/EntityGenerator';

export class MikroORM<D extends IDatabaseDriver = IDatabaseDriver> {

  em: EntityManager<D>;
  readonly config: Configuration<D>;
  private metadata: MetadataStorage;
  private readonly driver: D;
  private readonly logger: Logger;

  static async init<D extends IDatabaseDriver = IDatabaseDriver>(options: Options<D> | Configuration<D>): Promise<MikroORM<D>> {
    const orm = new MikroORM<D>(options);
    const driver = await orm.connect();

    try {
      const discovery = new MetadataDiscovery(MetadataStorage.init(), orm.driver.getPlatform(), orm.config, orm.logger);
      orm.metadata = await discovery.discover();
      orm.em = new EntityManager(orm.config, driver, orm.metadata);
      orm.metadata.decorate(orm.em);
      driver.setMetadata(orm.metadata);

      return orm;
    } catch (e) {
      await orm.close(true);
      throw e;
    }
  }

  constructor(options: Options<D> | Configuration<D>) {
    if (options instanceof Configuration) {
      this.config = options;
    } else {
      this.config = new Configuration(options);
    }

    this.driver = this.config.getDriver();
    this.logger = this.config.getLogger();
  }

  async connect(): Promise<D> {
    const connection = await this.driver.connect();
    const clientUrl = connection.getClientUrl();
    const dbName = this.config.get('dbName');
    this.logger.log('info', `MikroORM successfully connected to database ${chalk.green(dbName)}${clientUrl ? ' on ' + chalk.green(clientUrl) : ''}`);

    return this.driver;
  }

  async isConnected(): Promise<boolean> {
    return this.driver.getConnection().isConnected();
  }

  async close(force = false): Promise<void> {
    return this.driver.close(force);
  }

  getMetadata(): MetadataStorage {
    return this.metadata;
  }

  getSchemaGenerator(): SchemaGenerator {
    return new SchemaGenerator(this.driver as any as AbstractSqlDriver, this.metadata);
  }

  getEntityGenerator(): EntityGenerator {
    return new EntityGenerator(this.driver as any as AbstractSqlDriver, this.config);
  }

}
