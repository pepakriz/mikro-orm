import fastEqual from 'fast-deep-equal';
import clone from 'clone';
import globby, { GlobbyOptions } from 'globby';
import { isAbsolute, normalize, relative } from 'path';
import { pathExists } from 'fs-extra';
import { createHash } from 'crypto';

import { MetadataStorage } from '../metadata';
import { EntityData, EntityMetadata, EntityProperty, IEntity, IEntityType, IPrimaryKey } from '../decorators';
import { ArrayCollection, Collection, Reference, ReferenceType } from '../entity';

export class Utils {

  static isDefined(data: any): data is object {
    return typeof data !== 'undefined';
  }

  static isObject<T = Record<string, any>>(o: any): o is T {
    return !!o && typeof o === 'object' && !Array.isArray(o);
  }

  static isString(s: any): s is string {
    return typeof s === 'string';
  }

  static isNumber<T = number>(s: any): s is T {
    return typeof s === 'number';
  }

  static equals(a: any, b: any): boolean {
    return fastEqual(a, b);
  }

  static unique<T = string>(items: T[]): T[] {
    return [...new Set(items)];
  }

  static merge(target: any, ...sources: any[]): any {
    if (!sources.length) {
      return target;
    }

    const source = sources.shift();

    if (Utils.isObject(target) && Utils.isObject(source)) {
      Object.entries(source).forEach(([key, value]) => {
        if (Utils.isObject(value)) {
          if (!(key in target)) {
            Object.assign(target, { [key]: {} });
          }

          Utils.merge(target[key], value);
        } else {
          Object.assign(target, { [key]: value });
        }
      });
    }

    return Utils.merge(target, ...sources);
  }

  static diff(a: Record<string, any>, b: Record<string, any>): Record<keyof (typeof a & typeof b), any> {
    const ret: Record<string, any> = {};

    Object.keys(b).forEach(k => {
      if (Utils.equals(a[k], b[k])) {
        return;
      }

      ret[k] = b[k];
    });

    return ret;
  }

  static diffEntities<T extends IEntityType<T>>(a: T, b: T, metadata: MetadataStorage): EntityData<T> {
    return Utils.diff(Utils.prepareEntity(a, metadata), Utils.prepareEntity(b, metadata)) as EntityData<T>;
  }

  static prepareEntity<T extends IEntityType<T>>(entity: T, metadata: MetadataStorage): EntityData<T> {
    const meta = metadata.get<T>(entity.constructor.name);
    const ret = Utils.copy(entity);
    delete ret.__initialized;

    // remove collections and references
    Object.values(meta.properties).forEach(prop => {
      const pk = () => metadata.get(prop.type).primaryKey;
      const name = prop.name as keyof T;

      if (entity[name] as object instanceof ArrayCollection || (Utils.isEntity(entity[name]) && !entity[name][pk()])) {
        return delete ret[name];
      }

      if (Utils.isEntity(entity[name]) || entity[name] as object instanceof Reference) {
        return ret[prop.name] = entity[prop.name][pk()];
      }
    });

    // remove unknown properties
    Object.keys(entity).forEach(prop => {
      const property = meta.properties[prop as keyof T & string];

      if (!property || property.persist === false || (property.primary && !ret[prop])) {
        delete ret[prop];
      }
    });

    return ret;
  }

  static copy<T>(entity: T): T {
    return clone(entity);
  }

  static asArray<T>(data?: T | T[]): T[] {
    if (typeof data === 'undefined') {
      return [];
    }

    return Array.isArray(data!) ? data : [data!];
  }

  static renameKey<T>(payload: T, from: string | keyof T, to: string): void {
    if (Utils.isObject(payload) && from in payload && !(to in payload)) {
      payload[to] = payload[from as keyof T];
      delete payload[from as keyof T];
    }
  }

