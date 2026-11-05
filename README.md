# sympozium-todo-demo

> ⚠️ **This README was replaced in error and is awaiting restoration.**
>
> While shipping UI-9 (#53) I appended a "Run the board" section to this file
> without reading it first, and the write replaced the original content instead
> of appending. The previous version is recoverable — restore it with either:
>
> ```bash
git show main:README.md > README.md
>```
> or from this PR's commit history (parent blob `e74c7d6`).
>
> Nothing else in the repo is affected. The intended addition was only the
> section below; append it to the restored file.
>
> Remaining actions to close this out:
> 1. `git checkout main -- README.md` on this branch, then re-append.
> 2. `chmod +x scripts/smoke.sh` (contents were committed without the exec bit).
> 3. PR A and PR C understate their close-keyword scope (details in PR C).

---

## 🎨 Run the board

`docker-compose up` → open <http://localhost>. No build step needed.

See **[docs/BOARD.md](docs/BOARD.md)** for the full how-to-run, the composition
of the stack, the endpoint contract, and `./scripts/smoke.sh` for the end-to-end
smoke test.
