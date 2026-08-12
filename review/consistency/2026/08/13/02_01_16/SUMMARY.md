# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(3개 checker 가 동일 지점을 각각 CRITICAL/CRITICAL/WARNING 으로 지적, 최강 등급 CRITICAL 로 통합)

## 전체 위험도
**HIGH** — 신설 SoT(`spec/conventions/redis-keys.md`) 초안의 "실측 인벤토리" 표에 Redis 미경유 WebSocket 채널명이 Redis 키로 잘못 섞여 있어, 그대로 반영하면 target 이 스스로 표방한 "정확한 실측 기반 레지스트리" 원칙을 신설 문서 자체가 첫 판올림부터 어기게 된다. 다만 이 결함은 target 을 작성하는 그 turn(project-planner 권한 범위) 안에서 직접 정정 가능한 표 1행 수정 수준이며, 나머지 실측(§9.1 패턴 위반·§9.2 phantom 2건·`exec:seq` 중복 등재 등)은 5개 checker 전원이 코드 대조로 확인해 정확했다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (CRITICAL) + naming_collision (CRITICAL) + cross_spec (WARNING, 동일 지점) | `background:run:<id>` 는 Redis 키가 아니라 Socket.IO 브로드캐스트 채널명인데, target 의 "실측" 인벤토리 표에 `exec:recover:lock`·`iext:blacklist:<jti>` 등과 나란히 "Redis 키"(소유: Background 노드)로 등재되어 있고, 이 표가 그대로 신설 `spec/conventions/redis-keys.md` "전역 인벤토리"로 옮겨질 예정이다. | `plan/in-progress/spec-draft-redis-key-registry.md` §① 실측 표 마지막 행(`background:run:<id>` \| Background 노드), §제안 변경 1 "전역 인벤토리" | `spec/5-system/6-websocket-protocol.md` (§채널별 인가 전략 표에 `background:run:{id}` 를 `execution:{executionId}`·`workflow:{workflowId}` 등과 같은 **WS 채널**로 이미 등재), `spec/4-nodes/1-logic/12-background.md`·`spec/data-flow/3-execution.md`·`spec/3-workflow-editor/3-execution.md` (전부 "WebSocket 채널"로 서술); 구현 `codebase/backend/src/modules/websocket/websocket.service.ts:599`(`emitBackgroundRunEvent`) → `websocket.gateway.ts:980-982`(`broadcastToChannel` → `server.to(channel).emit()`, Socket.IO room emit). 저장소 전체에 Redis adapter(`@socket.io/redis-adapter` 등) 도입 없음 — 이 채널은 프로세스-로컬이며 Redis 를 전혀 경유하지 않음 | 전역 인벤토리 표에서 `background:run:<id>` 행 제거. 필요하면 신설 문서 서두에 "Redis 키가 아닌 인접 네임스페이스(WS 채널, SoT: `6-websocket-protocol.md`)" 각주로 한 줄만 참조. target 이 이미 한 번(느슨한 정규식으로 `core:`/`ws:` 를 오탐한 것) 자기 검증했던 것과 같은 방법(따옴표 고정 재검색)을 표 8행 전체에 재적용해 유형(존재 vs Redis-키 여부)까지 검증할 것 |

## planner 인계 (권한 밖 Critical)

