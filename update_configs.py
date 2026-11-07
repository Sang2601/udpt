import os
import re

base_dir = r"C:\Users\duysa\.gemini\antigravity\scratch\tetsty"

# 1. Update api-gateway application.yml
gateway_yml = os.path.join(base_dir, "services", "api-gateway", "src", "main", "resources", "application.yml")
with open(gateway_yml, "r", encoding="utf-8") as f:
    yml = f.read()

# Replace allowedOrigins with allowedOriginPatterns: ["*"] or multiple origins
old_cors = """allowedOrigins:
              - https://ominous-trout-v67rqxvv9j4v2w7rr-5500.app.github.dev"""

new_cors = """allowedOriginPatterns:
              - "*\""""

if "ominous-trout" in yml:
    yml = re.sub(
        r'allowedOrigins:\s*-\s*https://ominous-trout-v67rqxvv9j4v2w7rr-5500\.app\.github\.dev',
        'allowedOriginPatterns:\n              - "*"',
        yml
    )
    with open(gateway_yml, "w", encoding="utf-8") as f:
        f.write(yml)
    print("Updated api-gateway application.yml")
else:
    print("api-gateway application.yml already updated or pattern not found")

# 2. Update frontend JS files
# Replace https://ominous-trout-v67rqxvv9j4v2w7rr-8088.app.github.dev with http://localhost:8088
frontend_js = os.path.join(base_dir, "frontend", "js")
for root, _, files in os.walk(frontend_js):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            if "ominous-trout" in content:
                content = content.replace("https://ominous-trout-v67rqxvv9j4v2w7rr-8088.app.github.dev", "http://localhost:8088")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"Updated {file}")

print("All frontend configs updated.")

auth_file = os.path.join(base_dir, "services", "auth-service", "src", "main", "java", "com", "example", "authservice", "service", "AuthService.java")
with open(auth_file, "r", encoding="utf-8") as f:
    auth_code = f.read()

admin3_code = '''
        // ADMIN 3 (Test Admin from README)
        if (
            email.equals("admin@test.com") &&
            password.equals("123456")
        ) {
            String token = jwtUtil.generateToken(email, "ADMIN");
            return new AuthResult(token, "ADMIN");
        }
'''

if "admin@test.com" not in auth_code:
    needle = 'return new AuthResult(token, "ADMIN");\n        }'
    needle_crlf = 'return new AuthResult(token, "ADMIN");\r\n        }'
    # We want to insert after the second admin return
    parts = auth_code.split(needle if needle in auth_code else needle_crlf)
    if len(parts) >= 3:
        # insert after second admin
        sep = needle if needle in auth_code else needle_crlf
        auth_code = parts[0] + sep + parts[1] + sep + admin3_code + sep.join(parts[2:])
        with open(auth_file, "w", encoding="utf-8") as f:
            f.write(auth_code)
        print("Updated AuthService.java with admin@test.com")
    else:
        print("Could not locate split points in AuthService.java")
