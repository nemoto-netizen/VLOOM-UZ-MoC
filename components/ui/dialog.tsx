"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className = "",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={`fixed inset-0 z-50 bg-black/30 ${className}`}
      {...props}
    />
  );
}

export function DialogContent({
  className = "",
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-xl ${className}`}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({
  className = "",
  ...props
}: React.ComponentProps<"div">) {
  return <div className={`flex flex-col space-y-1.5 ${className}`} {...props} />;
}

export function DialogFooter({
  className = "",
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={`mt-6 flex items-center justify-end gap-2 ${className}`}
      {...props}
    />
  );
}

export function DialogTitle({
  className = "",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={`text-sm font-semibold text-gray-800 ${className}`}
      {...props}
    />
  );
}

export function DialogDescription({
  className = "",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={`text-xs text-gray-500 ${className}`}
      {...props}
    />
  );
}
