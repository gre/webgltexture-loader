declare module "react-native" {
  export function findNodeHandle(component: unknown): number | null;
}

declare module "expo-modules-core" {
  export const NativeModulesProxy: {
    ExponentGLObjectManager?: {
      destroyObjectAsync?: (exglObjId: number) => Promise<void>;
      createCameraTextureAsync?: (camera: unknown) => Promise<{ exglObjId: number }>;
    };
  };
}

declare module "expo-camera" {
  export class Camera {}
}
