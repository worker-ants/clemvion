# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 한계

`_prompts/rationale_continuity.md` 번들은 예산 초과로 target 15개 파일(4-execution-engine·5-expression-language·6-websocket-protocol·8-embedding-pipeline·9-rag-search·10-graph-rag·11-mcp-client·12-webhook·13-replay-rerun·14-external-interaction-api·15-chat-channel·17-agent-memory·_product-overview·7-llm-client·16-system-status-api)과 참조 Rationale 57개 파일 본문이 절단되어 있었다. 번들에 완전히 포함된 것은 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 와 일부 spec 의 `## Rationale` 발췌뿐이었다.

이에 따라 절단된 파일 중 이번 작업(task 이름 `eia-tracker-groom`)과 가장 밀접한 `spec/5-system/14-external-interaction-api.md`(EIA), 그리고 그것이 참조하는 `spec/5-system/12-webhook.md`(Rationale 절), `spec/5-system/2-api-convention.md`(Rationale 절), `spec/5-system/3-error-handling.md`, `spec/2-navigation/2-trigger-list.md`·`4-integration.md`(Rationale 발췌), `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 리포지토리에서 직접 Read 하여 교차 검증했다. `4-execution-engine.md`·`6-websocket-protocol.md`·`15-chat-channel.md`·`data-flow/15-external-interaction.md` 등 다른 truncated 파일은 EIA 본문의 인용 지점만 대조했고 전문 검증은 하지 못했다.

## 발견사항

이번 검토 범위 내에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다. 대신 아래는 검증 과정에서 확인한 사실과, 검토 범위 밖에 남아있는 잔여 리스크다.

- **[INFO] 직전 rationale_continuity 라운드가 지적한 R14 drift 는 이미 수정 반영됨**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R14 (`### R14. 토큰 검증 실패 status 통일`), 특히 `> 범위 명확화 (2026-08-11)` 콜아웃.
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"consistency 라운드가 넷을 더 잡았다" (2026-08-2x) — 이전 `rationale_continuity` 체커가 "R14 본문이 '모두 401(403 미사용)'로 단정하는데 `TOKEN_REFRESH_FORBIDDEN`(403) 이 예외로 존재해 표·콜아웃에만 반영되고 정본 Rationale 은 안 고쳐졌다"를 CRITICAL 로 잡았던 이력.
  - 상세: 현재 R14 본문에는 이미 "본 결정은 `InteractionGuard.deny()` 가 판정하는 검증 실패 5종에 한정되며 `refresh-token` 의 `403 TOKEN_REFRESH_FORBIDDEN` 은 예외"라는 명문화가 들어가 있다. 즉 지적된 drift 는 이미 해소된 상태이며 재발이 아니다. 추가로 이 tracker 는 리뷰어가 보고한 "동일 커밋 도입" 이력 주장을 검증 없이 옮겨 적었던 자기 실수까지 `git blame` 으로 재검증해 정정한 기록을 남겨두었다 — Rationale 연속성 관행이 리포지토리 차원에서 이미 성숙해 있다는 신호로 판단해 별도 조치 불필요.
  - 제안: 조치 불필요 (기록 목적).

- **[INFO] 검토 범위 밖 truncated 파일에 대한 잔여 리스크**
  - target 위치: `spec/5-system/4-execution-engine.md`, `6-websocket-protocol.md`, `15-chat-channel.md`, `12-webhook.md` 본문(§Rationale 이외 부분), `data-flow/15-external-interaction.md` 등.
  - 과거 결정 출처: 해당 없음 (미검증 자체가 리스크).
  - 상세: EIA 문서의 R10(단일 sink 정책 확장), R15(전용 outbox 미신설), R7(seq counter Redis-only) 등은 `4-execution-engine.md §4.4/§9.2`, `15-chat-channel.md §R-CC-10/R-CC-16`, `plan/complete/eia-distributed-seq-counter.md` 를 정본으로 인용하지만, 이번 세션에서는 이 파일들의 전문을 직접 열어 "인용된 결정이 실제로 그 문서에 그렇게 적혀 있는지"까지는 확인하지 못했다(EIA 쪽 인용문·cross-link 존재만 확인). 과거 tracker 기록(`spec-sync-external-interaction-api-gaps.md`)에서 이미 유사한 "인용 위치 오기"·"미러 문서 stale" 결함이 여러 차례 발견·수정된 이력이 있어, 구조적으로 재발 가능성이 남아있는 지점이다.
  - 제안: 실제 구현 착수 대상이 `4-execution-engine.md`/`6-websocket-protocol.md`/`15-chat-channel.md`/`12-webhook.md` 본문에 걸쳐 있다면, 착수 직전 해당 파일들을 대상으로 좁은 스코프의 `rationale_continuity` 재검토를 1회 더 수행할 것을 권고한다 (이번 라운드는 예산 절단으로 완전한 커버리지가 아니었음을 명시).

- **[INFO] `spec/5-system/2-api-convention.md`·`3-error-handling.md`·`spec/2-navigation/2-trigger-list.md` 교차 검증 — 정합 확인**
  - target 위치: `2-api-convention.md §2.2` (`/api/external/{resource}` 예외 명시), `3-error-handling.md §1.3/§1.6` (`INVALID_STATE` 422 ↔ WS `INVALID_EXECUTION_STATE` ↔ EIA `STATE_MISMATCH` 409 매핑), `2-navigation/2-trigger-list.md` Rationale R-2/R-14.
  - 과거 결정 출처: 위 세 문서 각각의 `## Rationale`.
  - 상세: EIA §R11(외부 prefix 분리), §R13(표면별 에러 코드 매핑), §4 Trigger 등록 페이로드의 `notification.secret` rotation(`/api/triggers/:id/notification/rotate-secret`, grace 24h)이 api-convention.md·error-handling.md·trigger-list.md 의 Rationale 과 모두 상호 참조가 일치했다. `trigger-list.md R-2` 가 TBD 로 남긴 "webhook HMAC secret v1.1 rotate" 는 EIA notification secret rotate(EIA-NX-12, 이미 구현)와 별개 항목으로 명확히 구분되어 있어 혼동의 여지가 없었다.
  - 제안: 조치 불필요.

## 요약

Rationale 연속성 관점에서, 이번 세션이 직접 검증할 수 있었던 범위(EIA 스펙 본문·Rationale R1~R19, 그리고 이를 참조하는 webhook.md·api-convention.md·error-handling.md·trigger-list.md·integration.md 의 Rationale, EIA 트래커의 자기 수정 이력)에서는 기각된 대안의 재도입이나 합의 원칙 위반, 무근거 번복이 발견되지 않았다. 오히려 이 저장소는 결정 변경 시 옛 표현을 명시적으로 "폐기/기각/번복"으로 표기하고 근거 커밋을 인용하는 관행이 강하며, 직전 rationale_continuity 라운드가 잡았던 R14 drift 도 이미 스펙 본문에 반영·해소되어 있었다. 다만 prompt 번들의 컨텍스트 예산 절단으로 `4-execution-engine.md`·`6-websocket-protocol.md`·`15-chat-channel.md` 등 EIA 가 인용하는 정본 문서들의 전문은 검증하지 못했으므로, 이 부분에 걸친 구현이 시작되면 좁은 스코프의 재검토가 필요하다.

## 위험도
LOW
