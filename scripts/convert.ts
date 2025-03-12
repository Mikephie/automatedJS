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
    const name = fileName.replace(/\.(js|conf)$/, '');
    
    // 尝试从脚本中提取描述信息
    const descMatch = content.match(/\/\/\s*@(desc|description)\s+(.+)/i);
    const desc = descMatch ? descMatch[2].trim() : `Converted from ${fileName}`;
    
    return { name, desc, content };
  } catch (err) {
    console.error(`Error parsing script ${filePath}:`, err);
    throw err;
  }
}

/**
 * 将QuantumultX脚本转换为Loon插件
 */
function convertToLoonPlugin(script: ScriptType): string {
  const { name, desc, content } = script;
  
  // 分析脚本内容
  const httpMatch = content.match(/http-(?:response|request)/);
  const cronMatch = content.match(/cronexp\s*=\s*["']([^"']+)["']/);
  
  let loonPlugin = `#!name=${name}\n#!desc=${desc}\n\n`;
  
  if (httpMatch) {
    // HTTP 脚本转换
    const urlRegexMatch = content.match(/url\s*=\s*["']([^"']+)["']/);
    const scriptUrlMatch = content.match(/script-path\s*=\s*["']([^"']+)["']/);
    
    if (urlRegexMatch && scriptUrlMatch) {
      loonPlugin += `[Script]\n`;
      loonPlugin += `http-response ${urlRegexMatch[1]} script-path=${scriptUrlMatch[1]}, requires-body=true, tag=${name}\n\n`;
    }
  } else if (cronMatch) {
    // 定时任务脚本转换
    const scriptUrlMatch = content.match(/script-path\s*=\s*["']([^"']+)["']/);
    
    if (cronMatch && scriptUrlMatch) {
      loonPlugin += `[Script]\n`;
      loonPlugin += `cron "${cronMatch[1]}" script-path=${scriptUrlMatch[1]}, tag=${name}\n\n`;
    }
  }
  
  // 提取并转换 mitm 部分
  const mitmMatch = content.match(/hostname\s*=\s*([^,\n]+)/);
  if (mitmMatch) {
    loonPlugin += `[MITM]\n`;
    loonPlugin += `hostname = ${mitmMatch[1].trim()}\n`;
  }
  
  return loonPlugin;
}

/**
 * 将QuantumultX脚本转换为Surge模块
 */
function convertToSurgeModule(script: ScriptType): string {
  const { name, desc, content } = script;
  
  // 分析脚本内容
  const httpMatch = content.match(/http-(?:response|request)/);
  const cronMatch = content.match(/cronexp\s*=\s*["']([^"']+)["']/);
  
  let surgeModule = `#!name=${name}\n#!desc=${desc}\n\n`;
  
  if (httpMatch) {
    // HTTP 脚本转换
    const urlRegexMatch = content.match(/url\s*=\s*["']([^"']+)["']/);
    const scriptUrlMatch = content.match(/script-path\s*=\s*["']([^"']+)["']/);
    
    if (urlRegexMatch && scriptUrlMatch) {
      surgeModule += `[Script]\n`;
      // Surge中HTTP脚本格式略有不同
      surgeModule += `${name} = type=http-response,pattern=${urlRegexMatch[1]},script-path=${scriptUrlMatch[1]},requires-body=1\n\n`;
    }
  } else if (cronMatch) {
    // 定时任务脚本转换
    const scriptUrlMatch = content.match(/script-path\s*=\s*["']([^"']+)["']/);
    
    if (cronMatch && scriptUrlMatch) {
      surgeModule += `[Script]\n`;
      surgeModule += `${name} = type=cron,cronexp="${cronMatch[1]}",script-path=${scriptUrlMatch[1]}\n\n`;
    }
  }
  
  // 提取并转换 mitm 部分
  const mitmMatch = content.match(/hostname\s*=\s*([^,\n]+)/);
  if (mitmMatch) {
    surgeModule += `[MITM]\n`;
    surgeModule += `hostname = %APPEND% ${mitmMatch[1].trim()}\n`;
  }
  
  return surgeModule;
}

/**
 * 保存转换后的插件/模块文件
 */
async function saveConvertedFile(
  outputDir: string, 
  fileName: string, 
  content: string,
  extension: string
): Promise<void> {
  try {
    const outputPath = path.join(outputDir, `${fileName}${extension}`);
    await fs.writeFile(outputPath, content, 'utf8');
    console.log(`Successfully saved to ${outputPath}`);
  } catch (err) {
    console.error(`Error saving file ${fileName}:`, err);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    const scriptFiles = await getQuantumultXScripts();
    console.log(`Found ${scriptFiles.length} QuantumultX scripts to convert`);
    
    for (const filePath of scriptFiles) {
      const script = await parseScriptInfo(filePath);
      console.log(`Converting ${script.name}...`);
      
      // 转换为Loon插件
      const loonPlugin = convertToLoonPlugin(script);
      await saveConvertedFile(LOON_OUTPUT_DIR, script.name, loonPlugin, '.plugin');
      
      // 转换为Surge模块
      const surgeModule = convertToSurgeModule(script);
      await saveConvertedFile(SURGE_OUTPUT_DIR, script.name, surgeModule, '.sgmodule');
    }
    
    console.log('Conversion completed successfully!');
  } catch (err) {
    console.error('Error in main process:', err);
    process.exit(1);
  }
}

// 执行主函数
main();
