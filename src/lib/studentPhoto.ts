// A student "has a photo" when a real picture was uploaded. Students without one get a generated
// dicebear initials avatar (see mapStudentRow in store.tsx), which must not count as a photo.

export type PhotoFilter = "all" | "with" | "without";

export function hasStudentPhoto(s: { imageUrl?: string | null }): boolean {
  const url = s.imageUrl?.trim();
  return !!url && !url.includes("api.dicebear.com");
}

export function matchesPhotoFilter(s: { imageUrl?: string | null }, filter: PhotoFilter): boolean {
  if (filter === "all") return true;
  return filter === "with" ? hasStudentPhoto(s) : !hasStudentPhoto(s);
}
