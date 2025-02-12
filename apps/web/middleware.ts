import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import type { NextRequest, NextFetchEvent } from "next/server"

export default clerkMiddleware({
  beforeAuth: (req: NextRequest) => {
    const isMaintenance = process.env.MAINTENANCE_MODE === "true"

    if (isMaintenance && !req.nextUrl.pathname.startsWith("/_next")) {
      return NextResponse.rewrite(new URL("/maintenance", req.url))
    }

    return NextResponse.next()
  },
})

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
}
