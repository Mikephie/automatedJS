const fs = require('fs');
const path = require('path');

/**
 * 解析QX脚本，提取必要信息
 * @param {string} scriptContent - QX脚本内容
 * @returns {Object} 解析后的脚本信息
 */
function parseQxScript(scriptContent) {
  // 提取应用名称
  let appName = '';
  const nameMatch = scriptContent.match(/📜\s*✨\s*([^✨]+)\s*✨/);
  if (nameMatch && nameMatch[1]) {
    appName = nameMatch[1].trim();
  }
  
  // 提取作者信息 (默认作者)
  const author = '🅜ⓘ🅚ⓔ🅟ⓗ🅘ⓔ';
  
  // 提取URL模式 (从QX部分)
  let pattern = '';
  const qxPatternMatch = scriptContent.match(/\[rewrite_local\].*?\n(.*?)\s+url\s+script-response-body/s);
  if (qxPatternMatch && qxPatternMatch[1]) {
    pattern = qxPatternMatch[1].trim();
  }
  
  // 如果QX部分没有，尝试从Loon部分提取
  if (!pattern) {
    const loonPatternMatch = scriptContent.match(/\[Script\].*?Loon.*?\nhttp-response\s+(.*?)\s+script-path/s);
    if (loonPatternMatch && loonPatternMatch[1]) {
      pattern = loonPatternMatch[1].trim();
    }
  }
  
  // 如果还是没有，尝试从Surge部分提取
  if (!pattern) {
    const surgePatternMatch = scriptContent.match(/\[Script\].*?Surge.*?\n.*?pattern=(.*?),/s);
    if (surgePatternMatch && surgePatternMatch[1]) {
      pattern = surgePatternMatch[1].trim();
    }
  }
  
  // 提取脚本路径
  let scriptPath = '';
  const scriptPathMatch = scriptContent.match(/script-(?:path|response-body)\s+(https:\/\/[^\s,]+)/);
  if (scriptPathMatch && scriptPathMatch[1]) {
    scriptPath = scriptPathMatch[1];
  }
  
  // 提取主机名
  let hostname = '';
  const hostnameMatch = scriptContent.match(/hostname\s*=\s*([^\s]+)/);
  if (hostnameMatch && hostnameMatch[1]) {
    hostname = hostnameMatch[1];
  }
  
  // 生成图标URL
  const iconFileName = appName.toLowerCase().replace(/\s+/g, '') + '.png';
  const iconUrl = `https://raw.githubusercontent.com/Mikephie/icons/main/icon/${iconFileName}`;
  
  // 默认应用类别
  const appCategory = '🔐APP';
  
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
#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"

[Script]
http-response ${pattern} script-path=${scriptPath}, requires-body=true, timeout=60, tag=${appName.toLowerCase()}

[MITM]
hostname = ${hostname}`;
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
hostname = %APPEND% ${hostname}`;
}

/**
 * 处理单个QX脚本文件
 * @param {string} filePath - QX脚本文件路径
 * @param {Object} outputDirs - 输出目录配置
 */
function processQxScript(filePath, outputDirs) {
  try {
    const scriptContent = fs.readFileSync(filePath, 'utf8');
    const scriptInfo = parseQxScript(scriptContent);
    
    // 如果没有提取到应用名称，使用文件名
    if (!scriptInfo.appName) {
      const fileName = path.basename(filePath, '.js');
      scriptInfo.appName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
      // 更新图标URL
      scriptInfo.iconUrl = `https://raw.githubusercontent.com/Mikephie/icons/main/icon/${fileName}.png`;
    }
    
    // 确保路径和主机名非空
    if (!scriptInfo.pattern || !scriptInfo.scriptPath || !scriptInfo.hostname) {
      console.warn(`警告: ${filePath} 缺少必要信息，跳过转换`);
      return;
    }
    
    const fileName = path.basename(filePath, '.js');
    
    // 生成并写入Loon插件
    const loonContent = generateLoonPlugin(scriptInfo);
    const loonOutputPath = path.join(outputDirs.loon, `${fileName}.plugin`);
    fs.writeFileSync(loonOutputPath, loonContent);
    
    // 生成并写入Surge模块
    const surgeContent = generateSurgeModule(scriptInfo);
    const surgeOutputPath = path.join(outputDirs.surge, `${fileName}.sgmodule`);
    fs.writeFileSync(surgeOutputPath, surgeContent);
    
    console.log(`成功处理: ${fileName}`);
    console.log(`- Loon插件: ${loonOutputPath}`);
    console.log(`- Surge模块: ${surgeOutputPath}`);
  } catch (error) {
    console.error(`处理 ${filePath} 时出错:`, error);
  }
}

/**
 * 处理QX脚本目录下的所有脚本
 * @param {string} directoryPath - QX脚本目录路径
 * @param {Object} outputDirs - 输出目录配置
 */
function processQxDirectory(directoryPath, outputDirs) {
  try {
    // 确保输出目录存在
    if (!fs.existsSync(outputDirs.loon)) {
      fs.mkdirSync(outputDirs.loon, { recursive: true });
    }
    if (!fs.existsSync(outputDirs.surge)) {
      fs.mkdirSync(outputDirs.surge, { recursive: true });
    }
    
    const files = fs.readdirSync(directoryPath);
    let processedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(directoryPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile() && path.extname(file).toLowerCase() === '.js') {
        processQxScript(filePath, outputDirs);
        processedCount++;
      }
    });
    
    console.log(`处理完成，共处理 ${processedCount} 个脚本`);
  } catch (error) {
    console.error('处理目录时出错:', error);
  }
}

// 主函数
function main() {
  // 配置
  const config = {
    qxDir: process.argv[2] || './qx',
    outputDirs: {
      loon: process.argv[3] || './loon',
      surge: process.argv[4] || './surge'
    }
  };
  
  console.log('开始转换脚本...');
  console.log(`- QX脚本目录: ${config.qxDir}`);
  console.log(`- Loon输出目录: ${config.outputDirs.loon}`);
  console.log(`- Surge输出目录: ${config.outputDirs.surge}`);
  
  processQxDirectory(config.qxDir, config.outputDirs);
}

// 当直接运行脚本时执行主函数
if (require.main === module) {
  main();
}

// 导出函数以便测试或模块化使用
module.exports = {
  parseQxScript,
  generateLoonPlugin,
  generateSurgeModule,
  processQxScript,
  processQxDirectory
};