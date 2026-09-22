"""BMAD Crew — autonomous crew implementation for sympozium-todo-demo.

The BMAD (Bug-Motivation-Action-Delivery) crew provides a lightweight
autonomous workflow engine that can be plugged into the existing demo
pipeline. It exposes a simple ``Crew`` class with lifecycle hooks and
a ``Task`` dataclass for representing work items.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class TaskStatus(Enum):
    """Possible states for a BMAD task."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Task:
    """A single work item in the BMAD crew pipeline.

    Attributes:
        name: Human-readable identifier for this task.
        payload: Arbitrary data carried through the pipeline.
        status: Current lifecycle state (defaults to ``PENDING``).
        result: Populated when ``status == DONE``.
        error: Populated when ``status == FAILED``.
    """

    name: str
    payload: dict[str, Any] = field(default_factory=dict)
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[Exception] = None


# ---------------------------------------------------------------------------
# Crew
# ---------------------------------------------------------------------------

class Crew:
    """Orchestrates a sequence of BMAD tasks.

    Usage::

        crew = Crew(name="demo-crew")
        crew.add_task("greet", lambda t: {"message": f"Hello {t.payload['name']}!"})
        crew.execute()
    """

    def __init__(self, name: str) -> None:
        self.name = name
        self._tasks: list[tuple[str, Callable[[Task], Any]]] = []
        self.results: dict[str, Any] = {}

    # -- public API --------------------------------------------------------

    def add_task(
        self,
        name: str,
        handler: Callable[[Task], Any],
    ) -> None:
        """Register a named task with its handler callable.

        The handler receives the current ``Task`` instance and should return
        a result (or raise to signal failure).
        """
        self._tasks.append((name, handler))

    def execute(self) -> dict[str, Any]:
        """Run all registered tasks in order.

        Returns:
            A mapping of task name → result for every successfully completed
            task. Tasks that fail are recorded with ``status == FAILED`` and
            their exception is attached to ``task.error``.
        """
        logger.info("Crew '%s' starting with %d task(s)", self.name, len(self._tasks))

        for task_name, handler in self._tasks:
            task = Task(name=task_name)
            task.status = TaskStatus.IN_PROGRESS
            logger.debug("Executing task '%s'", task_name)

            try:
                result = handler(task)
                task.result = result
                task.status = TaskStatus.DONE
                self.results[task_name] = result
                logger.info("Task '%s' completed successfully", task_name)
            except Exception as exc:
                task.error = exc
                task.status = TaskStatus.FAILED
                logger.error("Task '%s' failed: %s", task_name, exc, exc_info=exc)

        logger.info(
            "Crew '%s' finished — %d succeeded, %d failed",
            self.name,
            sum(1 for t in self._tasks if self.results.get(t[0]) is not None),
            len(self._tasks) - len(self.results),
        )
        return self.results

    @property
    def completed_tasks(self) -> list[str]:
        """Return names of tasks that reached ``DONE``."""
        return [name for name in self.results]

    @property
    def failed_tasks(self) -> list[str]:
        """Return names of tasks that reached ``FAILED``."""
        return [name for name, _ in self._tasks if name not in self.results]


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def run_crew(name: str, tasks: dict[str, Callable[[Task], Any]]) -> dict[str, Any]:
    """One-liner to create a crew, add tasks, and execute.

    Args:
        name: Crew identifier.
        tasks: Mapping of task name → handler callable.

    Returns:
        Result dictionary keyed by task name.
    """
    crew = Crew(name=name)
    for task_name, handler in tasks.items():
        crew.add_task(task_name, handler)
    return crew.execute()


# ---------------------------------------------------------------------------
# CLI entry-point (optional)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    def greet(task: Task) -> dict[str, str]:
        return {"greeting": f"Hello, {task.payload.get('name', 'World')}!"}

    def summarize(task: Task) -> dict[str, int]:
        return {"char_count": sum(len(str(v)) for v in task.payload.values())}

    results = run_crew(
        name="demo",
        tasks={
            "greet": greet,
            "summarize": summarize,
        },
    )
    print("Results:", results)
