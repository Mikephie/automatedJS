import * as fs from 'fs-extra';
import * as path from 'path';

// 定义输入和输出目录
const QUANTUMULTX_DIR = 'QuantumultX';
const LOON_OUTPUT_DIR = 'Loon/plugins';
const SURGE_OUTPUT_DIR = 'Surge/modules';

// 定义脚本类型
type ScriptType = {
  fileName: string;      // 原始文件名
  appName?: string;      // 应用名称
  author?: string;       // 作者
  scriptPath?: string;   // 脚本路径
  patterns?: string[];   // URL模式
  hostnames?: string[];  // 主机名
};

/**
 * 获取所有QuantumultX脚本文件
 */
async function getQuantumultXScripts(): Promise<string[]> {
  try {
    const files = await fs.readdir(QUANTUMULTX_DIR);
    return files
      .filter(file => file.endsWith('.js') || file.endsWith('.conf'))
      .map(file => path.join(QUANTUMULTX_DIR, file));
  } catch (err) {
    console.error('Error reading QuantumultX directory:', err);
    return [];
  }
}

/**
 * 从脚本文件中提取关键信息
 */
async function extractScriptInfo(filePath: string): Promise<ScriptType> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath).replace(/\.(js|conf)$/, '');
    
    // 提取应用名称
    const appNameMatch = content.match(/const\s+appName\s*=\s*["']([^"']+)["']/);
    const appName = appNameMatch 
      ? appNameMatch[1].replace(/✨/g, '').trim() 
      : fileName;
    
    // 提取作者
    const authorMatch = content.match(/const\s+author\s*=\s*["']([^"']+)["']/);
    const author = authorMatch ? authorMatch[1] : '🅜ⓘ🅚ⓔ🅟ⓗ🅘ⓔ';
    
    // 提取URL模式
    const patterns: string[] = [];
    
    // 从各种格式中提取URL模式
    const patternRegexes = [
      /pattern=([^,"\s]+)/g,             // Surge格式
      /http-response\s+([^\s,]+)/g,      // Loon格式
      /url\s+script-[^-]+-[^-]+\s+([^\s]+)/g  // QuantumultX格式
    ];
    
    patternRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1] && !patterns.includes(match[1])) {
          patterns.push(match[1]);
        }
      }
    });
    
    // 提取脚本路径
    let scriptPath = '';
    const scriptPathMatch = content.match(/script-path=([^,\s]+)/i) || 
                           content.match(/script-response-body\s+([^\s]+)/i);
    
    if (scriptPathMatch) {
      scriptPath = scriptPathMatch[1];
    }
    
    // 提取MITM主机名
    const hostnames: string[] = [];
    const hostnameMatches = content.match(/hostname\s*=\s*[%APPEND%\s]*([^,\n]+)/g);
    
    if (hostnameMatches) {
      hostnameMatches.forEach(match => {
        const hostnameStr = match.replace(/hostname\s*=\s*(%APPEND%\s*)?/, '').trim();
        const hosts = hostnameStr.split(',').map(h => h.trim());
        hosts.forEach(host => {
          if (host && !hostnames.includes(host)) {
            hostnames.push(host);
          }
        });
      });
    }
    
    return {
      fileName,
      appName,
      author,
      scriptPath,
      patterns,
      hostnames
    };
  } catch (err) {
    console.error(`Error extracting info from ${filePath}:`, err);
    throw err;
  }
}

/**
 * 生成Loon插件
 */
function generateLoonPlugin(scriptInfo: ScriptType): string {
  const { appName, author, scriptPath, patterns, hostnames } = scriptInfo;
  // 使用应用名小写且没有空格作为图标名和tag名
  const iconName = appName ? appName.toLowerCase().replace(/\s+/g, '') : scriptInfo.fileName.toLowerCase();
  const tagName = iconName;
  
  let loonConfig = `#!name = ${appName} 🔐APP\n`;
  loonConfig += `#!desc = 插件\n`;
  loonConfig += `#!author = ${author}\n`;
  loonConfig += `#!icon = https://raw.githubusercontent.com/Mikephie/icons/main/icon/${iconName}.png\n`;
  loonConfig += `#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"\n\n`;
  
  if (patterns && patterns.length > 0 && scriptPath) {
    loonConfig += `[Script]\n`;
    // 使用第一个模式
    loonConfig += `http-response ${patterns[0]} script-path=${scriptPath}, requires-body=true, timeout=60, tag=${tagName}\n\n`;
  }
  
  if (hostnames && hostnames.length > 0) {
    loonConfig += `[MITM]\n`;
    loonConfig += `hostname = ${hostnames.join(', ')}\n`;
  }
  
  return loonConfig;
}

