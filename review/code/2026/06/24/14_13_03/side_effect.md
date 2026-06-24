# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 모듈 수준 `let` 변수 — 기존 패턴, 신규 위험 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` — `expressionReferenceCache`, `nodeCatalogCache`
- 상세: 이 두 변수는 이번 변경 이전부터 존재하는 모듈 스코프 상태다. 이번 커밋은 두 변수를 전혀 건드리지 않는다. `resetExpressionCacheForTesting()` / `resetNodeCatalogCacheForTesting()` 도 기존 export 이며 시그니처 변경 없음. 신규 전역/공유 상태 도입 없음.
- 제안: 없음.

### [INFO] 테스트 단언 추가 — 공유 상태 변경 없음
- 위치: `system-prompt.spec.ts` lines 63–70 (추가된 두 `expect` 단언)
- 상세: 기존 `it('teaches the 2-stage finish self-review routine ...')` 블록 내부에 `expect(prompt).toMatch(/does NOT skip review/i)` 와 `expect(prompt).not.toMatch(...)` 두 줄만 추가했다. 테스트 코드는 `buildSystemPrompt` 를 순수 함수로 호출해 반환값을 검사하므로, 프로세스 공유 상태·전역 변수·파일시스템에 대한 부작용이 없다. 기존 `beforeEach(resetNodeCatalogCacheForTesting)` 패턴이 이미 캐시 격리를 담당하고 있어 신규 단언도 같은 격리 범위 내에서 동작한다.
- 제안: 없음.

### [INFO] 프롬프트 문자열 변경 — 런타임 동작 불변
- 위치: `system-prompt.ts` `STATIC_BLOCK_3_EDIT_PLAYBOOK` 상수, 변경 전후 line 382
- 상세: 변경은 `STATIC_BLOCK_3_EDIT_PLAYBOOK` const 문자열 내 단일 문장을 교체한다. 이 상수는 `buildSystemPrompt()` 반환값에만 반영되고, 함수 시그니처·반환 타입·호출 규약은 무변경이다. 서버 런타임 동작(가드 로직, 이벤트, 네트워크 호출)에는 영향 없음. LLM 에 전달되는 문자열 내용만 변경된다.
- 제안: 없음.

### [INFO] `review/` 산출물 파일 추가 — 의도된 파일시스템 쓰기
- 위치: `review/consistency/2026/06/24/14_03_16/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md` (3개 신규 파일)
- 상세: 이 파일들은 consistency-check 워크플로가 설계상 작성하는 산출물이다(`review/consistency/<timestamp>/` 경로). CLAUDE.md 정보 저장 위치 규약("일관성 검토 산출물 → `review/consistency/**`")에 부합한다. 예상치 못한 파일시스템 부작용이 아님.
- 제안: 없음.

## 요약

이번 변경은 `system-prompt.ts` 의 LLM 안내 문자열에서 옛 skip clause 를 제거하고 정확한 동작 설명으로 교체하는 behavior-neutral 수정이다. 함수 시그니처·공개 API·전역 변수·이벤트/콜백·환경 변수·네트워크 호출 어느 것도 변경되지 않았다. 테스트 단언 2건은 기존 격리 패턴(`resetNodeCatalogCacheForTesting`) 내에서 동작하며 공유 상태를 오염시키지 않는다. `review/` 산출물 파일 3개는 규약상 의도된 파일시스템 쓰기다. 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
