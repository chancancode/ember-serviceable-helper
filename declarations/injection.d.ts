import type { AnyFunction, AnyInjectableConstructor, InjectableConstructor } from './types.ts';
export declare function isInjectable(fn: AnyFunction): fn is AnyInjectableConstructor<object>;
export type GetInjections<Injections, Owner extends object> = (owner: Owner) => Injections;
export type GetInjected<Injections, F extends AnyFunction> = (injections: Injections) => F;
export type GetOwner<Owner> = (object: object) => Owner | undefined;
export declare function constructorFor<Injections, Injected extends AnyFunction, Owner extends object>(getInjections: GetInjections<Injections, Owner>, getInjected: GetInjected<Injections, Injected>, getOwner: (context: object) => Owner | undefined, name?: string): InjectableConstructor<Injected, Owner>;
//# sourceMappingURL=injection.d.ts.map