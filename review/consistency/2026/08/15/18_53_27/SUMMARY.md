# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 순수 코드 리팩터(`websocket.service.ts` 값/타입 분리, `spec_impact: none`)로 spec 본문·API 계약·RBAC·명명 규약과 충돌 없음. 다만 다른 in-progress plan 의 라인 인용 stale 화(WARNING)와 §4.4 Rationale 미인용(WARNING)은 착수 전 저비용으로 닫아야 함. 5개 checker 모두 전문 확보(재시도 필요 없음).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `ws-event-types-extract` plan 이 `4-execution-engine.md` §4.4 "두 기법(forwardRef/ModuleRef strict:false)으로 순환을 봉인 유지, 근본 축소는 별도 backlog" Rationale/PR #638 을 인용하지 않고 `spec_impact: none` 으로 단정. `forwardRef`·DI 그래프는 불변이라 봉인 기법 자체를 훼손하진 않으나, 봉인 대상 순환(`ws.service↔gateway↔retry↔event-emitter`)의 참여자 12곳을 순환 밖으로 부분 이동시키는 조치라 §4.4 가 명시적으로 미뤄둔 영역에 발을 들임 | `plan/in-progress/ws-event-types-extract.md` | `spec/5-system/4-execution-engine.md` §4.4 Rationale | plan "왜" 절에 §4.4/PR #638 인용 + "이벤트 기반 디커플링(deferred backlog)과는 다른 층위 — DI 그래프·forwardRef 불변, ES-module 값 평가 순서만 정리" 한 문장 추가. 구현 완료 후 §4.4 에 "타입 전용 서브모듈 추출은 봉인 기법을 대체하지 않는 보완 조치" 후속 bullet 1줄 추가 |
| 2 | plan_coherence | `websocket.service.ts:6~340`(이동 대상) 상단 선언 블록 제거로, 같은 파일을 절대 라인 번호로 인용하는 다른 3개 in-progress plan 의 인용이 조용히 stale 화됨. 그중 `spec-draft-eia-notification-payload-contract.md`(status: in-progress)는 아직 미해결 항목(`result.outputs`, `chatChannel` 외부 유출)이 그 인용 위에서 진행 중 | `plan/in-progress/ws-event-types-extract.md` (조치 목록) | `plan/in-progress/node-output-redesign/background.md:3,144` · `plan/in-progress/spec-draft-eia-62-waiting-payload.md:193-194` · `plan/in-progress/spec-draft-eia-notification-payload-contract.md:52,55,61` | 조치 목록에 "이동 후 `grep -rn 'websocket\.service\.ts:' plan/ spec/` 로 하위 인용 재확인 + 심볼 기준 갱신(또는 라인 번호 제거)" 항목 1개 추가. 저장소가 이미 "라인 인용은 리팩터마다 stale 화되니 심볼로 고정" 교훈을 기록해 둔 패턴과 동일 |
| 3 | naming_collision | `NotificationEventType` 이 WS 인앱 알림 벨(enum, 1값 `notification.new`)과 triggers webhook 구독 화이트리스트(type, 5값 `execution.*`)라는 서로 다른 의미로 **이미** 동일 이름을 공유 중(현재 컴파일 충돌 없음, import 교차 없음). 이번 리팩터가 WS 쪽 정의를 이름 자체가 "이벤트 타입 정본"처럼 보이는 공유 모듈로 옮기면서 향후 오import 위험을 키움 | `codebase/backend/src/modules/websocket/websocket-events.types.ts` (신설 예정) | `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:28` | 새 모듈의 `NotificationEventType` enum 바로 위에 "인앱 알림 벨 전용, outbound webhook 구독 화이트리스트는 `triggers/dto/notification-config.dto.ts` 동명 타입(별개)" disambiguation JSDoc 추가. rename 은 이번 plan 범위 밖이므로 후속 항목으로만 트래커에 남김 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | impl-prep 번들 예산이 이번 작업과 가장 관련 깊은 3개 파일(`6-websocket-protocol.md`·`14-external-interaction-api.md`·`4-execution-engine.md`)을 전부 생략하고 무관한 `1-auth.md` 가 예산을 소모. 직접 Read 로 보완 확인해 CRITICAL/WARNING 없음을 확인함 | 조립 프롬프트 헤더 (`### ⚠️ 컨텍스트 예산 초과로 생략된 파일 15개`) | harness 측에서 `code:` frontmatter 와 실제로 겹치는 spec 파일을 예산 우선순위로 올리는 개선 권고 (기존 `feedback_consistency_spec_mode_budget` 메모와 동일 클래스) |
| 2 | rationale_continuity | "단일 sink" 원칙(§4.4) 자체와는 충돌하지 않음 — plan 이 emit 경로는 안 건드리고 값/타입 위치만 이동하는데, 이 구분이 plan 어디에도 명시돼 있지 않아 후속 리뷰에서 "sink 분리 시도 아니냐"는 오탐 소지 | `plan/in-progress/ws-event-types-extract.md` | plan "왜" 절에 "§4.4 단일 sink 정책은 불변 — 이동 대상은 값/타입 정의뿐, emit 경로는 없음" 한 줄 추가 |
| 3 | convention_compliance | `spec/5-system/` 19개 중 7개(`2-api-convention.md`·`6-websocket-protocol.md` 등, 이번 작업이 직접 다루는 SoT 포함)에 `## Overview` 헤더 부재 — CLAUDE.md 3섹션 구성 권장과 부분 불일치. 기존부터 있던 패턴이라 이번 turn 차단 사유 아님 | `spec/5-system/2-api-convention.md`, `spec/5-system/6-websocket-protocol.md` 등 7개 파일 | 별도 `project-planner` turn 에서 `## Overview` 절 추가 고려 |
| 4 | plan_coherence | 새 파일 `websocket-events.types.ts` 가 `6-websocket-protocol.md` frontmatter `code:` 목록(glob 아닌 개별 파일 나열)에 반영 안 되면 향후 grep 기반 spec-coverage audit 이 놓칠 수 있음. re-export 로 기존 export 표면은 보존되므로 즉시 깨지지는 않음 | `spec/5-system/6-websocket-protocol.md` frontmatter `code:` | 리팩터 완료 시 `code:` 목록에 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 한 줄 추가 (spec 본문 변경 아님, `spec_impact: none` 과 무모순) |
| 5 | plan_coherence | 선행 조건(`eia-terminal-emit-facade`, PR #1174)은 `origin/main` 에 이미 병합(`8e0728a90`) 확인되어 유효. 다만 그 plan 자체의 체크리스트(`ai-review`/`impl-done`/`push`)가 `[ ]` 로 남아 실제 merged 상태를 반영 못함 — plan 위생 이슈이며 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)는 이미 정확히 `[x]` 로 기록됨 | `plan/in-progress/eia-terminal-emit-facade.md` (체크리스트) | 후속 정리 시 체크박스 동기화 (이번 작업의 선행조건 미해소는 아님) |
| 6 | convention_compliance | `6-websocket-protocol.md` §4.1 `execution.node.*` 표의 `nodeName` vs 실제 `nodeLabel` 불일치는 문서가 이미 "spec drift, 본 PR scope 밖" 으로 self-flag | `spec/5-system/6-websocket-protocol.md` §4.1 표 L177~L188 | 참고용, 등급 판정에 미포함 (cross_spec/spec-coverage 축의 기존 인지 항목) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | R10 "단일 sink" 불변식과 충돌 없음(호출부 무변경, 타입만 이동). `1-auth.md` 표본 대조 전부 일치. 번들 예산 갭은 직접 Read 로 보완 |
| rationale_continuity | MEDIUM | §4.4 "두 기법으로 봉인 유지, 근본 축소는 backlog" Rationale 미인용 — 결정 위반은 아니나 인접 결정 상호참조 누락 |
| convention_compliance | NONE | 검토 범위 내 위반 없음. 7/19 파일 `## Overview` 부재는 기존 패턴(INFO) |
| plan_coherence | LOW | 정본 트래커 항목과 1:1 정합, 결정 충돌 없음. 3개 타 plan 의 라인 인용 stale 화가 유일한 실질 리스크 |
| naming_collision | LOW | 이동 대상 15개 식별자 중 `NotificationEventType` 1건만 기존부터 존재하던 이름 중복 — 리팩터가 신규 생성하는 충돌 아니나 노출도 증가 |

## 권장 조치사항
1. (WARNING #1) plan "왜" 절에 `4-execution-engine.md` §4.4/PR #638 Rationale 인용 + "DI 그래프·forwardRef 불변, ES-module 값 평가 순서만 정리" 한 문장 추가.
2. (WARNING #2) 조치 목록에 `grep -rn 'websocket\.service\.ts:' plan/ spec/` 로 하위 3개 plan 의 라인 인용 재확인/심볼 기준 갱신 단계 추가.
3. (WARNING #3) 신설 `websocket-events.types.ts` 의 `NotificationEventType` enum 위에 `triggers/dto/notification-config.dto.ts` 동명 타입과의 disambiguation JSDoc 추가.
4. (INFO #2) plan "왜" 절에 "§4.4 단일 sink 정책 불변 — emit 경로 무변경" 한 줄 추가 (WARNING #1 조치와 함께 처리 가능).
5. (INFO #4, 후순위) 구현 완료 시 `6-websocket-protocol.md` frontmatter `code:` 에 신규 파일 경로 추가.