import Link from "next/link";

export function Navbar() {
  return (
    <nav style={{ padding: "10px", background: "#3b82f6", color: "white" }}>
      <Link href="/">Home</Link> | <Link href="/login">Login</Link> |{" "}
      <Link href="/profile">Profile</Link> | <Link href="/game">Game</Link>
    </nav>
  );
}