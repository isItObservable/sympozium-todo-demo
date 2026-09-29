# BMAD Crew Module

Provides crew management and roster functionality.

## Usage

```python
from bmad_crew import Crew, CrewMember

# Create a new crew
crew = Crew(name="BMAD")

# Add members
crew.add_member(CrewMember("Alice", role="lead"))
crew.add_member(CrewMember("Bob", role="developer"))

# Update status
crew.update_status("active")
```
