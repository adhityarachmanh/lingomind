import os
import re

# Dictionary of replacements to apply to all string literals inside rsx!
replacements = {
    r"\bbg-white\b": "bg-white dark:bg-slate-900",
    r"\bbg-slate-50\b": "bg-slate-50 dark:bg-slate-950",
    r"\bbg-slate-100\b": "bg-slate-100 dark:bg-slate-800",
    r"\bbg-slate-200\b": "bg-slate-200 dark:bg-slate-700",
    
    r"\btext-slate-900\b": "text-slate-900 dark:text-slate-50",
    r"\btext-slate-800\b": "text-slate-800 dark:text-slate-200",
    r"\btext-slate-700\b": "text-slate-700 dark:text-slate-300",
    r"\btext-slate-600\b": "text-slate-600 dark:text-slate-400",
    r"\btext-slate-500\b": "text-slate-500 dark:text-slate-400",
    
    r"\bborder-slate-100\b": "border-slate-100 dark:border-slate-800",
    r"\bborder-slate-200\b": "border-slate-200 dark:border-slate-700",
    
    # Specific component colors
    r"\bbg-teal-50\b": "bg-teal-50 dark:bg-teal-900/30",
    r"\btext-teal-600\b": "text-teal-600 dark:text-teal-400",
    r"\bborder-teal-100\b": "border-teal-100 dark:border-teal-900/50",
    
    r"\bbg-indigo-50\b": "bg-indigo-50 dark:bg-indigo-900/30",
    r"\btext-indigo-600\b": "text-indigo-600 dark:text-indigo-400",
    r"\bborder-indigo-100\b": "border-indigo-100 dark:border-indigo-900/50",
    
    r"\bbg-orange-50\b": "bg-orange-50 dark:bg-orange-900/30",
    r"\btext-orange-600\b": "text-orange-600 dark:text-orange-400",
    r"\bborder-orange-100\b": "border-orange-100 dark:border-orange-900/50",

    r"\bbg-rose-50\b": "bg-rose-50 dark:bg-rose-900/30",
    r"\btext-rose-600\b": "text-rose-600 dark:text-rose-400",
    r"\bborder-rose-100\b": "border-rose-100 dark:border-rose-900/50",
    
    r"\bbg-amber-50\b": "bg-amber-50 dark:bg-amber-900/30",
    r"\btext-amber-600\b": "text-amber-600 dark:text-amber-400",
    r"\bborder-amber-200\b": "border-amber-200 dark:border-amber-900/50",
}

def apply_replacements(content):
    # Only replace if the word isn't already followed by dark:
    for old, new in replacements.items():
        # Prevent double application if script is run twice
        if old in content:
            # Simple replacement. Because we have specific full-word boundaries in regex
            # and we want to avoid replacing "bg-white" inside "bg-white dark:bg-slate-900" again
            content = re.sub(old + r"(?! dark:)", new, content)
    return content

def process_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.rs'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                new_content = apply_replacements(content)
                
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Updated {filepath}")

if __name__ == "__main__":
    src_dir = os.path.join(os.path.dirname(__file__), "src")
    views_dir = os.path.join(src_dir, "views")
    components_dir = os.path.join(src_dir, "components")
    
    process_directory(views_dir)
    process_directory(components_dir)
    print("Done!")
