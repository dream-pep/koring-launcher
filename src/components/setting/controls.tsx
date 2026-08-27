// 可复用设置控件：HeroUI 3 复合组件封装，统一风格，绑定 configStore setter 自动保存。
// 每个控件都遵循 label / desc / value / onChange 通用接口。

import { useState } from "react";
import {
  Button,
  Input,
  ListBox,
  ListBoxItem,
  NumberField,
  Radio,
  RadioGroup,
  Select,
  Switch,
  TextArea,
} from "@heroui/react";
import { Check, ChevronDown, FolderOpen, FolderSearch, Loader2 } from "lucide-react";
import { ipcInvoke } from "@/api/ipc";
import { SettingRow } from "./SettingRow";

export interface SettingOption {
  value: string;
  label: string;
  desc?: string;
}

// HeroUI 默认主题 field 边框宽度为 0（--field-border-width: 0px），
// 统一补上与 Select.Trigger 一致的显式边框/背景，保证控件视觉完整。
export const fieldCls =
  "rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 transition-colors";

// ---------- 下拉选择 ----------
export function SettingSelect({
  label,
  desc,
  value,
  options,
  onChange,
  placeholder = "请选择",
  className,
}: {
  label: string;
  desc?: string;
  value: string;
  options: SettingOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const selectedKey = options.some((o) => o.value === value) ? value : "__none__";
  return (
    <SettingRow label={label} desc={desc}>
      <Select.Root
        selectedKey={selectedKey}
        onSelectionChange={(keys) => {
          // RAC 单选时可能传 Key | null，也可能传 Set<Key>；两种形状都兼容
          let v: string | undefined;
          if (keys === null || keys === undefined) {
            v = undefined;
          } else if (typeof keys === "string" || typeof keys === "number") {
            v = String(keys);
          } else if ((keys as unknown) instanceof Set) {
            const arr = Array.from(keys);
            v = arr.length > 0 ? String(arr[0]) : undefined;
          }
          if (v && v !== "__none__") onChange(v);
        }}
        className={className}
      >
        <Select.Trigger className="h-8 rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 hover:border-primary/30 transition-colors">
          <Select.Value className="text-[13px] text-foreground">
            {options.find((o) => o.value === value)?.label ?? placeholder}
          </Select.Value>
          <Select.Indicator>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
          </Select.Indicator>
        </Select.Trigger>
        <Select.Popover className="z-50 rounded-xl border border-border/50 dark:border-white/[0.08] bg-background shadow-xl p-1.5 min-w-[10rem]">
          <ListBox className="max-h-72 overflow-y-auto scroll-area outline-none">
            {options.map((opt) => (
              <ListBoxItem
                key={opt.value}
                id={opt.value}
                className="text-[13px] py-1.5 px-2.5 rounded-lg data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary outline-none cursor-pointer"
              >
                {opt.label}
              </ListBoxItem>
            ))}
          </ListBox>
        </Select.Popover>
      </Select.Root>
    </SettingRow>
  );
}

// ---------- 数字输入 ----------
export function SettingNumberField({
  label,
  desc,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  className,
}: {
  label: string;
  desc?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <SettingRow label={label} desc={desc}>
      <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
        <NumberField.Root
          value={value}
          onChange={onChange}
          minValue={min}
          maxValue={max}
          step={step}
          className="w-28"
        >
          <NumberField.Group className="flex items-center rounded-lg border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 overflow-hidden focus-within:border-primary/40 transition-colors">
            <NumberField.DecrementButton
              aria-label="减少"
              className="flex items-center justify-center w-7 h-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] cursor-pointer select-none"
            >
              −
            </NumberField.DecrementButton>
            <NumberField.Input className="w-14 h-8 bg-transparent text-center text-[13px] text-foreground outline-none" />
            <NumberField.IncrementButton
              aria-label="增加"
              className="flex items-center justify-center w-7 h-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] cursor-pointer select-none"
            >
              +
            </NumberField.IncrementButton>
          </NumberField.Group>
        </NumberField.Root>
        {suffix && <span className="text-[13px] text-muted-foreground shrink-0">{suffix}</span>}
      </div>
    </SettingRow>
  );
}

// ---------- 开关 ----------
export function SettingSwitch({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <SettingRow label={label} desc={desc}>
      {/* 注：HeroUI 3 基于 react-aria，Switch 使用 onChange 而非 onValueChange */}
      <Switch isSelected={checked} onChange={onChange}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch>
    </SettingRow>
  );
}

// ---------- 单选组 ----------
export function SettingRadioGroup({
  label,
  desc,
  value,
  options,
  onChange,
  horizontal = false,
}: {
  label?: string;
  desc?: string;
  value: string;
  options: SettingOption[];
  onChange: (v: string) => void;
  horizontal?: boolean;
}) {
  return (
    <div>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {desc && <p className="text-[13px] text-muted-foreground mt-0.5 mb-2">{desc}</p>}
      <RadioGroup
        value={value}
        onChange={(v) => onChange(String(v))}
        className={horizontal ? "flex items-center gap-4" : "space-y-2"}
      >
        {options.map((opt) => (
          <Radio key={opt.value} value={opt.value}>
            <Radio.Control className="border border-border/40 dark:border-white/[0.08] bg-white/60 dark:bg-black/30">
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>{opt.label}</Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
}

// ---------- 多行文本 ----------
export function SettingTextArea({
  label,
  desc,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  desc?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {desc && <p className="text-[13px] text-muted-foreground">{desc}</p>}
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        fullWidth
        className={fieldCls}
      />
    </div>
  );
}

// ---------- 文本输入 + 浏览按钮 ----------
export function SettingFilePicker({
  label,
  desc,
  value,
  onChange,
  placeholder,
  mode = "file",
  filters,
  showCheck,
}: {
  label: string;
  desc?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** file：选择文件；folder：选择文件夹 */
  mode?: "file" | "folder";
  filters?: { name: string; extensions: string[] }[];
  /** 显示路径校验通过标记（配合外部 resolveJava 校验） */
  showCheck?: boolean;
}) {
  const [browsing, setBrowsing] = useState(false);

  const handleBrowse = async () => {
    setBrowsing(true);
    try {
      if (mode === "file") {
        const result = await ipcInvoke<{ srcPath: string; ext: string } | null>("dialog:openFile", {
          filters,
        });
        if (result) onChange(result.srcPath);
      } else {
        const result = await ipcInvoke<{ folderPath: string } | null>("dialog:openFolder");
        if (result) onChange(result.folderPath);
      }
    } catch {
      // 对话框取消或失败则忽略
    } finally {
      setBrowsing(false);
    }
  };

  return (
    <div>
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      {desc && <p className="text-[13px] text-muted-foreground mt-0.5 mb-2">{desc}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 relative">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            fullWidth
            className={fieldCls}
          />
          {showCheck && value && (
            <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
          )}
        </div>
        <Button size="sm" variant="outline" onPress={handleBrowse} isDisabled={browsing} className="shrink-0">
          {browsing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : mode === "file" ? (
            <FolderSearch className="w-3.5 h-3.5" />
          ) : (
            <FolderOpen className="w-3.5 h-3.5" />
          )}
          浏览
        </Button>
      </div>
    </div>
  );
}
