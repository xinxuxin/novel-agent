import { app, Menu, type MenuItemConstructorOptions } from "electron";

export function installChineseApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "文炉写作台",
      submenu: [
        { label: "关于文炉写作台", role: "about" },
        { type: "separator" },
        { label: "隐藏文炉写作台", role: "hide" },
        { label: "隐藏其他应用", role: "hideOthers" },
        { label: "显示全部", role: "unhide" },
        { type: "separator" },
        { label: "退出文炉写作台", role: "quit" }
      ]
    },
    {
      label: "文件",
      submenu: [{ label: "关闭窗口", role: "close" }]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { label: "开发者工具", role: "toggleDevTools" },
        { type: "separator" },
        { label: "实际大小", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { type: "separator" },
        { label: "切换全屏", role: "togglefullscreen" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        { label: "缩放", role: "zoom" },
        { type: "separator" },
        { label: "前置全部窗口", role: "front" }
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "文炉写作台信息",
          click: () => {
            const name = app.getName();
            const version = app.getVersion();
            app.setAboutPanelOptions({
              applicationName: name,
              applicationVersion: version,
              version
            });
            Menu.sendActionToFirstResponder("orderFrontStandardAboutPanel:");
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
