const fs = require('fs');
const path = require('path');

// 配置
const config = {
  // 图标路径前缀
  iconBaseUrl: 'https://raw.githubusercontent.com/Mikephie/icons/main/icon/',
  // 输出目录
  outputDirs: {
    loon: './loon',
    surge: './surge'
  },
  // 应用类别映射 (可以根据关键词自动分类)
  appCategories: {
    default: "🔐APP",
    keywords: {
      "签到": "✅签到",
      "广告": "🚫广告",
      "工具": "🛠️工具"
    }
  }
};

/**
 * 解析QX脚本，提取必要信息
 * @param {string} scriptContent - QX脚本内容
 * @returns {Object} 解析后的脚本信息
 */
function parseQxScript(scriptContent) {
  // 提取应用名称 (通常在注释或者脚本名中)
  let appName = '';
  const nameMatch = scriptContent.match(/[\*📜]\s*✨\s*([^✨]+)\s*✨/);
  if (nameMatch && nameMatch[1]) {
    appName = nameMatch[1].trim();
  }
  
  // 提取作者信息 (可能在注释中)
  let author = '🅜ⓘ🅚ⓔ🅟ⓗ🅘ⓔ'; // 默认作者
  
  // 提取URL模式
  const patternMatch = scriptContent.match(/pattern=([^,]+)|url\s+([^\s]+)/);
  const pattern = patternMatch ? (patternMatch[1] || patternMatch[2]) : '';
  
  // 提取脚本路径
  const scriptPathMatch = scriptContent.match(/script-path=([^,\s]+)|script-response-body\s+([^\s]+)/);
  const scriptPath = scriptPathMatch ? (scriptPathMatch[1] || scriptPathMatch[2]) : '';
  
  // 提取主机名
  const hostnameMatch = scriptContent.match(/hostname\s*=\s*([^\s]+)/);
  const hostname = hostnameMatch ? hostnameMatch[1] : '';
  
  // 确定应用类别
  let appCategory = config.appCategories.default;
  for (const [keyword, category] of Object.entries(config.appCategories.keywords)) {
    if (scriptContent.toLowerCase().includes(keyword.toLowerCase())) {
      appCategory = category;
      break;
    }
  }
  
  // 从应用名称生成图标文件名
  const iconFileName = appName.toLowerCase().replace(/\s+/g, '') + '.png';
  const iconUrl = `${config.iconBaseUrl}${iconFileName}`;
  
  return {
    appName,
    author,
    pattern,
    scriptPath,
    hostname,
    appCategory,
    iconUrl
  };
}

/**
 * 生成Loon插件内容
 * @param {Object} scriptInfo - 脚本信息
 * @returns {string} Loon插件内容
 */
function generateLoonPlugin(scriptInfo) {
  const { appName, author, pattern, scriptPath, hostname, appCategory, iconUrl } = scriptInfo;
  
  return `#!name = ${appName} ${appCategory}
#!desc = 插件
#!author = ${author}
#!icon = ${iconUrl}
#!appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"

[Script]
http-response ${pattern} script-path=${scriptPath}, requires-body=true, timeout=60, tag=${appName.toLowerCase()}

[MITM]
hostname = ${hostname}
`;
}

/**
 * 生成Surge模块内容
 * @param {Object} scriptInfo - 脚本信息
 * @returns {string} Surge模块内容
 */
function generateSurgeModule(scriptInfo) {
  const { appName, author, pattern, scriptPath, hostname, appCategory, iconUrl } = scriptInfo;
  
  return `#!name = ${appName} ${appCategory}
#!desc = 网页游览 - 模块
#!author = ${author}
#!category=${appCategory}
#!icon = ${iconUrl}

[Script]
${appName} = type=http-response, pattern=${pattern}, script-path=${scriptPath}, requires-body=true, max-size=-1, timeout=60

[MITM]
hostname = %APPEND% ${hostname}
`;
}

/**
 * 处理单个QX脚本文件
 * @param {string} filePath - QX脚本文件路径
 */
function processQxScript(filePath) {
  try {
    const scriptContent = fs.readFileSync(filePath, 'utf8');
    const scriptInfo = parseQxScript(scriptContent);
    const fileName = path.basename(filePath, '.js');
    
    // 确保输出目录存在
    if (!fs.existsSync(config.outputDirs.loon)) {
      fs.mkdirSync(config.outputDirs.loon, { recursive: true });
    }
    if (!fs.existsSync(config.outputDirs.surge)) {
      fs.mkdirSync(config.outputDirs.surge, { recursive: true });
    }
    
    // 生成并写入Loon插件
    const loonContent = generateLoonPlugin(scriptInfo);
    fs.writeFileSync(`${config.outputDirs.loon}/${fileName}.plugin`, loonContent);
    
    // 生成并写入Surge模块
    const surgeContent = generateSurgeModule(scriptInfo);
    fs.writeFileSync(`${config.outputDirs.surge}/${fileName}.sgmodule`, surgeContent);
    
    console.log(`Successfully processed: ${fileName}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

/**
 * 处理QX脚本目录下的所有脚本
 * @param {string} directoryPath - QX脚本目录路径
 */
function processQxDirectory(directoryPath) {
  try {
    const files = fs.readdirSync(directoryPath);
    
    files.forEach(file => {
      const filePath = path.join(directoryPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && path.extname(file).toLowerCase() === '.js') {
        processQxScript(filePath);
      }
    });
    
    console.log('All scripts processed successfully');
  } catch (error) {
    console.error('Error processing directory:', error);
  }
}

// 如果直接运行脚本，则处理指定目录
if (require.main === module) {
  const qxDirectoryPath = process.argv[2] || './qx';
  processQxDirectory(qxDirectoryPath);
}

// 导出函数以便测试或模块化使用
module.exports = {
  parseQxScript,
  generateLoonPlugin,
  generateSurgeModule,
  processQxScript,
  processQxDirectory
};