/**
 * 生成Surge模块
 */
function generateSurgeModule(scriptInfo: ScriptType): string {
  const { appName, author, scriptPath, patterns, hostnames } = scriptInfo;
  // 使用应用名小写且没有空格作为图标名
  const iconName = appName ? appName.toLowerCase().replace(/\s+/g, '') : scriptInfo.fileName.toLowerCase();
  
  let surgeConfig = `#!name = ${appName} 🔐APP\n`;
  surgeConfig += `#!desc = 网页游览 - 模块\n`;
  surgeConfig += `#!author = ${author}\n`;
  surgeConfig += `#!category=🔐APP\n`;
  surgeConfig += `#!icon = https://raw.githubusercontent.com/Mikephie/icons/main/icon/${iconName}.png\n\n`;
  
  if (patterns && patterns.length > 0 && scriptPath) {
    surgeConfig += `[Script]\n`;
    // 使用第一个模式
    surgeConfig += `${appName} = type=http-response, pattern=${patterns[0]}, script-path=${scriptPath}, requires-body=true, max-size=-1, timeout=60\n\n`;
  }
  
  if (hostnames && hostnames.length > 0) {
    surgeConfig += `[MITM]\n`;
    surgeConfig += `hostname = %APPEND% ${hostnames.join(', ')}\n`;
  }
  
  return surgeConfig;
}

/**
 * 保存配置到文件，只有当文件不存在或内容变化时才写入
 */
async function saveConfig(
  outputDir: string, 
  fileName: string, 
  content: string,
  extension: string
): Promise<boolean> {
  try {
    const outputPath = path.join(outputDir, `${fileName}${extension}`);
    
    // 检查文件是否已存在
    let fileChanged = true;
    try {
      const existingContent = await fs.readFile(outputPath, 'utf8');
      // 如果内容完全相同，不需要重写
      if (existingContent === content) {
        console.log(`File ${outputPath} already exists with identical content, skipping`);
        fileChanged = false;
      }
    } catch (err) {
      // 文件不存在，需要创建
      console.log(`File ${outputPath} does not exist, creating new file`);
    }
    
    // 只有当文件不存在或内容变化时才写入
    if (fileChanged) {
      await fs.writeFile(outputPath, content, 'utf8');
      console.log(`Successfully saved to ${outputPath}`);
    }
    
    return fileChanged;
  } catch (err) {
    console.error(`Error saving file ${fileName}:`, err);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const scriptFiles = await getQuantumultXScripts();
    console.log(`Found ${scriptFiles.length} QuantumultX scripts`);
    
    let hasChanges = false;
    
    for (const filePath of scriptFiles) {
      const scriptInfo = await extractScriptInfo(filePath);
      console.log(`Processing ${scriptInfo.fileName}...`);
      
      // 生成Loon插件
      const loonConfig = generateLoonPlugin(scriptInfo);
      const loonChanged = await saveConfig(
        LOON_OUTPUT_DIR, 
        scriptInfo.fileName, 
        loonConfig, 
        '.plugin'
      );
      
      // 生成Surge模块
      const surgeConfig = generateSurgeModule(scriptInfo);
      const surgeChanged = await saveConfig(
        SURGE_OUTPUT_DIR, 
        scriptInfo.fileName, 
        surgeConfig, 
        '.sgmodule'
      );
      
      // 如果任一文件有变化，记录有更改
      if (loonChanged || surgeChanged) {
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      console.log('Processing completed with changes!');
      // 设置GitHub Actions输出变量
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_file_changes=true\n');
      }
    } else {
      console.log('Processing completed, no changes detected.');
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_file_changes=false\n');
      }
    }
  } catch (err) {
    console.error('Error in main process:', err);
    process.exit(1);
  }
}

// 执行主函数
main();