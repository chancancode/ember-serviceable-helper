import type Owner from '@ember/owner';
import type { Registry } from '@ember/service';
import type { AnyFunction, InjectableConstructor, InjectableFunction, Injected } from './types.ts';
type WithOwner = {
    owner: Owner;
};
type InjectOwner<Injections> = Inject<Injections & WithOwner>;
type WithService<K extends keyof Registry> = {
    [P in K]: Registry[K];
};
type InjectService<Injections, K extends keyof Registry> = Inject<Injections & WithService<K>>;
type WithProperty<K extends keyof object, V> = {
    [P in K]: V;
};
type InjectProperty<Injections, K extends keyof object, V> = Inject<Injections & WithProperty<K, V>>;
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
    service<K1 extends keyof object, K2 extends keyof Registry>(propertyName: K1, serviceName: K2): InjectProperty<Injections, K1, Registry[K2]>;
    /**
     * Inject an arbitrary property with a value determined by the callback
     *
     * @param name name of the property
     * @param callback a callback returning the value of the injected property
     */
    property<K extends keyof object, V>(name: K, callback: (this: Injections, owner: Owner) => V): InjectProperty<Injections, K, V>;
    /**
     * Finalize the injections, returning an instantiable version of the given
     * function
     *
     * @param fn the function that should receive these injections
     */
    into<F extends InjectableFunction<Injections>>(fn: F): InjectableConstructor<Injected<F>>;
    /**
     * Finalize the injections with a callback that, given the injections,
     * returns the instantiated function
     */
    build<F extends AnyFunction>(callback: (injections: Injections) => F): InjectableConstructor<F>;
}
declare const _default: Inject<{}>;
export default _default;
//# sourceMappingURL=builder.d.ts.map