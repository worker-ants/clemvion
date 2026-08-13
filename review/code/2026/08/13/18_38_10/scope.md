# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트 diff(72개 파일, 대부분 이전 리뷰/consistency 라운드 산출물)와 별개로,
`git log --oneline origin/main..HEAD`(9커밋) · `git diff origin/main...HEAD --stat`
· `git diff origin/main...HEAD -- codebase/`(8파일, +543/-42) · 최근 2개 커밋
(`860a727b7`, `64763c5cd`)의 실제 diff를 워크트리에서 직접 열어 대조했다.

## 발견사항

- **[INFO]** 워크트리/브랜치명("eia-r8-cache-scope")과 실제 작업 내용("backlog-final-three": snapshotCache LRU 테스트·dispatcher 로그 레벨 테스트·admission 배열 가드 하드닝)이 불일치한다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (frontmatter `worktree: lint-warning-triage`, 게이트 3행) — 이 tracker 문서가 여러 developer 턴에 걸쳐 누적되며, 이전 턴(2026-08-12, `eia-r8-cache-scope-4ae434`)이 쓰던 worktree 이름을 이번 턴(`backlog-final-three`)이 재사용했다.
  - 상세: 실제 코드 diff(`assertRowArray` 하드닝 4곳, `SNAPSHOT_CACHE_MAX_ENTRIES` export, 3개 spec 파일 테스트 보강)는 EIA R8 idempotency 캐시와 무관하다 — `review/consistency/2026/08/13/17_05_10/cross_spec.md` 가 이미 이 명칭 유사성으로 인한 오인 가능성을 실측(grep)으로 배제해 뒀다. 코드 자체의 스코프 위반은 아니고, 순수하게 worktree 명명/추적 상의 잔재다.
  - 제안: 조치 불요 — plan tracker 가 여러 턴을 순차로 기록하는 이 저장소의 정상 패턴(`plan/in-progress/*.md` 가 다회 developer 세션을 누적)이다. 다만 향후 신규 백로그 항목 착수 시 `.claude/tools/ensure-worktree.sh` 로 새 worktree 를 만들면 이런 이름 잔재가 재발하지 않는다.

- **[확인, 위반 아님]** 프로덕션 코드 변경(`execution-engine.service.ts`, `executions.service.ts`, 신규 `common/utils/assert-row-array.ts`)을 `git diff`로 직접 열어 대조한 결과, 4개 raw-SQL 소비 지점(`admitExecutionOrDefer`·`lockNonTerminalExecutionRow`·`updateExecutionStatus`·`computeChainDepth`)에 `assertRowArray` 가드를 배선하고 `runExecutionFromQueue`의 admission try/catch(routing release) 를 추가한 것 외에는 로직 변경이 없다. 이는 plan 이 명시한 backlog 항목과, 같은 PR 체인 내 선행 코드 리뷰 3라운드(`14_01_46`→`17_15_21`→`18_00_11`)가 각각 명시적으로 지적한 WARNING(자매 지점 미적용·routing 미해제·helper 중복)에 대한 후속 조치로 1:1 대응한다.
- **[확인, 위반 아님]** 최근 2개 커밋(`64763c5cd`, `860a727b7`)은 `git show --stat`으로 확인한 결과 `codebase/backend/src/common/utils/assert-row-array.spec.ts`의 주석 텍스트와 `plan/in-progress/backend-lint-gate-broken-on-main.md`의 서술만 수정한다 — 로직·테스트 케이스·assertion 변경 없이, 직전 라운드(`18_19_33`)가 지적한 "주석이 인용한 세션 ID 오류"를 정정하는 문서 전용 커밋이다. 새 스코프를 열지 않는다.
- **[확인, 위반 아님]** `chat-channel.dispatcher.spec.ts`의 `makeDispatcherHarness` 공통 헬퍼 추출과, admission 가드가 `return false`(defer)에서 `throw`(트랜잭션 롤백)로 바뀐 것 모두 같은 PR 체인의 선행 코드 리뷰가 직접 요구한 자기 교정이며 임의 리팩토링이 아니다(RESOLUTION.md 3건에 근거가 각각 기록됨).
- **[확인, 위반 아님]** `plan/in-progress/spec-draft-eia-notification-payload-contract.md`의 체크리스트 정리(중복·자기모순 블록 제거)는 이번 PR의 실제 코드 변경과 주제가 다르지만, 별도 consistency-check 라운드(`17_05_10` plan_coherence WARNING 1)가 지적한 결함을 그 권고대로 고친 것이고 코드 변경을 수반하지 않는다.
- **[확인, 위반 아님]** `review/code/2026/08/13/{14_01_46,17_15_21,18_00_11,18_19_33}/**`, `review/consistency/2026/08/13/{14_18_42,17_05_10}/**` 하위 60여 개 신규 파일은 CLAUDE.md가 명시한 코드 리뷰·consistency-check 산출물 저장 위치에 정확히 대응하는 강제 워크플로 산출물이다.
- 포맷팅만 바뀐 자리, 불필요한 주석 추가/삭제, 사용하지 않는 임포트, 의도치 않은 설정 파일 변경은 발견되지 않았다. `execution-engine.service.ts`/`executions.service.ts`의 신규 `import { assertRowArray } from '../../common/utils/assert-row-array'`는 실제로 각 파일에서 4회/1회 사용된다.

## 요약

이번 diff(`origin/main` 대비 9커밋, 72파일)의 실질 프로덕션 코드 변경은 3파일(`execution-engine.service.ts`, `executions.service.ts`, 신규 `common/utils/assert-row-array.ts`)에 국한되며, `git diff`로 직접 대조한 결과 plan이 명시한 백로그 항목과 같은 PR 체인 내 선행 코드 리뷰 4라운드가 요구한 후속 조치에 전부 소급 설명된다. 최근 2개 커밋은 로직 변경 없는 순수 주석/문서 정정이라 스코프를 넓히지 않는다. 유일하게 눈에 띄는 점은 워크트리 이름("eia-r8-cache-scope")이 실제 작업 주제("backlog-final-three")와 다르다는 것인데, 이는 누적형 plan tracker 문서가 여러 developer 턴에 걸쳐 worktree 이름을 재사용한 흔적일 뿐 코드 스코프 위반은 아니다. 요청 이상의 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
