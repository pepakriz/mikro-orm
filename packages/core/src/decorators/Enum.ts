import { MetadataStorage } from '../metadata';
import { ReferenceType } from '../entity';
import { PropertyOptions } from '.';
import { EntityProperty, AnyEntity, Dictionary } from '../typings';

export function Enum(options: EnumOptions | (() => Dictionary) = {}): Function {
  return function (target: AnyEntity, propertyName: string) {
    const meta = MetadataStorage.getMetadataFromDecorator(target.constructor);
    options = options instanceof Function ? { items: options } : options;
    meta.properties[propertyName] = Object.assign({ name: propertyName, reference: ReferenceType.SCALAR, enum: true }, options) as EntityProperty;
  };
}

export interface EnumOptions extends PropertyOptions {
  items?: (number | string)[] | (() => Dictionary);
}