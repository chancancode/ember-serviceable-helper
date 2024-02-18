# ember-serviceable-helper

An API for writing functions that needs access to Ember services.

## Motivation

Suppose you are using Ember 4.5+ (or installed the [polyfill](https://github.com/ember-polyfills/ember-functions-as-helper-polyfill/))
and have been writing all your helpers as plain functions, like so:

```js
// app/helpers/format-date.js

/**
 * Using the browser's default locale, return the formatted string for the
 * given date, optionally taking into account the given locale options.
 */
export default function formatDate(date, options = {}) {
  const userLocale = navigator.language;
  return new Intl.DateTimeFormat(userLocale, options).format(date);
}
```

That is great, until you realize your customers' operating system/browser
settings do not always align with their preferred locale.

No problem, we will introduce a setting for this and expose it via the existing
`preferences` service. But how do we access it from the `formatDate` function?

One option would be to accept it as a function argument. The downside is that
you will have to pass that in wherever and whenever you call this function. The
point of services in Ember is to consolidate these app-wide global dependencies
and to automatically inject them into whever it is needed in the app, it would
be great if we can take advantage of that instead.

Another option would be to use the "class-based helper" API:

```js
// app/helpers/format-date.js
import Helper from '@ember/component/helper';
import { service } from '@ember/service';

/**
 * Using the browser's default locale, return the formatted string for the
 * given date, optionally taking into account the given locale options.
 */
export default class FormatDate extends Helper {
  @service preferences;

  compute([date], options) {
    const userLocale = this.preferences.locale;
    return new Intl.DateTimeFormat(userLocale, options).format(date);
  }
}
```

This works, but the code is now _vastly_ different from the simple function we
had. The "class-based helper" API is a bit of a legacy feature, it's yet another
thing to learn, and it's really meant for helpers that needs to be "stateful",
which is quite rare, and certainly not the case here.

It is a bit unfortunate that the extra machinery and syntatic noise obfuscated
the fact that this is still just a plain function that happens to need access
to some app-wide global state via services.

## Usage

Enter `ember-serviceable-helper`:

```js
// app/helpers/format-date.js
import inject from 'ember-serviceable-helper';

export default inject.service('preferences').into(
  // The function will be called with a `this` that has the dependencies injected
  function formatDate(date, options = {}) {
    const userLocale = this.preferences.locale;
    return new Intl.DateTimeFormat(userLocale, options).format(date);
  },
);
```

Alternatively:

```js
// app/helpers/format-date.js
import inject from 'ember-serviceable-helper';

export default inject.service('preferences').build(
  ({ preferences }) =>
    // Alternatively, we can pass a callback that accepts the injections and
    // return our function, which now have access to the injections via the
    // closure variable.
    function formatDate(date, options = {}) {
      const userLocale = preferences.locale;
      return new Intl.DateTimeFormat(userLocale, options).format(date);
    },
);
```

Either way, the code for the function is pretty much identical to what it was
before, its actual parameters still reflect what its consumers are expected to
call it with, and the fact that it needs access to some services is hidden away
as an internal implementation detail.

So what the value of this default export here? How do the consumers call this
function?

```js
import formatDate from 'my-app/helpers/format-date';

// It is still a function:
typeof formatDate; // "function"

// Using it as a template helper just works:
<template>
  Today's date is {{formatDate @date}}
</template>

// This throws an error, because it needs DI to work
// Error: cannot call formatDate without a context object; it must be called
// with a `this` object with an owner
formatDate(new Date());

// Here are ways some ways to satisfy the DI requirement. We are using a
// component as an example, but any object with an owner (i.e. `getOwner(...)`
// is not `undefined`) would work.
import Component from '@glimmer/component';
import { getOwner } from '@ember/owner';

class MyComponent extends Component {
  // Again, using it as a template helper just works:
  <template>
    Today's date is {{formatDate @date}}
  </template>

  // This assigns the function to `this.formatDate`
  formatDate = formatDate;

  someMethod() {
    // Now this works just fine
    this.formatDate(new Date());

    // Alternatively, it's the same as...
    formatDate.call(this, new Date());

    // Or...
    const formatDate2 = formatDate.bind(this);

    // Now this value can be passed around and works everywhere
    formatDate2(new Date());

    // Finally, if you have the owner available, you can instantiate the
    // injected version of the function directly:
    const owner = getOwner(this);
    const formatDate3 = new formatDate(owner);

    // Same as above, this value can be passed around and works anywhere
    formatDate3(new Date());
  }
}
```

Conclusions:

1. Write normal plain functions
2. If/when your function need access to services, `ember-serviceable-helper`
   offers an API that lets you inject these dependencies into the function and
   returns an `InjectableConstructor`
3. The `InjectableConstructor`...
   1. Can be used as template helpers directly
   2. Can _instantiate_ the fully injected function using the `new` keyword and
      passing the owner
   3. As a convenience, can be instantiated and called directly with the method
      call syntax on any `this` object with an owner

## Builder API

The main entrypoint is a builder API for enumerating the required dependencies
and then applying them to a function.

The API is designed to be chained:

```js
inject
  .service('config')
  .service('store')
  // ...and more...
  .into(function () {
    this.config; // ConfigService here
    this.store; // StoreService here
  });
```

If you need to the property to be different from the name of the service:

```js
inject.service('someProperty', 'my-service').into(function () {
  this.someProperty; // MyService here
});
```

You can also inject the owner directly:

```js
inject
  .owner()
  // ...can still chain on .service('config') etc
  .into(function () {
    this.owner; // Owner here
  });
```

Just like `@service`, we create lazy getters on the injectsions object (the
`this` argument), so that service lookup happens lazily on first access and is
cached thereafter.

Furthermore, the injections object is itself created lazily and cached/reused
in subsequent invocations of the same funciton. Do not abuse this and use it to
store random properties! If you need your helper to be stateful, just use the
class-based helper API instead. The injections object is frozen in debug builds
to prevent this.

However, it is sometimes useful to compute some derived state with the same
lazy and once-per-owner semantics. For this purpose, there is this additional
API on the builder:

```js
inject
  .property('router', function (owner) {
    // `this` is the injections object
    return owner.lookup('service:router') ?? owner.lookup('router:main');
  })
  // ...can still chain on .service('config') etc
  .into(function () {
    this.router; // either RouterService or Router
  });
```

For finalization, either `into()` or `build()` is available on the builder.
They do the same thing, calling either of them will "terminate" the method
chain, finalize the injections and return an `InjectableConstructor`.

The difference lies in how they provide the injections to the function.

As shown above, `into()` takes the "injectable" function and provides the
injections object via the `this` argument. This makes it possible to write code
like this:

```js
// app/helpers/format-date.js
import inject from 'ember-serviceable-helper';

// This function can be imported in tests and unit tested without going through
// the DI system
export function formatDate(date, options = {}) {
  const userLocale = this.preferences.locale;
  return new Intl.DateTimeFormat(userLocale, options).format(date);
}

export default inject.service('preferences').into(formatDate);
```

On the other hand, `build()` takes a callback and provides the injections
object via a closure argument. This makes it possible to write code like this:

```js
// app/helpers/random.js
import inject from 'ember-serviceable-helper';
import SeededRandom from 'seeded-random';

export default inject.service('config').build((injections) => {
  // The initialization code here runs once-per-owner and lazily on the first
  // invocation of the helper/function; don't abuse this to store state!
  const { config } = injections;
  const RNG = new SeededRandom(config.seed ?? Date.now());

  return function random() {
    return RNG.next();
  };
});
```

This particular example is probably better modelled as a service anyway, the
same can be accomplished with the `property()` method on the builder, but
nevertheless it is sometimes useful for integrating/initializing third-party
libraries, registering destructors against the owner, etc.

Just keep in mind that this library is really just meant for "upgrading" simple
plain functions to have access to services, and if you find yourself doing very
eloborate things with it, consider whether a service or a stateful class-based
helper would be more appropiate.

Another reason (and the oringal reason) this `build()` API exists is that it
can sometimes provide better type inference for TypeScript. See the next
section for details.

## TypeScript/Glint Support

This addon comes with types for TypeScript. For the most part, all the code
shown in this README so far will work with TypeScript with little to no manual
type annotation required.

For example:

```ts
// app/helpers/format-date.ts
import inject from 'ember-serviceable-helper';

export default inject.service('preferences').into(function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  // TypeScript can infer the `this` type from the builder DSL.  Furthermore,
  // it uses the `Registry` type in `@ember/service` to infer the correct
  // type for the `preferences` service
  const userLocale = this.preferences.locale;
  return new Intl.DateTimeFormat(userLocale, options).format(date);
});
```

Of course, if you prefer, you can type the injections explicitly too, and
TypeScript will make sure it is typed correctly (matching the builder DSL):

```ts
// app/helpers/format-date.ts
import inject from 'ember-serviceable-helper';
import PreferencesService from 'my-app/services/preferences';

// Explictly typing the `this` argument
export interface FormatDateInjections {
  preferences: PreferencesService;
}

// This function can be imported in tests and unit tested without going through
// the DI system
export function formatDate(
  this: FormatDateInjections,
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  const userLocale = this.preferences.locale;
  return new Intl.DateTimeFormat(userLocale, options).format(date);
}

// If the inferred type from the builder DSL differs from your provided `this`
// type, you will get a type error here
export default inject.service('preferences').into(formatDate);
```

Arguably, this is good documentation for future human readers of the code, but
it is not necessarily unsafe to let TypeScript infer it.

If you are using Glint and `@glint/environment-ember-loose`, you may also want
to add it to your template registry:

```ts
// app/helpers/format-date.ts
import inject from 'ember-serviceable-helper';
import PreferencesService from 'my-app/services/preferences';

export interface FormatDateInjections {
  preferences: PreferencesService;
}

export function formatDate(
  this: FormatDateInjections,
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  const userLocale = this.preferences.locale;
  return new Intl.DateTimeFormat(userLocale, options).format(date);
}

// We need to name this return value so we can reference it for the registry
const formatDateHelper = inject.service('preferences').into(formatDate);
export default formatDateHelper;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    // Note: we want `typeof formatDateHelper`, not `typeof formatDate` here,
    // see discussion below
    'format-date': typeof formatDateHelper;
  }
}
```

Unfortunately, in JavaScript/TypeScript, there isn't a syntax that names the
result of an expression as a local (`let`/`const`) variable and making it the
default export at the same time, so this adds a bit of boilerplate, but it is
very much necessary.

From the perspective of your function's implementation, the signature of the
function is `(this: Injections, ...args)`, but your consumers should not see
that `this` parameter, as it is not an argument that they need to provide when
calling your function. In fact, Glint will not let you invoke a function as a
template helper unless it matches `(this: void, ...args)`.

The types in the builder DSL takes care of that for you and returns the correct
`InjectableConstructor` type (which also adds the `new (owner: Owner)` union),
it is important that that's the type we export to our consumers.

To do this, it essentially uses the same technique as TypeScript's built-in
[`OmitThisParameter`](https://www.typescriptlang.org/docs/handbook/utility-types.html#omitthisparametertype)
type. Unfortunately, there is an notable documented limitation/caveat here:

> Generics are erased and only the last overload signature is propagated into
> the new function type.

This is not a problem in most cases, but consider this example:

```ts
// app/helpers/get-config.ts
import inject from 'ember-serviceable-helper';
import ConfigService from 'my-app/services/config';

export interface GetConfigInjections {
  config: ConfigService;
}

export function getConfig<K extends keyof ConfigService>(
  this: GetConfigInjections,
  key: K,
): ConfigService[K] {
  return this.config.get(key);
}

const getConfigHelper = inject.service('config').into(getConfig);
export default getConfigHelper;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'get-config': typeof getConfigHelper;
  }
}
```

Suppose the config service has an interface like this:

```ts
interface ConfigService {
  build: number;
  commit: string;
  environment: 'development' | 'production';
}
```

The `getConfig` function is typed generically such that `getConfig('build')`
will have the return type `number`, `getConfig('commit')` returns `string`,
etc.

Unfortunately, because of the documented limitation in TypeScript, the function
returned by the builder in this case will have its generics "erased", which is:

```ts
function getConfig(key: 'build' | 'commit' | 'environment'): number | string;
```

This is unfortunate, because now `getConfig('build')` (and everything else)
will have the return type `number | string`, which is not really what you want.

Fortunately, for cases like this, the `build()` API does not suffer from the
same limitation:

```ts
// app/helpers/get-config.ts
import inject from 'ember-serviceable-helper';
import ConfigService from 'my-app/services/config';

export interface GetConfigInjections {
  config: ConfigService;
}

const getConfig = inject.service('config').build(
  ({ config }: GetConfigInjections) =>
    function <K extends keyof ConfigService>(key: K): ConfigService[K] {
      return config.get(key);
    },
);
export default getConfig;

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'get-config': typeof getConfig;
  }
}
```

Because we did not have to erase the `this` type here, `getConfig` will have
its generic signature left intact.

## ember-polaris-service

If you are experimenting with [ember-polaris-service](https://github.com/chancancode/ember-polaris-service/),
there is an alternative builder API that integrates with that addon instead:

```js
import inject from 'ember-serviceable-helper/polaris-experimental';
import PreferencesService from 'my-app/services/preferences';

export default inject
  .service('preferences', PreferencesService)
  .into(function formatDate(date, options = {}) {
    const userLocale = this.preferences.locale;
    return new Intl.DateTimeFormat(userLocale, options).format(date);
  });
```

It works the same way as the main builder API, except that `.service()` takes
both the property name and the service token/factory as arguments, and uses the
`lookup(owner, factory)` mechanism from that addon rather than the traditional
string-based lookup.

This is more or less a convenience over doing this yourself:

```js
import inject from 'ember-serviceable-helper';
import { lookup } from 'ember-polaris-service';
import PreferencesService from 'my-app/services/preferences';

export default inject
  // This is how you would integrate it manually with the main builder API
  .property('preferences', (owner) => lookup(owner, PreferencesService))
  .into(function formatDate(date, options = {}) {
    const userLocale = this.preferences.locale;
    return new Intl.DateTimeFormat(userLocale, options).format(date);
  });
```

## What about components?

It is certainly possible to make a version of this addon for components:

```js
export default inject.service('config').into(
  <template>now available: {{this.config.foo}}</template>
);
```

Personally, I don't think the same problem exists and that the meta-programming
"pays for itself" on components. With Glimmer components and `<template>`, the
"upgrade path" into classes feels seamless, and the doesn't feel like a falling
off an awkward cliff in the same way that helper -> class-based helper does to
me.

In my opinion, for components, upgrading a `<template>` into the conventional
class syntax when you need services is appropriate. You are very likely to need
class-based components for other purposes in your app already, it's not worth
adding another way to accomplish that same thing. (On the other hand, this was
originally created so that we can eliminate usages of class-based helpers in
the app, and that felt better motivated.)

## What about modifiers?

Creating a version of this for function-based/stateless (other than cleanup)
modifiers is certainly worth considering, largely for the same kind of reasons
that motivated the creation of this addon for helpers. That being said, I don't
currently have the use case for it and would prefer to see how things shake out
for the helpers version before investing the effort, but if you are interested,
certainly go for it. With the v2 addon blueprint, this set up as a monorepo and
ready to accommodate additional sibling packages.

## Compatibility

> [!WARNING]
> This started as an extraction from work projects on a weekend, at the moment
> I am just relying on the work project test suite to confirm that it works as
> expected. I am a bit biased and thinks the test suite is pretty good, but
> it's just one app on one particular version of Ember/TypeScript/Glint, and we
> don't have many such helpers. So if you are going to use this, maybe consider
> helping out by adding some tests in the test app, it'll help me not break you
> in the future. Thank you and feel free to remove this warning in the PR.

- Ember.js v4.12 or above
- Embroider or ember-auto-import v2

## Installation

```
ember install ember-serviceable-helper
```

## Contributing

See the [Contributing](CONTRIBUTING.md) guide for details.

## License

This project is licensed under the [MIT License](LICENSE.md).
