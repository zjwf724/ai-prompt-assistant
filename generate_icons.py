#!/usr/bin/env python3
"""
生成AI Prompt Assistant的图标文件
使用Pillow库创建简单的PNG图标
"""

from PIL import Image, ImageDraw
import os

def create_icon(size, output_path):
    """创建指定尺寸的图标"""
    # 创建透明背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 主要颜色
    green = (76, 175, 80, 255)
    white = (255, 255, 255, 255)
    dark_green = (56, 142, 60, 255)

    # 绘制圆形背景
    margin = size * 0.1
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=green,
        outline=dark_green,
        width=2
    )

    # 绘制菜单图标（三条横线）
    line_width = size * 0.15
    line_height = size * 0.08
    line_margin = size * 0.25
    top_margin = size * 0.35

    for i in range(3):
        y = top_margin + i * (line_height + line_margin)
        draw.rectangle(
            [size * 0.25, y, size * 0.75, y + line_height],
            fill=white
        )

    # 绘制右上角的小圆点（表示添加功能）
    dot_radius = size * 0.12
    dot_center_x = size * 0.78
    dot_center_y = size * 0.28

    draw.ellipse(
        [dot_center_x - dot_radius, dot_center_y - dot_radius,
         dot_center_x + dot_radius, dot_center_y + dot_radius],
        fill=white
    )

    # 保存图标
    img.save(output_path, 'PNG')
    print(f"已创建: {output_path} ({size}x{size})")

def main():
    """主函数"""
    icons_dir = "icons"

    # 确保icons目录存在
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir)

    # 需要生成的图标尺寸
    sizes = [16, 32, 48, 128]

    print("正在生成图标文件...")

    try:
        for size in sizes:
            output_path = os.path.join(icons_dir, f"icon{size}.png")
            create_icon(size, output_path)

        print("\n✅ 所有图标生成完成！")
        print("\n现在可以:")
        print("1. 在Chrome扩展管理页面重新加载扩展")
        print("2. 或者重新安装扩展")

    except ImportError:
        print("❌ 错误: 需要安装Pillow库")
        print("请运行: pip install Pillow")
    except Exception as e:
        print(f"❌ 生成图标时出错: {e}")

if __name__ == "__main__":
    main()