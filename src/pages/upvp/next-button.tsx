interface NextButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** 与 OOBE 相同的下一步圆形按钮 */
export function NextButton({ onClick, disabled = false }: NextButtonProps) {
  return (
    <div className="absolute bottom-12">
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-12 h-12 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-all duration-200 text-xl disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-foreground/[0.06] disabled:hover:text-foreground/60"
      >
        →
      </button>
    </div>
  );
}
