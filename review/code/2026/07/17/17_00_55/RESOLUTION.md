# RESOLUTION — review/code/2026/07/17/17_00_55

Critical 0건 / Warning 10건. main 이 사전에 분류한 라우팅(반드시 fix vs fix 하지 말 것)을
그대로 실행했다 — 자체 판단으로 범위를 바꾸지 않았다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W#1 | 코드 | `a8c946056` | `output-shape.ts` 고아 JSDoc(L112-121, `MULTI_TURN_INTERACTION_TYPES` 이관 잔재) 삭제 + `isConversationOutput` JSDoc 을 함수 선언(L135) 바로 위로 재배치(24줄 이격 해소). 5개 reviewer(아키텍처/요구사항/범위/유지보수성/문서화)가 독립 지적한 항목 |
| W#2 | 문서(plan) | `a8c946056` | plan E-3b 절에 E-3·E-5·E-7 과 동일 형식의 "실측 정정" 각주 추가 — `REGISTRY_SITES` 1줄 추가안은 실행되지 않았고 `interaction-type-registry.ts` 의 exhaustive `Record<WaitingInteractionType, boolean>` 로 대체된 이유(부분집합 오탐 회피, 실측: `output-shape.ts` 에 `"form"`/`"buttons"` 리터럴 0건)를 명시 |
| W#3 | 코드(아키텍처) | 조치 없음 (main 지시) | `ResumableNodeHandler` 제네릭화 — 후속 칩 등록 완료. 파라미터를 넓히면 bivariance 로 좁은 구현체가 조용히 통과해 port switch fallthrough 위험이 있어 **손대지 않음** |
| W#4 | 코드(아키텍처) | 조치 없음 (main 지시) | `isConversationOutput` OR-chain 재설계 — plan 명시 의도적 범위 축소(이번 목표는 값 drift 차단, 리팩토링 아님). **코드 수정 금지** |
| W#5 | 테스트 | `a8c946056` | `MULTI_TURN_INTERACTION_TYPES` 가 정확히 `{"ai_conversation","ai_form_render"}` 인지 단언하는 테스트 신설(`interaction-type-registry.test.ts`, 신규 파일). mutation 실측: `ai_form_render: true→false` 주입 → red 확인 → 원복(`git diff` 잔여 0) |
| W#6 | 테스트 | `a8c946056` | `isConversationOutput` 의 endReason 화이트리스트 거부(negative) 테스트 신설(`output-shape.test.ts`). mutation 실측: `looksLikeConversationEnd` 의 화이트리스트 조건절 제거 → 신규 테스트만 red, 기존 31개 영향 없음 확인 → 원복 |
| W#7 | 유지보수성 | 조치 없음 (main 지시) | `satisfies`+`Exclude` exhaustiveness 보일러플레이트 공용 헬퍼화 — 우선순위 낮음, 이번 PR 범위 밖 |
| W#8 | 범위/이력 | review/**-전용 커밋(본 RESOLUTION 포함) | 이전 라운드(16_07_35, 미완결)의 미커밋 서브에이전트 리포트 3개(`architecture.md`/`side_effect.md`/`testing.md`)를 이력 보존 목적으로 커밋 포함. SUMMARY 소급 작성은 하지 않음(main 지시) |
| W#9 | 문서화 | `a8c946056` | `ai-end-reason/README.md` 에 형제 패키지 4개(`expression-engine`/`node-summary`/`graph-warning-rules`/`chat-channel-validation`) 전부가 갖는 `## 빌드`/`## 사용(Exports)` 섹션 추가 |
| W#10 | 요구사항/의존성 | `a8c946056` | `backend/Dockerfile:29`, `frontend/Dockerfile.playwright-e2e:38-39` 내부 패키지 클로저 개수 주석 정정("4개"→"5개", "6개"→"7개"). 기능 영향 없음(실제 COPY/manifest 는 기존에도 정확) |

## TEST 결과

- lint  : 통과 (72s)
- unit  : 통과 — backend 412 suites 전원 / frontend 279 files·5509 tests 전원(+1 tests 사전 존재 skip, 이번 변경 무관) / 내부 패키지 5개(ai-end-reason·expression-engine·graph-warning-rules·node-summary·chat-channel-validation) 전원 통과. (wrapper 요약줄의 `tests=14 passed` 표기는 로그 마지막 패키지 라인 오매칭 — 전체 로그를 직접 grep 해 각 워크스페이스 `Test Suites/Tests: N passed, N total` 전수 재확인, 실패 마커 0건)
- build : 통과 (257s) — tsc(backend/frontend/패키지 5개) + Docker build(backend, frontend) 전원 통과. Dockerfile 주석 수정(W#10)이 빌드에 영향 없음을 이 단계로 재확인
- e2e   : 통과 (448s) — backend jest-e2e 45 suites/256 tests 전원 pass + frontend playwright 51 tests 전원 pass. 전체 로그 직접 grep 재확인(실패 마커 0건) — wrapper 한 줄 요약의 `tests=256` 은 backend 몫이라는 기존 함정(메모리 기록)을 알고 있었기에 playwright 결과(`51 passed`)까지 로그에서 별도 확인함

## 보류·후속 항목

- W#3 `ResumableNodeHandler<TEndReason>` 제네릭화 — main 지시로 미조치, 후속 칩 이미 등록 완료. 넓히면 bivariance 위험(근거: `node-handler.interface.ts` 해당 JSDoc)
- W#4 `isConversationOutput` OR-chain 구조 리팩토링 — main 지시로 미조치, plan 명시 의도적 범위 축소
- W#7 exhaustiveness 단언 공용 헬퍼(`[X] extends [never] ? true : never` 패턴 제네릭화) — main 지시로 미조치, 우선순위 낮음
- INFO#1 내부 패키지 목록 자동 파생(`pnpm-workspace.yaml` glob 기반) — 후속 칩 이미 등록 완료, 자동 조치 대상 아님
- INFO#3 `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록에 `ai-end-reason/src/index.ts`·`interaction-type-registry.ts` 추가 — 선택사항, main 지시로 이번 라운드 미조치
- INFO#4 `output-shape.ts` 커밋 안 된 로컬 변경 — main 이 이미 실측 확인한 오탐(공유 worktree 동시 mutation-테스트 아티팩트). 본 세션 착수 시점 `git status` clean 재확인, 대상 파일은 본 세션에서 W#1 로 직접 편집·커밋됨
- 나머지 INFO(#2, #5~#12) — SUMMARY 자체가 "조치 불요"/"낮은 우선순위"/"필수 아님" 으로 명시. 자동 조치 대상 아님, 별도 후속 없음
- spec draft 위임: 없음 (이번 라운드 fix 대상 10건 중 spec/ 결함·SPEC-DRIFT 0건 — spec/ 파일은 이 fix 커밋에서 전혀 건드리지 않음)

## 참고

- 리뷰 라운드: `review/code/2026/07/17/17_00_55`
- fix 커밋: `a8c946056` (SUMMARY#1,2,5,6,9,10 배치, 단일 커밋)
- lint 로그: `_test_logs/lint-20260717-174137.log`
- unit 로그: `_test_logs/unit-20260717-174252.log`
- build 로그: `_test_logs/build-20260717-174447.log`
- e2e  로그: `_test_logs/e2e-20260717-174958.log`
- 진행 로그: `_resolution_log.md` (본 디렉터리)
