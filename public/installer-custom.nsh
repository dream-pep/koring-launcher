;  __         __     __   __     ______     __  __     ______        __   __     ______     ______  
; /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\ 
; \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/ 
;  \ \_____\  \ \_\  \ \_\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\"\_\  \ \_____\    \ \_\ 
;   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/ 
;                                                                                                   
; 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
; 未经允许的情况下删除此版权头可能会受到民事指控
; 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

; ============================================================
; NSIS 自定义包含脚本 - Koring Launcher
;
; 注意：此文件通过 electron-builder 配置的「nsis.include」附加在其内部
; NSIS 模板的「脚本前缀」中，会先于 installer.nsi 模板被编译，
; 因此这里定义的宏可以被 assistedInstaller.nsh 中的
; !ifmacrodef customWelcomePage 检测到。
;
; 重要约定（必须遵守，否则会导致 makensis 编译失败或
; 安装程序在语言选择后直接崩溃退出）：
;   1) 禁止再定义 .onInit / .onInstSuccess / un.onInit /
;      un.onUninstSuccess 这类全局回调函数，它们已被
;      electron-builder 模板占用。
;   2) 禁止使用 !insertmacro LANG_STRING 之类只有
;      electron-builder 内部才有的宏。
;   3) 禁止在语言宏展开前使用 LANG_SIMPCHINESE 等符号常量，
;      直接用数字 LCID（2052、1028、1033）更稳。
;   4) 如非必要，不要在 include 脚本中写未被模板实际引用
;      的 LangString / Section / Function，避免因语言包未
;      加载导致初始化阶段直接退出。
; ============================================================

; ------------------------------------------------------------
; 自定义欢迎页宏
; electron-builder 的辅助安装向导（oneClick: false）默认没有安装
; 欢迎页（只有完成页）。定义此宏后，assistedInstaller.nsh 会
; 插入 MUI_PAGE_WELCOME，使安装向导第一页显示欢迎页，
; 并展示 MUI_WELCOMEFINISHPAGE_BITMAP（即 installerSidebar 配置的
; build/installer-header.bmp 横幅图）。
; ------------------------------------------------------------
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
