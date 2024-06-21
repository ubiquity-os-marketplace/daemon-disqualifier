# @ubiquibot/user-activity-watcher

Watches user activity on issues, sends reminders on deadlines, and eventually unassigns inactive user to ensure that 
tasks don't stall, and subtracts XP.

## Setup
```shell
yarn install
```

Then copy `.dev.vars.example` to `.dev.vars` and fill the required values.

### Database
To start a local instance, run
```shell
supabase start
```

Afterward, you can generate types for full auto-completion with
```shell
yarn supabase:generate:local
```

### Worker
Start the Worker by running
```shell
yarn dev
```

### Make requests
To trigger the worker, `POST` requests should be made to http://localhost:4000 with a `Content-Type: application/json`
header and a body looking like
```json
{
  "stateId": "",
  "eventName": "",
  "eventPayload": "",
  "settings": "",
  "ref": ""
}
```
For convenience, you can find an `.http` file with a valid request [here](/tests/http/request.http).

### Test
To start Jest testing, run
```shell
yarn test
```

## Valid configuration
```yaml
- plugin: ubiquibot/user-activity-watcher
  type: github
  with:
    disqualification: "7 days"
    warning: "3.5 days"
```
