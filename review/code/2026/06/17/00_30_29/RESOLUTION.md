# RESOLUTION — C-1 step1 (NodeBootstrapService + WORKFLOW_EXECUTOR)

리뷰 세션: `review/code/2026/06/17/00_30_29/SUMMARY.md`
대상 PR: `claude/engine-split-s1-nodebootstrap` (C-1 step1 / m-3)
전체 위험도: **LOW** · Critical 0 · Warning 4

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W-1 | Architecture | **수용(코드 변경 없음)** — `NodeBootstrapService` 가 `nodes/ALL_NODE_COMPONENTS` 를 직접 import 하는 것은 bootstrap 이 nodes(컴포넌트 카탈로그)+engine(`NodeHandlerDependenciesProvider` 가 `ExecutionEventEmitter`·`ConversationThreadService` 등 엔진 deps 집약) 를 잇는 **브리지**라, 현 구조에서 유일한 무순환 경로. reviewer 도 "허용" 판정. PR2 `EngineDriver` 도입 시 플러그인 등록 패턴으로 역전 예정 (plan c1-engine-split.md). | — |
| W-2 | Architecture | **수용(코드 변경 없음)** — `ExecutionEngineService` 9,670줄 god-class 잔류(ctor 26→24)는 strangler-fig step1 의 **의도된 한계**. stacked PR2(AiTurnOrchestrator)·PR3(Form/Button)·PR4(Retry) 로 점진 해소 (plan). | — |
| W-3 | Testing | **fix** — `execution-engine.service.spec.ts` 4개 TestingModule 블록의 미사용 `NodeHandlerDependenciesProvider` 등록 제거 (15101 mock 은 의도적 유지). | `0bd881c7` |
| W-4 | Maintainability | **fix** — `onModuleInit` 에 "노드 핸들러 bootstrap 은 NodeBootstrapService(C-1 step1)로 이전, 본 hook 은 큐 깊이 gauge 등록 전용" NOTE 주석 추가. | `0bd881c7` |

INFO 처분 (요점):
- **INFO-1** (`WORKFLOW_EXECUTOR` 평문 문자열 토큰): 코드베이스 기존 관용(`SHUTDOWN_GRACE_MS` 등 문자열 토큰)과 일치 — 관용 유지. Symbol 전환은 불필요.
- **INFO-2** (`assertSameWorkspace` fail-open): 본 PR 미변경(기존 코드). 후속 PR 에서 node handler 의 `executeAsync`/`executeInline` 경로 확장 시 fail-closed 전환 검토 — plan c1-engine-split.md 후속 항목에 반영.
- **INFO-8** (`node-bootstrap.service.spec.ts` 2번째 테스트): 1번째(`toHaveBeenCalledWith` deep-equality)와 달리 **reference identity(`toBe`)** 를 단언해 미세하게 구분되나 가치 낮음 — INFO 라 유지(저우선). PR2 정리 가능.
- 기타 INFO(3·4·5·6·7·9·10·11·12): 현 구조 유지 권장 또는 PR4 일괄 갱신 권고 — 즉시 조치 불요.

## TEST 결과

- **lint**: 통과 — 변경 파일 7종 eslint 0 errors (backend full lint 은 `codebase/packages/sdk` 의 fresh-worktree 부트스트랩 이슈로 web-chat 단계 실패하나 backend·frontend lint 는 통과; 본 PR 과 무관한 환경 셋업 이슈).
- **unit**: 통과 — backend 350 suites / 7045 passed / 1 skipped (신규 `node-bootstrap.service.spec.ts` + 엔진 16k줄 spec 포함; W-3 provider 제거 후 DI 무결 재확인).
- **build**: 통과 — `nest build` 0 errors (TS1272 `import type` fix 포함).
- **e2e**: 통과 — commit `7e38716a` 에서 dockerized e2e **34 suites / 202 tests 통과**(앱 정상 부팅 = bootstrap 이동·forwardRef 제거 후 DI·lifecycle 검증). 리뷰 fix commit `0bd881c7` 은 런타임 .ts 의 **주석 1건**(컴파일 산출물에서 strip) + **테스트 spec 파일**(미배포) 변경뿐이라 배포 artifact 가 `7e38716a` 와 동일 → e2e 결과 불변. ("Jest did not exit" open-handle 경고는 테스트 통과 후 종료 단계 pre-existing 환경 이슈, bootstrap 이동과 무관.)

## 보류·후속 항목

- **W-1 / W-2** (god-class·레이어 배치): plan `c1-engine-split.md` 의 PR2(`EngineDriver`)·PR3·PR4 로 해소.
- **INFO-2** (`assertSameWorkspace` fail-closed 전환): 후속 PR plan 에 반영 — node handler 의 executeAsync/executeInline 활성 확장 시점.
