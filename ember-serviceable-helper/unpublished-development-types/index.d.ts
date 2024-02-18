import type Owner from '@ember/owner';

declare module '@ember/helper' {
  interface HelperCapabilities {
    hasValue: boolean;
    hasDestroyable: boolean;
  }

  export function capabilities(
    version: '3.23',
    capabilities: Partial<HelperCapabilities>,
  ): HelperCapabilities;

  export interface Arguments {
    positional: unknown[];
    named: Record<string, unknown>;
  }

  export interface HelperManager<D, T> {
    createHelper(definition: D, args: Arguments): T;
    getValue(state: T): unknown;
    getDebugName(definition: D): string;
  }

  export function setHelperManager<D, T, O extends object>(
    factory: (owner: Owner) => HelperManager<D, T>,
    object: O,
  ): O;
}
