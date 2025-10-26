import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function getSession() {
  const asd = await getServerSession(authOptions);
  return asd;
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return {
        message: "User is not authorized",
        authorized: false,
        response: NextResponse.json(
            {error: "Unauthorized. Please sign in"},
            {status: 401}
        )
    };
  }

  const userId = session.user.id;

  return {
    authorized: true,
    userId: userId,
    session,
    response: NextResponse.json(
        {message: "Auth success"},
        {status: 200}
    )
  }
}
