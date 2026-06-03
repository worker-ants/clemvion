## 발견사항

- **[INFO]** `toolStatusMapFromItems` 함수에서 `startedAt` 전파 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/conversation/conversation-utils.ts` — `toolStatusMapFromItems` 함수
  - 상세: `toolStatusMapFromDebug`에는 `startedAt: tc.startedAt` 전파가 추가됐지만, 같은 파일의 `toolStatusMapFromItems`(live 이벤트 경로의 snapshot에서 상태를 보존하는 함수)는 `startedAt` 없이 그대로다. 이 함수의 반환 타입인 `ToolStatusInfo`에 `startedAt?`가 추가됐으므로, 보존 경로에도 동일하게 전파해야 라이브 → ai_message snapshot 교체 시 시각이 유실되지 않는다. 그러나 이 누락은 "의도하지 않은 추가 범위"가 아니라 오히려 "해야 할 변경을 하지 않은 불완전함"이므로 scope 범위 이탈 문제는 아니다. 별도 버그 리뷰에서 판단할 사항.
  - 제안: `toolStatusMapFromItems` 내 map.set() 호출에 `startedAt: item.timestamp` 추가 여부를 담당 리뷰어(side_effect/requirement)에서 검토 권고.

- **[INFO]** `use-execution-events.ts` 내 인라인 타입 정의 패턴 유지 — 불필요한 리팩토링 없음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/workflow-turn-timing-69fee2/codebase/frontend/src/lib/websocket/use-execution-events.ts`
  - 상세: 파일 내 익명 인라인 타입에만 `startedAt?`/`finishedAt?` 두 필드를 추가했다. 기존 인라인 타입을 named interface로 추출하거나 `ToolCallStartedPayload`를 import하는 정리는 하지 않았다. 이는 올바른 최소 범위 판단이다.

- **[INFO]** `spec/conventions/conversation-thread.md` 변경 범위
  - 위치: `spec/conventions/conversation-thread.md` — §9.12 신규 섹션
  - 상세: 기존 §9.11까지의 내용에는 손대지 않고 §9.12 섹션만 append했다. 불필요한 기존 내용 편집 없음.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 변경 범위
  - 위치: `spec/5-system/6-websocket-protocol.md`
  - 상세: §4.4 테이블에 두 행 추가, JSON 예시 3곳에 필드 추가, Reconciliation 노트에 항목 추가, Rationale 섹션에 신규 항목 append. 기존 내용 개서·정리 없음. 범위 내.

- **[INFO]** `plan/in-progress/workflow-execution-turn-timing.md` 신규 생성
  - 위치: `plan/in-progress/workflow-execution-turn-timing.md`
  - 상세: 새 작업에 대응하는 plan 파일 신규 생성. CLAUDE.md 정책(plan 파일은 `plan/in-progress/`)에 부합. `worktree` frontmatter 명시 등 요구 형식 충족. 범위 내.

## 요약

18개 파일 전체가 "워크플로우 실행 디버깅 UI — 요소별 발생 시각(절대) + 소요시간 노출" 작업의 명시된 Phase 2(백엔드 `startedAt`/`finishedAt` 추가) + Phase 3(프론트엔드 렌더) + Phase 1 spec 갱신 범위에 정확히 대응한다. 불필요한 리팩토링, 포맷팅 전용 변경, 관련 없는 파일 수정, 기능 과잉 추가는 확인되지 않는다. `toolStatusMapFromItems`의 `startedAt` 미전파는 scope 이탈이 아니라 구현 불완전 가능성이며 별도 리뷰 항목으로 분류된다.

## 위험도

NONE
