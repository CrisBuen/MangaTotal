import { redirect } from "next/navigation";

export default function Home() {
  // la biblioteca es la portada — visible también sin sesión
  redirect("/biblioteca");
}
