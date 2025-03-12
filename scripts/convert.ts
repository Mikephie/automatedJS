import re
import os
from pathlib import Path

# 读取 QuantumultX 脚本内容
def read_script(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

# 提取信息
def extract_info(script_content):
    info = {}

    # 提取应用名称（从注释或脚本名中推断）
    name_match = re.search(r'#.*?\b(\w+)\b\s*(?:✨|🔐|\=)', script_content) or re.search(r'(?<=type=http-response,.*?)\b(\w+)\b\s*=', script_content)
    info['app_name'] = name_match.group(1) if name_match else 'UnknownApp'

    # 提取作者（从 GitHub URL 或注释中推断）
    author_match = re.search(r'github\.com/([^/]+)/', script_content) or re.search(r'#.*?author\s*=\s*([^#\n]+)', script_content)
    info['author'] = author_match.group(1).strip() if author_match else 'UnknownAuthor'

    # 提取 URL 模式 (pattern)
    pattern_match = re.search(r'pattern\s*=\s*([^,\n]+)', script_content) or re.search(r'http-response\s+([^\s]+)', script_content)
    info['pattern'] = pattern_match.group(1).strip() if pattern_match else ''

    # 提取脚本路径 (script-path)
    script_path_match = re.search(r'script-path\s*=\s*([^,\n]+)', script_content)
    info['script_path'] = script_path_match.group(1).strip() if script_path_match else ''

    # 提取主机名 (hostname)
    hostname_match = re.search(r'hostname\s*=\s*([^,\n]+)', script_content)
    info['hostname'] = hostname_match.group(1).strip() if hostname_match else ''

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

# 处理单个文件并生成配置
def process_file(file_path, output_dir):
    script_content = read_script(file_path)
    info = extract_info(script_content)

    # 创建输出目录
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # 生成并保存 Loon 文件
    loon_output = os.path.join(output_dir, f"{info['app_name']}_loon.conf")
    with open(loon_output, 'w', encoding='utf-8') as f:
        f.write(generate_loon_config(info))
    print(f"Generated Loon config: {loon_output}")

    # 生成并保存 Surge 文件
    surge_output = os.path.join(output_dir, f"{info['app_name']}_surge.sgmodule")
    with open(surge_output, 'w', encoding='utf-8') as f:
        f.write(generate_surge_config(info))
    print(f"Generated Surge config: {surge_output}")

# 主函数：批量处理 QuantumultX 目录中的脚本
def main(input_dir='QuantumultX', output_dir='output'):
    for root, _, files in os.walk(input_dir):
        for file in files:
            if file.endswith('.js') or file.endswith('.txt'):  # 假设脚本文件为 .js 或 .txt
                file_path = os.path.join(root, file)
                process_file(file_path, output_dir)

if __name__ == "__main__":
    main()