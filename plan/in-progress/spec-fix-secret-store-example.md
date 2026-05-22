---
worktree: chat-channel-secret-store-pgcrypto
started: 2026-05-22
owner: resolution-applier
---
# Spec Fix Draft — spec/conventions/secret-store.md §5.1 예제 코드 (#33)

## 원본 발견사항
SUMMARY#33: `spec/conventions/secret-store.md §5.1` 예제 코드 `delete botToken` 라인 — 실제 구현과 불일치.
위치: `spec/conventions/secret-store.md` L164–170

## 현황

`spec/conventions/secret-store.md §5.1` 의 teardown 예제에 `delete botToken` 형태의 코드가 있는데,
실제 구현은 `deleteByPrefix('secret://triggers/{id}/')` 로 batch 삭제한다.

## 제안 변경

spec/conventions/secret-store.md §5.1 예제 코드를 아래와 같이 수정:

```typescript
// Before (stale):
await secrets.delete(`secret://triggers/${trigger.id}/bot-token`);
await secrets.delete(`secret://triggers/${trigger.id}/webhook-secret`);

// After (실제 구현):
// trigger 삭제 시 모든 관련 secret 일괄 삭제 (deleteByPrefix).
await secrets.deleteByPrefix(`secret://triggers/${trigger.id}/`);
```

또한 "개별 삭제" 패턴 대신 "prefix 삭제" 패턴을 권장하는 주석 추가.
