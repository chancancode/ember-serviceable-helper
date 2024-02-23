import type { Scope, ServiceFactory } from 'ember-polaris-service';
import { getScope, setScope, lookup } from 'ember-polaris-service';

import type {
  AnyFunction,
  InjectableConstructor,
  InjectableFunction,
  Injected,
} from './types.ts';
import { constructorFor } from './injection.ts';
import type { GetInjections } from './injection.ts';
import { helperFor } from './manager.ts';

type WithScope = { scope: Scope };

type InjectScope<Injections> = Inject<Injections & Scope>;

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
   * Inject the scope as `this.scope`
   */
  scope(): InjectScope<Injections>;

  /**
   * Inject `lookup(scope, factory)` as `this[name]`
   *
   * @param name name of the property
   * @param factory the lookup token/factory for the service
   */
  service<K extends keyof object, V>(
    name: K,
    factory: ServiceFactory<V>,
  ): InjectProperty<Injections, K, V>;

  /**
   * Inject an arbitrary property with a value determined by the callback
   *
   * @param name name of the property
   * @param callback a callback returning the value of the injected property
   */
  property<K extends keyof object, V>(
    name: K,
    callback: (this: Injections, owner: Scope) => V,
  ): InjectProperty<Injections, K, V>;

  /**
   * Finalize the injections, returning an instantiable version of the given
   * function
   *
   * @param fn the function that should receive these injections
   */
  into<F extends InjectableFunction<Injections>>(
    fn: F,
  ): InjectableConstructor<Injected<F>, Scope>;

  /**
   * Finalize the injections with a callback that, given the injections,
   * returns the instantiated function
   */
  build<F extends AnyFunction>(
    callback: (injections: Injections) => F,
  ): InjectableConstructor<F, Scope>;
}

type DefineInjectedProperty = (scope: Scope, injections: object) => void;

class Builder<Injections> implements Inject<Injections> {
  constructor(
    private readonly properties: readonly DefineInjectedProperty[] = [],
  ) {}

  scope(): InjectScope<Injections> {
    return new Builder<Injections & WithScope>([
      ...this.properties,
      (scope, injections) => {
        Object.defineProperty(injections, 'scope', {
          get(): Scope {
            return scope;
          },
        });
      },
    ]);
  }

  service<K extends keyof object, V>(
    name: K,
    factory: ServiceFactory<V>,
  ): InjectProperty<Injections, K, V> {
    return new Builder<Injections & WithProperty<K, V>>([
      ...this.properties,
      (scope, injections) => {
        let service: V | UNINITIALIZED = UNINITIALIZED;
        Object.defineProperty(injections, name, {
          get(): V {
            if (service === UNINITIALIZED) {
              service = lookup(scope, factory);
            }
            return service;
          },
        });
      },
    ]);
  }

  property<K extends keyof object, V>(
    name: K,
    callback: (this: Injections, scope: Scope) => V,
  ): InjectProperty<Injections, K, V> {
    return new Builder<Injections & WithProperty<K, V>>([
      ...this.properties,
      (scope, injections) => {
        let value: V | UNINITIALIZED = UNINITIALIZED;
        Object.defineProperty(injections, name, {
          get(): V {
            if (value === UNINITIALIZED) {
              value = callback.call(this, scope);
            }
            return value;
          },
        });
      },
    ]);
  }

  into<F extends InjectableFunction<Injections>>(
    fn: F,
  ): InjectableConstructor<Injected<F>, Scope> {
    const getInjections = this.getInjections();
    const getInjected = (injections: Injections) => fn.bind(injections);
    return helperFor(
      constructorFor(getInjections, getInjected, getScope, fn.name),
    );
  }

  build<F extends AnyFunction>(
    getInjected: (injections: Injections) => F,
  ): InjectableConstructor<F, Scope> {
    const getInjections = this.getInjections();
    return helperFor(
      constructorFor(getInjections, getInjected, getScope, getInjected.name),
    );
  }

  private getInjections(): GetInjections<Injections, Scope> {
    const { properties } = this;

    return (scope) => {
      const injections = {};

      for (const defineProperty of properties) {
        defineProperty(scope, injections);
      }

      setScope(injections, scope);

      return Object.freeze(injections) as Injections;
    };
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export default new Builder() as Inject<{}>;

export type { InjectableFunction, Injected, InjectableConstructor };
