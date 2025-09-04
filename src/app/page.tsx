import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  return (
    <div className="flex gap-4 m-2">
      <h1 className="text-3xl font-bold underline">Hello, Next.js!</h1>
      <Button variant={"destructive"}>Click Me</Button>
      <Button variant={"secondary"}>Click Me</Button>
      <Button variant={"muted"}>Click Me</Button>
      <Button variant={"teritary"}>Click Me</Button>
      <Button disabled>Click Me</Button>
      <Button>Click Me</Button>
      <Input placeholder="Type here..." />
    </div>
  );
}
