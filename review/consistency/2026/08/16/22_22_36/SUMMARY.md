# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 성공, CRITICAL 발견 없음. WARNING 5건은 모두 "착수 전 결정/정정 권장" 수준.

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 이번에 착수하는 `eia-fanout-and-internal-data-masking.md`(§A: WS `execution.node.*` fanout 값-패턴 마스킹, §B: 내부 REST `inputData`/`outputData` 마스킹)이 내릴 두 설계 선택이 같은 `spec/5-system/` 트리 안의 기존 확정 결정(§R17 masking-parity 원칙, `12-webhook.md` "display 시점 마스킹 기각" Rationale)과 반대 방향을 가리켜, 명시적 정리 없이 진행하면 이 저장소가 반복 겪은 "선례가 갈렸다" 패턴이 재발한다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 미발견)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `execution.node.*` WS 내부 wire 를 원문으로 남기는 §A 설계가 R17 masking-parity 원칙과 충돌 — WS 채널 구독 인가(§3.3)와 `GET /api/executions/:id` 조회 인가가 동일 인구("워크스페이스 멤버 전원", role 구분 없음)여서 "wire는 소유자 전용이라 안전"이라는 §A 전제가 RBAC 문서로 실증되지 않음 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` §A "왜 wire가 아니라 fanout인가" | `spec/5-system/14-external-interaction-api.md` §R17 "내부 읽기 경로도 같은 마스킹을 적용한다"(:1486-1511, "안전성은 롤 게이팅이 아니라 boundary masking parity 에 의존") | (a) `execution.node.*` wire에도 `deepRedactSecrets` 적용해 parity 원칙과 맞추거나, (b) wire 예외 근거를 §R17 옆에 캐비엇으로 명시. 어느 쪽이든 `6-websocket-protocol.md` §4.1 `execution.node.*` 행에 최종 정책 반영 |
| 2 | cross_spec | §B(`inputData`/`outputData` display-시점 마스킹)가 같은 컬럼(`Execution.inputData`)에 대해 정확히 검토 후 기각됐던 전략을 재도입 — "raw secret이 DB에 잔존해 유출 표면이 남는다"는 기각 근거가 §B 대상(자격증명 패턴 박힌 자유 텍스트)에도 문자 그대로 적용됨 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` §B ("`toExecutionDto`/`toResponseExecution` 두 자리에 마스킹") | `spec/5-system/12-webhook.md` Rationale "민감 헤더 마스킹 — ingestion(저장) 시점 채택(2026-07-07)"(:434-439) — 4개 문서(`12-webhook.md`, `4-execution-engine.md`, `5-expression-language.md`, `4-nodes/7-trigger/1-manual-trigger.md`)가 공유하는 전제 | plan §B가 spec 갱신 시 `12-webhook.md` Rationale을 명시 인용하고 "ingestion층=알려진 헤더 key / egress층=임의 값-패턴, 방어 계층이 다르다" 캐비엇을 §R17 또는 §B 갱신 자리에 추가. `12-webhook.md` §5.3(:319) "모든 read 경로가 자동 마스킹된다" 문장에도 "민감 헤더 key 한정" 스코프 캐비엇 추가 |
| 3 | convention_compliance | `6-websocket-protocol.md` §4.1 이벤트 표가 실제 wire 필드명(`nodeLabel`)과 다른 `nodeName`을 문서화(문서 자신도 "spec drift"로 인지) — 이 drift가 `status: partial`의 `pending_plans` 트래커에 등재되지 않아, 트래커가 `complete/`로 이동해 문서가 `implemented`로 승격되는 순간 추적 근거를 잃음 | `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.started/.completed/.failed/.skipped` 4행 (`nodeName` 표기) | `spec/conventions/spec-impl-evidence.md` §3 pending_plans 승격 규칙 / 실제 코드(`execution-engine.service.ts` 전 emit이 `nodeLabel`) / `plan/in-progress/spec-sync-websocket-protocol-gaps.md`(이 항목 미등재) | 코드 변경 불요 — `nodeName`→`nodeLabel` 4곳 문서 치환이 최저비용. 유예 시 `spec-sync-websocket-protocol-gaps.md`에 이 항목 명시 등재 |
| 4 | plan_coherence + rationale_continuity (동일 지적, 강한 등급으로 통합) | spec 갱신 체크리스트가 §R17 "잔여(범위 밖)" 세 항목 중 **①만 flip**하도록 적혀 있어, §B가 실제로 닫는 **②**("inputData/outputData는 다른 컬럼이라 포함되지 않는다")가 구현 후에도 target 문서에 stale 서술로 남을 위험 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트 `spec — 14-external-interaction-api.md §R17 카탈로그 등재 + 잔여 ① flip` | `spec/5-system/14-external-interaction-api.md` §R17 "잔여(범위 밖)" 서브목록 ①②③(:1515-1518) — 문서 스스로 "적용 범위는 총칭이 아니라 열거다" 원칙을 두 번 강조 | 체크리스트를 착수 전 "잔여 **①·②** flip"으로 정정하고 "③(workflow-assistant) 제외"를 명시. 이 저장소가 반복 겪은 "자매 항목 중 일부만 반영" 패턴 재발 방지 |
| 5 | naming_collision | §A "두 fanout 브랜치 공유 헬퍼"의 이름이 아직 미정 — 기존 마스킹 함수 4계열(`redact*ForResponse`/`toTerminal*Payload`/`deepRedactSecrets`/`strip*OnlyFields`) 및 개념이 거의 동일한 모듈-로컬 `stripAndRedact`(`interaction.service.ts:99`, EIA 외부 `getStatus()`가 strip+deepRedactSecrets 조합에 이미 쓰는 이름)와 동명 재사용 위험 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트 "A — 두 fanout 브랜치가 공유하는 단일 헬퍼 + deepRedactSecrets" | `codebase/backend/src/shared/utils/{redact-stored-error,terminal-error-payload,sanitize-error-message,strip-external-only-fields}.ts` + `codebase/backend/src/modules/external-interaction/interaction.service.ts:99` `stripAndRedact` | 구현 착수 시 헬퍼 이름을 spec/plan에 명시하고 기존 `redact*` 명명 규칙을 따르거나 `interaction.service.ts`의 `stripAndRedact`를 export해 재사용. 신규 이름을 쓰더라도 **동일 이름 재사용은 피할 것** |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `BackgroundRunsService` parity 체크리스트 누락 가능성 — §R17이 `Execution.error` 마스킹 적용 범위를 "`ExecutionsService` 4경로 + `BackgroundRunsService` body 노드까지" 열거했는데 §B 체크리스트("`toExecutionDto`+`toResponseExecution` 두 자리")는 `BackgroundRunsService`를 언급 안 함 | plan §B 체크리스트 | `BackgroundRunsService`의 대응 read 경로도 이번 라운드 갱신 대상에 포함 |
| 2 | cross_spec | `spec/conventions/**` 전체가 이 impl-prep 세션 번들에서 예산 초과로 생략됨(기존에 알려진 갭 — memory: `feedback_consistency_spec_mode_budget`) | 프롬프트 조립 단계 | 향후 `spec/5-system/` target 세션은 `spec/conventions/{chat-channel-adapter,node-output,error-codes}.md`를 명시적으로 우선 포함 |
| 3 | naming_collision | 신설 §R17 카탈로그 불릿이 "`error`"라는 동일 필드명을 쓰는 **세 번째** 표면이 됨(기존 ①②와 소스 컬럼·표면이 다름) | `spec/14-external-interaction-api.md` §R17 신규 불릿 예정 자리 | 표제를 `execution.node.completed/.failed emit 의 error(node-level, WS/SSE fanout)`처럼 필드 경로+표면 명시(기존 ② 불릿과 동일 패턴) |
| 4 | naming_collision | `6-websocket-protocol.md`의 기존 `### 4.4` 절 번호 중복(신규 아님, 이미 이연된 결함) — target이 같은 파일을 편집 예정이라 참고 | `spec/5-system/6-websocket-protocol.md` ~L1406, ~L1775 | 새 마스킹 규정 문단은 기존 4.4 절 안에 캐비엇으로 붙이거나 `## Rationale`에 추가, 인용 시 전체 앵커 슬러그 사용 |
| 5 | cross_spec | plan §A "node 이벤트는 종결 이벤트와 같은 외부 도달 범위(SSE·ChatChannelDispatcher·NotificationFanout)를 갖는다"는 서술이 webhook 화이트리스트(종결 3종+`waiting_for_input`/`ai_message`뿐, `node.*` 제외)와 어긋남 — spec 자체는 정합, plan의 구현 범위 산정 주의 사항 | plan §A 서술 vs `6-websocket-protocol.md` §4.6 / `14-external-interaction-api.md` §11 매핑 표 | 구현 시 webhook(NotificationFanout) 경로까지 손대지 않도록 범위 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | WS wire 원문 유지가 R17 parity 원칙과 충돌 + inputData/outputData egress 마스킹이 12-webhook.md ingestion-시점 채택 Rationale과 상충 (WARNING 2건) |
| rationale_continuity | LOW | 마스킹 시점 철학 상호참조 부재 + §R17 잔여 ①만 명시(후자는 plan_coherence WARNING과 통합) — 기각 대안 무단 재도입은 없음 |
| convention_compliance | LOW | `nodeName`/`nodeLabel` drift가 `pending_plans` 추적 누락(WARNING) 외 CRITICAL 규약 위반 없음, 최근 마스킹 PR 연쇄는 conventions 전반 준수 양호 |
| plan_coherence | LOW | §R17 "잔여" ①만 flip하도록 된 체크리스트가 §B가 닫는 ②를 stale로 남길 위험(WARNING) 외 미해결 결정 우회·선행 plan 미해소 없음 |
| naming_collision | LOW | 신규 공유 헬퍼 이름 미정(WARNING) + 신규 §R17 "error" 불릿 구분 필요·기존 §4.4 중복 참고(INFO), CRITICAL 없음 |

## 권장 조치사항
1. 구현 착수 전, §A(WS `execution.node.*` wire 마스킹 여부)와 §B(egress vs `12-webhook.md` ingestion-시점 상충)에 대해 명시적 설계 결정을 내리고 spec에 상호 캐비엇을 남긴다 (WARNING #1, #2).
2. `eia-fanout-and-internal-data-masking.md` 체크리스트의 spec 갱신 항목을 "§R17 잔여 **①·②** flip, ③ 제외"로 정정한다 (WARNING #4).
3. §A 공유 헬퍼 명명 시 기존 `redact*`/`strip*`/`deepRedactSecrets` 패밀리와 대조하고, `interaction.service.ts`의 `stripAndRedact`와 동명 재사용을 피하거나 그 함수를 export해 재사용한다 (WARNING #5).
4. `6-websocket-protocol.md` §4.1의 `nodeName`→`nodeLabel` 4곳을 정정하거나 `spec-sync-websocket-protocol-gaps.md`에 등재한다 (WARNING #3).
5. 신규 §R17 "error" 불릿에 필드 경로·표면을 명시하고, `BackgroundRunsService` 대응 read 경로도 §B 범위에 포함한다 (INFO #1, #3).
