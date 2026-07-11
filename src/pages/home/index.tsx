import { InstanceTitle } from "./InstanceTitle";
import { StartCard } from "./StartCard";

export function Home() {
  return (
    <div className="relative h-full flex flex-col justify-end items-start p-6 gap-3">
      <InstanceTitle />
      <StartCard />
    </div>
  );
}
