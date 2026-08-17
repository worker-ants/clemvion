# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건(spec/spec 직접 모순)이 있어 호출자가 차단해야 함

## 전체 위험도
**HIGH** — `spec/1-data-model.md` §2.13 이 이번 PR 이 갱신한 EIA/WS 마스킹 결정과 정면으로 모순되는 낡은 서술을 그대로 유지 중(cross_spec CRITICAL). 나머지 4개 checker(rationale_continuity/convention_compliance/plan_coherence/naming_collision)는 LOW~NONE 이며 실질적 위반 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/1-data-model.md` §2.13 "응답 마스킹" 행이 (a) 이제 낡은 것으로 명시 정정된 "4곳" 표면 개수를 그대로 재기재하고, (b) "WS `execution.node.*` emit 은 마스킹 미포함"이라는, 이번 PR 로 사실이 아니게 된 주장을 계속 단언 | `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" / "잔여 ① 해소(2026-08-16)", `spec/5-system/6-websocket-protocol.md` §4.1 값-패턴 마스킹 캐비엇 | `spec/1-data-model.md` L564 (Execution.error ↔ NodeExecution.error 관계 표, 이번 diff 미포함) | `1-data-model.md` L564 를 (a) 개수 재기재 없이 EIA §R17 참조로 축약하거나, (b) 최소한 "WS emit 미포함" 캐비엇을 "emit 시점 값-패턴 마스킹 대상(2026-08-16)"으로 정정 |

## planner 인계 (권한 밖 Critical)

