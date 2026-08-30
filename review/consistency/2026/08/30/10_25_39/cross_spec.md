STATUS=success cross-spec 검토 완료 — CRITICAL 0 / WARNING 1 / INFO 1

===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — `spec-draft-followups-drain-2026-08-30.md`

> 조립 프롬프트의 번들이 예산 초과로 `spec/conventions/egress-masking.md` 를 통째로 누락하고
> `spec/5-system/14-external-interaction-api.md` · `spec/data-flow/15-external-interaction.md` ·
> `spec/5-system/6-websocket-protocol.md` 를 전부 절단했다(기존에 기록된 `--spec` 예산 갭과
> 동일 클래스). 세 파일 + `plan/in-progress/ws-event-types-extract.md` ·
> `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 리포에서 직접 `Read`/`grep` 해
> 판정했다.

## 발견사항

### 검증됨 — target 의 실측 인용 전부 정확 (충돌 아님, 참고용)

target 의 4개 항목(§1 statusCode, §2 Redis 각주, §3 egress-masking 캐비엇, §4 EventType 명명)은
전부 대상 spec 파일의 **정확한 위치·정확한 원문**을 인용하고 있고, 인용된 코드 사실
(`isHttpStatusCode()` 범위 검사, `redis-keys.md:59` 등재, `toTerminalErrorPayload` 5개 호출부,
`redactTerminalError`→`deepRedactSecrets`, `NotificationEventType` 동명 충돌)도 현재
`codebase/**` 와 전수 일치한다. §3 의 `spec_impact` 7파일 목록·"살아있는 인입 링크 2건"·
"`plan/complete/**` 4건 옛 경로 유지" 주장도 `ws-event-types-extract.md` 의 자체 체크리스트·
`git show --stat c6dd5cb89 57917975c -- spec/` 산출과 정확히 일치했다. 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC 어느 축에서도 다른 spec 영역과의 모순을 찾지 못했다 — 넷 다
**기존 spec 문장을 실측으로 정정**하는 것이지 새 계약을 도입하지 않는다.

- **[WARNING]** §3 의 "동시에 `plan/complete/` 이동" 이 plan-lifecycle 규칙과 충돌 — plan 자체에 미해결 follow-up 이 남아 있다
  - target 위치: draft §3, "**동시에** `plan/in-progress/ws-event-types-extract.md` → `plan/complete/` 이동" 문단
  - 충돌 대상: [`.claude/docs/plan-lifecycle.md`](../../../../../../.claude/docs/plan-lifecycle.md) §1·§2·§3 ("미완 항목이 단 하나라도 남으면 옮기지 않는다" / "미해결 follow-up 항목이 **하나라도** 있으면 `in-progress/`" / "모든 체크박스 `[x]` + 미해결 follow-up 0건이 되는 PR 안에") vs `plan/in-progress/ws-event-types-extract.md:450`
  - 상세: target 은 §3 캐비엇 회수와 `ws-event-types-extract.md` 의 `complete/` 이동을 "같은 PR" 로 명시한다. 그런데 그 plan 파일에는 `## 후속 (이 PR 범위 밖)` 절 안에 여전히 미체크 항목이 남아 있다 — `:450` "**(작음) facade 재수출 커버리지 비대칭**" (`websocket.service.spec.ts` 가 `InAppNotificationEventType` 재수출을 소비하지 않는 갭, fix 는 한 줄이라고 명시돼 있으나 아직 미실행). 같은 plan 안의 다른 항목(`:473`, `TerminalErrorPayload` 전수확인 건)은 "다른 트래커가 이미 센다 → 포인터로 대체해 닫는다" 로 정식으로 `[x]` 이관 처리됐지만, `:450` 항목은 그런 이관 없이 그냥 `[ ]` 로 남아 있다. plan-lifecycle 문서는 "후속" 항목도 예외 없이 0건이어야 `complete/` 이동을 허용한다고 명시하므로, target 이 지시한 대로 §3 만 처리하고 이동하면 이 규칙을 위반한 상태로 `complete/` 에 안착한다.
  - 제안: 셋 중 하나를 target 에 명시한다 — (a) `:450` 항목도 이번 PR 에서 함께 실행(본문이 "fix 는 한 줄" 이라고 이미 적어 뒀다), (b) `spec-sync-external-interaction-api-gaps.md` 에 정식 항목으로 이관하고 `:450` 을 그 이관을 가리키는 `[x]` 로 닫은 뒤 이동, (c) 이동을 별도 후속 PR 로 늦추고 이번 PR 은 캐비엇 회수까지만. (c) 를 고르면 §3 이 이미 경고한 "캐비엇 회수와 이동은 같은 PR" 원칙(DEAD 링크 방지)이 깨지므로, (a) 또는 (b) 가 더 안전하다.

- **[INFO]** `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 트래커 항목이 target 범위에서 언급되지 않음
  - target 위치: draft §1·§2 전체
  - 충돌 대상: `spec-sync-external-interaction-api-gaps.md:1947`("§R8 Rationale 의 `statusCode` 선재 갭 서술이 태어날 때부터 거짓이었다", 미체크) · `:1986`("`15-external-interaction.md §4` Redis 각주가 `redis-keys.md` 등재를 반영 못 한다", 미체크)
  - 상세: 이 "정본 트래커" 는 target §1·§2 와 **동일한 결함을 동일한 실측(커밋 SHA·순서 포함)으로 이미 별도 등재**해 두었다(2026-08-29). target 이 spec 본문을 고치면서 이 두 항목을 체크하거나 갱신하지 않으면, 트래커에는 이미 해소된 항목이 계속 `[ ]` 로 남아 다음 사람이 같은 조사를 반복하게 된다. 이는 spec/** 간 충돌은 아니지만 (plan vs spec 상태 drift) 이 draft 가 처리해야 할 인접 문서다.
  - 제안: target PR 에서 두 항목을 `[x]` 로 닫고 "이 draft PR 이 해소" 포인터를 남긴다(다른 항목들이 이미 쓰는 패턴 — 예: `:484`의 "다른 트래커가 이미 센다" 이관 방식을 반대 방향으로 적용).

## 요약

target 이 인용하는 4건의 spec 서술은 모두 실측(커밋 순서·코드 grep·plan 체크리스트 대조)으로 검증했고, 다른 spec 영역의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임과 직접 모순되는 지점은 없었다 — 이 draft 는 새 계약을 만들지 않고 이미 거짓이 된 서술을 코드 현실로 맞추는 정정이다. 유일한 실질 리스크는 spec 밖(§3 이 명시한 "동시 이동" 대상인 `ws-event-types-extract.md`)에 있다 — 그 plan 이 아직 만족하지 못하는 `plan-lifecycle.md` 의 "미해결 follow-up 0건" 조건을 target 이 건드리지 않고 넘어가면, 계획대로 실행 시 정책 위반 상태로 `complete/` 이동이 일어난다. 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 대응 항목 미갱신은 부차적 INFO.

## 위험도
LOW
