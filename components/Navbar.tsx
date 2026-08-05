"use client";

import Link from "next/link";
import { BookMarked, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface Props { full_name: string; }

export default function Navbar({ full_name }: Props) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 border-b border-border bg-background/95 backdrop-blur shadow-sm flex items-center h-[calc(3.5rem_+_env(safe-area-inset-top))] pt-[env(safe-area-inset-top)]">
      <div className="max-w-4xl mx-auto w-full px-4 flex items-center justify-between">
        <Link href="/chat" className="flex items-center gap-2">
          <img src="/logo.png" alt="LingoMind Logo" className="w-7 h-7 rounded-lg object-cover border border-border" />
          <span className="text-lg font-black tracking-wider bg-gradient-to-r from-teal-600 to-teal-500 bg-clip-text text-transparent">LingoMind</span>
        </Link>
        <div className="flex items-center gap-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/flashcards"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Flashcard"
                >
                  <BookMarked className="h-4.5 w-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Flashcard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">{full_name}</span>
          <Avatar className="h-7 w-7 border border-border bg-muted">
            <AvatarFallback className="text-[10px] font-bold">{full_name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-3.5 w-3.5 mr-1" /> Keluar
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
