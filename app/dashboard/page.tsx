
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function Dashboard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [message, setMessage] = useState("Loading...");

  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      // 1. Get the currently logged-in user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setMessage("You are not logged in.");
        return;
      }

      const user = userData.user;

      setEmail(user.email ?? "");

      // 2. Check whether this user already has a profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setMessage(profileError.message);
        return;
      }

      // 3. If no profile exists, create one
      if (!profile) {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            full_name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              "",
            avatar_url:
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              "",
          })
          .select("full_name, avatar_url")
          .single();

        if (insertError) {
          setMessage(insertError.message);
          return;
        }

        setName(newProfile.full_name ?? "");
        setAvatarUrl(newProfile.avatar_url ?? "");
      } else {
        // 4. Profile already exists
        setName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      }

      setMessage("");
    }

    loadProfile();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <main>
      <h1>LearnMate Dashboard</h1>

      {message ? (
        <p>{message}</p>
      ) : (
        <>
          <p>Logged in as: {email}</p>

          <p>Name: {name || "No name set"}</p>

          {avatarUrl && (
            <img
              src={avatarUrl}
              alt="Profile"
              width={80}
              height={80}
            />
          )}

          <button onClick={logout}>Logout</button>
        </>
      )}
    </main>
  );
}

