import { lookup, getScope, setScope } from 'ember-polaris-service';
import { h as helperFor, c as constructorFor } from './manager-13Gnqjvl.js';

const UNINITIALIZED = Symbol('UNINITIALIZED');

/**
 * A builder DSL to build the injections needed for a function
 */

class Builder {
  constructor(properties = []) {
    this.properties = properties;
  }
  scope() {
    return new Builder([...this.properties, (scope, injections) => {
      Object.defineProperty(injections, 'scope', {
        get() {
          return scope;
        }
      });
    }]);
  }
  service(name, factory) {
    return new Builder([...this.properties, (scope, injections) => {
      let service = UNINITIALIZED;
      Object.defineProperty(injections, name, {
        get() {
          if (service === UNINITIALIZED) {
            service = lookup(scope, factory);
          }
          return service;
        }
      });
    }]);
  }
  property(name, callback) {
    return new Builder([...this.properties, (scope, injections) => {
      let value = UNINITIALIZED;
      Object.defineProperty(injections, name, {
        get() {
          if (value === UNINITIALIZED) {
            value = callback.call(this, scope);
          }
          return value;
        }
      });
    }]);
  }
  into(fn) {
    const getInjections = this.getInjections();
    const getInjected = injections => fn.bind(injections);
    return helperFor(constructorFor(getInjections, getInjected, getScope, fn.name));
  }
  build(getInjected) {
    const getInjections = this.getInjections();
    return helperFor(constructorFor(getInjections, getInjected, getScope, getInjected.name));
  }
  getInjections() {
    const {
      properties
    } = this;
    return scope => {
      const injections = {};
      for (const defineProperty of properties) {
        defineProperty(scope, injections);
      }
      setScope(injections, scope);
      return Object.freeze(injections);
    };
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
var polarisExperimental = new Builder();

export { polarisExperimental as default };
//# sourceMappingURL=polaris-experimental.js.map
