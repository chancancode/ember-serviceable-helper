/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type EmberOwner from '@ember/owner';

export type AnyFunction = (...params: any[]) => any;

export type InjectableFunction<
  Injections,
  Params extends any[] = any[],
  Return = any,
> = (this: Injections, ...params: Params) => Return;

export type Injected<F extends InjectableFunction<any>> = (
  ...params: Parameters<F>
) => ReturnType<F>;

export type InjectableConstructor<
  F extends AnyFunction,
  Owner extends object = EmberOwner,
> = F & {
  new (owner: Owner): F;
};

export type AnyInjectableConstructor<Owner extends object = EmberOwner> =
  InjectableConstructor<AnyFunction, Owner>;
