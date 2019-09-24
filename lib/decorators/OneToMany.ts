import { PropertyOptions } from './Property';
import { EntityName, EntityProperty, IEntity, IEntityType } from './Entity';
import { MetadataStorage } from '../metadata';
import { Utils } from '../utils';
import { Cascade, ReferenceType } from '../entity';
import { QueryOrder } from '../query';
import { OneToOneOptions } from './OneToOne';

export function OneToMany<T extends IEntityType<T>>(
  entity: OneToManyOptions<T> | string | ((e?: any) => EntityName<T>),
  mappedBy?: (string & keyof T) | ((e: T) => any),
  options: Partial<OneToManyOptions<T>> = {},
) {
  return createOneToDecorator(entity, mappedBy, options, ReferenceType.ONE_TO_MANY);
}

export function createOneToDecorator<T extends IEntityType<T>>(
  entity?: OneToManyOptions<T> | string | ((e?: any) => EntityName<T>),
  mappedBy?: (string & keyof T) | ((e: T) => any),
  options?: Partial<OneToManyOptions<T>>,
  reference?: ReferenceType,
) {
  return function (target: IEntity, propertyName: string) {
    options = Utils.isObject<OneToManyOptions<T>>(entity) ? entity : { ...options, entity, mappedBy };
    const meta = MetadataStorage.getMetadata(target.constructor.name);
    Utils.lookupPathFromDecorator(meta);

    if (reference === ReferenceType.ONE_TO_MANY) {
      if (!options.entity) {
        throw new Error(`'@OneToMany({ entity: string | Function })' is required in '${target.constructor.name}.${propertyName}'`);
      }

      if ((options as any).fk) {
        throw new Error(`@OneToMany({ fk })' is deprecated, use 'mappedBy' instead in '${target.constructor.name}.${propertyName}'`);
      }
    }

    const prop = {
      name: propertyName,
      reference,
      cascade: [Cascade.PERSIST, Cascade.MERGE],
    } as EntityProperty<T>;
    Object.assign(prop, options);

    if (reference === ReferenceType.ONE_TO_ONE) {
      Utils.defaultValue(prop, 'nullable', !prop.cascade.includes(Cascade.REMOVE) && !prop.cascade.includes(Cascade.ALL));
      prop.owner = prop.owner || !!prop.inversedBy || !prop.mappedBy;
      prop.unique = prop.owner;
    }

    meta.properties[propertyName] = prop;
  };
}

export type OneToManyOptions<T extends IEntityType<T>> = PropertyOptions & {
  entity: string | (() => EntityName<T>);
  cascade?: Cascade[];
  orphanRemoval?: boolean;
  orderBy?: { [field: string]: QueryOrder };
  joinColumn?: string;
  inverseJoinColumn?: string;
  referenceColumnName?: string;
  mappedBy?: (string & keyof T) | ((e: T) => any);
};
