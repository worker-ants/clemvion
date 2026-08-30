# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 가드 테스트 파일명 리네임이 같은 파일 안에서 절반만 반영됐다 — 정정하려던 바로 그 종류의 드리프트를 새로 하나 만들었다
  - 위치: `.claude/workflows/ai-review.js:109`, `.claude/workflows/consistency-check.js:48`, `.claude/workflows/merge-coordinate.js:58`
  - 상세: 이번 PR 은 `>>> SHARED-BLOCK: agent-return (... guard: .claude/tests/test_workflow_shared_block.py)` 를 `test_workflow_scripts.py` 로 정정했다 — 실제로 `.claude/tests/test_workflow_shared_block.py` 는 저장소에 존재하지 않고 `test_workflow_scripts.py` 만 존재한다(확인함). 그런데 이 정정은 **SHARED-BLOCK 마커 줄 자체**(4개 파일: `_lib/agent-return.mjs` 정본 + 3개 워크플로 미러의 `>>> SHARED-BLOCK` 줄)에만 적용됐고, `ai-review.js`/`consistency-check.js`/`merge-coordinate.js` 세 파일 각각에서 그 마커 바로 5줄 위에 있는 로컬 헤더 주석(`// Report-return contract — MIRROR of ... // `.claude/tests/test_workflow_shared_block.py` fails the build if these drift apart;`)은 그대로 남았다. 즉 같은 파일 안에 같은 사실(가드 테스트 파일명)이 두 곳에 적혀 있는데 한쪽만 고쳐졌다 — 이 PR 이 통째로 다루는 "파일과 반환 메시지가 서로 다른 것을 요구하는데 한쪽만 갱신됐다" 는 결함 클래스와 동형이다.
    실제로 `_lib/agent-return.mjs` 는 이 사실을 딱 한 곳에서만 말하므로 완전히 정합하지만(확인함), 3개 워크플로 파일은 각자 로컬 헤더 + SHARED-BLOCK 마커 두 곳에서 같은 사실을 말하고 그중 하나만 고쳐졌다.
    더 나쁜 점: `test_workflow_scripts.py::SharedBlockDriftTest._extract_block()` 은 `text.find(BEGIN)` (`BEGIN = ">>> SHARED-BLOCK: agent-return"`) 부터 슬라이스하므로, 그 이전에 있는 로컬 헤더 텍스트는 애초에 비교 대상에 들어가지 않는다 — 즉 드리프트 가드가 이 특정 스테일 텍스트를 구조적으로 볼 수 없다. 아무 테스트도 이걸 잡아주지 않으므로 다음 사람이 `.claude/tests/test_workflow_shared_block.py` 를 찾다가 헛수고하게 된다.
  - 제안: 3개 워크플로 파일의 로컬 헤더 줄도 `test_workflow_scripts.py` 로 맞춘다. 재발 방지까지 원한다면 헤더의 가드 파일명 언급을 SHARED-BLOCK 마커 줄에 있는 문구를 참조하는 식으로 단일화하거나, `_extract_block` 의 비교 범위를 로컬 헤더까지 넓히는 것을 고려할 것(다만 이건 이번 PR 범위 밖의 가드 설계 변경).

- **[INFO]** `updateExecutionStatus` JSDoc 이 개정 이력을 누적하는 방식으로 계속 길어지고 있다 (현재 약 40줄)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `updateExecutionStatus` 바로 위 JSDoc 블록 (실제 파일 기준 8553~8592행)
  - 상세: 이번 diff 로 "호출 스택 축도 확인했다 (2026-08-31)" 단락이 추가되며 마지막 괄호 문장이 "초판은 11곳... 그 다음 판은 어휘적 범위까지만... 이번에 호출 스택 축을 채웠다" 로 3세대째 개정 이력을 이어 붙이는 형태가 됐다. 현재 상태(무엇을 해도 되고 안 되는지)를 파악하려는 독자가 지나간 리뷰 라운드 서사를 함께 읽어야 한다. 같은 측정치(`.transaction(` 블록 36개 / 모듈 안 9개 / 모듈 밖 27개)가 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에도 거의 동일한 문장으로 중복 기재돼 있어, 둘 중 하나만 갱신되면 두 사본이 어긋날 수 있다.
  - 제안: JSDoc 은 "현재 유효한 제약 + 남는 한계"만 남기고, 세대별 개정 서사(무엇을 몇 번 고쳤는지)는 plan 문서 쪽에만 두는 것을 고려. 지금 구조는 review 세션 ID(`17_36_15`, `18_10_28`)까지 코드 주석에 박아 두는데, 코드를 읽는 사람 입장에서는 plan/review 경로를 몰라도 되는 정보다.

- **[INFO]** 같은 JSDoc 블록 안에서 "9" 라는 숫자가 서로 무관한 두 모집단을 가리켜 헷갈리기 쉽다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — 같은 JSDoc 블록 내 두 문장(실제 파일 기준 8571행의 "EngineDriver 경유 9곳"과 8579행의 "이 모듈 안 9개")
  - 상세: 8571행의 "9곳" 은 `updateExecutionStatus` 를 EngineDriver 경유로 호출하는 **호출부 개수**이고, 8579행의 "9개" 는 이 모듈 안에서 발견된 `.transaction(` **블록 개수**(그리고 그 블록들이 `updateExecutionStatus` 에 도달하지 않음을 확인한 것)다. 우연히 같은 값이라 빠르게 훑는 독자가 "그 9곳이 이 9개 트랜잭션 블록이구나" 라고 잘못 연결할 여지가 있다.
  - 제안: 두 번째 "9개" 를 언급할 때 "(위 20곳/9곳과는 별개의 집합)" 정도의 짧은 명시를 붙이면 오독을 막을 수 있다.

## 요약

이번 diff 의 핵심(파일 sink 와 반환 메시지 sink 를 분리한 계약 정정, 3개 워크플로 미러 동기화, 신규 회귀 테스트 2건)은 명확하고 잘 테스트됐다 — 특히 새 테스트 두 개는 뮤테이션으로 "회귀 검증 없음" 을 실측 확인한 뒤 추가된 것으로 보이고, 정규식/슬라이스 로직도 실제 계약 문구와 정합한다. 다만 부수적으로 수행한 가드 파일명 리네임(`test_workflow_shared_block.py` → `test_workflow_scripts.py`)이 SHARED-BLOCK 마커 줄에만 적용되고 3개 워크플로 파일 각각의 로컬 헤더 사본에는 반영되지 않아, 같은 파일 안에 신·구 파일명이 공존하는 새로운 드리프트를 만들었다 — 드리프트 가드 자신이 구조적으로 볼 수 없는 위치라 사후에도 잡히지 않는다. execution-engine.service.ts 의 JSDoc 추가분은 기능적으로 문제없으나 개정 이력이 누적되는 패턴이 계속되고 있고 plan 문서와 같은 수치를 중복 기재해 SoT 가 둘로 나뉘는 점은 가벼운 유지보수 부채다.

## 위험도

LOW
