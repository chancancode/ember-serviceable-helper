import { assert } from '@ember/debug';
import { capabilities, setHelperManager } from '@ember/helper';
import type { Arguments, HelperManager } from '@ember/helper';
import type Owner from '@ember/owner';

import type { AnyFunction, AnyInjectableConstructor } from './types.ts';
import { isInjectable } from './injection.ts';

interface State {
  fn: AnyFunction;
  args: Arguments;
}

class InstantiableHelperManager
  implements HelperManager<AnyInjectableConstructor<Owner>, State>
{
  readonly capabilities = capabilities('3.23', { hasValue: true });

  constructor(private owner: Owner) {}

  createHelper(constructor: AnyInjectableConstructor, args: Arguments): State {
    assert('must be an injectable constructor', isInjectable(constructor));
    return { fn: new constructor(this.owner), args };
  }

  getValue({ fn, args }: State): unknown {
    if (Object.keys(args.named).length > 0) {
      return fn(...args.positional, args.named);
    } else {
      return fn(...args.positional);
    }
  }

  getDebugName(fn: AnyInjectableConstructor): string {
    return fn.name;
  }
}

function factory(owner: Owner): InstantiableHelperManager {
  return new InstantiableHelperManager(owner);
}

export function helperFor<F extends AnyInjectableConstructor>(fn: F): F {
  assert('must be an injectable constructor', isInjectable(fn));
  return setHelperManager(factory, fn);
}
