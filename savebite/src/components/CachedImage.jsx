import { Image as ExpoImage } from "expo-image";
import * as NativeWind from "nativewind";

// let className work on expo-image (NativeWind v4); harmless if your version doesn't have it
NativeWind.cssInterop?.(ExpoImage, { className: "style" });

// Drop-in for react-native's <Image>, but pictures are kept on the phone's disk,
// so they still show when there's no internet.
export default function CachedImage({ resizeMode, ...props }) {
  return <ExpoImage contentFit={resizeMode ?? "cover"} cachePolicy="memory-disk" transition={120} {...props} />;
}
