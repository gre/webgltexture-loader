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
    static loadAsync(uri: string | string[]): Promise<Asset[]>;
    downloadAsync(): Promise<this>;
    width: number | null;
    height: number | null;
    uri: string;
    localUri?: string | null;
  }
}

declare module "react-native" {
  export const Image: {
    getSize(
      uri: string,
      success: (width: number, height: number) => void,
      failure?: (error: unknown) => void,
    ): void;
  };
}
