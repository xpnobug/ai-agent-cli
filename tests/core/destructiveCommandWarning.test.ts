import { describe, it, expect } from 'vitest';
import { getDestructiveCommandWarning } from '../../src/core/destructiveCommandWarning.js';

describe('getDestructiveCommandWarning', () => {
  const cases: Array<{ cmd: string; expects: RegExp | null }> = [
    // 安全命令
    { cmd: 'ls -la', expects: null },
    { cmd: 'cat file.txt', expects: null },
    { cmd: 'git log --oneline', expects: null },
    { cmd: 'npm install', expects: null },
    { cmd: 'echo hello', expects: null },

    // Git 数据丢失类
    { cmd: 'git reset --hard HEAD~3', expects: /未提交/ },
    { cmd: 'git reset --hard', expects: /未提交/ },
    { cmd: 'git push --force origin main', expects: /远程/ },
    { cmd: 'git push origin main --force-with-lease', expects: /远程/ },
    { cmd: 'git push -f', expects: /远程/ },
    { cmd: 'git clean -fd', expects: /未跟踪/ },
    { cmd: 'git checkout .', expects: /工作区/ },
    { cmd: 'git restore .', expects: /工作区/ },
    { cmd: 'git stash drop', expects: /stash/ },
    { cmd: 'git stash clear', expects: /stash/ },
    { cmd: 'git branch -D feature-x', expects: /强制删除分支/ },
    { cmd: 'git branch --delete --force x', expects: /强制删除分支/ },

    // Git 绕过检查
    { cmd: 'git commit --no-verify -m x', expects: /安全 hook/ },
    { cmd: 'git push --no-verify', expects: /安全 hook/ },
    { cmd: 'git commit --amend -m new', expects: /改写/ },

    // rm 删除
    { cmd: 'rm -rf node_modules', expects: /递归强制/ },
    { cmd: 'rm -fr tmp', expects: /递归强制/ },
    { cmd: 'rm -r old/', expects: /递归删除/ },
    { cmd: 'rm -f file.txt', expects: /强制删除/ },

    // 数据库
    { cmd: 'DROP TABLE users;', expects: /数据库/ },
    { cmd: 'TRUNCATE TABLE logs', expects: /数据库/ },
    { cmd: 'drop schema x', expects: /数据库/ },
    { cmd: 'DELETE FROM users;', expects: /清空数据库/ },

    // 基础设施
    { cmd: 'kubectl delete pod foo', expects: /Kubernetes/ },
    { cmd: 'terraform destroy', expects: /Terraform/ },
    { cmd: 'docker rm -f container', expects: /Docker 容器/ },
    { cmd: 'docker system prune -af', expects: /Docker 镜像/ },

    // 包发布
    { cmd: 'npm publish', expects: /npm registry/ },
    { cmd: 'pnpm publish --access public', expects: /npm registry/ },

    // 命令组合里有危险命令（首匹配返回）
    { cmd: 'ls && git reset --hard', expects: /未提交/ },
  ];

  for (const { cmd, expects } of cases) {
    it(`"${cmd}" → ${expects ? expects.source : 'null'}`, () => {
      const result = getDestructiveCommandWarning(cmd);
      if (expects === null) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result!).toMatch(expects);
      }
    });
  }
});
