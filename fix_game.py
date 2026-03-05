import re

with open(r'C:\Users\muham\OneDrive\Masaüstü\studyhell_site\game.html', encoding='utf-8') as f:
    content = f.read()

# 1. Remove debug SCRIPT_START log
before = "console.log('SCRIPT_START');\nvar Game; try { Game = (("
after = "var Game; Game = (("
if before in content:
    content = content.replace(before, after)
    print("Fixed SCRIPT_START")
else:
    print("SCRIPT_START not found")

# 2. Fix IIFE closing line (remove try/catch wrapper and IIFE_DONE log)
# The current pattern after all the debug edits
pattern = r"\}\)\(\); \} catch\(e\) \{ console\.error\('IIFE_ERROR:'.*?\); \}\nconsole\.log\('IIFE_DONE.*?\);\nwindow\.Game = Game;"
replacement = "})();\nwindow.Game = Game;"
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
if new_content != content:
    content = new_content
    print("Fixed IIFE closing")
else:
    print("IIFE close pattern not found, checking...")
    idx = content.find("})();")
    if idx >= 0:
        print("Found })(); at:", idx)
        print("Context:", repr(content[idx:idx+200]))

# 3. Remove undefined auth functions from return statement
old_auth = "    // Auth\n    switchAuthTab, doLogin, doRegister, doLogout, openAuthOverlay, closeAuthOverlay,"
new_auth = "    // Auth\n    doLogout, openAuthOverlay, closeAuthOverlay,"
if old_auth in content:
    content = content.replace(old_auth, new_auth)
    print("Removed undefined auth functions")
else:
    print("Auth line not found")

with open(r'C:\Users\muham\OneDrive\Masaüstü\studyhell_site\game.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("All done.")