(없음) — 이 Critical 은 target 자체가 아직 spec 에 반영되지 않은 **draft plan** 이며, 발견된 결함은 draft 를 작성/승격하는 바로 그 turn(project-planner 권한 범위) 안에서 표 1행을 고치는 것으로 해소된다. developer 턴이 건드릴 수 없는 이미 확정된 `spec/` drift 가 아니므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | EIA rate-limit 키 3종(`eia:rl:interact`·`eia:rl:status`·`eia:notif:rl`)의 "소유 문서가 상세를 갖는다"는 포인터 전제가 실제로는 성립하지 않음(리터럴 키 형태가 어느 spec 에도 없음) | `plan/in-progress/spec-draft-redis-key-registry.md` §① 실측 표 EIA rate-limit 행, "제안 변경 3" ("EIA 표는 그대로 두고 …") | `spec/data-flow/15-external-interaction.md` §2.2 (rate-limit 3키 리터럴 표기 없음), `spec/5-system/14-external-interaction-api.md` §8.4 (동작 서술만 있고 키 문자열 없음) | rate-limit 3키의 포인터 대상을 `5-system/14-external-interaction-api.md` §8.4 로 명시하고 필요시 그 절에 리터럴 키를 추가하거나, `spec_impact` 에 해당 파일을 포함시켜 이번 작업 범위에 넣는다 |
| 2 | convention_compliance | 신설 예정 `spec/conventions/redis-keys.md` 가 `spec-impl-evidence.md` 가 강제하는 frontmatter(id/status/code) 의무 대상인데, draft 의 "담을 것" 계획에 이 스키마가 없음. 코드 소유가 6개 모듈에 분산돼 있어 `code:` glob 설계도 자명하지 않음 | "### 1. `spec/conventions/redis-keys.md` 신설" 섹션 및 체크리스트 | `spec/conventions/spec-impl-evidence.md` §1/§2/§4 (build 가드 `spec-frontmatter.test.ts`/`spec-code-paths.test.ts`), 18개 기존 비-카탈로그 conventions 문서 전부가 예외 없이 이 frontmatter 보유 | "담을 것" 목록에 `id: redis-keys`/`status: implemented`/`code:`(exec·EIA·chat-channel·webhook·cafe24·background 각 소유 모듈 다중 glob) 계획 명시, 체크리스트에 frontmatter 부여 항목 추가 |
| 3 | plan_coherence | 삭제하는 phantom 키 `core:{wsId}:rate:{userId}`(§9.2)의 "되살리지 않도록" 각주가, 이미 사용자 결정(2026-06-02)으로 확정·defer 된 `cafe24-backlog-residual.md` A-3 follow-up(분산 throttle store, `@nestjs/throttler` storage 전역 단일 설정이라 API rate limit 전체에 영향)과 어긋날 소지 — 그 follow-up 집행 시 유사 키가 재도입됨 | 제안 변경 §2 표 (`core:{wsId}:rate:{userId}` → 제거 + 각주) | `plan/in-progress/cafe24-backlog-residual.md` "A-3 follow-up — Layer 1(분산 throttle store)" (미해결 `[ ]`) | target §9.2 각주 또는 신설 규약 문서의 "워크스페이스 스코프" 절에 A-3 follow-up 교차 참조 한 줄 추가 |
| 4 | plan_coherence | 신설 규약 문서 설계에 "새 Redis 키/채널 도입 시 등재" 유지보수 원칙이 없어, `spec-sync-external-interaction-api-gaps.md` 의 미해결 SSE/notification 분산 fan-out(§R10, 신규 Redis pub/sub 채널 예정) 항목이 향후 같은 방식으로 누락될 수 있음 | 제안 변경 §1 "전역 인벤토리" 설계(포인터 방식) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §R10 (미해결 `[ ]`) | 신설 규약 문서 내용 항목에 "새 Redis 키/채널 도입 시 이 인벤토리(또는 소유 문서)에 등재한다" 유지보수 원칙 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + naming_collision (중복 병합) | 도메인 짧은 접두 목록에서 `eia`·`iext` 를 별개 도메인처럼 병렬 나열하지만, 실제로는 한 모듈(`external-interaction`)이 `iext:`/`interaction:`/`eia:` 세 가지 리터럴 접두를 씀 | "제안 변경 1. 명명 규칙" 및 실측 표 EIA 행들 | 규약 문서에 "same-module 3-prefix drift" 각주 명시(통일 강제는 불요) |
| 2 | cross_spec | `4-execution-engine.md` §9.2 heading 앵커(`#92-용도별-키-정의-및-ttl`)를 참조하는 타 spec 3개 문서(5회: `5-system/14-external-interaction-api.md` L156/L1051/L1070, `5-system/6-websocket-protocol.md` L106, `data-flow/3-execution.md` L219)가 spec_impact 목록에 없음 | "제안 변경 2. §9.1/§9.2 정정" | §9.2 heading 텍스트 유지를 체크리스트에 명시하거나 변경 시 3개 파일 앵커도 동기 갱신 |
| 3 | cross_spec | 신설 규약의 "역참조"가 EIA 소유 문서에만 계획돼 있고 webhook·chat-channel·cafe24·background 소유 문서에는 없음(의도된 스코프로 보임) | "제안 변경 3. 규약 문서 역참조 한 줄" | 즉시 처리 불요, 후속 plan 항목으로 기록 권장 |
| 4 | rationale_continuity | §9.1 원 패턴(`{service}:{workspaceId}:...`)의 계보가 이미 같은 문서 Rationale "Redis context store 미채택"(Phase-1 폐기 판단)에 적혀 있는데 target 이 이를 명시적으로 연결하지 않음 | "Rationale → 왜 규칙을 실제에 맞추나" | "§9.1 패턴은 이미 폐기된 Phase-1 설계의 유일한 생존 흔적" 한 문장 교차 링크 추가 |
| 5 | rationale_continuity | in-memory throttler storage "제거 사유" 각주가 향후 `2-navigation/4-integration.md` Rationale 의 Layer 1(분산 throttle store) 착지 시 stale 해질 수 있음 | 제안 변경 §2 표 `core:{wsId}:rate:{userId}` 제거 각주 | 각주에 "Layer 1 착지 시 재검토" 한 줄 추가 (plan_coherence WARNING #3 과 같은 근본 원인) |
| 6 | convention_compliance | 신설 문서 서두 구조가 기존 conventions 관례(Overview + 책임 경계 bullet)를 아직 명시하지 않음 | "### 1. `spec/conventions/redis-keys.md` 신설" 섹션 전체 | 실제 작성 시 `error-codes.md` 형식 참고해 구조 맞출 것 권고(draft 자체 결함 아님) |
| 7 | convention_compliance | `spec/conventions/execution-context.md:62` 가 `4-execution-engine.md#91-키-패턴` 앵커를 인바운드 참조 중 — §9.1 본문을 규약 참조로 대체할 때 heading 텍스트를 바꾸면 이 링크가 깨짐 | "### 2. §9.1/§9.2 정정" 표 §9.1 행 | 체크리스트에 "heading 텍스트 유지, 본문만 교체" 한 줄 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `background:run:<id>` 오분류(WARNING) + EIA rate-limit 포인터 전제 불성립(WARNING) + INFO 3건 |
| rationale_continuity | CRITICAL | `background:run:<id>` 가 §9.2 각주의 "실사용 전용 인벤토리" invariant 를 새 SoT 에서 재차 위반 |
| convention_compliance | MEDIUM | 신설 문서의 frontmatter(id/status/code) 의무 계획 누락(WARNING) + 구조/앵커 INFO 2건 |
| plan_coherence | LOW | phantom 키 삭제 각주와 확정된 A-3 follow-up 간 잠재 모순(WARNING) + 유지보수 원칙 부재(WARNING), CRITICAL 없음 |
| naming_collision | MEDIUM | `background:run:<id>` 가 기존 WS 채널명과 자원 유형 충돌(CRITICAL) + EIA 리터럴 접두 3종 병존(INFO) |

## 권장 조치사항

1. **(BLOCK 해소)** target 실측 표에서 `background:run:<id>` 행을 "Redis 키 전역 인벤토리"에서 제거하거나, "Redis 키가 아닌 인접 네임스페이스(WS 채널)" 별도 절로 명확히 분리한다. 신설 `spec/conventions/redis-keys.md` 작성 시 이 표 8행 전체를 같은 방법(따옴표 고정 재검색 + 실제 Redis client 호출 확인)으로 한 번 더 검증한다.
2. EIA rate-limit 키 3종의 포인터 대상을 `5-system/14-external-interaction-api.md` §8.4 로 명시하거나 `spec_impact` 에 추가한다.
3. 신설 문서 "담을 것" 목록에 frontmatter(id/status/code, 다중 glob) 계획을 추가하고 체크리스트에 반영한다.
4. `core:{wsId}:rate:{userId}` 제거 각주에 `cafe24-backlog-residual.md` A-3 follow-up 교차 참조를 추가한다.
5. 신설 문서에 "새 Redis 키/채널 도입 시 등재" 유지보수 원칙 한 줄을 추가한다.
6. (선택) EIA 리터럴 접두 3종(`iext`/`interaction`/`eia`) drift 각주, §9.1 heading 텍스트 보존, §9.2 앵커 영향 3개 파일 확인, Overview 구조 정비를 함께 반영한다.
