interface NextButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** 向导步骤的「下一步」按钮：固定在布局底部居中（相对 WizardLayout）。 */
export function NextButton({ onClick, disabled = false }: NextButtonProps) {
  return (
    <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-12 h-12 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-[transform,background-color,color] duration-200 ease-spring-soft hover:scale-105 active:scale-95 text-xl disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 disabled:hover:bg-foreground/[0.06] disabled:hover:text-foreground/60"
      >
        →
      </button>
    </div>
  );
}
