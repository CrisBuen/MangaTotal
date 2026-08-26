import { HomeExperience } from "@/components/home/HomeExperience";
import { AppHeader } from "@/components/ui/AppHeader";
import { getSessionUser } from "@/lib/auth";

export default async function Home() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-canvas">
      <AppHeader
        user={user ? { nickname: user.nickname, avatarPath: user.avatarPath, isAdmin: user.isAdmin } : null}
      />
      <main className="mx-auto max-w-app px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-10" data-od-id="home-content">
        <HomeExperience />
      </main>
    </div>
  );
}
