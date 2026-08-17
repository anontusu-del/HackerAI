import { redirect } from "next/navigation";

// Login removed — the platform runs in live no-login mode.
export default function LoginPage() {
  redirect("/dashboard");
}

