# Code Review 통합 보고서 (4R — 3R 조치 검증)

## 전체 위험도

**MEDIUM** — **Critical 0** (2라운드 연속). 3R 의 W14~W18 은 **전건 해소 확인**됐고 testing 이 mutation 4건을 독립 재실측해 주장이 정확함을 확인했다. 다만 이번 라운드가 **이 PR 이 직접 만든 새 결함 1건**(W15 재throw 가 노드를 영구 `running` 으로 남김)과 **인접 잔존 결함 2건**을 찾았다.

## 3R 항목 검증 결과 — 전건 해소

| 항목 | 결과 | 근거 |
|---|---|---|
| W14 스로틀 Map Background 누수 | **해소** | `:6951` delete 추가. concurrency 가 `set()` 콜체인을 역추적해 **5개 top-level 진입점 전부가 3개 정리 지점으로 커버**됨을 확인. mutation RED |
| W15 `executeNode` 취소 미분류 | **해소**(단, 아래 신규 결함 파생) | `:5812` 재throw 가 FAILED 마킹 앞에 배치. mutation RED |
| W16 retry-turn `error` 노출 | **해소** | `!isCancelled` 가드. REST DTO 가 `?? null` 로 흡수해 소비자 영향 없음(side_effect 확인). mutation RED |
| W17 스로틀 테스트 flaky | **해소** | `Date.now` spy 로 결정화. requirement·testing 확인 |
| W18 Map 정리 커버리지 0 | **해소** | 정상 종결·Background 두 경로 회귀 테스트 + LoopExecutor 대칭 테스트. mutation RED |

## Critical 발견사항

**없음.**

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| W19 | side_effect | **W15 재throw 가 새 결함을 만들었다.** `ParkReleaseSignal` 패턴을 복제했으나 전제가 다르다 — park 은 재개돼 누군가 row 를 마감하지만 **취소는 재개되지 않고** `finalizeCancelledExecution` 은 top-level Execution 만 갱신한다. 결과: Sub-Workflow 노드의 `NodeExecution` 이 `running`/`finishedAt=null` 로 **영구 잔류**하고 프론트 타임라인이 영원히 spinner. 같은 catch 의 `isAbortError` 분기가 명시한 "terminal 이벤트 필수" 불변식 위반. **게다가 W15 테스트의 단언이 vacuous 였다** — `lastNodeExecSave` 가 반환하던 것은 최초 RUNNING save 라 `not.toBe(FAILED)` 가 RUNNING 인 채로도 참이었다 | **조치함** — `CANCELLED` 마킹 + `finishedAt` + `NODE_CANCELLED` emit 추가(내부 message 는 payload 미포함). 테스트를 `toBe(CANCELLED)` + `finishedAt` + emit + message 미노출 양성 단언으로 강화. mutation: 마킹 제거 시 `Received: "running"` RED |
| W20 | requirement | **`errorHandling.policy:'retry'` 노드에서 취소가 재시도된다.** `executeWithRetry` 의 재시도 제외 판정이 `isAbortError` 뿐인데 `ExecutionCancelledError` 는 `name` 이 `AbortError` 가 아니라 걸리지 않는다 → 최대 3회 재호출 + 백오프(최대 7초) 뒤에야 수렴 | **조치함** — 재시도 제외에 추가. mutation: 제거 시 **호출 4회**(1+3) RED |
| W21 | documentation · maintainability (2명 수렴) | **"인용이 실체와 어긋난다" 4번째 재발.** 3R 이 §5→§2.2 인용 오류를 plan 에서만 고치고 **완전히 동일한 문장이 있는 소스 JSDoc(`:545`)** 은 손대지 않았다. 또 W14 로 정리 지점이 3곳이 됐는데 `containerCancelCheckedAtMs` 필드 JSDoc 은 여전히 2곳만 나열 | **조치함** — JSDoc 두 곳 정정 |
| W22 | documentation | CHANGELOG 에 W14~W16 미반영 — 같은 섹션의 기존 관례(라운드별 후속 항목 추가)와 불일치 | **조치함** — 항목 6~9 추가(W14·W15·W20·W16) |
| W23 | testing | 대형 단일 spec 파일의 **구조적 flakiness** — 64회 반복 중 2회, `Date.now` 와 무관한 신규 테스트 2건이 flake. 원인은 파일에 기존부터 있던 real-timer 헬퍼 `flushResumeDrive`(파일 자체 주석이 "CI 고부하 시 flaky" 를 명시) | **미조치 — 백로그**. 이 PR 이 만든 것이 아닌 선재 구조 문제이고, 해소는 spec 파일 분할 규모의 작업이다 |
| W24 | scope | **프로세스 지적**: security 가 3R 에서 낸 W15·W16 은 스스로 "diff 밖" 이라 밝히면서 미변경 파일 수정을 제안했고, 명시적 triage 없이 해소 사이클에 편입됐다 | **수용 — 이번 라운드에서 명시 triage 함**(아래 §범위 판정) |

## 범위 판정 (W24 에 대한 응답)

이번 라운드 발견을 명시적으로 갈랐다.

- **편입** — W19(이 PR 이 직접 만든 결함), W20(이 PR 의 `ExecutionCancelledError` 확산으로 **새로 도달 가능해진** 경로), W21·W22(이 PR 이 만든 문서의 부정확).
- **분리(백로그)** — W23(선재 구조적 flakiness), `runParallel` 의 `failures` 미소비, `ParallelExecutor 'stop'` 의 `failures[0]` 우선순위 레이스, 가드 시퀀스 헬퍼 승격(W8), shutdown `FAILED` 미감지.
- 기준: **"이 PR 이 만들었거나, 이 PR 때문에 새로 도달 가능해졌는가"**. 아니면 백로그.

## 참고 (INFO)

- `ExecutionCancelledError` 재throw 지점이 6곳으로 늘었으나 maintainability 는 **헬퍼 추출 불필요** 판정 — 4곳은 축소 불가능한 2줄 idiom이고 실질 정보가 사이트별 주석에 있어 추출 시 손실. 다만 이 결함 클래스가 5라운드 연속 재발견된 것은 규약 부재 신호이므로 저비용 문서화 권장.
- 3R `RESOLUTION.md`(main 작성)의 W17 줄 인용 `:10196` 이 실제 위치(`:10308` 부근)와 다름 — 코드 정확성 무영향, review 산출물 내 오류.
- 스로틀은 시간 상한이지 아이템 개수 상한이 아님(§5 best-effort 상 수용).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| side_effect | MEDIUM | W14·W16 해소 확인. **W19 신규**(영구 running + vacuous 단언) |
| documentation | MEDIUM | 250ms 명시 해소. **W21 4번째 재발**·W22 |
| requirement | MEDIUM | W17 해소 확인. **W20 신규**(retry 정책 취소 오분류) |
| testing | LOW | **mutation 주장 4건 전부 독립 재실측 일치**. W23 구조적 flake |
| maintainability | LOW | 재throw 확산은 추출 불필요 판정. W21 수렴 |
| scope | LOW | diff 자체는 위반 없음. **W24 프로세스 지적** |
| concurrency | NONE | **W14 완전 해소** — 5개 진입점 × 3개 정리 지점 전수 확인 |
| security | NONE | W15·W16 해소 확인. `ExecutionCancelledError` message 소비 지점 10곳 전수 확인 — 잔존 노출 경로 없음 |

## 라우터 결정

- **실행 8명**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency (강제 7명 전원 포함)
- **제외 6명**: architecture · performance(3R NONE, 이번 diff 는 성능 표면 무변화) · dependency · database · api_contract · user_guide_sync
