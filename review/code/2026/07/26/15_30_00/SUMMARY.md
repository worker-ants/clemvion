# Code Review 통합 보고서 (5R — 4R 조치 검증)

## 전체 위험도

**LOW** — **Critical 0** (3라운드 연속). 4R 의 W19~W22 는 **전건 해소 확인**됐고, testing 이 mutation 주장 2건을 독립 재실측해 실패 시그니처까지 문자 그대로 일치함을 확인했다. 7개 reviewer 중 **4명이 위험도 NONE**. 잔여는 WARNING 1건(이번 PR 이 만든 코드 중복)뿐이다.

## 4R 항목 검증 결과 — 전건 해소

| 항목 | 결과 | 근거 |
|---|---|---|
| **W19** 취소 노드 영구 `running` | **해소** | `executeNode` 취소 분기가 `CANCELLED` 마킹 + `finishedAt` + `NODE_CANCELLED` emit. mutation: 마킹 제거 → `Expected "cancelled" / Received "running"` RED. side_effect 가 신규 emit 의 부작용(중복·구독자·순서)까지 전수 확인 — `ChatChannelDispatcher`·`NotificationFanout` 은 애초에 node-level 이벤트를 구독하지 않아 영향 표면 없음 |
| **W20** retry 정책 취소 오분류 | **해소** | 재시도 제외에 추가. mutation: 제거 → **호출 4회(1+3)** RED. requirement 가 `executeNode` 기존 계약(errorPolicy 라우팅·in-flight 등록/해제)과 무충돌 확인 |
| **W21** 인용 4번째 재발 | **해소** | JSDoc 2곳 정정. documentation 이 전 파일 `§5`/`§2.2`/`best-effort` grep 전수로 잔존 없음 확인 |
| **W22** CHANGELOG 미반영 | **해소** | 항목 6~9 추가, 실제 코드와 문자 일치 확인 |
| **W24** 범위 triage 프로세스 | **해소** | scope 가 `git log -S` 로 편입 4건의 최초 도입 커밋을 역추적 — 전부 이 브랜치 자신이 만든 것 확인. 분리 항목들은 대상 파일이 커밋 변경 목록에 **전혀 없음**을 대조 확인 |

## Critical 발견사항

**없음.**

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| W25 | maintainability | **W19 가 만든 20여 줄 중복.** `executeNode` catch 의 두 분기(`isAbortError` / `ExecutionCancelledError`)가 상태 마킹·`finishedAt`/`durationMs` 계산·`save`·`NODE_CANCELLED` emit 을 문자 그대로 복제한다. **차이는 `errorEnvelope` 유무 하나뿐.** 같은 파일이 Execution 레벨의 동형 중복을 `finalizeCancelledExecution`(W12)으로 이미 추출한 선례가 있다. 4R 이 "2줄 재throw idiom 은 추출 불필요" 로 판정한 것과는 규모가 질적으로 다르다 | **조치함** — `markNodeCancelled(nodeExecution, node, context, executionId, errorEnvelope?)` 추출. `errorEnvelope` 를 선택 인자로 둬 두 분기의 유일한 차이를 표현하고, throw 는 호출부 책임으로 남겨 "무엇을 다시 던지는가" 가 호출부에서 보이게 유지. mutation: 헬퍼의 마킹 제거 → `Received: "running"` RED |

## 참고 (INFO)

- **harness diff-list 갭** (testing·documentation·maintainability·side_effect·scope **5명 지적**) — 이번 라운드 프롬프트의 파일 목록이 검증 대상 소스 3파일(`execution-engine.service.ts`·`.spec.ts`·`CHANGELOG.md`)을 **전혀 포함하지 않았다**. 원인은 fix 커밋(`0f4047426`)이 코드 수정과 직전 라운드 리뷰 산출물을 한 커밋에 담은 것으로 보인다. 오케스트레이터가 각 reviewer 에게 "소스를 직접 열어 검증하라" 고 명시 지시해 실질 검증은 수행됐으나, 표준 파이프라인 단독이었다면 **핵심 임무를 프롬프트만으로는 수행할 수 없었다**. → 별도 harness 백로그.
- `13_47_42/RESOLUTION.md` 의 W17 줄 인용(`:10196`)이 여전히 실제 위치(`:10385` 부근)와 다름 — review 산출물 내부 기록 오류, 코드 무영향.
- `spec/5-system/6-websocket-protocol.md:186` 의 `execution.node.cancelled` 서술이 `isAbortError` 단일 생산자·`error` 상시 존재를 전제 — W19 로 두 번째 생산자가 생겼고 그 경로는 `error` 를 싣지 않는다. 소비자 전부 방어적이라 런타임 무해. **spec 은 developer 권한 밖** → planner 위임 항목에 추가 대상.
- `errorPolicy:'retry'` 노드가 취소 시 실제 재시도 없이도 `retryCount` 를 1 이상 저장 — `isAbortError` 부터 있던 기존 순서, 라우팅 무영향.
- W19 시나리오(Sub-Workflow 취소)는 unit 만 있고 e2e 부재 / `NODE_CANCELLED` payload 단언이 `objectContaining` 부분 매치 / CHANGELOG 항목 8 태그 형식 불일치 — 전부 저위험.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|---|---|---|
| security | **NONE** | W19 신규 emit payload 에 `error` 필드 자체가 없음 확인. 회귀 테스트가 `not.toContain('cancelled externally')` 로 문자열 수준 고정. `input` 등 나머지 필드는 `9842edebf`(#442) 이래 기존 구성 재사용 |
| side_effect | **NONE** | W19 해소. 중복 emit·구독자 영향·순서 역전 전부 없음 확인 |
| requirement | **NONE** | W20 해소(mutation 재현). `executeNode` 기존 계약 무충돌 |
| scope | **NONE** | §범위 판정 기준이 실제 커밋에서 지켜짐을 `git log -S` 로 검증. diff 3파일·3 hunk 로 정확히 국한 |
| testing | LOW | **mutation 2건 독립 재실측 — 주장과 문자 그대로 일치**. 새 vacuous 패턴 없음 |
| documentation | LOW | W21·W22 해소. 5번째 인용 재발 없음 |
| maintainability | MEDIUM | W25(중복) — 조치함 |

## 권장 조치사항

1. **W25** — 헬퍼 추출. **완료**.
2. (백로그) harness diff-list 갭 — 코드 수정과 리뷰 산출물이 한 커밋에 있을 때 소스 파일이 누락되는 문제.
3. (planner 위임) `6-websocket-protocol.md` 의 `execution.node.cancelled` 생산자·필드 서술 갱신.

## 라우터 결정

- **실행 7명**: security, requirement, scope, side_effect, maintainability, testing, documentation (강제 7명 전원)
- **제외 7명**: architecture · performance · dependency · database · concurrency(4R 전수 확인 완료, 이번 diff 는 동기 분기·마킹뿐) · api_contract · user_guide_sync
