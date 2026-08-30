# 동시성(Concurrency) 코드 리뷰

## 검증 방법

`git status --short` 로 시작·종료 시 저장소 상태를 확인했고(clean), 저장소 파일은 뮤테이션하지
않았다(읽기 전용 `Read`/`grep`만 사용). 이번 diff 는 이전 라운드(`17_36_15` concurrency)가 이미
리뷰한 `updateExecutionStatus` else 분기 트랜잭션화 코드에, 그 라운드의 WARNING/INFO 후속 조치
(self-deadlock JSDoc 추가, `finishStatusTransition` 헬퍼 추출, CHANGELOG/plan/spec 문서 갱신)가
합쳐진 누적 diff다. `execution-engine.service.ts` 의 실제 현재 상태를 직접 열어 diff 와 대조했고,
`updateExecutionStatus`/`EngineDriver.updateExecutionStatus` 의 전체 호출부와 파일 내 모든
`dataSource.transaction`/`manager.transaction` 블록을 grep 으로 전수 대조했다.

## 발견사항

- **[WARNING]** self-deadlock 경고 JSDoc 이 "현재 호출부 11곳 전수 대조" 라고 적었지만, 실제
  호출부 전체는 20곳이다 — `EngineDriver` 를 경유하는 9곳이 그 "11곳" 집계 밖에 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8570`
    (`public async updateExecutionStatus` 위 JSDoc, "**호출 제약 — 자신의 트랜잭션 콜백 안에서
    부르지 말 것.**" 문단, 특히 "현재 호출부 11곳은 전부 top-level 이라 해당 없음(`17_36_15`
    concurrency INFO 2 가 전수 대조)" 문장)
  - 상세: 이 JSDoc 이 세는 "11곳" 은 `execution-engine.service.ts` **자체 안의**
    `this.updateExecutionStatus(` 호출(652, 2309, 2409, 2485, 2574, 3569, 4307, 4432, 4755,
    4893, 5014행)뿐이다. 그런데 `updateExecutionStatus` 는 `EngineDriver` 인터페이스
    (`engine-driver.interface.ts:84`) 의 멤버라 다른 4개 서비스가 `this.driver.updateExecutionStatus(...)`
    로 호출한다 — `ai-turn-orchestrator.service.ts`(453, 550, 1608행, 3곳),
    `button-interaction.service.ts`(391, 562행, 2곳), `retry-turn.service.ts`(696, 915행, 2곳),
    `form-interaction.service.ts`(110, 325행, 2곳) = 추가 9곳. 실제 호출부 총합은 **20곳**이지,
    JSDoc 이 명시한 11곳이 아니다.

    직접 대조한 결과 오늘 시점엔 위험이 실현되지 않는다 — 이 9곳 중 어느 하나도 이미 열린
    `dataSource.transaction`/`manager.transaction` 콜백 안에서 호출되지 않는다. 위 4개 파일에서
    `.transaction(` 을 여는 곳은 `retry-turn.service.ts:215`(`retryLastTurn` 함수, 215-244행)
    단 하나뿐인데, 그 블록은 `manager.save`/`createQueryBuilder` 만 쓰고 `updateExecutionStatus`
    를 호출하지 않는다 — 696행(`finalizeGuarded`)·915행(`resumeGraphAfterRetry`)은 둘 다 그
    트랜잭션과 무관한 별개 함수의 top-level `await` 다. 따라서 **지금 당장 self-deadlock 이
    트리거되는 경로는 없다.**

    문제는 문구 자체다. `17_36_15` concurrency 라운드의 INFO 2(과 그 JSDoc 정착본)는 "전수 대조"
    라고 주장하면서도 실제로는 같은 파일 안의 호출부만 세었다(그 라운드의 `side_effect.md` 는
    4개 소비자 파일까지 열어봤다고 적었지만, 그 결론은 이 JSDoc 문장에 반영되지 않았다 —
    JSDoc 은 "11곳" 이라는 숫자만 남겼다). 이 저장소는 "완전성 주장이 실제보다 좁다" 부류의
    결함을 반복 겪었고, 이 JSDoc 이 정확히 그 모양이다 — 다음 사람이 새 호출부를
    `execution-engine.service.ts` 안에만 추가하며 "11 → 12" 로 숫자만 갱신하고, driver 경유
    9곳 쪽에 새 호출부(예: 어떤 서비스가 자기 트랜잭션 콜백 안에서 `driver.updateExecutionStatus`
    를 호출하도록 리팩터링)가 생겨도 이 JSDoc 의 "top-level 확인됨" 이라는 확신을 그대로
    믿을 위험이 있다.
  - 제안: JSDoc 문장을 "현재 호출부 20곳(본 파일 11 + `EngineDriver` 를 소비하는
    `ai-turn-orchestrator`/`button-interaction`/`retry-turn`/`form-interaction` 서비스의 9)은
    전부 top-level" 로 정정하거나, 최소한 "`EngineDriver` 소비자 4개 파일의 호출부도 포함해
    확인함" 한 문구를 추가해 audit 범위가 파일 경계에 갇혀 있지 않음을 명시한다.

- **[INFO]** (재확인, 신규 아님) else 분기가 트랜잭션 래핑으로 바뀌며 hot path 의 커넥션 풀
  점유 시간이 늘어난다는 `17_36_15` concurrency INFO 1 은 이번 diff 에도 그대로 유효하고,
  RESOLUTION 에서 "의도된 트레이드오프, 조치 불요" 로 이미 처분됐다 — 재조사 불필요.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8696-8727`
  - 상세: `let persisted = false; await this.dataSource.transaction(async (manager) => {...});`
    는 짝 전이(`linkedNodeExec`) 분기와 형태가 일치하고, 목적(shape 위반 throw 시 실제 롤백
    보장)이 왕복 증가 비용을 상회한다는 이전 판정을 재확인했다. 새로 추가할 내용 없음.

- **[INFO]** (재확인) `finishStatusTransition` 추출은 동시성 관점에서 새 공유 상태를 만들지
  않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8757-8766`
  - 상세: `private finishStatusTransition(execution, newStatus, enteringRunning, persisted)` 는
    인자만으로 동작하는 순수 위임이고, 호출부 두 곳(8654행 linkedNodeExec 분기, 8735행 else
    분기) 모두 자기 트랜잭션이 끝난 뒤 호출한다 — 트랜잭션 경계를 넘어서는 공유 mutable 상태
    (`this.segmentStartMs`) 접근은 추출 전과 동일한 지점(같은 함수, 같은 순서)에서만 일어난다.
    추출 자체가 새 race 를 만들지 않는다.

## 요약

핵심 코드 변경(else 분기 guarded UPDATE 를 `dataSource.transaction` 으로 감싸 shape-위반
throw 시 실제 롤백을 보장) 자체는 이전 라운드(`17_36_15`)가 이미 정확히 검증했고, 이번 diff 는
그 검증에 대한 후속 조치(self-deadlock JSDoc, `finishStatusTransition` 헬퍼 추출, 문서 갱신)를
더한 누적본이다. 새로 발견한 것은 그 self-deadlock JSDoc 자체의 완전성 문제다 — "호출부 11곳
전수 대조" 라는 문구가 실제로는 같은 파일 안의 호출부만 세고, `EngineDriver` 를 경유하는 4개
소비자 서비스의 9개 호출부를 audit 서술에서 누락했다. 직접 전수 대조한 결과 그 9곳 어디도
현재 트랜잭션 콜백 안에서 호출되지 않아 self-deadlock 이 지금 실현되는 경로는 없지만, 문구가
주는 "확인됨" 이라는 확신의 범위가 실제 호출부 전체보다 좁아 향후 회귀 방지 효과가 기대보다
약하다. 그 외 커넥션 풀 점유·헬퍼 추출은 이전 라운드 판정을 재확인했을 뿐 새로운 위험은
없다. Critical 은 없다.

## 위험도

LOW
