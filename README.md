# QX Script Converter

这个工具可以自动从 QuantumultX 脚本中提取信息并生成标准格式的 Loon 插件和 Surge 模块。

## 功能

- 自动提取脚本中的应用名称和作者信息
- 识别 URL 模式、脚本路径和主机名
- 自动匹配应用类别（✅签到、🚫广告、🔐APP、🛠️工具）
- 生成标准格式的 Loon 插件和 Surge 模块配置文件
- 通过 GitHub Actions 自动化整个流程

## 目录结构

```
├── qx/               # 存放 QuantumultX 脚本
├── loon/             # 生成的 Loon 插件
├── surge/            # 生成的 Surge 模块
├── script-converter.js  # 转换脚本
└── .github/workflows/   # GitHub Actions 工作流配置
```

## 使用方法

### 本地使用

1. 克隆仓库到本地
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

2. 将 QuantumultX 脚本放入 `qx` 目录

3. 运行转换脚本
   ```bash
   node script-converter.js ./qx
   ```

4. 转换后的 Loon 插件和 Surge 模块将分别生成在 `loon` 和 `surge` 目录中

### 自动化流程（GitHub Actions）

1. Fork 这个仓库

2. 启用 GitHub Actions

3. 将 QuantumultX 脚本推送到 `qx` 目录
   ```bash
   git add qx/your-script.js
   git commit -m "Add new script"
   git push
   ```

4. GitHub Actions 会自动运行并生成相应的 Loon 插件和 Surge 模块

## 脚本格式要求

为了确保转换脚本能够正确提取信息，QuantumultX 脚本应包含以下格式的注释：

```javascript
/*
📜 ✨ 应用名称 ✨
...其他注释内容...
*/

[rewrite_local] // Quantumult X
^https:\/\/api\.example\.com\/v1\/profile url script-response-body https://raw.githubusercontent.com/yourusername/Script/main/qx/example.js

[MITM]
hostname = api.example.com
```

## 自定义配置

您可以通过修改 `script-converter.js` 文件中的 `config` 对象来自定义转换行为：

```javascript
const config = {
  // 图标路径前缀
  iconBaseUrl: 'https://raw.githubusercontent.com/yourusername/icons/main/icon/',
  // 输出目录
  outputDirs: {
    loon: './loon',
    surge: './surge'
  },
  // 应用类别映射
  appCategories: {
    default: "🔐APP",
    keywords: {
      "签到": "✅签到",
      "广告": "🚫广告",
      "工具": "🛠️工具"
    }
  }
};
```

## 许可证

MIT
