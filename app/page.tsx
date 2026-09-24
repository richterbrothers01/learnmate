"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export default function Home() {
  const [status, setStatus] = useState("Testing Supabase...");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then((result) => {
      if (result.error) {
        setStatus(`Supabase error: ${result.error.message}`);
      } else {
        setStatus("Supabase connected successfully!");
      }
    });
  }, []);

  return (
    <main>
      <h1>LearnMate</h1>
      <p>{status}</p>
    </main>
  );
}