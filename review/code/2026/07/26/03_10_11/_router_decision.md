# Router Decision

```json
{
  "router_version": 2,
  "decided_at": "2026-07-26T11:30:00Z",
  "decisions": [
    {"name": "security", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "performance", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "architecture", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "requirement", "selected": true, "reason": "agents_forced (router_safety): spec 본문 변경"},
    {"name": "scope", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "side_effect", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "maintainability", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "testing", "selected": false, "reason": "소스 코드 변경 없음"},
    {"name": "documentation", "selected": true, "reason": "agents_forced (router_safety): spec/conventions/node-cancellation.md 문서 변경"},
    {"name": "dependency", "selected": false, "reason": "package.json/lock 변경 없음"},
    {"name": "database", "selected": false, "reason": "DB schema/migration 변경 없음"},
    {"name": "concurrency", "selected": false, "reason": "async/락/큐 코드 변경 없음"},
    {"name": "api_contract", "selected": false, "reason": "HTTP route/controller 변경 없음"},
    {"name": "user_guide_sync", "selected": true, "reason": "spec/conventions/** 변경 — doc-sync-matrix 의 'spec 신규/대규모 변경' trigger 매칭"}
  ],
  "selected_count": 3,
  "skipped_count": 11,
  "forced": ["documentation", "requirement"]
}
```