> 이 항목은 `spec/1-data-model.md` 정정이 필요하다는 점에서 등급 CRITICAL·`BLOCK: YES` 는
> 그대로 유지된다. developer 트랙(이번 target: `spec/5-system/` 5파일 + codebase 마스킹 구현)은
> `spec/` 이 read-only 이고, 이번 PR 의 명시 스코프 밖(`1-data-model.md`)까지 건드리는 것은
> 권한 확장이므로 이 정정은 planner 턴으로 인계한다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | developer 는 `spec/` write 권한 없음(read-only) + 이번 PR 스코프(`spec/5-system/`)가 아닌 `spec/1-data-model.md` 정정이 필요 | project-planner | `spec/1-data-model.md` §2.13 "Execution.error ↔ NodeExecution.error 관계" 표의 "응답 마스킹" 행 — EIA §R17(여섯 표면·둘 컬럼) 참조로 축약 또는 WS emit 캐비엇 정정 | `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md` §4.1 (근거 SoT) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `spec/5-system/13-replay-rerun.md` §10.2(Re-run 모달)에 `inputData` 비-마스킹 결정의 교차 참조 부재 — 모순은 아니나 침묵이 향후 회귀 재도입 위험 | `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ② — inputData 는 의도적 비대상(2026-08-16)" | `spec/5-system/13-replay-rerun.md` §10.2 (이번 diff 미포함) | §10.2 에 "`inputData` 는 egress 마스킹 대상이 아니다" 캐비엇 1줄 + EIA §R17 링크 추가 |
| 2 | plan_coherence | `plan/in-progress/eia-fanout-and-internal-data-masking.md` frontmatter `spec_impact` 가 실제 변경 5개 spec 파일 중 3개만 나열(`15-chat-channel.md`·`3-error-handling.md` 누락) | plan frontmatter `:10-13` | 실제 diff: `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,14-external-interaction-api,15-chat-channel}.md` (5개) | `spec_impact` 를 `plan/complete/spec-draft-eia-fanout-masking.md` 와 동일하게 5개 전부로 갱신(complete/ 이동 전 필수) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 유저 가이드(`run-results.mdx`/`.en.mdx`) 예시가 구 필드명(`nodeName`)·구 에러코드(`NODE_EXECUTION_FAILED`) 유지 — 이번 PR 범위 밖 기존 drift | `codebase/frontend/.../run-results.mdx` L163-178 | 별도 documentation-sync 항목으로 처리(비차단) |
| 2 | rationale_continuity | `nodeOutput` allowlist 잔여 노트가 신규 emit 값-패턴 마스킹 층(부분 완화 효과)을 아직 반영 안 함 | `14-external-interaction-api.md` §R17 말미 "nodeOutput 일반 키 allowlist" 불릿 | "2026-08-16 이후 값-패턴 마스킹 층 추가로 gap 부분 축소됨" 1줄 교차 참조 추가 |
| 3 | convention_compliance | `redact-stored-error.ts` 파일명이 이제 error 외 컬럼(inputData/outputData)도 커버 — 강제 규약 없음 | `shared/utils/redact-stored-error.ts` `redactStoredDataForResponse` | 후속에 `redact-stored-response.ts` rename 또는 스코프 주석 |
| 4 | convention_compliance | 두 DTO 파일이 JSDoc vs `@ApiPropertyOptional(description)` 스타일 분리 유지 — 이번 PR 이전부터의 기존 편차, 신규 위반 아님 | `execution-response.dto.ts` vs `background-run-response.dto.ts` | 다음에 `background-run-response.dto.ts` 만질 때 JSDoc 패턴으로 통일 고려 |
| 5 | convention_compliance | 마스킹 정책이 정식 컨벤션 파일이 아닌 도메인 spec(EIA §R17)에 SoT — 기존 위임 패턴과 동형, 규약 위반 아님 | `3-error-handling`/`6-websocket-protocol`/`12-webhook`/`14-external-interaction-api`/`15-chat-channel` | 캐비엇이 더 늘면 `spec/conventions/output-masking.md` 승격 고려 |
| 6 | convention_compliance | review 세션 timestamp 를 spec 본문에 직접 인용 — 확립된 관행과 일치 | `14-external-interaction-api.md` §R17 | 조치 불요 |
| 7 | naming_collision | "값-레벨 마스킹"(기각안) vs "값-패턴 마스킹"(신규 채택) 용어 근접 — target 자신이 이미 "병존" 캐비엇으로 해소 | `6-websocket-protocol.md` §4.1 / `## Rationale` | 조치 불요(향후 절 재정비 시 용어 통일 고려) |
| 8 | naming_collision | 마스킹 마커 리터럴 `'[REDACTED]'` SoT 가 여전히 3곳(target 신규 `KEY_MASK_MARKER` + `sanitize-response-headers.util.ts` + `workflow-assistant/tools/redact.ts`)에 분산 — 이름 충돌 아님 | `sanitize-error-message.ts` `KEY_MASK_MARKER` | 후속으로 두 지역 `REDACTED` 상수를 `KEY_MASK_MARKER` export 로 교체 또는 상호 참조 주석 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `spec/1-data-model.md` §2.13 이 이번 PR 의 EIA §R17/WS §4.1 갱신과 직접 모순(CRITICAL) + `13-replay-rerun.md` 침묵(WARNING) |
| rationale_continuity | LOW | 기각된 대안 재도입·무근거 번복 없음. `nodeOutput` allowlist 잔여 노트 미갱신(INFO)만 재기재 |
| convention_compliance | LOW | CRITICAL/WARNING 없음. 파일명 스코프 드리프트·DTO 스타일 편차·정책 분산 전부 INFO, 위반 아님 |
| plan_coherence | LOW | 트래커·CHANGELOG·plan 정합 매우 높음. `spec_impact` frontmatter 부분집합 나열(WARNING) 1건만 |
| naming_collision | NONE | 신규 ID/endpoint/코드 심볼 충돌 없음. 용어 근접·마커 리터럴 분산은 INFO |

## 권장 조치사항

1. **(BLOCK 해소 우선)** `spec/1-data-model.md` §2.13 "응답 마스킹" 행을 EIA §R17 최신 상태(여섯 표면·둘 컬럼, WS emit 포함)에 맞춰 정정 — **§planner 인계** 표에 명시된 대로 project-planner 턴에서 처리(developer 는 `spec/` read-only + 이번 PR 스코프 밖).
2. `spec/5-system/13-replay-rerun.md` §10.2 에 `inputData` egress 비-마스킹 캐비엇 1줄 추가(WARNING #1) — 이 항목은 target PR 스코프(`spec/5-system/`) 내이므로 developer 트랙에서도 처리 가능하면 함께 처리.
3. `plan/in-progress/eia-fanout-and-internal-data-masking.md` frontmatter `spec_impact` 를 5개 전부로 갱신(WARNING #2) — `complete/` 이동 전 필수.
4. INFO 8건은 비차단 — 우선순위 낮은 후속 항목으로 각자 트래커에 등재 권장(특히 `nodeOutput` allowlist 노트 갱신, `[REDACTED]` 마커 SoT 통합).