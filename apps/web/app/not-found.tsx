import Link from "next/link";
export default function Missing() {
	return (
		<>
			<h1>No page at this address.</h1>
			<Link href="/">Return to Errata</Link>
		</>
	);
}
