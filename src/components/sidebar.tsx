import Image from "next/image";
import Link from "next/link";
import React from "react";
import { DottedSeparator } from "./dotted-separator";
import Navigation from "./navigation";
import WorkspaceSwitcher from "./workspace-switcher";
import { Projects } from "./projects";

const Sidebar = () => {
  return (
    <aside className="h-full bg-muted p-4 w-full">
      <Link href="/" className="flex items-center gap-2 w-full cursor-pointer">
        <Image src="/logo.svg" alt="logo" width={48} height={48} />
        <span className="text-2xl font-semibold">Align</span>
      </Link>
      <DottedSeparator className="my-4" />
      <WorkspaceSwitcher />
      <DottedSeparator className="my-4" />
      <Navigation />
      <DottedSeparator className="my-4" />
      <Projects />
    </aside>
  );
};

export default Sidebar;
