# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec checker 가 CRITICAL 1건(`waitingNodeType` 필드 오너십/SoT 정반대 선언)을 발견했다.

## 전체 위험도
**CRITICAL** — EIA §6.2(신규)와 WS §4.4(본 PR 미변경) 문서가 `waitingNodeType` 필드의 SoT 를 정반대로 선언하고, EIA §6.2 의 신규 주장은 자신이 인용하는 참조 구현(`parseWaitingForInput`)으로 반증된다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `waitingNodeType` 필드 오너십(SoT)이 EIA §6.2(본 PR 신규 추가)와 WS §4.4/Rationale(본 PR 미변경) 사이에서 정반대로 선언됨. EIA §6.2 는 `node.type → waitingNodeType` 을 "위젯/SDK 가 읽는 외부 소비 필드"로 신규 선언하며 WS-owned 내부 식별자 목록에서 `waitingNodeType` 을 암묵적으로 뺐지만(3개로 축소), WS §4.4 본문·Rationale 3곳은 여전히 `waitingNodeType` 을 "WS 내부 전용이라 EIA 밖"이라고 반복 선언 중. 또한 양쪽이 참조 구현(SoT)으로 인용하는 `channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput` 은 실제로 `waitingNodeType` 을 전혀 읽지 않아(`interactionType` 만 사용) EIA §6.2 의 신규 주장이 그 자신이 인용한 참조 구현으로 반증됨(반면 `waitingNodeType` 을 실제 읽는 코드는 내부 에디터 WS 채널의 `use-execution-events.ts` 뿐이라 오히려 원래 "WS 소유" 쪽이 코드 실태와 부합). | `spec/5-system/14-external-interaction-api.md` §6.2 (L697-719 부근, commit `4b13ca5ae`) | `spec/5-system/6-websocket-protocol.md` §4.4 (L395) + Rationale "§4.4 wire 필드 caveat"(L973-983, 2026-08-13 갱신 각주 포함) | (a) WS §4.4 본문+Rationale 2곳에서 `waitingNodeType` 을 WS-owned 목록에서 빼고 EIA §6.2 를 SoT 로 넘기되, 이 경우 `parseWaitingForInput`/`eia-types.ts` 가 실제로 이 필드를 소비하도록 위젯 코드도 함께 갱신하거나 "현재 미소비지만 wire 계약상 보장"이라 명시. **(b) 더 낮은 비용— 권장**: EIA §6.2 의 신규 `node.type → waitingNodeType` 행과 "위젯/SDK 가 읽는다" 서술을 철회하고 `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 과 함께 원래의 4개 WS-owned 제외 목록으로 되돌려 참조 구현 실태·"오너십 분리" 설계 의도와 일치시킨다. |

## planner 인계 (권한 밖 Critical)

> `spec/5-system/` 문서(EIA §6.2·WS §4.4) 자체의 정정이 필요한 사안으로, 코드 변경으로는 해소되지 않는
> spec drift 다. 이 항목은 developer 권한 밖이며 planner 턴에서 spec 정정이 정상 경로다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/` 쓰기는 `project-planner` 권한. `developer`/코드 변경으로 두 spec 문서 간 SoT 상충을 해소할 수 없음(spec 텍스트 자체의 모순) | project-planner | `spec/5-system/14-external-interaction-api.md` §6.2 blockquote (`node.type → waitingNodeType` 행 + "위젯/SDK 가 읽는다" 서술) 철회 **또는** `spec/5-system/6-websocket-protocol.md` §4.4 본문 + Rationale "§4.4 wire 필드 caveat"(WS-owned 목록에서 `waitingNodeType` 제외) 갱신 — 위 제안 (a)/(b) 중 택1. (b) 채택 시 참조 구현·설계 의도와 정합, 코드 변경 불요 | cross_spec.md Critical #1 (본 SUMMARY 상단 표와 동일) |

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `Planned` 라벨 표기가 같은 문서 안에서 두 가지 형태로 갈림 — 신규 §6.2 `interaction` 블록이 `Planned (미구현)`(순서 역전) / `Planned 다`(영어 단독)를 쓰는데, 같은 문서 §6 기존 표(`result.outputs`/`durationMs` 행 등)는 일관되게 `미구현 (Planned)`를 씀. blockquote 가 "같은 표기"라 주장하지만 문자열이 다름 | `spec/5-system/14-external-interaction-api.md` §6.2 (webhook 예시 comment + 바로 아래 blockquote) | 두 곳 모두 `**미구현 (Planned)**`으로 통일. 별도 planner 턴 없이 다음 spec 편집 시 함께 정리 가능 |
| 2 | plan_coherence | `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 글로브 삽입으로 본문이 +1줄 이동, 형제 plan(`spec-update-node-cancellation-shutdown-classification.md`)의 raw line-number 인용(`:186`/`:375`)이 추가로 stale 해짐(단, 주된 stale 원인은 이번 diff 이전부터 존재) | `spec/5-system/6-websocket-protocol.md` (frontmatter `code:` 목록 삽입 지점) | 이번 PR 조치 불요(내용 충돌 없음, 소유 plan 도 다른 owner). 해당 plan 을 다음에 집행할 때 raw line 인용 대신 본문 텍스트("execution.node.cancelled" 행 / "replay 중 cancel" 불릿)로 재탐색할 것. 겸사겸사 이미 구현된 `#6 보강 (4)` 를 완료로 마킹 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | `waitingNodeType` SoT 가 EIA §6.2(신규)와 WS §4.4(미변경) 사이에서 정반대로 선언되고, EIA 신규 주장은 자신이 인용한 참조 구현으로 반증됨 |
| rationale_continuity | NONE | strip 깊이 확장·`getStatus` 값마스킹+삭제 병행 두 결정 번복 모두 대응 Rationale 항목을 함께 갱신했고 "기각된 대안" 문단 보존. 신규 Rationale 연속성 위반 없음 |
| convention_compliance | LOW | `Planned` 라벨 표기 불일치(INFO) 외 전 항목이 conventions·실 코드와 정합 확인 (webhook 봉투, URL 상대경로, null 부재표현, anchor 유효성 등) |
| plan_coherence | LOW | 3개 관련 plan 의 합의 항목 전부 target 에 정확히 반영됨. 유일 이슈는 이번 diff 이전부터 존재하던 형제 plan 의 raw line-number stale 인용이 소폭 더 밀린 것(INFO) |
| naming_collision | NONE | 신규 식별자(`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`/`stripAndRedact`)는 단일 정의·일관 재사용이며 충돌 없음. §6.2 URL 정정은 오히려 기존 불일치 제거 |

## 권장 조치사항
1. **(BLOCK 해소 최우선)** planner 턴에서 `waitingNodeType` SoT 상충을 해소 — 위 §planner 인계 표의 (a)/(b) 중 택1. (b)(EIA §6.2 신규 행 철회, 원래 4개 WS-owned 제외 목록 복원)이 참조 구현·기존 설계 의도와 가장 정합하며 코드 변경이 불요해 비용이 낮다.
2. (선택, 비차단) `spec/5-system/14-external-interaction-api.md` §6.2 의 `Planned` 라벨 표기 두 곳을 `미구현 (Planned)` 로 통일.
3. (선택, 비차단) `spec-update-node-cancellation-shutdown-classification.md` 의 raw line-number 인용을 본문 텍스트 기반으로 재탐색하고, 이미 구현된 `#6 보강 (4)` 를 완료로 마킹.