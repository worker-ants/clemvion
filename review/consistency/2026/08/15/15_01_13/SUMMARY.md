# Consistency Check 통합 보고서

**BLOCK: YES** — `spec/conventions/node-cancellation.md` 가 방금 코드가 스스로 정정한 결함(사용자 Stop 침묵)의 원인이 됐던 오해를 정본 문서에 여전히 담고 있음(cross_spec, rationale_continuity 두 checker 가 독립적으로 CRITICAL 판정, 근거 상세히 일치).

## 전체 위험도
**CRITICAL** — `node-cancellation.md` §2.4 매트릭스·Rationale 이 `finalizeCancelledExecution` 0행-매칭 시 emit 극성을 실제 구현과 반대로 서술(모두 skip / 자매와 동형 → 실제는 DB 재조회 후 CANCELLED면 emit, 극성 반대). 근본 원인은 `spec/` 파일이라 developer 세션 권한 밖 — planner 인계 필요.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity (중복 통합) | `spec/conventions/node-cancellation.md` §2.4 표(신규 행, ~198행)와 그 아래 Rationale 첫 불릿(~209-217행)이 "조건부 UPDATE 0행 매칭 시 emit 을 **모두 skip**, 자매 `finalizeFailedExecution` 과 **동형**" 이라고 서술. 그러나 HEAD 코드(`execution-engine.service.ts` `finalizeCancelledExecution`, ~4899-4929행)는 0행이면 DB 재조회 후 (a) 이미 CANCELLED → **emit 한다**(stop() RUNNING/PENDING 경로의 유일한 알림 지점), (b) FAILED/COMPLETED → skip. 즉 "모두 skip"·"동형" 은 거짓 — 극성이 자매와 반대다. | `spec/5-system/14-external-interaction-api.md` §6.5(`execution.cancelled` `durationMs`), §9.3 EIA-RL-06 이 의존하는 종결-emit 경로의 정본 서술 | `spec/conventions/node-cancellation.md` §2.4 표 197~198행 + Rationale 209-217행(같은 diff 에서 편집됐으나 미정정) | 표/Rationale 을 코드 주석·회귀 테스트(`describe('finalizeCancelledExecution — 0행 매칭의 두 의미')`)와 동형으로 재작성: "0행 매칭 시 DB 재조회 → CANCELLED 면 emit(유일한 알림 지점 보존), 그 외 terminal 이면 skip. `finalizeFailedExecution` 과는 진입점만 같고 `!persisted` 이후 처리는 **극성이 반대**(그쪽은 0행이면 무조건 skip)." "자매와 동형" 문구 삭제/한정 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 호출자(developer) 권한 밖입니다. **등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로**입니다 — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/conventions/node-cancellation.md` 는 `spec/` 파일 — developer 세션은 `spec/` read-only(CLAUDE.md Skill 체계 표), 정정을 이 턴에서 직접 실행할 권한 없음 | project-planner | `spec/conventions/node-cancellation.md` §2.4 구현 상태 표(~198행) + `## Rationale` "왜 취소 시각 보존 메커니즘이 두 가지인가" 첫 불릿(~209-217행) — 위 Critical 제안 문구로 재정정. 기존 취소선+정정노트 관행(577행, 816~824행 패턴) 재사용 가능 | `plan/in-progress/eia-db-wire-invariant.md:63-68` 의 `[x] node-cancellation.md 정정` 체크박스는 재오픈 필요(그 항목이 닫은 건 `692dfa00e` 시점 과대서술이었고, 이후 `b4d0ca27e`/`bf0f86ca8` 가 코드를 다시 바꿔 같은 문구가 재차 부정확해짐). 연관: `plan/in-progress/update-returning-tuple-shape.md` §후속 [planner 위임] 분류표(아래 WARNING #2)도 같은 정정 작업에서 함께 갱신 권장 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `update-returning-tuple-shape.md` §후속 [planner 위임] 호출부 분류표가 `finalizeCancelledExecution` 을 "반환값을 버리는 호출 — shape 과 무관 = 영향 없음" 으로 분류. 이번 PR(항목 ①)이 정확히 그 함수를 고쳐 이제 `updateExecutionStatus` 반환값(`persisted`)을 읽고 분기하므로 전제가 깨짐 | `spec/conventions/node-cancellation.md` §2.4 신규 행 + 근거 diff(`execution-engine.service.ts` `finalizeCancelledExecution`, `const persisted = await this.updateExecutionStatus(...)` 신규 추가) | `plan/in-progress/update-returning-tuple-shape.md` §후속 "[planner 위임] 소급 각주" 블록의 "영향 없음" 목록 | `finalizeCancelledExecution` 을 "영향 있음" 목록으로 재분류하는 각주 추가, 또는 project-planner 가 §2.4 caveat 집행 전 재실측하라는 안내 남기기. `eia-db-wire-invariant.md`/`spec-sync-external-interaction-api-gaps.md` 자체 정정은 불요(서술 정확) |
| 2 | convention_compliance | orchestrator 번들이 예산 초과로 target 이 직접 인용하는 conventions 문서 10개(swagger.md, error-codes.md, redis-keys.md 등)를 전부 생략하고, 무관한 cafe24/makeshop API 카탈로그(300+ 파일)가 앞자리를 차지 | `_prompts/convention_compliance.md` "정식 규약 모음" 청크 (harness 산출물, target 아님) | 번들링 우선순위 로직 | orchestrator 번들러가 target 본문이 명시적으로 링크하는 `spec/conventions/*.md` 를 저관련 대량 하위 트리보다 먼저 적재하도록 우선순위 조정 (harness 개선 항목, 본 PR 범위 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/data-flow/15-external-interaction.md` §1.2 `GET /:id` 필드 열거가 `durationMs` 추가를 반영 못해 기존부터 있던 비-망라 요약이 한 칸 더 벌어짐 | `spec/5-system/14-external-interaction-api.md` EIA-IN-04, §5.3 vs `spec/data-flow/15-external-interaction.md` §1.2 | 여유 있을 때 필드 목록 갱신 또는 "필드 목록은 EIA §5.3 참조"로 대체 |
| 2 | naming_collision | `durationMs` 를 §5.3 GET 응답에 확장 — 신규 식별자 아니라 §6 종결 이벤트/Execution 엔티티와 동일 필드 재노출. `toPersistedDate` 신규 유틸(전수 grep 1곳 정의+1곳 호출+1곳 테스트, 충돌 없음) | `spec/5-system/14-external-interaction-api.md` §5.3, `terminal-duration.ts` | 조치 불요 |
| 3 | convention_compliance | (참고, 관할 밖) node-cancellation.md §2.4 서술이 실제 분기보다 좁음 — 위 Critical #1 과 동일 사안, 이 checker 는 자기 관할(명명/포맷/구조/API문서/금지항목) 밖이라 INFO 로만 기록 | 상동 | 통합 단계에서 상위 CRITICAL 판정으로 흡수(하향 아님 — 이 checker 자신의 원 판정) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | node-cancellation.md §2.4/Rationale 이 `finalizeCancelledExecution` 0행-매칭 emit 극성을 실제 구현과 반대로 서술 |
| rationale_continuity | CRITICAL | 동일 사안 — `b4d0ca27e`/`bf0f86ca8` 두 교정 커밋이 코드는 고쳤으나 node-cancellation.md 는 갱신 안 함, "동형(무조건 skip)" 오해가 이번 PR 이 이미 한 번 만들었던 회귀 원인과 동일 |
| convention_compliance | LOW | CRITICAL 위반 없음(target 인용 conventions 10개 전부 실존 대조 완료). WARNING=번들 예산이 관련 conventions 를 생략(harness). node-cancellation.md 건은 INFO 로만(자기 관할 밖) |
| plan_coherence | LOW | plan 트래커 동기화는 양호. 유일 갭: 자매 plan `update-returning-tuple-shape.md` 의 호출부 분류표가 이번 diff 로 stale |
| naming_collision | NONE | 신규 식별자 표면 매우 좁음(`toPersistedDate` 1개, 충돌 없음). `durationMs` 재노출은 신규 식별자 아님 |

## 권장 조치사항
1. **(BLOCK 해소 최우선, planner 턴)** `spec/conventions/node-cancellation.md` §2.4 표(~198행)와 Rationale 첫 불릿(~209-217행)을 실제 `finalizeCancelledExecution` 극성(DB 재조회 후 CANCELLED면 emit, 그 외 skip; 자매와 진입점만 같고 극성은 반대)에 맞춰 재정정. `plan/in-progress/eia-db-wire-invariant.md:63-68` 체크박스 재오픈.
2. (WARNING) `plan/in-progress/update-returning-tuple-shape.md` 의 `finalizeCancelledExecution` 분류를 "영향 없음"→"영향 있음"으로 갱신 — 위 1번 정정과 같은 turn 에서 처리 권장.
3. (WARNING, harness) orchestrator 번들 우선순위 조정 — target 이 인용하는 conventions 를 대용량 무관 하위 트리보다 먼저 적재. 본 PR 범위 아님, 별도 백로그.
4. (INFO, 선택) `spec/data-flow/15-external-interaction.md` §1.2 필드 열거를 EIA §5.3 참조로 교체하거나 `durationMs` 반영.