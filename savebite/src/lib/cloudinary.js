const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export function uploadImage(asset) {
  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return reject(new Error("Cloudinary is not configured. Check your EXPO_PUBLIC_CLOUDINARY_* variables."));
    }

    const form = new FormData();
    form.append("file", {
      uri: asset.uri,
      type: asset.mimeType || "image/jpeg",
      name: asset.fileName || `product-${Date.now()}.jpg`,
    });
    form.append("upload_preset", UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else {
        reject(new Error(data?.error?.message || "Image upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error while uploading image"));
    xhr.send(form);
  });
}

export const uploadImages = (assets) => Promise.all(assets.map(uploadImage));