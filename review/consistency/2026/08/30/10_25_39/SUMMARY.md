# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 5건은 모두 같은 PR 안에서 처리 가능한 텍스트·트래커 동기화 보완이며 기계 invariant 위반은 없음.

## 전체 위험도
**MEDIUM** — spec 서술 정정 자체(§1 statusCode, §2 Redis 각주, §3 egress-masking 캐비엇, §4 EventType 명명)는 5개 checker 전원이 실측(커밋 순서·코드 grep·plan 체크리스트 대조)으로 사실관계를 검증했고 다른 spec 영역과의 데이터 모델/API 계약 충돌도 없다. 다만 target 이 지시한 대로 그대로 집행하면 (a) plan-lifecycle 의 "미해결 follow-up 0건" 조건을 어긴 채 `ws-event-types-extract.md` 를 `complete/` 로 옮기게 되고, (b) 이 draft 의 근거가 된 `spec-sync-external-interaction-api-gaps.md` 트래커 항목들이 죽은 참조로 남으며, (c) `egress-masking.md` 자신의 좌표계 표 갱신 규율과 대상 문서의 Rationale 서브섹션 형식을 각각 어긴다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §3 "동시에 `plan/complete/` 이동" 이 plan-lifecycle 의 "미해결 follow-up 0건" 조건과 충돌 — `ws-event-types-extract.md:450` 에 미체크 항목(facade 재수출 커버리지 비대칭)이 남아 있음 | draft §3, "동시에 … `complete/` 이동" 문단 | `.claude/docs/plan-lifecycle.md` §1-§3 vs `ws-event-types-extract.md:450` | (a) `:450` 항목도 이번 PR 에서 함께 실행(본문이 이미 "fix 는 한 줄" 이라 명시), 또는 (b) `spec-sync-external-interaction-api-gaps.md` 로 정식 이관 후 `[x]` 처리, 중 하나 선택. (c) 이동을 별도 후속 PR 로 늦추는 안은 §3 자신의 "캐비엇 회수와 이동은 같은 PR" 원칙을 깨므로 비권장 |
| 2 | cross_spec, rationale_continuity, plan_coherence (3건 중복 → 최강 등급 WARNING 채택) | §1·§2 가 해소하는 `spec-sync-external-interaction-api-gaps.md` 의 대응 트래커 항목(§1: `:1947-1949`, §2: `:1986-1988`)이 target 실행 후에도 체크되지 않고 죽은 참조로 남음 — 이 트래커 문서가 스스로 기록한 "자기를 닫은 PR 이 자기 이름을 부르지 않으면 영영 미체크로 남는다" 패턴의 재발 | §1 전체, §2 전체 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1947-1949`, `:1986-1988` | target §1·§2 에 §3 과 같은 톤으로 "동시에 `spec-sync-external-interaction-api-gaps.md:1949`/`:1988` 를 `[x]` 로 닫고 처분 결과를 한 줄 남긴다" 지시를 추가 |
| 3 | convention_compliance | §3 변경안이 `TerminalErrorPayload`(`redactTerminalError`→`deepRedactSecrets` 경유)를 새로 확인해 놓고도 `egress-masking.md` 자신의 좌표계 표(§1 표 2행 소비처 열) 및 frontmatter `code:` 목록을 갱신하지 않음 — 문서가 2026-08-23 실례로 명시한 자기 규율 위반 | target §3 변경안 블록 (`egress-masking.md:89` 캐비엇 교체) | `spec/conventions/egress-masking.md` §1 표 2행 + §3 자기 규율(2026-08-23 `assistant-mask-leak` 실례) | §1 표 2행 소비처 열에 "`TerminalErrorPayload` emit(WS, `redactTerminalError` 경유)" 추가, frontmatter `code:` 에 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 등재 |
| 4 | convention_compliance | §4 변경안이 대상 문서 `## Rationale` 의 기존 서브섹션 구조(`### <제목> — <근거> (날짜·결정)` 헤딩)를 따르지 않고 최상위 blockquote 로만 얹음 | target §4 변경안 블록 (`6-websocket-protocol.md` `## Rationale` 삽입) | CLAUDE.md "Spec 문서 3섹션 구성" + `6-websocket-protocol.md` 의 기존 Rationale 서브섹션 전체(10개 이상, 전부 `###` 헤딩) | `### WS 이벤트 enum 명명 — <도메인>EventType (2026-08-30, #1238 후속)` 형태의 `###` 헤딩 신설, 본문은 일반 프로즈로 두고 "왜 conventions/ 신설이 아닌가" 만 nested blockquote 유지 |
| 5 | plan_coherence | §2 재작성문이 "표"라고 지칭하는 절이 실제로는 표가 없는 `4-execution-engine.md §9.1`(산문, SoT 포인터)이고 실제 `키 패턴/용도/TTL` 표는 §9.2 에 있음 — 이 draft 가 고치려는 "주어를 생략한 부재 서술"과 같은 종류의 정밀도 문제를 새 문장에 다시 심음 | target §2 변경안 두 번째 문장 | `spec/5-system/4-execution-engine.md` §9.1(산문) vs §9.2(`### 9.2 용도별 키 정의 및 TTL`, 실제 표) — 같은 파일 §R8 Rationale 은 이미 §9.2 를 정확히 인용(`14-external-interaction-api.md:1266`) | 앵커를 `#91-키-패턴` → `#92-용도별-키-정의-및-ttl` 로, 절 번호를 §9.1 → §9.2 로 정정 (또는 "§9.1(SoT 포인터)·§9.2(표) 모두" 로 명시) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | §4 "conventions/ 신설 대신 Rationale 에 얹는다" 판단이 CLAUDE.md "정보 저장 위치" 표와 결이 다르지만, `#1194`(egress-masking.md 신설, `bdcfdc514`) 원칙의 역방향 유비로 방어 가능 | target §4 "왜 `spec/conventions/` 신설이 아닌가" 블록 | 현재 방어 논리로 충분. 향후 "한 파일 스코프 명명 규칙" 사례가 반복되면(예: `audit-actions.md` 승격 선례) conventions/ 승격 재검토 권장 |
| 2 | convention_compliance | §2 변경안 링크가 라벨엔 "§3" 을 명시하면서 href 앵커 fragment 를 안 달아 클릭 시 문서 최상단으로 이동 | target §2 변경안, `[conventions/redis-keys.md §3](../conventions/redis-keys.md)` | href 를 `../conventions/redis-keys.md#3-전역-인벤토리-포인터` 로 갱신 |
| 3 | naming_collision | §4 새 Rationale 문단이 `websocket-events.types.ts:222-223` JSDoc 과 같은 규칙("`<도메인>EventType`")을 두 곳에 서로 다른 문구로 유지하게 됨(충돌은 아님) | target §4 변경안 | 필수 아님. 새 Rationale 문단 끝에 "코드 쪽 근거: `websocket-events.types.ts` `InAppNotificationEventType` JSDoc" 상호 포인터를 남기면 향후 drift 탐지 용이 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 4항목 실측 인용 전부 정확. §3 "동시 이동" 이 plan-lifecycle 미해결 follow-up 조건과 충돌(WARNING), 트래커 미동기화(INFO→통합 시 WARNING 승격) |
| rationale_continuity | LOW | 기각된 대안 재도입·합의 원칙 위반·무근거 번복 없음. §1 실측 근거를 spec 본문 대신 커밋 메시지로만 남긴 것이 이 저장소 관행과 결이 다름(WARNING), 트래커 미동기화(INFO→통합) |
| convention_compliance | MEDIUM | §3 좌표계 표 미갱신(WARNING), §4 Rationale 서브섹션 구조 미준수(WARNING). §4 conventions 미신설 판단·§2 앵커 누락은 INFO |
| plan_coherence | MEDIUM | §1·§2 원 출처 트래커 체크박스 미동기화(WARNING), §2 앵커가 표 없는 §9.1 을 가리킴(WARNING). §3·§4 는 근거 plan 과 문면까지 정확히 일치해 즉시 집행 가능 |
| naming_collision | NONE | 신규 식별자 충돌 전무 확인(요구사항 ID·엔티티·endpoint·이벤트명·ENV var·spec 경로 전 축). §4 코드 JSDoc 과의 내용 중복만 INFO |

## 권장 조치사항
1. §1·§2 각각에 대응 `spec-sync-external-interaction-api-gaps.md` 체크박스(`:1949`, `:1988`)를 같은 PR 에서 `[x]` 처리하는 지시를 target 에 추가한다.
2. §3 의 "동시 이동" 대상인 `ws-event-types-extract.md:450` 잔여 항목을 이번 PR 에서 함께 실행하거나(권장, 본문이 "fix 는 한 줄" 이라 명시) `spec-sync-external-interaction-api-gaps.md` 로 정식 이관 후 이동한다.
3. §3 변경안 실행 시 `egress-masking.md` §1 표 2행 소비처 열과 frontmatter `code:` 목록에 `terminal-error-payload.ts` 를 함께 등재한다.
4. §4 변경안을 대상 문서의 기존 `###` Rationale 서브섹션 형식에 맞춰 헤딩을 신설한다.
5. §2 변경안의 앵커/절 번호를 `4-execution-engine.md §9.1` → `§9.2`(실제 표 위치)로 정정한다.
6. (선택) §2 `redis-keys.md §3` 링크에 앵커 fragment 추가, §4 Rationale 문단에 코드 JSDoc 상호 포인터 추가.
