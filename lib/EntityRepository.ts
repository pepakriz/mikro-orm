import { DeleteWriteOpResultObject, FilterQuery, InsertOneWriteOpResult, UpdateWriteOpResult } from 'mongodb';
import { EntityManager } from './EntityManager';
import { BaseEntity } from './BaseEntity';
import { RequestContext } from './RequestContext';

export class EntityRepository<T extends BaseEntity> {

  constructor(private _em: EntityManager,
              protected entityName: string) { }

  async persist(entity: T, flush = true): Promise<void> {
    return this.em.persist(entity, flush);
  }

  async findOne(where: FilterQuery<T> | string, populate: string[] = []): Promise<T> {
    return this.em.findOne<T>(this.entityName, where, populate);
  }

  async find(where: FilterQuery<T>, populate: string[] = [], orderBy: { [k: string]: 1 | -1 } = {}, limit: number = null, offset: number = null): Promise<T[]> {
    return this.em.find<T>(this.entityName, where, populate, orderBy, limit, offset);
  }

  async findAll(populate: string[] = [], orderBy: { [k: string]: 1 | -1 } = {}, limit: number = null, offset: number = null): Promise<T[]> {
    return this.em.find<T>(this.entityName, {}, populate, orderBy, limit, offset);
  }

  async remove(where: T | any): Promise<number> {
    return this.em.remove(this.entityName, where);
  }

  async flush(): Promise<void> {
    return this.em.flush();
  }

  async nativeInsert(data: any): Promise<InsertOneWriteOpResult> {
    return this.em.nativeInsert(this.entityName, data)
  }

  async nativeUpdate(where: FilterQuery<T>, data: any): Promise<UpdateWriteOpResult> {
    return this.em.nativeUpdate(this.entityName, where, data)
  }

  async nativeDelete(where: FilterQuery<T> | any): Promise<DeleteWriteOpResultObject> {
    return this.em.nativeDelete(this.entityName, where)
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return this.em.aggregate(this.entityName, pipeline)
  }

  /**
   * Gets a reference to the entity identified by the given type and identifier without actually loading it, if the entity is not yet loaded
   */
  getReference<T extends BaseEntity>(id: string): T {
    return this.em.getReference(this.entityName, id);
  }

  canPopulate(property: string): boolean {
    return this.em.canPopulate(this.entityName, property);
  }

  /**
   * Creates new instance of given entity and populates it with given data
   */
  create(data: any): T {
    return this.em.create<T>(this.entityName, data);
  }

  async count(where: any = {}): Promise<number> {
    return this.em.count(this.entityName, where);
  }

  protected get em(): EntityManager {
    return RequestContext.getEntityManager() || this._em;
  }

}
