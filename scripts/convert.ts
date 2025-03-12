import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';

// 定义输入和输出目录
const QUANTUMULTX_DIR = 'QuantumultX';
const LOON_OUTPUT_DIR = 'Loon/plugins';
const SURGE_OUTPUT_DIR = 'Surge/modules';
const HASH_FILE = '.script_hashes.json';

// 定义脚本类型
type ScriptType = {
  fileName: string;      // 原始文件名
  appName?: string;      // 应用名称
  author?: string;       // 作者
  scriptPath?: string;   // 脚本路径
  patterns?: string[];   // URL模式
  hostnames?: string[];  // 主机名
};

// 定义哈希记录类型
type HashRecord = {
  [filePath: string]: string;  // 文件路径: 文件哈希
};

/**
 * 计算文件内容的MD5哈希值
 */
function calculateFileHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 加载保存的哈希值
 */
async function loadHashRecords(): Promise<HashRecord> {
  try {
    if (await fs.pathExists(HASH_FILE)) {
      const data = await fs.readFile(HASH_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn(`Warning: Failed to load hash records: ${err}. Creating new hash record.`);
  }
  return {};
}

/**
 * 保存哈希值记录
 */
async function saveHashRecords(hashRecords: HashRecord): Promise<void> {
  try {
    await fs.writeFile(HASH_FILE, JSON.stringify(hashRecords, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error saving hash records: ${err}`);
  }
}

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
    
    // 提取应用名称 - 增强提取规则
    let appName = fileName; // 默认使用文件名
    
    // 尝试多种格式提取应用名
    const appNameMatches = [
      // 从注释中提取 "📜 ✨ 应用名 ✨" 格式
      content.match(/📜\s*✨\s*([^✨]+)\s*✨/),
      // 从变量定义中提取
      content.match(/const\s+appName\s*=\s*["']([^"']+)["']/),
      // 从标题注释中提取
      content.match(/\/\*\s*([^*]+?)\s*\*\//),
      // 从Surge模块定义中提取
      content.match(/\[Script\].*?Surge.*?\n(.*?)\s*=/s)
    ];
    
    for (const match of appNameMatches) {
      if (match && match[1]) {
        appName = match[1].replace(/✨/g, '').trim();
        break;
      }
    }
    
    // 提取作者 - 默认作者
    const author = '🅜ⓘ🅚ⓔ🅟ⓗ🅘ⓔ';
    
    // 提取URL模式
    const patterns: string[] = [];
    
    // 从各种格式中提取URL模式 - 增强提取规则
    const patternRegexes = [
      // QX格式
      /\[rewrite_local\].*?\n(.*?)\s+url\s+script-response-body/s,
      // Surge格式
      /pattern=([^,"\s]+)/g,
      // Loon格式
      /http-response\s+([^\s,]+)/g,
      // 其他可能的QX格式
      /url\s+script-[^-]+-[^-]+\s+([^\s]+)/g
    ];
    
    // 尝试QX格式提取
    const qxMatch = patternRegexes[0].exec(content);
    if (qxMatch && qxMatch[1] && !patterns.includes(qxMatch[1].trim())) {
      patterns.push(qxMatch[1].trim());
    }
    
    // 尝试其他格式提取
    for (let i = 1; i < patternRegexes.length; i++) {
      let match;
      const regex = patternRegexes[i];
      while ((match = regex.exec(content)) !== null) {
        if (match[1] && !patterns.includes(match[1])) {
          patterns.push(match[1]);
        }
      }
    }
    
    // 提取脚本路径 - 增强提取规则
    let scriptPath = '';
    const scriptPathMatches = [
      content.match(/script-path=([^,\s]+)/i),
      content.match(/script-response-body\s+([^\s]+)/i)
    ];
    
    for (const match of scriptPathMatches) {
      if (match && match[1]) {
        scriptPath = match[1];
        break;
      }
    }
    
    // 提取MITM主机名 - 增强提取规则
    const hostnames: string[] = [];
    const hostnameSections = content.match(/\[MITM\][\s\S]*?hostname\s*=\s*([^;\n]+)/g);
    
    if (hostnameSections) {
      hostnameSections.forEach(section => {
        const hostnameStr = section.replace(/\[MITM\][\s\S]*?hostname\s*=\s*(%APPEND%\s*)?/, '').trim();
        const hosts = hostnameStr.split(/[,\s]+/).filter(Boolean);
        hosts.forEach(host => {
          if (host && !hostnames.includes(host)) {
            hostnames.push(host);
          }
        });
      });
    }
    
    console.log(`提取信息: ${appName}, 模式: ${patterns.join(',')}, 主机名: ${hostnames.join(',')}`);
    
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
 * 保存配置到文件
 */
async function saveConfig(
  outputDir: string, 
  fileName: string, 
  content: string,
  extension: string
): Promise<boolean> {
  try {
    await fs.ensureDir(outputDir);
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
    // 确保输出目录存在
    await fs.ensureDir(LOON_OUTPUT_DIR);
    await fs.ensureDir(SURGE_OUTPUT_DIR);
    
    // 获取所有QX脚本
    const scriptFiles = await getQuantumultXScripts();
    console.log(`找到 ${scriptFiles.length} 个 QuantumultX 脚本`);
    
    // 加载保存的哈希记录
    const hashRecords = await loadHashRecords();
    let hasChanges = false;
    
    // 处理每个脚本
    for (const filePath of scriptFiles) {
      try {
        // 读取文件内容
        const content = await fs.readFile(filePath, 'utf8');
        const currentHash = calculateFileHash(content);
        
        // 检查是否需要处理此文件
        if (hashRecords[filePath] === currentHash) {
          console.log(`文件 ${filePath} 未变更，跳过处理`);
          continue;
        }
        
        console.log(`处理脚本文件: ${filePath}`);
        
        // 提取脚本信息
        const scriptInfo = await extractScriptInfo(filePath);
        
        // 如果没有模式或脚本路径，跳过此文件
        if (!scriptInfo.patterns || scriptInfo.patterns.length === 0 || !scriptInfo.scriptPath) {
          console.warn(`警告: ${filePath} 缺少必要的URL模式或脚本路径，跳过此文件`);
          continue;
        }
        
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
        
        // 更新哈希记录
        hashRecords[filePath] = currentHash;
      } catch (err) {
        console.error(`处理 ${filePath} 时出错:`, err);
        // 继续处理下一个文件，不中断整个流程
        continue;
      }
    }
    
    // 保存哈希记录
    await saveHashRecords(hashRecords);
    
    // 设置GitHub Actions输出
    if (hasChanges) {
      console.log('处理完成，有文件变更!');
      if (process.env.GITHUB_OUTPUT) {
        await fs.appendFile(process.env.GITHUB_OUTPUT, 'has_file_changes=true\n');
      }
    } else {
      console.log('处理完成，没有检测到文件变更。');
      if (process.env.GITHUB_OUTPUT) {
        await fs.appendFile(process.env.GITHUB_OUTPUT, 'has_file_changes=false\n');
      }
    }
  } catch (err) {
    console.error('主流程出错:', err);
    process.exit(1);
  }
}

// 执行主函数
main();