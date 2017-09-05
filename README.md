# WebGLTextureLoader libraries

[gre/webgltexture-loader](https://github.com/gre/webgltexture-loader) repository hosts `webgltexture-loader` libraries, utility to load & cache various kind of WebGLTexture with an extensible and loosely coupled system.

The `webgltexture-loader` library is a core WebGL Texture loader implementation used by frameworks like `gl-react`.

**The gist**

> You usually need to build a small helper to hook things together (as things are initially uncoupled). That said, the following gist is a proof it's still viable to directly use it.

```js
import { LoaderResolver } from "webgltexture-loader";
import "webgltexture-loader-dom"; // import support for DOM, including video, canvas or simple image url

const canvas = document.createElement("canvas"); document.body.appendChild(canvas);
const gl = canvas.getContext("webgl");

const resolver = new LoaderResolver(gl);

function load (input) { // just an example (create your own load function based on needs)
  const loader = resolver.resolve(input);
  return loader ? loader.load(input) : Promise.reject("no loader supports the input "+input);
}

load("https://i.imgur.com/wxqlQkh.jpg") // just an example, many format supported here
.then(({ texture }) => {
  const program = createDemoProgram(gl);
  const tLocation = gl.getUniformLocation(program, "t");
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(tLocation, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
});
```

[createDemoProgram() source code](https://gist.github.com/gre/5d894656e10c70409b9e60e265753e94)

## WebGLTextureLoader ?

a `WebGLTextureLoader<T>` is an object created with a `WebGLRenderingContext` that can load and cache a WebGLTexture for a given input.

```js
type TextureAndSize = {
  texture: WebGLTexture,
  width: number,
  height: number
}

class WebGLTextureLoader<T> {
  constructor(gl: WebGLRenderingContext){}
  canLoad(input: any): boolean
  load(input: T): Promise<TextureAndSize>
  get(input: T): ?TextureAndSize
  update(input: T)
}
```


If `loader.canLoad(input)` is true, the loader can be used:

`loader.get(input)` returns a **{texture, width, height}** object if the input is loaded. Otherwise it returns null, and you need to call `loader.load(input)` to load the resource, which return a promise of that same object. Note that you can just stick with the `load` API.

> When the load(input) promise is fulfilled, it is guarantee that `loader.get(input)` returns a result that is `===` to the Promise result. It is also guarantee that 2 call to the same `loader.load(input)` is idempotent and returns the same Promise (by `===`).

### Why is there both `get` and `load` API?

The dual `get` and `load` is defined to allow the best of the 2 worlds paradigms: async and sync. Typically, you can call `get()` in a requestAnimationFrame loop (and call load if it fails so the future frames will eventually have it resolved). But, in a more async paradigm, you can wait the `load()` Promise.

A second reason is that some Loader are simply sync by nature. For instance, the HTMLCanvasElement or ndarray loaders. (this is transparent when using the API).

Th idea behind `get(input)` is also to allow functional/"descriptive" way like an object coming from React (e.g. in React, user sent again and again the full state tree and therefore don't keep state, input might just be an new object each time, the library do the reconciliation in some way).

## LoaderResolver

A LoaderResolver is a tiny utility that instantiate the loaders and exposes a resolve method that returns the first WebGLTextureLoader that `canLoad` a given input.

```js
const resolver = new LoaderResolver(gl); // instantiate once
const maybeLoader = resolver.resolve(input); // use many times
// then do your logic...
// ... maybeLoader.get(input);
// ... maybeLoader.load(input);
```

> `LoaderResolver` also accept a second parameter that is the LoadersRegistry to use, by default it is the "globalRegistry".

## Available loaders

Loaders implementation are available via various NPM packages. The idea of each is that they both expose the loader class but they will also automatically add itself in the globalRegistry (as soon as imported in the bundle). So typically you need to `import "webgltexture-loader-WHATEVER;"` them all and use `new LoaderResolver(gl)` to use the globalRegistry.

- `webgltexture-loader-dom` add all **DOM only** loaders:
  - `webgltexture-loader-dom-canvas` for a HTMLCanvasElement
  - `webgltexture-loader-dom-video` for a HTMLVideoElement
  - `webgltexture-loader-dom-image-url` support for image by giving it's URL (as a string input).
- `webgltexture-loader-ndarray` add **NDArray loader** support.
- `webgltexture-loader-react-native` add all **React Native** loaders (using react-native-webgl)
  - `webgltexture-loader-react-native-config` add the generic Config format of react-native-webgl
  - `webgltexture-loader-react-native-imagesource` add support of ImageSource (same format as in React Native Image source prop).
- `webgltexture-loader-expo` exposes loaders for Expo (EXGLView). They might soon be replaced by `webgltexture-loader-react-native` if it gets migrated to react-native-webgl.
