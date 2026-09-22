# BMAD Crew Demo

A demo project implementing the BMAD (Battle-Tested, Modular, Autonomous, Deployable) crew pattern for the sympozium-todo-demo.

## Setup

```bash
pip install -r requirements.txt
```

## Testing

```bash
pytest tests/
```

## Usage

```python
from src.bmad_crew import BMADCrew, CrewMember

crew = BMADCrew("my-team")
crew.add_member(CrewMember("alice", "engineer"))
print(f"Crew size: {crew.size}")
```
