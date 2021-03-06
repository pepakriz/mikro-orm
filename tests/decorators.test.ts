import { ManyToMany, ManyToOne, OneToMany } from '../lib';
import { Test } from './entities';

describe('decorators', () => {

  test('ManyToMany', () => {
    expect(() => ManyToMany({} as any)(new Test(), 'test')).toThrowError(`@ManyToMany({ entity: string | Function })' is required in 'Test.test`);
  });

  test('ManyToOne', () => {
    expect(() => ManyToOne({} as any)(new Test(), 'test')).toThrowError(`@ManyToOne({ entity: string | Function })' is required in 'Test.test`);
  });

  test('OneToMany', () => {
    expect(() => OneToMany({} as any)(new Test(), 'test')).toThrowError(`@OneToMany({ entity: string | Function })' is required in 'Test.test`);
  });

});
