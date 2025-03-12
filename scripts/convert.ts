import re
import os

# 读取 QuantumultX 脚本内容
def read_script(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

# 提取信息
def extract_info(script_content):
    info = {}
    
    # 提取应用名称（从注释或脚本名中推断）
    name_match = re.search(r'Aloha', script_content)  # 示例，动态匹配需优化
    info['app_name'] = name_match.group(0) if name_match else 'Unknown'
    
    # 提取作者（从注释或 GitHub URL 中推断）
    author_match = re.search(r'github\.com/(\w+)/', script_content)
    info['author'] = author_match.group(1) if author_match else 'Unknown'
    
    # 提取 URL 模式
    url_match = re.search(r'pattern=(.+?),', script_content)
    info['pattern'] = url_match.group(1) if url_match else ''
    
    # 提取脚本路径
    script_path_match = re.search(r'script-path=(.+?),', script_content)
    info['script_path'] = script_path_match.group(1) if script_path_match else ''
    
    # 提取主机名
    hostname_match = re.search(r'hostname\s*=\s*(.+)', script_content)
    info['hostname'] = hostname_match.group(1) if hostname_match else ''
    
    return info

# 生成 Loon 配置
def generate_loon_config(info):
    template = f"""#!name = {info['app_name']} 🔐APP
#!desc = 插件
#!author = {info['author']}
#!icon = https://raw.githubusercontent.com/{info['author']}/icons/main/icon/{info['app_name'].lower()}.png
#appCategory = select,"✅签到","🚫广告","🔐APP","🛠️工具"

[Script]
http-response {info['pattern']} script-path={info['script_path']}, requires-body=true, timeout=60, tag={info['app_name'].lower()}

[MITM]
hostname = {info['hostname']}
"""
    return template

# 生成 Surge 配置
def generate_surge_config(info):
    template = f"""#!name = {info['app_name']} 🔐APP
#!desc = 网页游览 - 模块
#!author = {info['author']}
#!category=🔐APP
#!icon = https://raw.githubusercontent.com/{info['author']}/icons/main/icon/{info['app_name'].lower()}.png

[Script]
{info['app_name']} = type=http-response, pattern={info['pattern']}, script-path={info['script_path']}, requires-body=true, max-size=-1, timeout=60

[MITM]
hostname = %APPEND% {info['hostname']}
"""
    return template

# 主函数
def main():
    script_content = read_script('quantumultx_script.txt')  # 输入文件路径
    info = extract_info(script_content)
    
    # 生成并保存文件
    with open(f"{info['app_name']}_loon.conf", 'w', encoding='utf-8') as f:
        f.write(generate_loon_config(info))
    with open(f"{info['app_name']}_surge.sgmodule", 'w', encoding='utf-8') as f:
        f.write(generate_surge_config(info))

if __name__ == "__main__":
    main()