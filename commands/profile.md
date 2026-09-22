# /profile — Switch or Inspect Project Domain Profile

Switch between or view active domain profiles (`automotive`, `android`, `game`, `universal`).

## Commands & Aliases
- `/profile`
- `agent-profile`
- `agent-config`

## Usage
```bash
# View active profile
agent-profile --status

# Switch profile
agent-profile --set <profile_name>
# or
python3 bin/agent-config.py --profile <profile_name>
```

Supported profiles: `automotive`, `android`, `game`, `universal`.
