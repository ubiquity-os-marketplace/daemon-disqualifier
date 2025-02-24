# @ubiquity-os/daemon-disqualifier

Watches user activity on issues, sends reminders on disqualification threshold, and eventually unassigns inactive user to ensure that
tasks don't stall, and subtracts XP.

The system utilizes a dedicated CRON workflow (cron.yml) that runs periodically to manage and update reminders. This CRON system maintains state in a database and automatically enables/disables itself based on pending updates. It tracks user activity by updating comment timestamps and handles the reminder notifications and automatic unassign of inactive users according to the configured time frames.

## Technical Architecture

### Overview

Daemon Disqualifier is built as a TypeScript-based GitHub Action that monitors pull request activity and manages reviewer assignments. The system uses a combination of event-driven processing and scheduled tasks to maintain an efficient code review workflow.

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
    # Time period after which inactive reviewers are unassigned
    negligenceThreshold: "7 days"
    # Time period after which warning notifications are sent
    followUpInterval: "3.5 days"
    # Enable faster processing for priority items
    prioritySpeed: true
    # Enforce pull request requirement
    pullRequestRequired: true
    # List of GitHub webhook events to process (these are the tail of the webhook event i.e. pull_request.review_requested)
    eventWhitelist:
      - "review_requested"
      - "ready_for_review"
      - "commented"
      - "committed"
    availableDeadlineExtensions:
      enabled: true
      amounts:
        - "Priority: 1 (Normal)": 5
        - "Priority: 2 (Medium)": 4
        - "Priority: 3 (High)": 3
        - "Priority: 4 (Urgent)": 2
        - "Priority: 5 (Emergency)": 1
```
