import { getOwner, setOwner } from '@ember/owner';
import { h as helperFor, c as constructorFor } from './manager-13Gnqjvl.js';

const UNINITIALIZED = Symbol('UNINITIALIZED');

/**
 * A builder DSL to build the injections needed for a function
 */

class Builder {
  constructor(properties = []) {
    this.properties = properties;
  }
  owner() {
    return new Builder([...this.properties, (owner, injections) => {
      Object.defineProperty(injections, 'owner', {
        get() {
          return owner;
        }
      });
    }]);
  }
  service(propertyName, serviceName = propertyName) {
    return new Builder([...this.properties, (owner, injections) => {
      let service = UNINITIALIZED;
      Object.defineProperty(injections, propertyName, {
        get() {
          if (service === UNINITIALIZED) {
            service = owner.lookup(`service:${serviceName}`);
          }
          return service;
        }
      });
    }]);
  }
  property(name, callback) {
    return new Builder([...this.properties, (owner, injections) => {
      let value = UNINITIALIZED;
      Object.defineProperty(injections, name, {
        get() {
          if (value === UNINITIALIZED) {
            value = callback.call(this, owner);
          }
          return value;
        }
      });
    }]);
  }
  into(fn) {
    const getInjections = this.getInjections();
    const getInjected = injections => fn.bind(injections);
    return helperFor(constructorFor(getInjections, getInjected, getOwner, fn.name));
  }
  build(getInjected) {
    const getInjections = this.getInjections();
    return helperFor(constructorFor(getInjections, getInjected, getOwner, getInjected.name));
  }
  getInjections() {
    const {
      properties
    } = this;
    return owner => {
      const injections = {};
      for (const defineProperty of properties) {
        defineProperty(owner, injections);
      }
      setOwner(injections, owner);
      return Object.freeze(injections);
    };
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
var builder = new Builder();

export { builder as default };
//# sourceMappingURL=index.js.map
