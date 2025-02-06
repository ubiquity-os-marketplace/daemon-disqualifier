# @ubiquity-os/daemon-disqualifier

Watches user activity on issues, sends reminders on disqualification threshold, and eventually unassigns inactive user to ensure that
tasks don't stall, and subtracts XP.

## Technical Architecture

### Overview

Daemon Disqualifier is built as a TypeScript-based GitHub Action that monitors pull request activity and manages reviewer assignments. The system uses a combination of event-driven processing and scheduled tasks to maintain an efficient code review workflow.

### Core Components

#### Action Infrastructure
- **Entry Point** (`src/index.ts`): Bootstraps the action and initializes core services
- **Runner** (`src/run.ts`): Orchestrates the main action workflow
- **Worker** (`src/worker.ts`): Handles background processing tasks

#### Cron System
- **Database Handler** (`src/cron/database-handler.ts`): Manages state persistence
- **Workflow Engine** (`src/cron/workflow.ts`): Executes scheduled tasks
- **Periodic Checks**: Automated monitoring of pull request activity

#### Activity Monitoring
- **User Activity Watcher** (`src/handlers/watch-user-activity.ts`): Tracks reviewer interactions
- **Time Management** (`src/handlers/time-format.ts`): Handles time-based operations and formatting

#### Helper Utilities
- **Pull Request Management** (`src/helpers/`):
  - `collect-linked-pulls.ts`: Manages related pull request connections
  - `get-assignee-activity.ts`: Tracks assignee interactions
  - `pull-request-draft.ts`: Handles draft PR states
  - `remind-and-remove.ts`: Manages notifications and unassignment
  - `task-update.ts`: Updates task states and metadata

#### Type System
- **GitHub Types** (`src/types/github-types.ts`): Type definitions for GitHub API interactions
- **Environment Types** (`src/types/env.d.ts`): Environment configuration types
- **Plugin Types** (`src/types/plugin-input.ts`): Plugin configuration interfaces

### Testing Infrastructure

The project includes a comprehensive test suite using Jest:

- **Unit Tests**: Cover individual components and utilities
- **Integration Tests**: Test interaction between components
- **Mock System** (`tests/__mocks__/`):
  - Database mocks
  - HTTP route mocks
  - GitHub API mocks
  - User activity simulation

## Setup

```shell
bun install
```

### Database

To start a local instance, run

```shell
supabase start
```

Afterward, you can generate types for full auto-completion with

```shell
bun run supabase:generate:local
```

### Test

To start Jest testing, run

```shell
bun run test
```

## Valid configuration

```yaml
- plugin: ubiquity-os/daemon-disqualifier
  with:
    disqualification: "7 days"
    warning: "3.5 days"
    prioritySpeed: true
    pullRequestRequired: true
    watch:
      optOut:
        - "repoName"
        - "repoName2"
    eventWhitelist: # these are the tail of the webhook event i.e. pull_request.review_requested
      - "review_requested"
      - "ready_for_review"
      - "commented"
      - "committed"
```

### Configuration Options

- `disqualification`: Time period after which inactive reviewers are unassigned
- `warning`: Time period after which warning notifications are sent
- `prioritySpeed`: Enable faster processing for priority items
- `pullRequestRequired`: Enforce pull request requirement
- `watch.optOut`: Repositories to exclude from monitoring
- `eventWhitelist`: List of GitHub webhook events to process
