import { assert } from '@ember/debug';
import { setHelperManager, capabilities } from '@ember/helper';
import { isDestroying, isDestroyed } from '@ember/destroyable';
import { macroCondition, isDevelopingApp } from '@embroider/macros';

const STORAGE = new WeakMap();
const INJECTABLE = Symbol('INJECTABLE');
function isInjectable(fn) {
  return fn[INJECTABLE] === true;
}
function constructorFor(getInjections, getInjected, getOwner, name) {
  const storage = new Storage(getInjections, getInjected);
  const constructor = makeConstructor(storage, getOwner, name);
  STORAGE.set(constructor, storage);
  constructor[INJECTABLE] = true;
  return constructor;
}
function makeConstructor(storage, getOwner, name) {
  if (macroCondition(isDevelopingApp())) {
    if (name) {
      // trick to set function.name
      const obj = {
        [name]: function (...args) {
          if (new.target) {
            return storage.getInjected(args[0]);
          } else {
            assert(`cannot call ${name} without a context object; it must be called with a \`this\` object with an owner`, this !== null && typeof this === 'object');
            const owner = getOwner(this);
            assert(`cannot call ${name} with an invalid context object; it must be called with a \`this\` object with an owner`, owner);
            return storage.getInjected(owner)(...args);
          }
        }
      };
      return obj[name];
    }
  }
  return function (...args) {
    if (new.target) {
      return storage.getInjected(args[0]);
    } else {
      const owner = getOwner(this);
      return storage.getInjected(owner)(...args);
    }
  };
}
class Storage {
  #getInjections;
  #getInjected;
  #name;
  #injected = new WeakMap();
  #injections = new WeakMap();
  constructor(getInjections, getInjected, name = '(unknown function)') {
    this.#getInjections = getInjections;
    this.#getInjected = getInjected;
    this.#name = name;
  }
  getInjections(owner) {
    assert(`cannot call ${this.#name} while the owner is being destroyed`, !isDestroying(owner));
    assert(`cannot call ${this.#name} after the owner has already been destroyed`, !isDestroyed(owner));
    let injections = this.#injections.get(owner);
    if (!injections) {
      this.#injections.set(owner, injections = this.#getInjections(owner));
    }
    return injections;
  }
  getInjected(owner) {
    assert(`cannot call ${this.#name} while the owner is being destroyed`, !isDestroying(owner));
    assert(`cannot call ${this.#name} after the owner has already been destroyed`, !isDestroyed(owner));
    let injected = this.#injected.get(owner);
    if (!injected) {
      const injections = this.getInjections(owner);
      this.#injected.set(owner, injected = this.#getInjected(injections));
    }
    return injected;
  }
}

class InstantiableHelperManager {
  capabilities = capabilities('3.23', {
    hasValue: true
  });
  constructor(owner) {
    this.owner = owner;
  }
  createHelper(constructor, args) {
    assert('must be an injectable constructor', isInjectable(constructor));
    return {
      fn: new constructor(this.owner),
      args
    };
  }
  getValue({
    fn,
    args
  }) {
    if (Object.keys(args.named).length > 0) {
      return fn(...args.positional, args.named);
    } else {
      return fn(...args.positional);
    }
  }
  getDebugName(fn) {
    return fn.name;
  }
}
function factory(owner) {
  return new InstantiableHelperManager(owner);
}
function helperFor(fn) {
  assert('must be an injectable constructor', isInjectable(fn));
  return setHelperManager(factory, fn);
}

export { constructorFor as c, helperFor as h };
//# sourceMappingURL=manager-13Gnqjvl.js.map
