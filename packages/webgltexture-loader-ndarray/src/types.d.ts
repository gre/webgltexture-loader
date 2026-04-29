declare module "ndarray-ops" {
  import type { NdArray } from "ndarray";
  const ops: {
    assign(out: NdArray, inp: NdArray): NdArray;
    muls(out: NdArray, inp: NdArray, scalar: number): NdArray;
  };
  export default ops;
}

declare module "typedarray-pool" {
  type DType = "uint8" | "uint16" | "uint32" | "int8" | "int16" | "int32" | "float32" | "float64";
  const pool: {
    malloc(
      size: number,
      dtype: DType,
    ):
      | Uint8Array
      | Uint16Array
      | Uint32Array
      | Int8Array
      | Int16Array
      | Int32Array
      | Float32Array
      | Float64Array;
    free(buf: ArrayBufferView): void;
  };
  export default pool;
}
