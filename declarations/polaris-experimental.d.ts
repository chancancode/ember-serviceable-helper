import type { Scope, ServiceFactory } from 'ember-polaris-service';
import type { AnyFunction, InjectableConstructor, InjectableFunction, Injected } from './types.ts';
type InjectScope<Injections> = Inject<Injections & Scope>;
type WithProperty<K extends keyof object, V> = {
    [P in K]: V;
};
type InjectProperty<Injections, K extends keyof object, V> = Inject<Injections & WithProperty<K, V>>;
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
    service<K extends keyof object, V>(name: K, factory: ServiceFactory<V>): InjectProperty<Injections, K, V>;
    /**
     * Inject an arbitrary property with a value determined by the callback
     *
     * @param name name of the property
     * @param callback a callback returning the value of the injected property
     */
    property<K extends keyof object, V>(name: K, callback: (this: Injections, owner: Scope) => V): InjectProperty<Injections, K, V>;
    /**
     * Finalize the injections, returning an instantiable version of the given
     * function
     *
     * @param fn the function that should receive these injections
     */
    into<F extends InjectableFunction<Injections>>(fn: F): InjectableConstructor<Injected<F>, Scope>;
    /**
     * Finalize the injections with a callback that, given the injections,
     * returns the instantiated function
     */
    build<F extends AnyFunction>(callback: (injections: Injections) => F): InjectableConstructor<F, Scope>;
}
declare const _default: Inject<{}>;
export default _default;
export type { InjectableFunction, Injected, InjectableConstructor };
//# sourceMappingURL=polaris-experimental.d.ts.map