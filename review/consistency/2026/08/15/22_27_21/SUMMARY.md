# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 완료, Critical 없음.

## 전체 위험도
**LOW** — `ws-event-types-extract` (`#1174` ES-module 순환 해소를 위한 순수 값/타입 추출 리팩터, `spec_impact: none`)는 wire 계약·DI 그래프·emit call-site·요구사항 ID 어느 것도 변경하지 않았음을 5개 checker가 독립적으로 diff 실측 확인. 유일한 실질 잔여물은 심볼 이동에 따른 spec 문서의 "정본 위치" 서술 stale(plan이 이미 실측·등재해 둔 후속 항목)뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `KbEventType`/`ExecutionChannelEvent` 등 정본 위치 서술이 target 3곳(`spec/5-system/`)에서 여전히 `WebsocketService`/`websocket.service.ts`를 지목 — 실제로는 `websocket-events.types.ts`로 이동. re-export로 "거짓"은 아니나 SoT 미반영 | `spec/5-system/6-websocket-protocol.md:740, :1034`, `spec/5-system/8-embedding-pipeline.md:276`, `spec/5-system/10-graph-rag.md:552` | `plan/in-progress/ws-event-types-extract.md` §"후속(이 PR 범위 밖)" — 이미 6곳(위 4곳 + `spec/data-flow/6-knowledge-base.md:288`, `spec/data-flow/0-overview.md:110`)을 unchecked 항목으로 등재 | 이번 PR 스코프 밖이 맞음(순수 이동, `spec_impact: none`). 별도 **planner 턴**에서 심볼(`KbEventType`) 기준 6곳 일괄 정정. 이번 세션 차단 사유 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec/data-flow/0-overview.md` §"주요 컴포넌트" WebSocket 행이 인용하는 "websocket.service.ts 헤더 주석"(EIA §R10 근거)이 실제로는 `websocket-events.types.ts`로 이동 | `spec/data-flow/0-overview.md:110` | 괄호 주석을 `websocket-events.types.ts 헤더 주석`으로 갱신 (project-planner 턴, 코드 수정 불요) |
| 2 | cross_spec | `NodeEventType`/`KbEventType` 정의 위치 서술이 여전히 `websocket.service.ts`를 지목(re-export 덕에 사실상 참이나 정밀하지 않음) | `spec/3-workflow-editor/3-execution.md:657`, `spec/5-system/10-graph-rag.md:552` | `websocket-events.types.ts`로 정밀화하거나 두 문서 `code:` front-matter에도 추가. 다음 spec 동기화 pass에서 처리 가능 (WARNING #1과 동일 후속 묶음) |
| 3 | rationale_continuity | §4.4 "순환 의존 처리" 표가 `forwardRef`/`ModuleRef.get` 두 기법만 언급 — 이번 PR의 "의존성-프리 모듈 추출"은 직교하는 세 번째 완화 기법인데 spec 본문에 미기재 | `spec/5-system/4-execution-engine.md` §4.4 | 필수 아님. §4.4에 "값/타입을 의존성-프리 모듈로 분리해 ESM 순환의 평가-순서 위험을 제거하는 보완 기법(코드: `websocket-events.types.ts`)" 한 문장 추가 시 향후 탐색 비용 감소 |
| 4 | convention_compliance | `spec-impl-evidence.md` §2.1/§3 (`code:` 필드 스키마, `status: partial` 매치 의무) 준수 확인 — 위반 아님 | `spec/5-system/6-websocket-protocol.md` frontmatter `code:` | 조치 불요 (확인 완료) |
| 5 | convention_compliance | `## Overview` 섹션 부재 — `spec/5-system/`은 다중 spec 영역(`_product-overview.md` 보유)이라 SKILL.md상 설계된 예외. 다만 같은 영역 내 `3-error-handling.md`는 자체 Overview 병존해 규약 자체가 모호 | `spec/5-system/6-websocket-protocol.md`, `2-api-convention.md` | 이탈 아님. 후속 planner 턴에서 SKILL.md의 "다중 spec 영역 개별-파일 Overview 허용 여부" 명확화 시 모호성 해소 |
| 6 | convention_compliance | `### 4.3`/`### 4.4` 절 번호 중복 — 이번 diff와 무관한 기존 상태(재확인), Markdown 앵커는 서로 달라 링크 충돌 없음 | `spec/5-system/6-websocket-protocol.md:254,437,783,806` | 이번 turn 차단 사유 아님. 후속 spec 정리 시 재배열 고려 |
| 7 | plan_coherence | `plan/in-progress/ws-event-types-extract.md` frontmatter `spec_impact: none`이 실제 diff(spec 1줄 변경)와 문자 그대로는 불일치 — in-progress 단계는 Gate C 의무 아니라 현재 차단 사유 아님 | plan frontmatter | `plan/complete/` 이동 시점에 `spec_impact`를 실제 변경 파일 목록(`spec/5-system/6-websocket-protocol.md` 등)으로 갱신하도록 완료 체크리스트에 기록 |
| 8 | naming_collision | `NotificationEventType` 동명 충돌(WS 인앱 알림 1값 enum vs `triggers/dto/notification-config.dto.ts` webhook 구독 5값 union) — JSDoc disambiguation 유지 중이며 이번 라운드에서 rename 후속 항목이 plan에 실제 등재됨(`ws-event-types-extract.md:325-328`) | `codebase/backend/src/modules/websocket/websocket-events.types.ts:213-221` | 등급 유지 충분(INFO). rename은 별도 작업으로 남겨 이번 리팩터의 "순수 이동" 스코프 보존 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 값/타입/wire 계약/이벤트명/채널/인가 전부 이동 전후 동일(diff 실측). 문서 귀속(SoT 포인터) drift 2건만 INFO |
| rationale_continuity | NONE | §4.4(순환 의존 봉인 기법) · EIA §R10(단일 sink) · 과거 리뷰 경고(`NotificationEventType`) 모두 승계·정합. 위반 없음 |
| convention_compliance | NONE | `spec-impl-evidence.md` code 필드 스키마 정확 준수. Overview 부재·절 번호 중복은 기존 상태/설계된 예외 |
| plan_coherence | LOW | plan 자기감사 철저(6라운드 review 수렴). 유일 잔여는 plan이 이미 등재한 "정본 위치 서술 stale" 후속 항목(WARNING) |
| naming_collision | LOW | `NotificationEventType` 동명 충돌 지속하나 JSDoc 완화 + 이번 라운드 rename 백로그 실제 등재로 진전. 신규 충돌면 없음 |

## 권장 조치사항
1. (선택, 비차단) 별도 **planner 턴**에서 `KbEventType` 등 심볼 정본 위치 서술 6곳(`spec/5-system/` 3곳 + `spec/data-flow/` 2곳 + `spec/3-workflow-editor/3-execution.md:657`) 일괄 정정 — plan에 이미 unchecked 항목으로 등재되어 있으므로 그 목록을 그대로 집행.
2. `plan/in-progress/ws-event-types-extract.md`가 `plan/complete/`로 이동할 때 `spec_impact: none`을 실제 변경 파일 목록으로 갱신(완료 체크리스트에 추가).
3. `NotificationEventType` 동명 rename은 plan에 이미 등재된 별도 백로그 항목으로 후속 세션에서 처리(이번 PR 스코프 밖 유지가 합리적).