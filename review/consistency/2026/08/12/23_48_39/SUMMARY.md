# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — target(`spec/data-flow/`) 자체는 이번 diff 에서 변경되지 않았고, 실제 변경은 `IdempotencyInterceptor` 의 캐시 손상 처리 버그 픽스(fail-open 완성) 1건. 5개 checker 전원이 Critical/Warning 없음으로 판정했고, rationale_continuity 가 INFO 1건(문서 표현 세밀도 격차)만 남겼다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | Fail-open 5-경로/4-warn 세분화가 data-flow 문서의 "일괄 warn" 서술과 결이 다름. 코드 JSDoc 은 "경로 1(기동 시 미주입)"은 장애가 아니므로 warn 을 안 남긴다고 세분화하지만, `spec/data-flow/15-external-interaction.md` Rationale "Fail-open 정책의 일관 표기"는 "모두 … warn 로그"로 뭉뚱그려 서술한다. 결정 번복이 아니라 기존 fail-open 원칙을 더 정확히 충족시키는 방향의 변경(경로 세분화가 문서에 아직 반영 안 됨) | `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표 및 하단 Rationale | 필수 아님. 원한다면 §2.2 표 각주나 Rationale 문단에 "구성 미주입(기동 시 null)은 장애가 아니므로 warn 제외" 한 줄 추가로 두 문서의 표현 granularity 를 맞출 수 있음 |
| 2 | convention_compliance | 프롬프트 번들이 `spec/conventions/error-codes.md` · `execution-context.md` · `interaction-type-registry.md` · `node-output.md` · `swagger.md` · `migrations.md` · `conversation-thread.md` 등 EIA 관련 conventions 핵심 문서를 컨텍스트 예산 초과로 반복 절단(프로세스 관찰, 규약 위반 아님. 이번엔 절대경로 직접 대조로 보완 완료) | orchestrator 프롬프트 조립 단계 (`spec/conventions/*`) | target 이 명시적으로 cross-reference 하는 conventions 파일에 예산 우선순위 부여 검토 (기존 `feedback_consistency_spec_mode_budget.md` 계열 재확인) |
| 3 | cross_spec | 동일 원인의 예산 절단 — `spec/5-system/14-external-interaction-api.md`(EIA 본문) 및 `spec/5-system/15-chat-channel.md` 등 대다수 `related_specs` 가 절단됨(직접 대조로 보완 완료) | prompt 번들 `related_specs` | 위 항목과 동일 근본 원인 — 병행 해결 권장 |
| 4 | plan_coherence | `plan/in-progress/spec-draft-eia-r8-alignment.md` 는 체크리스트 전 항목 `[x]`이고 미해결 후속이 안 보이는데 `status: in-progress` 로 남아 있음(이번 diff 가 만든 상태 아님) | `plan/in-progress/spec-draft-eia-r8-alignment.md` | `plan/complete/` 이동 대상인지 다음 planner 턴에서 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | R8 닫힌 캐시 목록·캐시 키 스코프·fail-open 3계약 불변. 신규 엔드포인트/필드/요구사항 ID/상태전이/RBAC 변경 없음. spec 절단분은 직접 대조로 보강 |
| rationale_continuity | LOW | 기존 "캐시 대상 닫힌 목록/키 스코프/fail-open" Rationale 재도입·번복·우회 없음. fail-open 경로 세분화가 문서 표현보다 더 정밀해진 것은 결손 보완이지 번복 아님 (INFO 1건) |
| convention_compliance | NONE | 에러코드 UPPER_SNAKE_CASE, secret URI scheme, BullMQ 큐 카탈로그 동기화, migration 컬럼 인용, 문서 5-요소 구조 전부 충족. 금지 패턴 미관측. conventions 절단은 프로세스 관찰(INFO) |
| plan_coherence | NONE | 겨냥한 plan 항목(`backend-lint-gate-broken-on-main.md`)이 같은 diff 안에서 체크박스까지 동기화됨. 다른 미해결 plan 항목과 선행조건/결정 축 충돌 없음 |
| naming_collision | NONE | 신규 spec 레벨 식별자 없음. 신설 private 메서드 `discardCorruptEntry`·warn 로그 문자열 2종 모두 codebase 전역에서 유일 (grep 확인) |

## 권장 조치사항
1. (선택) `spec/data-flow/15-external-interaction.md` §2.2 표 각주 또는 Rationale 에 "구성 미주입(기동 시 null)은 장애가 아니므로 warn 제외" 한 줄 추가 — fail-open 경로 세분화와 문서 표현의 granularity 일치.
2. (프로세스) consistency-check 프롬프트 조립 시 target(`spec/data-flow/`)이 명시적으로 참조하는 `spec/conventions/*.md` 및 `spec/5-system/14-external-interaction-api.md` 등에 예산 우선순위 부여 — 동일 절단이 3개 checker(cross_spec/rationale_continuity/convention_compliance)에서 반복 관측됨.
3. (선택) `plan/in-progress/spec-draft-eia-r8-alignment.md` 의 `plan/complete/` 이동 여부를 다음 planner 턴에서 확인.

Critical/Warning 없음 — 차단 사유 없음. 위 INFO 는 모두 비차단 참고 사항.
