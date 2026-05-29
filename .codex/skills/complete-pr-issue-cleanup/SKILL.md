---
name: complete-pr-issue-cleanup
description: Use when finishing a GitHub PR tied to a parent Issue in this VN Maker repo, especially when the user asks to merge, complete Issues, verify Project Done state, and clean up branches or worktrees.
---

# Complete PR Issue Cleanup

## Core Rule

Finish only from evidence. Do not call a PR/Issue complete until PR state, review threads, checks, parent/child Issues, Project status, post-merge verification, branch deletion, and worktree cleanup are all verified.

This is a project skill for `highschool-romance-sim`. Follow `AGENTS.md`; keep all user-facing reports Korean and call the user `주인님`.

Default project tracking is GitHub Projects v2 board `https://github.com/users/Sharknia/projects/4`. Do not bypass Project access by treating Issues alone as complete.

## Required Companion Skills

Use these when available:

- `github:github` for PR/Issue orientation.
- `github:gh-address-comments` when review-thread state matters.
- `superpowers:finishing-a-development-branch` before integration cleanup.
- `superpowers:verification-before-completion` before any completion claim.

## Inputs To Resolve

Resolve these before acting:

- Repository root and current branch.
- PR number or URL. If omitted, use `gh pr view`.
- Parent Issue number. Prefer the user's explicit number, then PR body references such as `Refs #108`. Ask only if ambiguous.
- Expected base branch, normally `main`.

## Pre-Merge Gates

Run from the feature worktree or PR branch:

```bash
git status --short --branch
gh pr view <pr> --json number,url,state,isDraft,mergeable,statusCheckRollup,headRefName,baseRefName,commits,reviewDecision,latestReviews
```

Require:

- PR is `OPEN`, not draft, and mergeable.
- Required checks are passing, or there are no checks.
- Worktree has no uncommitted task changes.
- Current HEAD matches the pushed PR head.

Check review threads with the GitHub skill's thread-aware script when available:

```bash
python /data/system/codex-home-new/plugins/cache/openai-curated/github/9b3c8689/skills/gh-address-comments/scripts/fetch_comments.py
```

Do not merge while there are unresolved current review threads. Outdated unresolved threads are acceptable if they refer to superseded diffs and the final PR body or Issue comment records the response.

Check Issue state:

```bash
gh issue view <parent> --json state,closed,projectItems,title,url
gh issue list --search 'repo:Sharknia/highschool-romance-sim parent:<parent> is:open' --json number,title,state,url --limit 100
```

If Project access is missing and status cannot be verified or updated, stop and report the blocker. Do not substitute standalone Issue changes for Project status.

## Verification Before Merge

Run fresh verification unless the same HEAD was verified in the current turn and no files changed after that:

```bash
npm run typecheck
npm run test:maker
git diff --check
```

Add focused tests or browser checks when the PR changed the relevant surface. Report mock/browser/manual checks separately from automated tests.

## Merge

Prefer running the merge from the primary repo root on `main`, not from a feature worktree, to avoid `fatal: 'main' is already used by worktree ...`.

```bash
gh pr merge <pr> --merge --delete-branch
```

If `gh pr merge` returns a local git error, immediately check PR state before retrying:

```bash
gh pr view <pr> --json state,mergedAt,mergeCommit,headRefName,baseRefName
```

The remote merge may have succeeded even when local checkout cleanup failed.

## Post-Merge Main Verification

Update local `main` and verify from the primary repo root:

```bash
git fetch origin --prune
git pull --ff-only origin main
npm run typecheck
npm run test:maker
git diff --check
```

Then confirm:

```bash
gh pr view <pr> --json state,mergedAt,mergeCommit,url
gh issue view <parent> --json state,closed,projectItems,url
gh issue list --search 'repo:Sharknia/highschool-romance-sim parent:<parent> is:open' --json number,title,state,url --limit 100
```

If the parent Issue or Project item is not Done/closed, update it with the available GitHub Project tooling. If permissions block Project updates, report the exact blocker and do not claim completion.

Add an Issue comment with:

- PR URL and merge commit.
- Post-merge verification commands.
- Parent/child Issue and Project status.
- Branch/worktree cleanup status.

If this completes a Codex `/goal` task, follow `AGENTS.md`: send the Gmail completion report to `zel@kakao.com` when Gmail is available, or report why it could not be sent.

## Branch And Worktree Cleanup

After merge is confirmed:

1. Confirm remote branch deletion:

   ```bash
   git ls-remote --heads origin <head-branch>
   ```

   If it still exists, delete it:

   ```bash
   git push origin --delete <head-branch>
   ```

2. Remove only owned feature worktrees. Owned paths include `.worktrees/`, `worktrees/`, and `~/.config/superpowers/worktrees/`.

   ```bash
   git worktree remove <worktree-path>
   git worktree prune
   ```

3. Delete the local branch after the worktree is removed:

   ```bash
   git branch -d <head-branch>
   ```

Do not remove unrelated untracked files such as pre-existing `artifacts/`.

## Final Audit

Before the final response, verify:

```bash
git status --short --branch
git log --oneline -1
git branch --list '<head-branch>'
git branch -r --list 'origin/<head-branch>'
git worktree list | rg '<head-branch>|<worktree-name>' || true
gh pr view <pr> --json state,mergedAt,mergeCommit,url
gh issue view <parent> --json state,closed,projectItems,url
gh issue list --search 'repo:Sharknia/highschool-romance-sim parent:<parent> is:open' --json number,title,state,url --limit 100
```

## Final Report

Report concisely in Korean:

- PR URL, merged state, merge commit.
- Parent Issue state, Project status, open child Issue count.
- Verification commands and results.
- Remote branch, local branch, and worktree cleanup result.
- Remaining local noise, explicitly distinguishing unrelated pre-existing files.
