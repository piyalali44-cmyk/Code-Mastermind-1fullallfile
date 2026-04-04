import type { Router } from "expo-router";

export function navigateDeepLink(url: string, router: Router): void {
  const seriesMatch = url.match(/^stayguided:\/\/series\/(.+)$/);
  if (seriesMatch) {
    router.push(`/series/${seriesMatch[1]}`);
    return;
  }
  const screen = url.replace(/^stayguided:\/\/(screen\/)?/, "");
  switch (screen) {
    case "journey": router.push("/journey"); break;
    case "quran": router.push("/(tabs)/quran"); break;
    case "profile": router.push("/(tabs)/profile"); break;
    case "leaderboard": router.push("/leaderboard"); break;
    case "subscription": router.push("/subscription"); break;
    case "settings": router.push("/settings"); break;
    case "search": router.push("/search"); break;
    case "notifications": router.push("/notifications"); break;
    case "contact": router.push("/contact"); break;
    case "hadith": router.push("/hadith"); break;
    default:
      if (url.startsWith("/series/")) {
        router.push(url as "/series/[id]");
      } else if (url.startsWith("/")) {
        router.push(url as any);
      } else {
        router.push("/");
      }
      break;
  }
}
