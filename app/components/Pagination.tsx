import Link from "next/link";

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Pages"><Link className={page === 1 ? "disabled" : ""} href={href(Math.max(1, page - 1))}>Previous</Link>{Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => <Link className={number === page ? "active" : ""} href={href(number)} key={number}>{number}</Link>)}<Link className={page === totalPages ? "disabled" : ""} href={href(Math.min(totalPages, page + 1))}>Next</Link></nav>;
}
