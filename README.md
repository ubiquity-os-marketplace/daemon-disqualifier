# @ubiquibot/user-activity-watcher

Watches user activity on issues, sends reminders on deadlines, and eventually unassigns inactive user to ensure that 
tasks don't stall, and applies malus XP.

## Setup

### Database
To start a local instance, run
```shell
supabase start
```

Afterward, you can generate types for full auto-completion with
```shell
yarn supabase:generate:local
```

### Test
To start Jest testing, run
```shell
yarn test
```
