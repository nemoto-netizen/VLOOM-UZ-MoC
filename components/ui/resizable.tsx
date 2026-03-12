"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
} from "react-resizable-panels";

export function ResizablePanelGroup({
  direction = "horizontal",
  className = "",
  ...props
}: React.ComponentProps<typeof Group> & {
  direction?: "horizontal" | "vertical";
}) {
  return (
    <Group
      orientation={direction}
      className={`flex h-full w-full data-[panel-group-direction=vertical]:flex-col ${className}`}
      {...props}
    />
  );
}

export const ResizablePanel = Panel;

export function ResizableHandle({
  withHandle,
  className = "",
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) {
  return (
    <Separator
      className={`relative flex w-px items-center justify-center bg-gray-200 after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 after:content-[''] hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-8 w-4 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
          <GripVertical className="h-3 w-3 text-gray-500" />
        </div>
      ) : null}
    </Separator>
  );
}
