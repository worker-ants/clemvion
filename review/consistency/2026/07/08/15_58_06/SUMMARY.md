# consistency-check --impl-done SUMMARY — 알림 설정 API (§6.2)

- 범위: spec/2-navigation/9-user-profile.md (§5.1/§5.3/§5.4/§6.2) · spec/data-flow/8-notifications.md (§1/§1.1) + 구현 코드.
- 방식: 직접 Agent fan-out — cross-spec + convention-compliance/plan-coherence.

## BLOCK: NO (Critical 0)

## 발견 (Warning 3 / Info 3) — 처리

| # | checker | sev | 요지 | 처리 |
|---|---|---|---|---|
| 1 | convention | WARNING | `USER_NOT_FOUND` 예외 body 가 nested `{error:{...}}` — 다른 5곳은 flat `{code,message}` | **FIX**: flat 로 통일 |
| 2 | convention | WARNING | PATCH /settings 에 `@ApiNotFoundResponse` 누락 | **FIX**: 추가 |
| 3 | cross-spec | WARNING | 4-integration §11.2/§11.3 필드명 stale(`notifyIntegrationExpiryByEmail`) — 코드는 `integrationExpiryEmail`. (out-of-scope 문서) | **FIX(doc)**: §5.1 각주 정정(기본값은 이미 정합, 남은 건 필드명) + tracker 후속 스코프 "필드명 동기화"로 정정 |
| 4 | cross-spec | INFO | 4-integration §11.3 stale 클래스명 `NotificationDispatcher` | tracker 후속 등록 |
| 5 | cross-spec | INFO | §5.4 가 §5.1 을 "미구현"으로 지칭(stale) | **FIX**: "이메일 on/off 구현·인앱 뮤팅 미구현" 으로 정정 |
| 6 | convention | INFO | getSettings/updateSettings user-not-found 비대칭(도달불가 방어) | 수용 |

## 정합 확인 (문제 없음)
- §6.2 endpoint·`{data}` 래핑·DTO 네이밍/위치·PATCH 부분수정 시맨틱·prefs camelCase — api-convention/swagger 준수.
- 9-user-profile ↔ 8-notifications ↔ 4-integration(기본값) 필드명/기본값/딥링크 계약 정합. notification.type CHECK·data-model 무충돌(JSONB additive, migration 불요).
- frontmatter `status: partial` + pending_plans 유지(아바타·슬러그·digest 잔여) — spec-impl-evidence 정합. tracker flip + 후속 `[ ]` 등록 — plan-lifecycle 정합.

BLOCK: NO
