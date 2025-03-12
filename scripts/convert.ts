import * as fs from 'fs-extra';
import * as path from 'path';

// 定义输入和输出目录
const QUANTUMULTX_DIR = 'QuantumultX';
const LOON_OUTPUT_DIR = 'Loon/plugins';
const SURGE_OUTPUT_DIR = 'Surge/modules';

// 定义脚本类型
type ScriptType = {
  name: string;
  desc?: string;
  author?: string;
  scriptPath?: string;
  originalName?: string; // 添加原始文件名字段
  iconUrl?: string;
  patterns?: string[];
  hostnames?: string[];
  category?: string;
  content: string;
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
 * 从脚本文件中解析脚本信息
 */
async function parseScriptInfo(filePath: string): Promise<ScriptType> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath);
    // 保留原始文件名（不含扩展名）
    const originalName = fileName.replace(/\.(js|conf)$/, '');
    
    // 从脚本内容中提取App名称
    const appNameMatch = content.match(/const\s+appName\s*=\s*["']([^"']+)["']/);
    const appName = appNameMatch ? appNameMatch[1].replace(/✨/g, '').trim() : originalName;
    
    // 提取作者
    const authorMatch = content.match(/const\s+author\s*=\s*["']([^"']+)["']/);
    const author = authorMatch ? authorMatch[1] : '🅜ⓘ🅚ⓔ🅟ⓗ🅘ⓔ';
    
    // 提取URL模式
    const patterns: string[] = [];
    
    // 找出Surge格式的pattern
    const surgePatternMatches = content.match(/pattern=([^,\s]+)/g);
    if (surgePatternMatches) {
      surgePatternMatches.forEach(match => {
        const pattern = match.replace(/pattern=/, '').trim();
        if (pattern && !patterns.includes(pattern)) {
          patterns.push(pattern);
        }
      });
    }
    
    // 找出Loon格式的pattern
    const loonPatternMatches = content.match(/http-response\s+([^\s]+)/g);
    if (loonPatternMatches) {
      loonPatternMatches.forEach(match => {
        const pattern = match.replace(/http-response\s+/, '').trim();
        if (pattern && !patterns.includes(pattern)) {
          patterns.push(pattern);
        }
      });
    }
    
    // 找出QuantumultX格式的pattern
    const qxPatternMatches = content.match(/url\s+([^\s]+)/g);
    if (qxPatternMatches) {
      qxPatternMatches.forEach(match => {
        const pattern = match.replace(/url\s+/, '').trim();
        if (pattern && !patterns.includes(pattern)) {
          patterns.push(pattern);
        }
      });
    }
    
    // 提取MITM主机名
    const hostnames: string[] = [];
    const hostnameMatches = content.match(/hostname\s*=\s*([^,\n]+)/g);
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
    
    // 提取脚本路径
    let scriptPath = '';
    const scriptPathMatches = content.match(/script-path=([^,\s]+)/g);
    if (scriptPathMatches && scriptPathMatches.length > 0) {
      scriptPath = scriptPathMatches[0].replace(/script-path=/, '').trim();
    } else {
      // 从 QuantumultX 规则中提取
      const qxScriptMatch = content.match(/script-response-body\s+([^\s\n]+)/);
      if (qxScriptMatch) {
        scriptPath = qxScriptMatch[1].trim();
      }
    }
    
    return {
      name: appName,
      desc: `${appName} 解锁`,
      author,
      scriptPath,
      originalName, // 保存原始文件名
      iconUrl: `https://raw.githubusercontent.com/Mikephie/icons/main/icon/${appName.toLowerCase().replace(/\s+/g, '')}.png`,
      patterns,
      hostnames,
      category: '🔐APP',
      content
    };
  } catch (err) {
    console.error(`Error parsing script ${filePath}:`, err);
    throw err;
  }
}

/**
 * 将QuantumultX脚本转换为Loon插件
 */
function convertToLoonPlugin(script: ScriptType): string {
  const { name, desc, author, scriptPath, iconUrl, patterns, hostnames } = script;
  
  let loonPlugin = `#!name = ${name} ${script.category}\n`;
  loonPlugin += `#!desc = ${desc || name + ' 解锁'}\n`;
  loonPlugin += `#!author = ${author}\n`;
  
  if (iconUrl) {
    loonPlugin += `#!icon = ${iconUrl}\n`;
  }
  
  loonPlugin += `#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"\n\n`;
  
  if (patterns && patterns.length > 0 && scriptPath) {
    loonPlugin += `[Script]\n`;
    patterns.forEach((pattern, index) => {
      loonPlugin += `http-response ${pattern} script-path=${scriptPath}, requires-body=true, timeout=60, tag=${name.toLowerCase()}${index > 0 ? index : ''}\n`;
    });
    loonPlugin += `\n`;
  }
  
  if (hostnames && hostnames.length > 0) {
    loonPlugin += `[MITM]\n`;
    loonPlugin += `hostname = ${hostnames.join(', ')}\n`;
  }
  
  return loonPlugin;
}

