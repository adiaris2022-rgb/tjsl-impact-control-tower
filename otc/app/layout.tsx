import "../../app/globals.css";
import type { Metadata } from "next";
export const metadata: Metadata={title:"NORTAGO OTC",description:"Owner Control Tower commerce layer"};
export default function Layout({children}:{children:React.ReactNode}){return <div className="otc-wrap">{children}</div>}
