import { redirect } from "next/navigation";

// Registration removed — the platform runs in live no-login mode.
export default function RegisterPage() {
  redirect("/dashboard");
}

