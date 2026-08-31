"use client";

import { useEffect, useState } from "react";

export const AVATAR_UPDATED_EVENT = "mangatotal:avatar-updated";

export function announceAvatarUpdate(avatarPath: string | null) {
  window.dispatchEvent(
    new CustomEvent<string | null>(AVATAR_UPDATED_EVENT, { detail: avatarPath }),
  );
}

function avatarUrl(path: string) {
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/images/${encodedPath}`;
}

export function UserAvatar({
  nickname,
  avatarPath,
  className,
  fallbackClassName,
  alt = "",
}: {
  nickname: string;
  avatarPath: string | null;
  className: string;
  fallbackClassName?: string;
  alt?: string;
}) {
  const [currentPath, setCurrentPath] = useState(avatarPath);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentPath(avatarPath);
    setFailed(false);
  }, [avatarPath]);

  useEffect(() => {
    function handleAvatarUpdated(event: Event) {
      setCurrentPath((event as CustomEvent<string | null>).detail);
      setFailed(false);
    }

    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated);
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdated);
  }, []);

  return (
    <span className={`relative flex shrink-0 overflow-hidden ${className}`}>
      {currentPath && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl(currentPath)}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center ${fallbackClassName ?? "font-display font-semibold text-ink"}`}
          aria-hidden={alt ? undefined : true}
        >
          {nickname.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
