import { redirect } from "next/navigation";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const metadata = { title: "Sign in · Kinpin Arts CRM" };

export default async function LoginPage() {
  if (await getChatGPTUser()) redirect("/");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#130a18",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "40px 32px",
          textAlign: "center",
          background: "#1b1020",
          border: "1px solid #38203c",
          borderRadius: 12,
          boxShadow: "0 8px 26px #14061c66",
        }}
      >
        <img
          src="/kinpin-logo-white.svg"
          alt="Kinpin Arts Media"
          style={{ width: 157, height: 56, objectFit: "contain", margin: "0 auto" }}
        />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "24px 0 8px", color: "#f5f0f6" }}>
          Sign in
        </h1>
        <p style={{ fontSize: 14, color: "#beb0c5", margin: "0 0 28px" }}>
          Sign in to open the Kinpin Arts CRM.
        </p>
        <a
          href={chatGPTSignInPath("/")}
          style={{
            display: "block",
            padding: "12px 16px",
            borderRadius: 8,
            background: "#dd1c49",
            color: "#fff",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Sign in with ChatGPT
        </a>
      </section>
    </main>
  );
}
