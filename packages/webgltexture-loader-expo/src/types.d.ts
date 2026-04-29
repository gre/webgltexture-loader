declare module "expo-modules-core" {
  export const NativeModulesProxy: {
    ExponentGLObjectManager?: {
      createObjectAsync?: (config: unknown) => Promise<{ exglObjId: number }>;
      destroyObjectAsync?: (exglObjId: number) => Promise<void>;
    };
  };
}

declare module "expo-asset" {
  export class Asset {
    static fromModule(module: number): Asset;
    downloadAsync(): Promise<this>;
    width: number | null;
    height: number | null;
    uri: string;
    localUri?: string | null;
  }
}
