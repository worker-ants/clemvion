# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 이번 diff(durationMs 종결 이벤트 3종 구현 + Re-run `/v1/` 경로 오탈자 정정)는 새로운 cross-spec 충돌·규약 위반·신규 식별자 충돌·plan 불일치를 만들지 않았다. 발견된 WARNING 4건은 전부 (a) diff 밖의 기존(pre-existing) 이슈이거나(3건, 이미 `spec-sync-external-interaction-api-gaps.md` 추적 중) (b) 이번 PR 이 spec 에 새로 못박은 invariant 문구에 이미 알려진 예외 캐비엇이 빠진 것(1건, 코드 수정 불요·spec 문구 정정만 필요).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §8.2 "HMAC algorithm whitelist: `hmac-sha256` 만" 서술이 같은 문서 §3.1 EIA-NX-03·§Rationale R12·`spec/data-flow/15-external-interaction.md` §1.4·코드(`notification-signature.util.ts` `SupportedHmacAlgorithm`)와 모순 (전부 sha256+sha512 둘 다가 화이트리스트) | `spec/5-system/14-external-interaction-api.md` §8.2 (894–899행) | 같은 문서 §3.1/R12, `spec/data-flow/15-external-interaction.md` §1.4, 코드 SoT | §8.2 를 "hmac-sha256 / hmac-sha512(§R12)" 로 정정, "v2 추가 시 v2= prefix" 문구는 삭제 또는 secret rotation 표기와 구분 재작성 |
| 2 | cross_spec (재확인, pre-existing) | `15-chat-channel.md` 가 `InteractionRequestContext` 를 옛 형태(단일 인터페이스+optional `scope`)로 서술 — EIA §3.3.1 의 discriminated union(`External…`/`Internal…`)과 불일치. 문서 stale, 런타임 결함 아님 (코드는 이미 union 사용) | `spec/5-system/15-chat-channel.md` §5.1(319행)·§8(507행) | `spec/5-system/14-external-interaction-api.md` §3.3.1 | 15-chat-channel.md 서술을 EIA §3.3.1 cross-link 로 교체(내용 재중복 금지) — 이미 `spec-sync-external-interaction-api-gaps.md` `- [ ]` 등재됨 |
| 3 | cross_spec (재확인, pre-existing) | EIA §5.1 이 `12-webhook.md` §5.2 를 "legacy `statusCode/errors` 형식" 이라 서술하나 §5.2 는 이미 2026-06-28 신컨벤션(`{error:{code,message,...}}`)으로 정합화됨 — 대비 서술이 그릇된 인상 유발 | `spec/5-system/14-external-interaction-api.md` 317행 | `spec/5-system/12-webhook.md` §5.2(295행) | 317행 legacy 대비 문구 삭제 또는 "2026-06-28 정합화 이후 동일 컨벤션" 으로 정정 — 이미 같은 plan 파일에 등재됨 |
| 4 | rationale_continuity | 이 PR 이 §6/§6.5 에 새로 못박은 "durationMs 는 DB 와 wire 가 같은 값" invariant 에, 같은 code-review 사이클이 이미 발견해 plan 백로그에 등재한 반례(retry-turn CANCELLED 재진입 시 DB(T1)≠emit(T2))가 캐비엇 없이 누락 — 이 문서 자신의 "알려진 갭은 명시한다" 관행(R14/R17/§6.4/§1.5)과 불일치 | `spec/5-system/14-external-interaction-api.md:575`(§6 표), `:808`(§6.5 blockquote) | `retry-turn.service.ts` `finalizeGuarded`/`failRetryExecution`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W1 | §6 표 또는 §6.5 blockquote 에 "단, retry-turn CANCELLED 재진입 시 DB(최초 stop 값)와 emit(재진입 시점 값)이 어긋날 수 있다 — 추적: spec-sync-external-interaction-api-gaps.md W1" 한 줄 추가. 코드 수정은 스코프 밖(타당) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec (재확인, pre-existing) | `spec/data-flow/15-external-interaction.md:119` 가 정의되지 않은 `EIA-AU-09` 참조 (실제로는 `EIA-AU-08` 만 존재, 오탈자로 추정) | `spec/data-flow/15-external-interaction.md:119` | `EIA-AU-08/09` → `EIA-AU-08` 로 정정 |
| 2 | rationale_continuity | `spec/data-flow/3-execution.md` 시퀀스 다이어그램이 EIA 신규 캐비엇(큐 대기시간 구분 등) 미반영 — 3라운드째 이월, Rationale 위반은 아님(결과적으로 참) | `spec/data-flow/3-execution.md:111` | 이번 PR 범위 밖이면 plan 에 "다음 턴 이연" 사유 명시 |
| 3 | plan_coherence | `plan/in-progress/eia-terminal-payload.md`·`retry-turn-terminal-guard.md` #2 가 인용하는 `retry-turn.service.ts` 줄 번호(`:956~965`)가 이번 durationMs 구현으로 실제 emit 위치(`:964`)와 소폭 더 벌어짐. 함수 심볼로 특정 가능해 추적 실패 위험 낮음, 결정 충돌 없음 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution` | 조치 불요(이전 라운드 판정 유지) — 해당 항목 착수 시 자연히 재확인됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | diff 자체는 정합. §8.2 HMAC 화이트리스트 자기모순(신규 발견) + 15-chat-channel.md stale 서술·EIA §5.1 webhook legacy 오분류(재확인, pre-existing) 3건 WARNING + EIA-AU-09 dangling 참조 1건 INFO |
| rationale_continuity | LOW | R8 캐시 스코프·"삭제된 약속"·Planned→구현됨 보존 관행 모두 무결. 신규 invariant("DB=wire") 에 이미 알려진 예외(retry-turn 재진입) 캐비엇 누락 1건 WARNING + data-flow 다이어그램 미동기화 1건 INFO(3라운드째 이월) |
| convention_compliance | NONE | `spec/conventions/**` 전 축(swagger/error-codes/redis-keys/secret-store/audit-actions/interaction-type-registry) 위반 없음. 코드 대조로 재확인 |
| plan_coherence | NONE | 직전 라운드 WARNING(durationMs Planned→구현됨 미반영) 완전 해소 확인. 잔여는 줄 번호 staleness 1건 INFO(저위험, 이전 판정 유지) |
| naming_collision | NONE | 신규 식별자 도입 없음. `durationMs` 재사용은 기존 정의와 의미 일치, Re-run 경로 정정은 자매 문서·컨트롤러·API 규약과 정합 |

## 권장 조치사항
1. §8.2 HMAC 화이트리스트 문구를 §3.1/R12 와 일치시켜 "hmac-sha256 / hmac-sha512" 로 정정 (신규 발견, 우선순위 최상 — 보안 섹션 자기모순).
2. §6/§6.5 의 "DB=wire" invariant 에 retry-turn CANCELLED 재진입 예외 캐비엇 한 줄 추가 (신규 발견, 이 문서 자신의 관행과 정합화).
3. `15-chat-channel.md` 의 `InteractionRequestContext` 구형 서술을 EIA §3.3.1 union 에 대한 cross-link 로 교체 (pre-existing, 이미 추적 중이나 미해소).
4. EIA §5.1 의 webhook "legacy statusCode/errors" 대비 문구 정정 (pre-existing, 이미 추적 중이나 미해소).
5. (선택, 낮은 우선순위) `EIA-AU-08/09` → `EIA-AU-08` 오탈자 정정.

모든 항목은 spec 텍스트 정정 수준이며 이번 PR 의 실제 동작(코드)에는 영향이 없음 — BLOCK 사유 아님.