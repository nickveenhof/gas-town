# opencode-gitlab-workstream

Two OpenCode plugins for reliable agent task management with GitLab.

## Plugins

### ErrorRecovery

`tool.execute.after` hook that catches runtime errors and appends actionable guidance.

**Catches:**
- JSON truncation: `JSON Parse error: Expected '}'` — appends split-and-retry instructions
- Unknown agent type: `unknown agent type: X` — appends fix instructions with config pointer

**Use in any opencode project.** No config required.

### GitLabWorkstream

Registers `plan_create` and `plan_track` tools for tracking multi-session agent projects as GitLab issues.

**Tools:**
- `plan_create` — Create a parent issue as a project/initiative container
- `plan_track` — Create child task issues linked to the parent via `relates_to`

**Future:** Epic support when a GitLab Ultimate group is available (set `gitlab_group` in config).

## Install

```bash
# In your opencode project plugins/ directory
# Or reference directly from the repo
```

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-gitlab-workstream"]
}
```

## Configure

Create `~/.config/opencode/gas-town.jsonc`:

```jsonc
{
  "work_tracking": {
    "gitlab_project": "my-group/my-project",
    "gitlab_project_id": 12345678,
    "gitlab_group": "my-group",
    "default_labels": ["opencode", "gas-town"],
    "enabled": true
  }
}
```

## Usage

```
plan_create(
  title="Migrate agent orchestration",
  description="Replace OMO with native opencode agent config. Success: all agents load via frontmatter.",
  due_date="2026-05-01"
)
// → parent_iid: 1

plan_track(
  title="analyst: audit current OMO hooks",
  description="Read all OMO hook files. Map which ones Gas Town uses.",
  parent_iid=1,
  session_id="ses_28e..."
)
// → issue_iid: 2

// Close when done:
plan_track(issue_iid=2, title="analyst: audit done", description="Results in /tmp/audit.md", status="closed")
```

## License

MIT
