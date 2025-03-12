import * as fs from 'fs-extra';
import * as path from 'path';

// 定义输入和输出目录
const QUANTUMULTX_DIR = 'QuantumultX';
const LOON_OUTPUT_DIR = 'Loon/plugins';
const SURGE_OUTPUT_DIR = 'Surge/modules';

// 定义脚本类型
type ScriptType = {
  fileName: string;     // 原始文件名
  appName?: string;     // 应用名称
  author?: string;      // 作者
  loonConfig?: string;  // Loon配置部分
  surgeConfig?: string; // Surge配置部分
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
 * 从脚本文件中直接提取Loon和Surge配置
 */
async function extractConfigs(filePath: string): Promise<ScriptType> {
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
    
    // 提取或构建Loon配置
    let loonConfig = '';
    
    // 尝试提取预配置的Loon部分
    const loonMatch = content.match(/Loon\n([\s\S]*?)(?=\n\n\n|Surge\n|$)/);
    if (loonMatch && loonMatch[1].trim()) {
      loonConfig = loonMatch[1].trim();
    } else {
      // 如果没有预配置，尝试从脚本中提取元素构建一个基本配置
      const patternMatch = content.match(/http-response\s+([^\s]+)/);
      const scriptPathMatch = content.match(/script-path=([^,\s]+)/);
      const hostnameMatch = content.match(/hostname\s*=\s*([^,\n]+)/);
      
      if (patternMatch && scriptPathMatch) {
        const pattern = patternMatch[1].trim();
        const scriptPath = scriptPathMatch[1].trim();
        const hostname = hostnameMatch ? hostnameMatch[1].trim() : '';
        
        loonConfig = `#!name = ${appName} 🔐APP\n`;
        loonConfig += `#!desc = 插件\n`;
        loonConfig += `#!author = ${author}\n`;
        loonConfig += `#!icon = https://raw.githubusercontent.com/Mikephie/icons/main/icon/${appName.toLowerCase().replace(/\s+/g, '')}.png\n`;
        loonConfig += `#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"\n\n`;
        loonConfig += `[Script]\n`;
        loonConfig += `http-response ${pattern} script-path=${scriptPath}, requires-body=true, timeout=60, tag=${fileName.toLowerCase()}\n\n`;
        
        if (hostname) {
          loonConfig += `[MITM]\n`;
          loonConfig += `hostname = ${hostname}\n`;
        }
      }
    }
    
    // 提取或构建Surge配置
    let surgeConfig = '';
    
    // 尝试提取预配置的Surge部分
    const surgeMatch = content.match(/Surge\n([\s\S]*?)(?=\n\n\n|Loon\n|$)/);
    if (surgeMatch && surgeMatch[1].trim()) {
      surgeConfig = surgeMatch[1].trim();
    } else {
      // 如果没有预配置，尝试从脚本中提取元素构建一个基本配置
      const patternMatch = content.match(/pattern=([^,\s]+)/);
      const scriptPathMatch = content.match(/script-path=([^,\s]+)/);
      const hostnameMatch = content.match(/hostname\s*=\s*([^,\n]+)/);
      
      if (patternMatch && scriptPathMatch) {
        const pattern = patternMatch[1].trim();
        const scriptPath = scriptPathMatch[1].trim();
        const hostname = hostnameMatch ? hostnameMatch[1].trim() : '';
        
        surgeConfig = `#!name = ${appName} 🔐APP\n`;
        surgeConfig += `#!desc = 网页游览 - 模块\n`;
        surgeConfig += `#!author = ${author}\n`;
        surgeConfig += `#!category=🔐APP\n`;
        surgeConfig += `#!icon = https://raw.githubusercontent.com/Mikephie/icons/main/icon/${appName.toLowerCase().replace(/\s+/g, '')}.png\n\n`;
        surgeConfig += `[Script]\n`;
        surgeConfig += `${appName} = type=http-response, pattern=${pattern}, script-path=${scriptPath}, requires-body=true, max-size=-1, timeout=60\n\n`;
        
        if (hostname) {
          surgeConfig += `[MITM]\n`;
          surgeConfig += `hostname = %APPEND% ${hostname}\n`;
        }
      }
    }
    
    return {
      fileName,
      appName,
      author,
      loonConfig,
      surgeConfig
    };
  } catch (err) {
    console.error(`Error extracting configs from ${filePath}:`, err);
    throw err;
  }
}

/**
 * 处理配置内容，替换应用名称和图标URL
 */