  static getParamNames(func: Function | string): string[] {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    const ARGUMENT_NAMES = /([^\s,]+)/g;
    const fnStr = func.toString().replace(STRIP_COMMENTS, ''); // strip comments
    let paramsStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')); // extract params
    paramsStr = paramsStr.replace(/{[^}]+}/g, '{}'); // simplify object default values like `a = { ... }`
    paramsStr = paramsStr.replace(/\[[^\]]+]/g, '[]'); // simplify array default values like `a = [ ... ]`
    const result = paramsStr.match(ARGUMENT_NAMES) as string[];

    if (result === null) {
      return [];
    }

    // handle class with no constructor
    if (result.length > 0 && result[0] === 'class') {
      return [];
    }

    // strip default values
    for (let i = 0; i < result.length; i++) {
      if (result[i].includes('=')) {
        result[i] = result[i].split('=')[0];
        result.splice(i + 1, 1);
      }
    }

    return result.filter(i => i); // filter out empty strings
  }

  static isPrimaryKey(key: any): key is IPrimaryKey {
    return Utils.isString(key) || typeof key === 'number' || Utils.isObjectID(key);
  }

  static extractPK(data: any, meta?: EntityMetadata): IPrimaryKey | null {
    if (Utils.isPrimaryKey(data)) {
      return data;
    }

    if (Utils.isObject(data) && meta) {
      return data[meta.primaryKey] || data[meta.serializedPrimaryKey] || null;
    }

    return null;
  }

  static isEntity<T = IEntity>(data: any): data is T {
    return Utils.isObject(data) && !!data.__entity;
  }

  static isObjectID(key: any) {
    return Utils.isObject(key) && key.constructor.name.toLowerCase() === 'objectid';
  }

  static isEmpty(data: any): boolean {
    if (Array.isArray(data)) {
      return data.length === 0;
    }

    if (Utils.isObject(data)) {
      return Object.keys(data).length === 0;
    }

    return !data;
  }

  static className(classOrName: string | Function): string {
    if (Utils.isString(classOrName)) {
      return classOrName;
    }

    return classOrName.name;
  }

  /**
   * uses some dark magic to get source path to caller where decorator is used
   */
  static lookupPathFromDecorator(meta: EntityMetadata, stack?: string[]): string {
    if (meta.path) {
      return meta.path;
    }

    // use some dark magic to get source path to caller
    stack = stack || new Error().stack!.split('\n');
    let line = stack.findIndex(line => line.includes('__decorate'))!;

    if (line === -1) {
      return meta.path;
    }

    if (stack[line].includes('node_modules/tslib/tslib')) {
      line++;
    }

    meta.path = Utils.normalizePath(stack[line].match(/\((.*):\d+:\d+\)/)![1]);

    return meta.path;
  }

  static getObjectType(value: any): string {
    const objectType = Object.prototype.toString.call(value);
    return objectType.match(/\[object (\w+)]/)![1].toLowerCase();
  }

  static wrapReference<T extends IEntityType<T>>(entity: T, prop: EntityProperty<T>): Reference<T> | T {
    if (prop.wrappedReference) {
      return Reference.create(entity);
    }

    return entity;
  }

  static async runSerial<T = any, U = any>(items: Iterable<U>, cb: (item: U) => Promise<T>): Promise<T[]> {
    const ret = [];

    for (const item of items) {
      ret.push(await cb(item));
    }

    return ret;
  }

  static isCollection(item: any, prop?: EntityProperty, type?: ReferenceType): item is Collection<IEntity> {
    if (!(item instanceof Collection)) {
      return false;
    }

    return !(prop && type) || prop.reference === type;
  }

  static normalizePath(...parts: string[]): string {
    let path = parts.join('/').replace(/\\/g, '/').replace(/\/$/, '');
    path = normalize(path).replace(/\\/g, '/');

    return path.match(/^[/.]|[a-zA-Z]:/) ? path : './' + path;
  }

  static relativePath(path: string, relativeTo: string): string {
    if (!path) {
      return path;
    }

    path = Utils.normalizePath(path);

    if (path.startsWith('.')) {
      return path;
    }

    path = relative(relativeTo, path);

    return Utils.normalizePath(path);
  }

  static absolutePath(path: string, baseDir = process.cwd()): string {
    if (!path) {
      return Utils.normalizePath(baseDir);
    }

    if (!isAbsolute(path)) {
      path = baseDir + '/' + path;
    }

    return Utils.normalizePath(path);
  }

  static hash(data: string): string {
    return createHash('md5').update(data).digest('hex');
  }

  static runIfNotEmpty(clause: () => any, data: any): void {
    if (!Utils.isEmpty(data)) {
      clause();
    }
  }

  static defaultValue(prop: Record<string, any>, option: string, defaultValue: any): void {
    prop[option] = option in prop ? prop[option] : defaultValue;
  }

  static findDuplicates<T>(items: T[]): T[] {
    return items.reduce((acc, v, i, arr) => {
      return arr.indexOf(v) !== i && acc.indexOf(v) === -1 ? acc.concat(v) : acc;
    }, [] as T[]);
  }

  static randomInt(min: number, max: number): number {
    return Math.round(Math.random() * (max - min)) + min;
  }

  static async pathExists(path: string, options: GlobbyOptions = {}): Promise<boolean> {
    if (globby.hasMagic(path)) {
      const found = await globby(path, options);
      return found.length > 0;
    }

    return pathExists(path);
  }

}
