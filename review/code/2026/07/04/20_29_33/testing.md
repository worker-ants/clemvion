# 테스트(Testing) Review

리뷰 대상: 파일 1(`execution-engine.service.spec.ts` 신규 4개 테스트) + 파일 2(`execution-concurrency-cap.e2e-spec.ts` 신규 1개 e2e 테스트). 파일 3~10 은 이전 세션의 `review/consistency/**` 산출물(비-코드 아티팩트)이라 테스트 관점 리뷰 대상에서 제외한다.

교차검증을 위해 실제 구현(`execution-engine.service.ts`)의 `admitExecutionOrDefer`·`runExecutionFromQueue`·`markQueueWaitTimeout`, e2e helper(`createTeamWorkspace`), jest 설정(`jest.config.ts`, clearMocks 미설정)을 직접 대조했다.

## 발견사항

- **[INFO]** 원자 UPDATE 파라미터 순서·cap 매핑 회귀 테스트는 실제 구현과 정확히 일치
  - 위치: `execution-engine.service.spec.ts` L3186 부근(`원자 UPDATE 파라미터 순서·cap 매핑 회귀`)
  - 상세: 테스트가 고정하는 파라미터 배열 `['eSQL','ws-X',7,'wf',2]` 은 `execution-engine.service.ts` L2661~2671 의 실제 바인딩 순서(`[executionId, workspaceId, wsCap, execution.workflowId, wfCap]`, wsCap=`workspace.settings`, wfCap=`workflow.settings`)와 정확히 대응한다. ws cap(7)과 wf cap(2)을 의도적으로 다르게 둬 교차 오염(순서 뒤바뀜)을 확실히 잡아낼 수 있는 좋은 설계다. advisory lock 키 `exec-cap:<workspaceId>` 검증(L63~64)도 소스 L2657 과 일치.
  - 제안: 없음(그대로 유효).

- **[INFO]** admission 3-분기(admitted/deferred/cancelled) 회귀가 `runExecutionFromQueue` 의 실제 분기 로직과 정확히 대응
  - 위치: `execution-engine.service.spec.ts` L107~164(`admission deferred/cancelled/admitted` 3개 테스트)
  - 상세: `runExecutionFromQueue`(L3349~3355)의 `admission !== 'admitted'` 분기 — deferred 시에만 `releaseExecutionRouting` 호출, cancelled 시 미호출(실제 release 는 `markQueueWaitTimeout` L2593 내부 담당) — 을 테스트가 정확히 반영한다. admitted 분기에서 `runExecution(execution, input, true)` 시그니처·인자까지 고정한 점도 회귀 방지에 유효하다. cancelled 테스트의 주석("markQueueWaitTimeout 이 처리 — 여기선 admit stub 이라 미호출")은 실제 코드 대비 정확한 설명이며 오해의 소지가 없다.
  - 제안: 없음.

- **[INFO]** Mock/spy 격리 — describe 블록 전체가 top-level `beforeEach` 로 매 테스트마다 새 `TestingModule`/mock 레포 인스턴스를 재구성하므로, jest 설정에 `clearMocks`/`resetMocks` 가 없어도(`jest.config.ts` 확인) cross-test 오염 위험이 낮다. 신규 4개 테스트 모두 `spy.mockRestore()` 를 명시 호출해 원본 메서드를 복원한다.
  - 위치: `execution-engine.service.spec.ts` L412(`beforeEach`), 신규 테스트 각각의 말미 `admitSpy.mockRestore()`/`runSpy.mockRestore()`/`spy.mockRestore()`
  - 상세: 다만 `mockRestore()` 를 각 `it` 본문 마지막 줄에서 수동 호출하는 패턴은, 테스트 중간에 `expect` 가 throw 하면 restore 가 스킵될 수 있다(기존 파일 전반의 기존 관례이므로 이번 diff 만의 신규 리스크는 아님). `afterEach(() => jest.restoreAllMocks())` 을 쓰는 인접 블록(`redriveStuckExecution` describe, L1393)과 패턴이 섞여 있어 일관성 갭이 있으나, 현재 테스트들은 각 `it` 이 독립 module 을 갖고 실패해도 다음 `beforeEach` 가 전체를 재구성하므로 실질적 격리 실패로 이어지진 않는다.
  - 제안: 강제 사항 아님. 향후 이 describe 블록 규모가 커지면 `afterEach(() => jest.restoreAllMocks())` 통일을 고려.

