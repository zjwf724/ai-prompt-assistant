#!/usr/bin/env python3
"""
验证manifest.json文件的完整性
"""

import json
import os

def verify_manifest():
    """验证manifest.json文件"""
    try:
        with open('manifest.json', 'r', encoding='utf-8') as f:
            manifest = json.load(f)

        print("✅ Manifest.json 格式正确")

        # 检查必需字段
        required_fields = ['manifest_version', 'name', 'version', 'description']
        for field in required_fields:
            if field in manifest:
                print(f"✅ {field}: {manifest[field]}")
            else:
                print(f"❌ 缺少必需字段: {field}")
                return False

        # 检查权限
        if 'permissions' in manifest:
            print(f"✅ 权限: {', '.join(manifest['permissions'])}")

        # 检查图标
        if 'icons' in manifest:
            icons = manifest['icons']
            print(f"✅ 图标配置: {len(icons)} 个尺寸")
            for size, path in icons.items():
                if os.path.exists(path):
                    print(f"   ✅ {size}x{size}: {path}")
                else:
                    print(f"   ❌ {size}x{size}: {path} (文件不存在)")

        # 检查action
        if 'action' in manifest:
            action = manifest['action']
            if 'default_popup' in action:
                popup_path = action['default_popup']
                if os.path.exists(popup_path):
                    print(f"✅ Popup: {popup_path}")
                else:
                    print(f"❌ Popup文件不存在: {popup_path}")

        # 检查background
        if 'background' in manifest:
            bg = manifest['background']
            if 'service_worker' in bg:
                worker_path = bg['service_worker']
                if os.path.exists(worker_path):
                    print(f"✅ Service Worker: {worker_path}")
                else:
                    print(f"❌ Service Worker文件不存在: {worker_path}")

        # 检查content_scripts
        if 'content_scripts' in manifest:
            cs = manifest['content_scripts'][0]
            print(f"✅ Content Scripts: {len(cs.get('js', []))} JS文件")
            if 'matches' in cs:
                print(f"   匹配模式: {cs['matches']}")

        print("\n🎉 Manifest验证通过！")
        return True

    except json.JSONDecodeError as e:
        print(f"❌ JSON语法错误: {e}")
        return False
    except FileNotFoundError:
        print("❌ manifest.json文件不存在")
        return False
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        return False

def check_all_files():
    """检查所有必需文件"""
    required_files = [
        'manifest.json',
        'background.js',
        'content.js',
        'popup.html',
        'popup.js',
        'styles.css',
        'icons/icon16.png',
        'icons/icon32.png',
        'icons/icon48.png',
        'icons/icon128.png'
    ]

    print("\n📁 文件检查:")
    all_exist = True
    for file in required_files:
        if os.path.exists(file):
            size = os.path.getsize(file)
            print(f"✅ {file} ({size} bytes)")
        else:
            print(f"❌ {file} (缺失)")
            all_exist = False

    return all_exist

if __name__ == "__main__":
    print("🔍 AI Prompt Assistant 验证工具")
    print("=" * 50)

    files_ok = check_all_files()
    manifest_ok = verify_manifest() if files_ok else False

    if files_ok and manifest_ok:
        print("\n✅ 所有检查通过！现在可以安装扩展了。")
        print("\n安装步骤:")
        print("1. 打开 chrome://extensions/")
        print("2. 开启'开发者模式'")
        print("3. 点击'加载已解压的扩展程序'")
        print("4. 选择当前目录")
    else:
        print("\n❌ 请修复上述问题后重试")