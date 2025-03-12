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
# 项目结构

```
.
├── .github
│   └── workflows
│       └── convert.yml     # GitHub Actions 工作流配置
├── QuantumultX/            # 存放源 QuantumultX 脚本的目录
│   ├── script1.js          # 示例脚本文件
│   └── script2.js
├── Loon                    # Loon 插件输出目录
│   └── plugins/            # 转换后的 Loon 插件存放处
│       ├── script1.plugin
│       └── script2.plugin
├── Surge                   # Surge 模块输出目录
│   └── modules/            # 转换后的 Surge 模块存放处
│       ├── script1.sgmodule
│       └── script2.sgmodule
├── scripts/                # 存放工具脚本
│   └── convert.ts          # 转换脚本
├── README.md               # 项目说明文档
├── package.json            # Node.js 项目配置
└── tsconfig.json           # TypeScript 配置
```

## 关键文件说明

1. **`.github/workflows/convert.yml`**
   - GitHub Actions 工作流配置文件
   - 定义了自动转换的触发条件和执行步骤

2. **`scripts/convert.ts`**
   - 核心转换脚本
   - 负责解析 QuantumultX 脚本并转换为 Loon 插件和 Surge 模块格式

3. **`QuantumultX/`**
   - 存放您原始的 QuantumultX 脚本文件
   - 向此目录添加文件会触发自动转换

4. **`Loon/plugins/` 和 `Surge/modules/`**
   - 存放转换后的输出文件
   - 这些目录由转换脚本自动生成和更新
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