function processConfig(
  config: string, 
  appName: string, 
  fileName: string, 
  author: string,
  type: 'loon' | 'surge'
): string {
  // 替换图标URL中的应用名
  const iconPattern = /#!icon\s*=\s*https:\/\/raw\.githubusercontent\.com\/Mikephie\/icons\/main\/icon\/[^.\n]+\.png/;
  const iconReplacement = `#!icon = https://raw.githubusercontent.com/Mikephie/icons/main/icon/${appName.toLowerCase().replace(/\s+/g, '')}.png`;
  
  if (iconPattern.test(config)) {
    config = config.replace(iconPattern, iconReplacement);
  }
  
  // 替换或添加名称
  const namePattern = type === 'loon' 
    ? /#!name\s*=\s*[^\n]+/ 
    : /#!name\s*=\s*[^\n]+/;
  
  const nameReplacement = type === 'loon'
    ? `#!name = ${appName} 🔐APP`
    : `#!name = ${appName} 🔐APP`;
  
  if (namePattern.test(config)) {
    config = config.replace(namePattern, nameReplacement);
  } else {
    // 如果没有找到名称行，添加它
    config = `${nameReplacement}\n${config}`;
  }
  
  // 替换或添加作者
  const authorPattern = /#!author\s*=\s*[^\n]+/;
  const authorReplacement = `#!author = ${author}`;
  
  if (authorPattern.test(config)) {
    config = config.replace(authorPattern, authorReplacement);
  } else {
    // 在名称行后添加作者行
    config = config.replace(nameReplacement, `${nameReplacement}\n${authorReplacement}`);
  }
  
  // Surge特有的处理
  if (type === 'surge') {
    // 添加或替换category
    const categoryPattern = /#!category\s*=\s*[^\n]+/;
    const categoryReplacement = `#!category=🔐APP`;
    
    if (categoryPattern.test(config)) {
      config = config.replace(categoryPattern, categoryReplacement);
    } else {
      // 在作者行后添加分类行
      config = config.replace(authorReplacement, `${authorReplacement}\n${categoryReplacement}`);
    }
    
    // 修复 [Script] // 格式问题
    config = config.replace(/\[Script\]\s*\/\//, '[Script]');
  }
  
  // Loon特有的处理
  if (type === 'loon') {
    // 添加或替换appCategory
    const appCategoryPattern = /#appCategory\s*=\s*[^\n]+/;
    const appCategoryReplacement = `#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"`;
    
    if (appCategoryPattern.test(config)) {
      config = config.replace(appCategoryPattern, appCategoryReplacement);
    } else {
      // 添加appCategory行
      if (config.includes('#!icon')) {
        // 如果有图标行，在图标行后添加
        config = config.replace(iconReplacement, `${iconReplacement}\n${appCategoryReplacement}`);
      } else {
        // 否则在作者行后添加
        config = config.replace(authorReplacement, `${authorReplacement}\n${appCategoryReplacement}`);
      }
    }
    
    // 移除脚本主体内容 - 只保留配置部分
    // 找到 [MITM] 部分后的内容全部移除
    const mitmMatch = config.match(/(\[MITM\][^\n]*(?:\n[^\n]+)*)/);
    if (mitmMatch) {
      config = config.substring(0, config.indexOf(mitmMatch[0]) + mitmMatch[0].length);
    }
  }
  
  return config;
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
    console.log(`Found ${scriptFiles.length} QuantumultX scripts to extract`);
    
    let hasChanges = false;
    
    for (const filePath of scriptFiles) {
      const scriptInfo = await extractConfigs(filePath);
      console.log(`Processing ${scriptInfo.fileName}...`);
      
      // 处理Loon插件
      if (scriptInfo.loonConfig) {
        console.log(`Found Loon config for ${scriptInfo.fileName}`);
        const loonChanged = await saveConfig(
          LOON_OUTPUT_DIR, 
          scriptInfo.fileName, 
          scriptInfo.loonConfig, 
          '.plugin'
        );
        
        if (loonChanged) {
          hasChanges = true;
        }
      } else {
        console.log(`No Loon config found for ${scriptInfo.fileName}`);
      }
      
      // 处理Surge模块
      if (scriptInfo.surgeConfig) {
        console.log(`Found Surge config for ${scriptInfo.fileName}`);
        const surgeChanged = await saveConfig(
          SURGE_OUTPUT_DIR, 
          scriptInfo.fileName, 
          scriptInfo.surgeConfig, 
          '.sgmodule'
        );
        
        if (surgeChanged) {
          hasChanges = true;
        }
      } else {
        console.log(`No Surge config found for ${scriptInfo.fileName}`);
      }
    }
    
    if (hasChanges) {
      console.log('Extraction completed with changes!');
      // 设置GitHub Actions输出变量
      if (process.env.GITHUB_OUTPUT) {
        const fs = require('fs');
        fs.appendFileSync(process.env.GITHUB_OUTPUT, 'has_file_changes=true\n');
      }
    } else {
      console.log('Extraction completed, no changes detected.');
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