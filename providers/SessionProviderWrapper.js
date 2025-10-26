"use client"

import { SessionProvider } from "next-auth/react"

export const SessionProviderWrapper = ({children}) => {
    return <SessionProvider>
        {children}
    </SessionProvider>
}