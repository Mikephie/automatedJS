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
  content: string;
  scriptUrl?: string;
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
    
    // 提取脚本元数据
    const nameMatch = content.match(/@name\s+(.+)/);
    const descMatch = content.match(/@desc(?:ription)?\s+(.+)/);
    const authorMatch = content.match(/@author\s+(.+)/);
    
    // 尝试从重写规则中提取脚本URL
    const scriptUrlMatch = content.match(/script-(?:response|request)-body\s+([^\s]+)/i) || 
                         content.match(/script-path\s*=\s*["']?([^"'\s]+)["']?/i);
    
    return { 
      name: nameMatch ? nameMatch[1].trim() : name,
      desc: descMatch ? descMatch[1].trim() : `Converted from ${fileName}`,
      author: authorMatch ? authorMatch[1].trim() : undefined,
      content,
      scriptUrl: scriptUrlMatch ? scriptUrlMatch[1].trim() : undefined
    };
  } catch (err) {
    console.error(`Error parsing script ${filePath}:`, err);
    throw err;
  }
}

/**
 * 提取QuantumultX重写规则
 */
function extractRewriteRules(content: string): string[] {
  const rewriteSection = content.match(/\[rewrite_local\]([\s\S]*?)(?:\[|$)/);
  if (!rewriteSection) return [];
  
  return rewriteSection[1].split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * 提取MITM主机名
 */
function extractMitm(content: string): string[] {
  const mitmSection = content.match(/\[mitm\]([\s\S]*?)(?:\[|$)/);
  if (!mitmSection) return [];
  
  const hostnameMatch = mitmSection[1].match(/hostname\s*=\s*([^,\n]+)/);
  if (!hostnameMatch) return [];
  
  return hostnameMatch[1].split(',').map(host => host.trim());
}

/**
 * 将QuantumultX脚本转换为Loon插件
 */
function convertToLoonPlugin(script: ScriptType): string {
  const { name, desc, author, content, scriptUrl } = script;
  
  let loonPlugin = `#!name=${name}\n#!desc=${desc}\n`;
  if (author) {
    loonPlugin += `#!author=${author}\n`;
  }
  loonPlugin += '\n';
  
  // 提取重写规则并转换为Loon格式
  const rewriteRules = extractRewriteRules(content);
  const hasScriptRules = rewriteRules.length > 0;
  
  if (hasScriptRules || scriptUrl) {
    loonPlugin += '[Script]\n';
    
    // 转换重写规则
    rewriteRules.forEach(rule => {
      // 解析QuantumultX重写规则
      const urlMatch = rule.match(/^(.+?)\s+url\s+script-([^-]+)-([^-]+)\s+(.+)$/);
      if (urlMatch) {
        const [, pattern, type, bodyType, script] = urlMatch;
        const requiresBody = bodyType === 'body';
        
        // 转换为Loon脚本格式
        if (type === 'response') {
          loonPlugin += `http-response ${pattern} script-path=${script}, requires-body=${requiresBody}, tag=${name}\n`;
        } else if (type === 'request') {
          loonPlugin += `http-request ${pattern} script-path=${script}, requires-body=${requiresBody}, tag=${name}\n`;
        }
      }
    });
    
    // 提取定时任务
    const cronMatch = content.match(/cronexp\s*=\s*["']([^"']+)["']/);
    if (cronMatch && scriptUrl) {
      loonPlugin += `cron "${cronMatch[1]}" script-path=${scriptUrl}, tag=${name}\n`;
    }
    
    loonPlugin += '\n';
  }
  
  // 提取并转换MITM主机名
  const hostnames = extractMitm(content);
  if (hostnames.length > 0) {
    loonPlugin += '[MITM]\n';
    loonPlugin += `hostname = ${hostnames.join(', ')}\n`;
  }
  
  return loonPlugin;
}

/**
 * 将QuantumultX脚本转换为Surge模块
 */
function convertToSurgeModule(script: ScriptType): string {
  const { name, desc, author, content, scriptUrl } = script;
  
  let surgeModule = `#!name=${name}\n#!desc=${desc}\n`;
  if (author) {
    surgeModule += `#!author=${author}\n`;
  }
  surgeModule += '\n';
  
  // 提取重写规则并转换为Surge格式
  const rewriteRules = extractRewriteRules(content);
  const hasScriptRules = rewriteRules.length > 0;
  
  if (hasScriptRules || scriptUrl) {
    surgeModule += '[Script]\n';
    
    // 转换重写规则
    rewriteRules.forEach(rule => {
      // 解析QuantumultX重写规则
      const urlMatch = rule.match(/^(.+?)\s+url\s+script-([^-]+)-([^-]+)\s+(.+)$/);
      if (urlMatch) {
        const [, pattern, type, bodyType, script] = urlMatch;
        const requiresBody = bodyType === 'body' ? 1 : 0;
        
        // 转换为Surge脚本格式
        surgeModule += `${name} = type=http-${type},pattern=${pattern},script-path=${script},requires-body=${requiresBody}\n`;
      }
    });
    
    // 提取定时任务
    const cronMatch = content.match(/cronexp\s*=\s*["']([^"']+)["']/);
    if (cronMatch && scriptUrl) {
      surgeModule += `${name} = type=cron,cronexp="${cronMatch[1]}",script-path=${scriptUrl},wake-system=1\n`;
    }
    
    surgeModule += '\n';
  }
  
  // 提取并转换MITM主机名
  const hostnames = extractMitm(content);
  if (hostnames.length > 0) {
    surgeModule += '[MITM]\n';
    surgeModule += `hostname = %APPEND% ${hostnames.join(', ')}\n`;
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
 * 处理示例脚本格式中的注释格式转换
 */
function extractCommentedRules(content: string): string[] {
  // 查找注释块中的重写和MITM规则
  const commentBlock = content.match(/\/\*\*([\s\S]*?)\*\//g);
  if (!commentBlock) return [];
  
  const rules: string[] = [];
  
  // 遍历所有注释块
  commentBlock.forEach(block => {
    // 查找包含 [rewrite_local] 或 [mitm] 的注释块
    if (block.includes('[rewrite_local]') || block.includes('[mitm]')) {
      // 分割成行并清理注释符号
      const lines = block.split('\n')
        .map(line => line.replace(/^\s*\*\s*/, '').trim())
        .filter(line => line && !line.startsWith('/*') && !line.startsWith('*/'));
      
      rules.push(...lines);
    }
  });
  
  return rules;
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
