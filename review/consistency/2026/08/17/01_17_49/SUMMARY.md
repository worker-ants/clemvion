# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(cross_spec) 발견, 호출자 차단 필요.

## 전체 위험도
**HIGH** — WS 라이브 이벤트 마스킹과 REST 폴링 값이 같은 프런트 store 슬롯에서 충돌해, 이번 PR 이 세우려던 "boundary masking parity" 불변식이 가장 많이 쓰이는 실시간 실행 화면(Run Results 드로어)에서 flip-flop 으로 무효화된다. 나머지 4개 checker 는 전부 LOW(WARNING/INFO 수준)로 수렴.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | WS `node.*` emit 의 `input` 값-마스킹(신규)이 REST `NodeExecution.inputData` 비마스킹(§R17 잔여②, 기존 결정)과 **같은 프런트 store 슬롯**(`nodeResults[...].inputData`, Run Results 드로어 Input 탭)에서 충돌 — mid-flight 실행 중 2초 간격 `refetchInterval` REST 폴링이 `applyExecutionSnapshot()` 으로 원문 값을 재적용해, WS 도달 순간엔 마스킹된 값이 ≤2초 후 원문으로 되돌아가는 flip-flop 발생 | `spec/5-system/6-websocket-protocol.md` §4.1 신규 캐비엇("emit 의 `input` 은 마스킹하는데 REST `inputData` 는 안 하는 이유", 2026-08-17) | `spec/5-system/14-external-interaction-api.md` §R17 잔여② · `spec/1-data-model.md` §2.14 `input_data` 행(캐비엇 없음, 자매 `output_data` 행과 비대칭) · `spec/3-workflow-editor/3-execution.md` §10.6.1 · 실제 코드(`use-execution-events.ts`/`apply-execution-snapshot.ts`/실행 상세 `page.tsx` 의 REST→store bridge) | ① `NodeExecution.inputData` 도 REST 응답에서 `redactStoredDataForResponse` 로 값-마스킹(§R17 잔여②의 재제출 근거는 Execution 레벨 한정, NodeExecution 레벨엔 재제출 소비처 없음), 또는 ② WS `node.*` emit 의 `input` 필드에서 마스킹 제외(REST 와 계약 일치). 어느 쪽이든 §10.6.1·`1-data-model.md` §2.14 `input_data` 행에 정책 갱신 동반 필요 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 두 spec 문서(`6-websocket-protocol.md` §4.1 신규 캐비엇 vs `14-external-interaction-api.md` §R17 잔여②)가 각각 독립적으로는 합리적으로 내린 마스킹 정책 결정이 프런트 데이터 흐름에서 충돌하는 것이며, 해소에는 "WS emit 과 REST 중 어느 쪽 마스킹 정책이 우선하는가"라는 신규 spec 결정이 필요하다. 이는 `spec/` 저작 권한(project-planner)의 범위이고, 이번 검토가 developer 의 `--impl-done` 턴 산출물이라면(plan_coherence 발견에 근거) 이 자리에서 developer 가 스스로 spec 을 고칠 수 없다. **등급은 CRITICAL, `BLOCK: YES` 그대로 유지.**

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/6-websocket-protocol.md` §4.1 과 `spec/5-system/14-external-interaction-api.md` §R17 두 spec 문서 간 마스킹 정책 우선순위 결정 필요 — developer 권한(`spec/` read-only) 밖 | project-planner | `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 재작성 **또는** `spec/5-system/14-external-interaction-api.md` §R17 잔여② 재작성(택1), 동반: `spec/1-data-model.md` §2.14 `input_data` 행 각주 추가, `spec/3-workflow-editor/3-execution.md` §10.6.1 갱신 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` (이 작업의 집행 plan) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | EIA §R17 의 egress 값-마스킹 채택이 webhook ingestion-마스킹 Rationale 이 기각한 "display 시점 마스킹" 패턴을 재도입 — whack-a-mole 논거를 이름 붙여 반박하지 않음(이 브랜치 자체 이력이 그 우려를 실증: 표면 4→6, `inputData` 1회 왕복) | `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가" 절 | `spec/5-system/12-webhook.md` Rationale "민감 헤더 마스킹 — ingestion 시점 채택" (b) whack-a-mole 논거 | §R17 "언제 가리는가" 절에 "whack-a-mole 우려는 소수의 공유 관문(`toResponseExecution`·`emitExecutionEvent`/`emitNodeEvent`·`toTerminalErrorPayload`)으로 수렴시켜 완화한다"는 반박 문장 1개 추가 |
| 2 | convention_compliance | 신규 DTO description(4개 필드, 200~400자/5~9줄)이 `spec/conventions/swagger.md` §3 "10~40자 내외" 규약을 5~10배 초과 — 이 PR 이 처음 만든 패턴은 아니나(기존 9개+ DTO 선례) 대표적으로 더 키움 | `execution-response.dto.ts`(`inputData`/`outputData`/`error`) · `background-run-response.dto.ts`(`inputData`/`outputData`) | `spec/conventions/swagger.md` §3 | (a) 규약을 "보안/정책 민감 필드는 요약 1문장 + spec 링크"로 갱신해 관행 추인, 또는 (b) 신규 4필드 description 을 1~2문장+링크로 축약. 택1 |
| 3 | plan_coherence | 집행 plan 이 매 라운드를 기록해온 자기 관행을 `00_59_32` BLOCK:YES 라운드(CRITICAL 2건 → `39cb0bf1a` 로 해소)에서만 놓쳐, "재실행이 있었고 CRITICAL 이 나왔다 해소됐다"는 사실이 plan 문서에 미기록(동일 클래스 문제 3번째 재발, plan 자신이 2번 자기지적한 이력 있음) | `plan/in-progress/eia-fanout-and-internal-data-masking.md` `## 작업 체크리스트` `:256`·`:263` | (해당 없음 — plan 문서 자체 정합 이슈) | `:263` 항목을 `- [x] `--impl-done` 재실행 (`00_59_32`) — BLOCK: YES · CRITICAL 2(WS `input`/REST `inputData` 비대칭·`node-output.md` Principle 7 raw-echo 우선순위) → `39cb0bf1a` 로 해소`로 갱신 |
| 4 | naming_collision | 신규 마커 상수 `KEY_MASK_MARKER='[REDACTED]'`(`sanitize-error-message.ts`)가 기존 비공개(un-exported) 동일-리터럴 상수 2곳(`sanitize-response-headers.util.ts`·`workflow-assistant/tools/redact.ts`)과 값으로만 결합 — 컴파일러가 강제하지 않아 한쪽이 리터럴을 바꾸면 `isMaskedMarker` 가 조용히 놓쳐 이중 마스킹 재발 가능 | `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`KEY_MASK_MARKER`) | `sanitize-response-headers.util.ts:25`(`REDACTED`) · `workflow-assistant/tools/redact.ts:11`(`REDACTED`) | 두 기존 상수를 export 해 `KEY_MASK_MARKER` 를 단일 진실로 참조하게 하거나, 최소 `{@link}` 상호 참조 주석 추가(후속 트래커 등재로 충분, 이번 PR 차단 사유 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | WS §4 이벤트 표의 `execution.node.completed` 등 4행이 §4.1 캐비엇이 참조하는 `input` 필드를 여전히 닫힌 목록에서 누락(PR 범위 밖 선재 갭, 이번 캐비엇이 처음 근거로 소비) | `spec/5-system/6-websocket-protocol.md` §4 표 | 4행을 `…필드 집합` 형태로 열거나 `input`/`parentNodeExecutionId`/`status`/`startedAt`/`finishedAt` 명시 추가 |
| 2 | rationale_continuity | "boundary masking parity" 원칙 인용이 2단계 원용(WS §4.1 → EIA §R17 → 실행내역 R-5)을 거치며 원 출처 caveat 이 흐려짐(결론은 타당) | `spec/5-system/6-websocket-protocol.md` §4.1 캐비엇 | 인용에 원 출처(`14-execution-history.md#r-5`) 한 홉 추가 명시. 급하지 않음 |
| 3 | convention_compliance | WS §4.1 표가 기존(origin/main 부터 존재) blockquote 삽입으로 GFM 렌더링 중간 절단되던 결함을, 이번 PR 이 1줄→23줄 블록으로 증폭(정식 규약 위반 아님) | `spec/5-system/6-websocket-protocol.md` §4.1, `node.cancelled`~`waiting_for_input` 행 사이 | blockquote 를 표 완결 이후로 이동하거나 하위 섹션(`### 4.1.1`)으로 분리(`13-replay-rerun.md §10.2` 패턴 참고). 다른 checker/후속 정리로 이관 가능 |
| 4 | convention_compliance | 명명·상호참조(`nodeName`→`nodeLabel`, `redactStoredDataForResponse` 등 식별자, `[EIA §R17]` 류 앵커) 전수 확인 결과 일관 — 위반 없음 | 여러 곳(본문 참조) | 조치 불요 |
| 5 | naming_collision | 같은 WS §4.1 표에서 구현된 5행은 `nodeLabel` 로 정정됐는데 미구현 `execution.paused` 행만 `nodeName` 잔존 — 향후 구현 시 drift 재발 위험(문서 자체 각주로 이미 완화됨) | `spec/5-system/6-websocket-protocol.md` §4.1, `execution.paused` 행(L185) | `execution.paused` 행도 `nodeLabel` 로 함께 정정하고 각주 제거(선택 사항) |
| 6 | naming_collision | `WIRE_PRESERVED_FIELDS`(신규)가 `EXTERNAL_STRIPPED_FIELDS`(기존)를 `new Set(...)` 파생으로 감싸 이름은 반대지만 실질 동일 배열 — drift 위험 스스로 차단됨 | `codebase/backend/src/modules/websocket/websocket.service.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | WS emit `input` 마스킹 vs REST `inputData` 비마스킹이 같은 store 슬롯에서 flip-flop — CRITICAL 1건 |
| rationale_continuity | LOW | egress 마스킹이 webhook Rationale 의 whack-a-mole 기각 논거를 미반박(재도입 자체는 정합) — WARNING 1건 |
| convention_compliance | LOW | swagger.md DTO description 길이 규약과 신규 필드 간 괴리(기존 관행의 연장) — WARNING 1건 |
| plan_coherence | LOW | 집행 plan 이 직전 BLOCK:YES 라운드(`00_59_32`→해소)를 미기록 — WARNING 1건 |
| naming_collision | LOW | `KEY_MASK_MARKER` 가 비공개 동일-리터럴 상수 2곳과 값으로만 결합 — WARNING 1건, 신규 요구사항ID/엔드포인트/이벤트명 충돌은 0건 |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** project-planner 턴에서 WS §4.1 vs EIA §R17 잔여② 중 하나를 골라 `NodeExecution.inputData` REST/WS 마스킹 정책을 일치시키고, `spec/1-data-model.md` §2.14 · `spec/3-workflow-editor/3-execution.md` §10.6.1 을 동반 갱신한다.
2. `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트에 `00_59_32` 라운드(BLOCK:YES·CRITICAL 2 → `39cb0bf1a` 로 해소) 기록을 추가한다.
3. `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가" 절에 whack-a-mole 반박 문장 1개를 추가해 webhook Rationale 과의 긴장을 완전히 닫는다.
4. `spec/conventions/swagger.md` §3 갱신 또는 신규 4개 DTO description 축약 중 택1 결정.
5. (선택, 비차단) `KEY_MASK_MARKER` 3곳 결합을 export 로 승격하거나 `{@link}` 상호 참조 추가, `execution.paused` 행 `nodeLabel` 정정, WS §4.1 표 blockquote 위치 이동, WS §4 표 `input` 필드 명시.