- **[INFO]** e2e workspace-cap 테스트의 격리 전략은 적절
  - 위치: `execution-concurrency-cap.e2e-spec.ts` L1938~1975(`workspace-level cap 초과` 신규 테스트)
  - 상세: 기존 두 테스트가 공유 `workspaceId`(모듈 `beforeAll` 생성)를 사용하는 것과 달리, 신규 테스트는 `createTeamWorkspace` 로 완전히 격리된 `wsCapId` 를 생성해 잔여 running blocker 간섭을 원천 차단한다. `workflowCap=null` 로 workflow-level cap 을 비활성화해 workspace-level cap 만 단독으로 gating 하는지 순수하게 검증하는 설계도 타당하다 — 실제 구현의 workspace COUNT join(L2664~2666, "다른 workflow 의 running 도 슬롯 소비")을 정확히 겨냥한다.
  - 제안: 없음.

- **[INFO]** e2e 폴링/타임아웃 예산은 기존 패턴과 일관되고 여유 있음
  - 위치: `execution-concurrency-cap.e2e-spec.ts` L1696~1712
  - 상세: 슬롯 해제 후 `poll(execId, ..., 20_000, wsCapId)` — admission 재큐 delay 는 `EXECUTION_ADMISSION_RETRY_DELAY_MS=2000ms`(`execution-limits.ts` L69)이므로 20초 내 최소 9회 이상 재시도 여유가 있다. 전체 `it` 타임아웃 `40_000ms` 도 기존 두 테스트와 동일해 새 테스트만의 특별한 flakiness 유발 요인은 없다.
  - 제안: 없음.

- **[INFO — 잠재 커버리지 갭, 차단 아님]** admission 시 `admitExecutionOrDefer` 내부의 `workflow` lookup 결과가 null 인 경계 케이스(예: workflow 가 삭제된 상태에서 admission 시도)는 유닛/e2e 어느 쪽도 이번 diff 로 커버되지 않는다. 소스(L2648, L2657)는 `workspaceId ?? execution.workflowId` 로 fallback 하는 명시적 분기를 갖고 있어 의도된 방어 코드로 보이나, 회귀 테스트 대상은 아니다.
  - 위치: `execution-engine.service.ts` L2636~2657 (workflow null 대비 옵셔널 체이닝)
  - 상세: cap 매핑 회귀 테스트는 workflow 가 정상 조회되는 해피 패스만 다룬다. workflow 조회 실패/null 시 lock key fallback 로직은 신규·구 테스트 모두 미검증.
  - 제안: 이번 회귀 배치의 목적(파라미터 순서 고정)에는 영향 없어 차단 사유는 아니다. 후속 커버리지로 별도 티켓화 고려.

## 요약

신규 회귀 테스트 4건(유닛)과 1건(e2e)은 모두 실제 구현 코드(`admitExecutionOrDefer`, `runExecutionFromQueue`, `markQueueWaitTimeout`)와 라인 단위로 대조했을 때 정확하며, 의도한 불변식(원자 UPDATE 파라미터 순서·cap 교차 오염 방지, deferred/cancelled 분기에서 `runExecution` 미호출, workspace-level cap 단독 gating)을 실질적으로 고정한다. Mock 구성은 실제 트랜잭션/advisory-lock 흐름을 충실히 모사하고, 각 테스트가 독립된 TestingModule 인스턴스를 사용해 격리도 양호하다. e2e 테스트는 기존 파일의 폴링/타임아웃 관례를 그대로 따르며 별도 workspace 격리로 flakiness 를 낮췄다. 발견된 사항은 모두 INFO 등급(경미한 일관성/커버리지 참고 사항)이며 회귀 방지 목적을 저해하는 결함은 없다.

## 위험도

NONE