/**
 * 将QuantumultX脚本转换为Surge模块
 */
function convertToSurgeModule(script: ScriptType): string {
  const { name, desc, author, scriptPath, iconUrl, patterns, hostnames, category } = script;
  
  let surgeModule = `#!name = ${name} ${category}\n`;
  surgeModule += `#!desc = ${desc || name + ' - 模块'}\n`;
  surgeModule += `#!author = ${author}\n`;
  surgeModule += `#!category=${category}\n`;
  
  if (iconUrl) {
    surgeModule += `#!icon = ${iconUrl}\n`;
  }
  
  surgeModule += `\n`;
  
  if (patterns && patterns.length > 0 && scriptPath) {
    surgeModule += `[Script]\n`;
    patterns.forEach((pattern, index) => {
      surgeModule += `${name}${index > 0 ? index : ''} = type=http-response, pattern=${pattern}, script-path=${scriptPath}, requires-body=true, max-size=-1, timeout=60\n`;
    });
    surgeModule += `\n`;
  }
  
  if (hostnames && hostnames.length > 0) {
    surgeModule += `[MITM]\n`;
    surgeModule += `hostname = %APPEND% ${hostnames.join(', ')}\n`;
  }
  
  return surgeModule;
}

/**
 * 直接从脚本内容中提取预配置的Loon插件和Surge模块
 */
function extractPreconfiguredPlugins(script: ScriptType): { loon: string | null, surge: string | null } {
  const content = script.content;
  
  // 尝试提取预配置的Loon插件
  const loonMatch = content.match(/Loon\n([\s\S]*?)(?=\n\n\n|Surge\n|$)/);
  const loonPlugin = loonMatch ? loonMatch[1].trim() : null;
  
  // 尝试提取预配置的Surge模块
  const surgeMatch = content.match(/Surge\n([\s\S]*?)(?=\n\n\n|Loon\n|$)/);
  const surgeModule = surgeMatch ? surgeMatch[1].trim() : null;
  
  return { loon: loonPlugin, surge: surgeModule };
}

/**
 * 保存转换后的插件/模块文件，只有当文件不存在或内容变化时才写入
 */
async function saveConvertedFile(
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
    console.log(`Found ${scriptFiles.length} QuantumultX scripts to convert`);
    
    let hasChanges = false;
    
    for (const filePath of scriptFiles) {
      const script = await parseScriptInfo(filePath);
      console.log(`Converting ${script.name}...`);
      
      // 使用原始文件名作为输出文件名（如果存在）
      const outputBaseName = script.originalName || script.name.toLowerCase().replace(/\s+/g, '_');
      
      // 尝试提取预配置插件
      const preconfigured = extractPreconfiguredPlugins(script);
      
      // 处理Loon插件
      let loonContent;
      if (preconfigured.loon) {
        console.log(`Using preconfigured Loon plugin for ${script.name}`);
        loonContent = preconfigured.loon;
      } else {
        console.log(`Generating Loon plugin for ${script.name}`);
        loonContent = convertToLoonPlugin(script);
      }
      
      const loonChanged = await saveConvertedFile(
        LOON_OUTPUT_DIR, 
        outputBaseName, 
        loonContent, 
        '.plugin'
      );
      
      // 处理Surge模块
      let surgeContent;
      if (preconfigured.surge) {
        console.log(`Using preconfigured Surge module for ${script.name}`);
        surgeContent = preconfigured.surge;
      } else {
        console.log(`Generating Surge module for ${script.name}`);
        surgeContent = convertToSurgeModule(script);
      }
      
      const surgeChanged = await saveConvertedFile(
        SURGE_OUTPUT_DIR, 
        outputBaseName, 
        surgeContent, 
        '.sgmodule'
      );
      
      // 如果任一文件有变化，记录有更改
      if (loonChanged || surgeChanged) {
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      console.log('Conversion completed with changes!');
      // 设置GitHub Actions输出变量
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_file_changes=true\n');
      }
    } else {
      console.log('Conversion completed, no changes detected.');
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