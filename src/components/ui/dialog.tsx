"use client";
import * as React from "react";
import { Dialog as Primitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog=Primitive.Root;
export function DialogContent({children,className,...props}:React.ComponentProps<typeof Primitive.Content>){return <Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px]"/><Primitive.Content className={cn("fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-6 shadow-xl outline-none",className)} {...props}>{children}<Primitive.Close aria-label="Đóng hộp thoại" className="absolute right-4 top-4 rounded-md p-2 text-muted-foreground hover:bg-accent focus-visible:outline-2"><X className="size-4"/></Primitive.Close></Primitive.Content></Primitive.Portal>;}
export const DialogTitle=Primitive.Title;
export const DialogDescription=Primitive.Description;
