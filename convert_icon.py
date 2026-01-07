from PIL import Image
import sys
import os

def convert_to_ico(source, target):
    try:
        img = Image.open(source)
        img.save(target, format='ICO', sizes=[(256, 256)])
        print(f"Successfully converted {source} to {target}")
    except ImportError:
        print("Pillow library not found. Please run: pip install Pillow")
        sys.exit(1)
    except Exception as e:
        print(f"Error converting icon: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if os.path.exists('adobe_icon.png'):
        convert_to_ico('adobe_icon.png', 'adobe_icon.ico')
    else:
        print("adobe_icon.png not found")
