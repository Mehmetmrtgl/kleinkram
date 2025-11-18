from __future__ import annotations

import sys
import time
from typing import Optional, List

import typer

import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import RunQuery
from kleinkram.config import get_shared_state
from kleinkram.models import Run, LogEntry
from kleinkram.printing import print_runs_table, print_run_info, print_run_logs
from kleinkram.utils import split_args

HELP = """\
Manage and inspect action runs.

You can list action runs, get detailed information about specific runs, stream their logs,
cancel runs in progress, and retry failed runs.
"""

run_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "List action runs. Optionally filter by mission or project."
INFO_HELP = "Get detailed information about a specific action run."
LOGS_HELP = "Stream the logs for a specific action run."
CANCEL_HELP = "Cancel an action run that is in progress."
RETRY_HELP = "Retry a failed action run."


@run_typer.command(help=LIST_HELP, name="list")
def list_runs(
    mission: Optional[str] = typer.Option(
        None, "--mission", "-m", help="Mission ID or name to filter by."
    ),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="Project ID or name to filter by."
    ),
) -> None:
    """
    List action runs.
    """
    client = AuthenticatedClient()

    mission_ids, mission_patterns = split_args([mission] if mission else [])
    project_ids, project_patterns = split_args([project] if project else [])

    query = RunQuery(
        mission_ids=mission_ids,
        mission_patterns=mission_patterns,
        project_ids=project_ids,
        project_patterns=project_patterns,
    )

    runs = list(kleinkram.api.routes.get_runs(client, query=query))
    print_runs_table(runs, pprint=get_shared_state().verbose)


@run_typer.command(name="info", help=INFO_HELP)
def get_info(
    run_id: str = typer.Argument(..., help="The ID of the run to get information for.")
) -> None:
    """
    Get detailed information for a single run.
    """
    client = AuthenticatedClient()
    run: Run = kleinkram.api.routes.get_run(client, run_id=run_id)
    print_run_info(run, pprint=get_shared_state().verbose)


@run_typer.command(help=LOGS_HELP)
def logs(
    run_id: str = typer.Argument(..., help="The ID of the run to fetch logs for."),
    follow: bool = typer.Option(
        False, "--follow", "-f", help="Follow the log output in real-time."
    ),
) -> None:
    """
    Fetch and display logs for a specific run.
    """
    client = AuthenticatedClient()

    if follow:
        typer.echo(f"Watching logs for run {run_id}. Press Ctrl+C to stop.")
        try:

            # TODO: fine for now, but ideally we would have a streaming endpoint
            # currently there is no following, thus we just poll every 2 seconds
            # from the get_run endpoint
            last_log_index = 0
            while True:
                run: Run = kleinkram.api.routes.get_run(client, run_id=run_id)
                log_entries: List[LogEntry] = run.logs
                new_log_entries = log_entries[last_log_index:]
                if new_log_entries:
                    print_run_logs(new_log_entries, pprint=get_shared_state().verbose)
                    last_log_index += len(new_log_entries)

                time.sleep(2)

        except KeyboardInterrupt:
            typer.echo("Stopped following logs.")
            sys.exit(0)
    else:
        log_entries = kleinkram.api.routes.get_run(client, run_id=run_id).logs
        print_run_logs(log_entries, pprint=get_shared_state().verbose)
