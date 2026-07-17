# 신규 식별자 충돌 검토 — `plan/in-progress/ai-node-failed-conversation-preview.md`

## 발견사항

없음 (target 이 도입하는 신규 식별자 전수 조사 결과 충돌 없음).

### 조사한 신규 식별자와 근거

| 신규 식별자 | 종류 | 대상 위치 | 충돌 검사 결과 |
|---|---|---|---|
| `Inv-8` | 요구사항 ID (spec §9.9 UI Invariants) | `spec/conventions/conversation-thread.md` §9.9 | 기존 정의는 `Inv-1`~`Inv-7` (동 파일 L554-560) 까지만 존재. `Inv-8` 은 어느 spec/plan 파일에도 선점되지 않음 (target 자기 자신 제외 grep 결과 0건). 번호 연속성도 정합. |
| `CT-S15` / `CT-S16` | 요구사항 ID (spec §9.10 회귀 차단 시나리오) | `spec/conventions/conversation-thread.md` §9.10 | 기존 정의는 `CT-S1`~`CT-S14` (동 파일 §9.10 표). `CT-S15/16` 은 미사용 — target 자기 자신 외 참조 0건. 번호 연속성 정합. |
| `isFailedConversation` | 신규 지역 변수명 (파생 boolean) | `codebase/frontend/src/components/editor/run-results/result-detail.tsx` | 코드베이스 전역 grep 0건 — 신규. 기존 `isWaitingConversation` / `isCompletedConversation` 명명 패턴(`is<Adjective>Conversation`)과 일관돼 혼동 유발 소지 없음. |
| `effectiveConversationMessages` | 변수명 (target Phase 2 §2 가 "반영"이라 표현) | `result-detail.tsx:1057` | **신규 아님** — 이미 존재하는 변수(`isWaitingConversation ? ... : ...` 분기)를 target 이 재사용·확장하는 것. 충돌 없음(오히려 기존 식별자 재사용이라 바람직). |
| `plan/in-progress/ai-node-failed-conversation-preview.md` | 파일 경로 | plan 신규 파일 | 기존 `plan/in-progress/`·`plan/complete/` 어디에도 동명 파일 없음(가장 근접한 기존 파일은 `followup-conversation-reconcile.md`, 별개). frontmatter(`worktree`/`started`/`owner`) 컨벤션 준수. |
| §9.3 데이터 소스 선택 표 신규 행 (`node.failed` 종결 대화형 노드) | spec 표 행 (엔티티/키 아님) | `spec/conventions/conversation-thread.md` §9.3 | 기존 3행(conversation Preview 탭 / LLM Usage 탭 / 실행 이력 복원 view)과 "UI 용도" 축이 겹치지 않는 새 행 — ID 충돌 아님. 다만 §9.3 첫 행("conversation Preview 탭 → `conversationThread.turns` snapshot")과 신규 행("`node.failed` 종결 → store `conversationMessages`")이 동일 UI 용도(conversation Preview 탭)에 대해 서로 다른 1차 소스를 명시하게 되므로, spec 저자는 신규 행을 "예외/한정 조건"으로 명확히 종속시켜야 함 — 이는 identifier 충돌이 아니라 표 설계 이슈이므로 참고 INFO 로만 남김. |

검토 범위 밖(target 이 도입하지 않음, 확인만): 요구사항 ID(`NAV-*`/`ND-*`/`EH-DETAIL-*`), API endpoint, webhook/queue/SSE 이벤트명, ENV var/config key — target 은 이 카테고리에서 어떤 신규 식별자도 도입하지 않는다(순수 렌더 로직 버그픽스 + spec 표/불변량/시나리오 보강). `systemError.nodeId` 는 신규가 아니라 기존 spec §1.2.1(동 파일 L75) 이 이미 규정한 필드의 재사용.

## 요약

target 문서(`plan/in-progress/ai-node-failed-conversation-preview.md`)가 새로 도입하는 식별자는 spec 요구사항 ID `Inv-8`·`CT-S15`/`CT-S16`, 코드 변수명 `isFailedConversation`, plan 파일 경로 1개로 국한된다. 전수 grep 검사 결과 각각 기존 사용처와 번호·이름이 겹치지 않으며, `Inv-1~7`·`CT-S1~14`의 번호 연속선상에 정확히 이어지고, 변수명은 기존 `is<Adjective>Conversation` 명명 패턴을 따른다. 그 외 target 이 재사용을 명시한 `effectiveConversationMessages`·`systemError.nodeId` 는 이미 spec/코드에 정의된 식별자를 그대로 확장하는 것으로 의도적 재사용이지 충돌이 아니다. API endpoint·이벤트명·ENV var 등 다른 카테고리의 신규 식별자는 도입되지 않는다. 유일한 참고 사항은 §9.3 표에 추가되는 신규 행이 기존 첫 행과 동일 UI 용도(conversation Preview 탭)에 대해 병존하는 조건부 예외로 작성돼야 한다는 점인데, 이는 신규 식별자 충돌이 아니라 표 서술 정합성 이슈라 INFO 수준으로만 표기했다.

## 위험도

NONE
