import { assert } from '@ember/debug';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { macroCondition, isDevelopingApp } from '@embroider/macros';

import type {
  AnyFunction,
  AnyInjectableConstructor,
  InjectableConstructor,
} from './types.ts';

const STORAGE = new WeakMap<
  AnyInjectableConstructor<object>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Storage<any, AnyFunction, object>
>();

const INJECTABLE = Symbol('INJECTABLE');

export function isInjectable(
  fn: AnyFunction,
): fn is AnyInjectableConstructor<object> {
  return (fn as { [INJECTABLE]?: true })[INJECTABLE] === true;
}

export type GetInjections<Injections, Owner extends object> = (
  owner: Owner,
) => Injections;

export type GetInjected<Injections, F extends AnyFunction> = (
  injections: Injections,
) => F;

export type GetOwner<Owner> = (object: object) => Owner | undefined;

export function constructorFor<
  Injections,
  Injected extends AnyFunction,
  Owner extends object,
>(
  getInjections: GetInjections<Injections, Owner>,
  getInjected: GetInjected<Injections, Injected>,
  getOwner: (context: object) => Owner | undefined,
  name?: string,
): InjectableConstructor<Injected, Owner> {
  const storage = new Storage(getInjections, getInjected);
  const constructor = makeConstructor(storage, getOwner, name);

  STORAGE.set(
    constructor as InjectableConstructor<Injected, object>,
    storage as Storage<Injections, Injected, object>,
  );

  (constructor as { [INJECTABLE]?: true })[INJECTABLE] = true;

  return constructor;
}

function makeConstructor<
  Injections,
  Injected extends AnyFunction,
  Owner extends object,
>(
  storage: Storage<Injections, Injected, Owner>,
  getOwner: GetOwner<Owner>,
  name?: string,
): InjectableConstructor<Injected, Owner> {
  if (macroCondition(isDevelopingApp())) {
    if (name) {
      // trick to set function.name
      const obj = {
        [name]: function (this: object | void, ...args) {
          if (new.target) {
            return storage.getInjected(args[0]);
          } else {
            assert(
              `cannot call ${name} without a context object; it must be called with a \`this\` object with an owner`,
              this !== null && typeof this === 'object',
            );

            const owner = getOwner(this);

            assert(
              `cannot call ${name} with an invalid context object; it must be called with a \`this\` object with an owner`,
              owner,
            );

            return storage.getInjected(owner)(...args);
          }
        } as InjectableConstructor<Injected, Owner>,
      };

      return obj[name]!;
    }
  }

  return function (this: object, ...args) {
    if (new.target) {
      return storage.getInjected(args[0]);
    } else {
      const owner = getOwner(this);
      return storage.getInjected(owner!)(...args);
    }
  } as InjectableConstructor<Injected, Owner>;
}

class Storage<Injections, Injected extends AnyFunction, Owner extends object> {
  #getInjections: GetInjections<Injections, Owner>;
  #getInjected: GetInjected<Injections, Injected>;
  #name: string;

  #injected = new WeakMap<Owner, Injected>();
  #injections = new WeakMap<Owner, Injections>();

  constructor(
    getInjections: GetInjections<Injections, Owner>,
    getInjected: GetInjected<Injections, Injected>,
    name = '(unknown function)',
  ) {
    this.#getInjections = getInjections;
    this.#getInjected = getInjected;
    this.#name = name;
  }

  getInjections(owner: Owner): Injections {
    assert(
      `cannot call ${this.#name} while the owner is being destroyed`,
      !isDestroying(owner),
    );
    assert(
      `cannot call ${this.#name} after the owner has already been destroyed`,
      !isDestroyed(owner),
    );

    let injections = this.#injections.get(owner);

    if (!injections) {
      this.#injections.set(owner, (injections = this.#getInjections(owner)));
    }

    return injections!;
  }

  getInjected(owner: Owner): Injected {
    assert(
      `cannot call ${this.#name} while the owner is being destroyed`,
      !isDestroying(owner),
    );
    assert(
      `cannot call ${this.#name} after the owner has already been destroyed`,
      !isDestroyed(owner),
    );

    let injected = this.#injected.get(owner);

    if (!injected) {
      const injections = this.getInjections(owner);
      this.#injected.set(owner, (injected = this.#getInjected(injections)));
    }

    return injected!;
  }
}
