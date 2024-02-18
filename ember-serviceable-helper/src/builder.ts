import type Owner from '@ember/owner';
import { getOwner } from '@ember/owner';
import type { Registry } from '@ember/service';

import type {
  AnyFunction,
  InjectableConstructor,
  InjectableFunction,
  Injected,
} from './types.ts';
import { constructorFor } from './injection.ts';
import type { GetInjections } from './injection.ts';
import { helperFor } from './manager.ts';

type WithOwner = { owner: Owner };

type InjectOwner<Injections> = Inject<Injections & WithOwner>;

type WithService<K extends keyof Registry> = { [P in K]: Registry[K] };

type InjectService<Injections, K extends keyof Registry> = Inject<
  Injections & WithService<K>
>;

type WithProperty<K extends keyof object, V> = { [P in K]: V };

type InjectProperty<Injections, K extends keyof object, V> = Inject<
  Injections & WithProperty<K, V>
>;

const UNINITIALIZED = Symbol('UNINITIALIZED');
type UNINITIALIZED = typeof UNINITIALIZED;

/**
 * A builder DSL to build the injections needed for a function
 */
export interface Inject<Injections> {
  /**
   * Inject the owner as `this.owner`
   */
  owner(): InjectOwner<Injections>;

  /**
   * Inject `service:${name}` as `this[name]`
   *
   * @param name name of the property and service
   */
  service<K extends keyof Registry>(name: K): InjectService<Injections, K>;

  /**
   * Inject `service:${serviceName}` as `this[propertyName]`
   *
   * @param propertyName name of the property
   * @param serviceName name of the service
   */
  service<K1 extends keyof object, K2 extends keyof Registry>(
    propertyName: K1,
    serviceName: K2,
  ): InjectProperty<Injections, K1, Registry[K2]>;

  /**
   * Inject an arbitrary property with a value determined by the callback
   *
   * @param name name of the property
   * @param callback a callback returning the value of the injected property
   */
  property<K extends keyof object, V>(
    name: K,
    callback: (this: Injections, owner: Owner) => V,
  ): InjectProperty<Injections, K, V>;

  /**
   * Finalize the injections, returning an instantiable version of the given
   * function
   *
   * @param fn the function that should receive these injections
   */
  into<F extends InjectableFunction<Injections>>(
    fn: F,
  ): InjectableConstructor<Injected<F>>;

  /**
   * Finalize the injections with a callback that, given the injections,
   * returns the instantiated function
   */
  build<F extends AnyFunction>(
    callback: (injections: Injections) => F,
  ): InjectableConstructor<F>;
}

type DefineInjectedProperty = (owner: Owner, injections: object) => void;

class Builder<Injections> implements Inject<Injections> {
  constructor(
    private readonly properties: readonly DefineInjectedProperty[] = [],
  ) {}

  owner(): InjectOwner<Injections> {
    return new Builder<Injections & WithOwner>([
      ...this.properties,
      (owner, injections) => {
        Object.defineProperty(injections, 'owner', {
          get(): Owner {
            return owner;
          },
        });
      },
    ]);
  }

  service<K extends keyof Registry>(name: K): InjectService<Injections, K>;
  service<K1 extends keyof object, K2 extends keyof Registry>(
    propertyName: K1,
    serviceName: K2,
  ): InjectProperty<Injections, K1, Registry[K2]>;
  service<K1 extends keyof object, K2 extends keyof Registry>(
    propertyName: K1,
    serviceName: K2 = propertyName,
  ): InjectProperty<Injections, K1, Registry[K2]> {
    return new Builder<Injections & WithProperty<K1, Registry[K2]>>([
      ...this.properties,
      (owner, injections) => {
        let service: Registry[K2] | UNINITIALIZED = UNINITIALIZED;
        Object.defineProperty(injections, propertyName, {
          get(): Registry[K2] {
            if (service === UNINITIALIZED) {
              service = owner.lookup(`service:${serviceName}`);
            }
            return service;
          },
        });
      },
    ]);
  }

  property<K extends keyof object, V>(
    name: K,
    callback: (this: Injections, owner: Owner) => V,
  ): InjectProperty<Injections, K, V> {
    return new Builder<Injections & WithProperty<K, V>>([
      ...this.properties,
      (owner, injections) => {
        let value: V | UNINITIALIZED = UNINITIALIZED;
        Object.defineProperty(injections, name, {
          get(): V {
            if (value === UNINITIALIZED) {
              value = callback.call(this, owner);
            }
            return value;
          },
        });
      },
    ]);
  }

  into<F extends InjectableFunction<Injections>>(
    fn: F,
  ): InjectableConstructor<Injected<F>> {
    const getInjections = this.getInjections();
    const getInjected = (injections: Injections) => fn.bind(injections);
    return helperFor(
      constructorFor(getInjections, getInjected, getOwner, fn.name),
    );
  }

  build<F extends AnyFunction>(
    getInjected: (injections: Injections) => F,
  ): InjectableConstructor<F> {
    const getInjections = this.getInjections();
    return helperFor(
      constructorFor(getInjections, getInjected, getOwner, getInjected.name),
    );
  }

  private getInjections(): GetInjections<Injections, Owner> {
    const { properties } = this;

    return (owner) => {
      const injections = {};

      for (const defineProperty of properties) {
        defineProperty(owner, injections);
      }

      return Object.freeze(injections) as Injections;
    };
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default new Builder() as Inject<{}>;
