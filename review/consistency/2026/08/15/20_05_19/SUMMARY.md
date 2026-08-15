# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 Critical 없음.

## 전체 위험도
**LOW** — 대상은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록 1줄 추가를 제외하면 순수 코드 리팩터(`websocket.service.ts` 의 이벤트 enum/interface/type 을 의존성-프리 신규 모듈 `websocket-events.types.ts` 로 추출). wire 이벤트명·payload shape·emit 호출 경로·R10 단일 sink 정책은 5개 checker 모두 코드 diff 로 직접 대조해 무변경임을 확인. 발견된 항목은 전부 코드 이동에 따른 spec 문서 내 위치/등재 정보 stale 화(INFO~WARNING 급 문서 동기화)뿐이며 이번 PR 을 막을 사유 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 아래 WARNING 항목도 developer 권한 밖(spec/ read-only)이지만 등급이 CRITICAL 이 아니므로 이 표 대상 아님. 참고용으로 조치 위치만 §권장 조치사항에 명시.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `KbEventType` 정본 선언 위치 stale 서술 — plan 의 "후속(planner 턴 인계)" 항목이 `10-graph-rag.md:552` 한 곳만 등재했으나 동일 패턴이 `spec/5-system/` 안에만 최소 3곳(`6-websocket-protocol.md:740`,`:1034`, `8-embedding-pipeline.md:276`) 더 있고 영역 밖 `data-flow/6-knowledge-base.md:288` 도 동일 | `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)" | `6-websocket-protocol.md:740,1034`, `8-embedding-pipeline.md:276`, (참고) `data-flow/6-knowledge-base.md:288` | plan 의 후속 항목 리스트를 위 3~4곳 전수로 확장하거나 "`WebsocketService` 의 `KbEventType`" 패턴을 `grep -rn` 으로 잡아 planner 턴에 전수 목록으로 인계 (코드 자체는 developer 권한 밖 — plan 문서 갱신만 필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/data-flow/0-overview.md:110` 의 "websocket.service.ts 헤더 주석" 인용이 리팩터로 위치 이동(R10 문구가 `websocket-events.types.ts` 로 이관) | `spec/data-flow/0-overview.md:110` | 인용을 `websocket-events.types.ts` 의 `ExecutionChannelEvent` JSDoc 으로 갱신하거나 파일-불변적 표현으로 완화 (planner 턴, spec/data-flow/ 는 developer 쓰기 범위 밖) |
| 2 | Cross-Spec | `spec/3-workflow-editor/3-execution.md` frontmatter `code:` 가 같은 리팩터의 자매 spec(`6-websocket-protocol.md`)과 비대칭 — `NodeEventType` 인용하면서도 `websocket-events.types.ts` 미등재 | `spec/3-workflow-editor/3-execution.md` frontmatter `code:`(4-13행), 본문 L657 | `code:` 에 `codebase/backend/src/modules/websocket/websocket-events.types.ts` 추가 (CI 비차단, 등재 완결성 문제) |
| 3 | Cross-Spec / Rationale Continuity | `spec/5-system/10-graph-rag.md:552` `KbEventType` 정본 위치 서술 stale — 이미 plan/RESOLUTION 에 후속 등재됨, 착지 후에도 여전히 open (신규 발견 아님, 재확인) | `spec/5-system/10-graph-rag.md:552` | 기존 계획대로 별도 planner 턴 처리 (WARNING#1 과 함께 일괄 처리 가능) |
| 4 | Rationale Continuity | `spec/5-system/4-execution-engine.md` §4.4 Rationale 에 이번 추출을 반영하는 후속 bullet 부재 — plan 문서 차원(원문 인용+층위 구분)은 충실히 보완됐으나 spec 본문 자체는 미이행 | `spec/5-system/4-execution-engine.md` §4.4(Rationale, 라인 1328~) | 후속 세션에서 §4.4 말미에 "값·타입 선언은 websocket-events.types.ts 로 추출되어 순환 참여자 집합이 축소됐다(2026-08-15). DI 그래프·봉인 기법·단일 sink 정책 자체는 불변" 한 줄 추가 (planner 턴) |
| 5 | Convention Compliance | 직전 라운드(18:53:27)의 "`## Overview` 섹션 부재" INFO 는 `_product-overview.md` 존재 시 SKILL.md 예외 조항에 비추어 실이탈 아닐 가능성 — 정정 | `spec/5-system/6-websocket-protocol.md`, `2-api-convention.md` | project-planner SKILL.md 의 "다중 spec 파일 영역 Overview 위임 규칙" 명확화 시 이 INFO 자체 소멸 가능 (이번 PR 과 무관) |
| 6 | Convention Compliance | `6-websocket-protocol.md` §4 절 번호 중복(`### 4.4` 두 번, `4.3`이 `4.4` 뒤 등장) — origin/main 에도 존재하던 기존 상태, 이번 diff 무관 | `spec/5-system/6-websocket-protocol.md` L209/L392/L738/L761 | 후속 spec 정리 시 재배열 고려 (명시적 규약 위반 아님, 참고용) |
| 7 | Naming Collision | `NotificationEventType` 동명 충돌(`websocket-events.types.ts` enum vs `triggers/dto/notification-config.dto.ts` union) — 직전 라운드 WARNING 대로 disambiguation JSDoc 주석 반영 확인됨, 근본 rename 은 여전히 별도 항목으로 유예 | `codebase/backend/src/modules/websocket/websocket-events.types.ts:219-221` (주석: 209-217) | rename 항목이 실제 plan 트래커(예: `spec-sync-external-interaction-api-gaps.md`)에 등재됐는지 이번 턴 종료 전 확인 권장 (등재 누락 시 재발견만 반복될 위험) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | R10 단일 sink 불변식·wire 이벤트명·payload shape 무변경 확인. spec 문서 2곳 위치 인용 stale(INFO) + 기존 open item 1건 재확인 |
| Rationale Continuity | LOW | §4.4 봉인 기법(forwardRef/ModuleRef)·단일 sink·"근본 축소는 별도 backlog" 유예 결정 어느 것도 재도입/번복 없음. spec 본문 후속 bullet 미이행(INFO) |
| Convention Compliance | NONE | `spec-impl-evidence.md` `code:` 필드 스키마 정확히 준수. CRITICAL/WARNING 없음, INFO 3건(2건은 이번 diff 무관 기존 상태) |
| Plan Coherence | LOW | plan 트래커 동시 갱신·line-citation 심볼 기준 정리 등 전반적으로 관리 양호. 유일 발견: `KbEventType` 후속 등재 범위가 실제보다 좁음(WARNING) |
| Naming Collision | LOW | 신규 식별자 실질 도입 없음(15개 심볼 순수 이동 + import 13곳 rewrite). 기존 WARNING(`NotificationEventType` 동명)에 대한 disambiguation 주석 반영 확인 → INFO 로 하향 |

## 권장 조치사항
1. (WARNING#1) `plan/in-progress/ws-event-types-extract.md` §"후속" 의 `KbEventType` stale 서술 등재 범위를 `6-websocket-protocol.md:740,1034`·`8-embedding-pipeline.md:276`(및 `data-flow/6-knowledge-base.md:288`) 까지 확장 — plan 문서 갱신만 필요, developer 권한 내.
2. (INFO#3와 통합 가능) 위 항목을 다음 planner 턴에서 `10-graph-rag.md:552` 건과 함께 일괄 처리.
3. (INFO#1,2,4) planner 턴에서 `spec/data-flow/0-overview.md:110` 인용 갱신, `spec/3-workflow-editor/3-execution.md` `code:` 등재, `spec/5-system/4-execution-engine.md` §4.4 후속 bullet 추가를 한 번에 묶어 처리 권장.
4. (INFO#7) developer 는 이번 턴 종료 전 `NotificationEventType` rename 후속 항목이 실제 트래커에 등재됐는지 확인.
5. (INFO#5,6) 이번 PR 과 무관한 기존 상태이므로 후속 spec 정리 세션에서 검토(비차단).