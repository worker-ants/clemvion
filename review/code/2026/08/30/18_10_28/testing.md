# 테스트(Testing) 리뷰 — `raw-update-guard-scope-0e154c` (18_10_28)

## 범위

이번 라운드는 직전 라운드(`17_36_15`)의 RESOLUTION 을 반영한 diff다: `updateExecutionStatus`
else 분기의 guarded UPDATE 를 `dataSource.transaction` 으로 감싼 핵심 변경 자체는 이전
라운드와 동일하고, 이번엔 (1) 신규 테스트 `it()` 명 축소, (2) e2e 한계를 밝히는 JSDoc/주석
캐버트 추가, (3) 두 분기가 복제하던 epilogue 4줄을 `finishStatusTransition` 헬퍼로 추출,
(4) CHANGELOG·plan·spec 문서 동기화가 얹혔다. 나머지 파일(7~27)은 직전 리뷰/컨시스턴시
라운드의 산출물이 신규 파일로 커밋되는 것이라 테스트 관점에서 별도 코드 검증 대상이 아니다.

## 검증 방법

코드 리뷰 외에 실제 테스트를 직접 실행해 문서화된 주장(456/456, 뮤테이션 RED 2×2)을
재확인했다. 저장소 파일은 전혀 쓰지 않았다 — `npx jest` 는 read-only 실행이고,
`git status --short` 로 시작·종료 시점 모두 클린 확인(내 산출물 디렉터리 외 변경 없음).

```
npx jest src/modules/execution-engine/execution-engine.service.spec.ts
→ Tests: 456 passed, 456 total   (반복 실행 6회 중 5회 이 결과)
```

## 발견사항

- **[INFO]** 검증 중 정확히 1회, 신규 테스트 2건 + 무관한 기존 테스트 1건이 동시에 실패하는
  것을 관측했다 — 이후 6회 재실행(캐시 클리어 포함)에서는 재현되지 않았다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4812`
    (`it('shape 위반 throw 가 트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)', ...)`),
    `:4780`(`it('updateExecutionStatus: guarded UPDATE 가 배열이 아니면 던진다...')`),
    `:6069`(`it('else 분기: query() reject 시 오류가 상위로 전파된다', ...)`, `PR2a — §8` describe 안)
  - 상세: 첫 `npx jest .../execution-engine.service.spec.ts` 실행(콜드 스타트, 이 워크트리에서
    내가 만든 첫 jest 프로세스)에서 위 세 테스트가 전부 `expect(received).rejects.toThrow()` →
    `Resolved to value: false` 로 실패했다. 세 테스트는 서로 다른 `describe` 블록에 있고
    (`admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)` 2건 + `PR2a — §8 active-running
    누적 타임아웃` 1건), 공통점은 모두 "else 분기 guarded UPDATE 가 예외를 던져야 한다" 는
    단언뿐이다. 이후 `-t` 로 개별 실행(각각 단독 PASS), `--clearCache` 후 재실행(PASS),
    전체 파일 재실행 5회(전부 456/456 PASS)로도 재현되지 않았다. 코드를 직접 읽어도
    `updateReturningRows`/`updateExecutionStatus` 어디에도 예외를 삼키는 `try/catch` 가 없어
    (재확인: `execution-engine.service.ts:8698-8734`), 로직상 이 세 테스트가 구조적으로
    실패할 이유가 없다. 가장 그럴듯한 원인은 **이 세션이 병렬 fan-out 리뷰 중**이라는
    프롬프트 경고와 일치한다 — 다른 reviewer 도 동시에 같은 워크트리에서 `npx jest`/`tsc`
    를 돌리고 있었을 수 있고, ts-jest 컴파일 캐시(`node_modules/.cache` 또는
    `$TMPDIR/jest_*`)를 여러 프로세스가 동시에 쓰면 한쪽이 상대 프로세스의 부분 완성
    캐시를 읽어 일시적으로 stale 컴파일 결과를 실행했을 가능성이 있다. **코드 결함이라는
    증거는 없다** — 재현 실패가 부재의 증거는 아니라는 점을 알고 있으므로 단정하지 않고
    기록만 한다.
  - 제안: 조치 불필요(가능성 높은 원인이 리뷰 하네스의 동시성이지 diff 의 결함이 아님).
    다만 다음에 이 파일(또는 인접 `updateExecutionStatus` 테스트)에서 유사한 "간헐적
    reject 실패" 를 **단독 실행이 아닌 상황에서 반복 관측**하면, 이번 기록을 근거로 회귀가
    아니라 harness 잡음이라고 성급히 결론짓지 말고 재조사할 것 — 이번엔 표본이 1회뿐이라
    확정할 수 없다.

- **[INFO]** `finishStatusTransition` 추출에 대한 전용 단위 테스트는 없지만, 기존 WARNING #9
  회귀 테스트들이 두 분기 모두에서 이 헬퍼의 행동(가드 통과시에만 세그먼트 기록)을 이미
  관측 가능한 형태로 고정하고 있어 실질적 커버리지 갭은 아니다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8757`
    (`private finishStatusTransition`)
  - 상세: `execution-engine.service.spec.ts:5907`(else 분기, "PENDING → RUNNING 전이가
    거부되면... 기록하지 않는다"), `:6013`/`:6036`(linkedNodeExec 분기, 거부/적용 대조)이
    추출 전과 동일한 로직을 그대로 검증한다 — 순수 리팩터라 회귀 위험이 낮고, 위 테스트들이
    실제로 456/456 GREEN 을 유지해 확인된다.
  - 제안: 없음. 참고로만 기록.

## 잘 된 점 (직전 라운드 INFO 처분 확인)

- 직전 라운드(`17_36_15`) testing INFO 1(테스트 이름 과대주장)·INFO 2(e2e 경계 미문서화)가
  이번 diff 에서 실제로 반영됐음을 코드에서 직접 확인했다 — 테스트 이름이
  `"...트랜잭션 manager 를 경유해 밖으로 전파된다 (롤백 전제조건)"` 로 좁혀졌고
  (`execution-engine.service.spec.ts:4812`), 바로 위 JSDoc(`:4806-4810`)에 "실 DB 검증은
  e2e 몫인데 shape 위반은 드라이버 계약이 바뀌어야 나는 이벤트라 e2e 로 재현할 방법이
  없다" 캐버트가 추가됐다.
- 신규 두 테스트("롤백 전제조건" + "정상 경로도 트랜잭션 manager 를 경유한다")는 서로
  보완 관계다 — 롤백 테스트 단독이면 "throw 경로만 우연히 트랜잭션을 탄" 등가 코드를
  배제 못 하는데, 정상 경로 테스트가 그 공백을 닫는다. 직전 라운드에서 이미 뮤테이션
  실측(트랜잭션 제거 → RED 2, throw 삼킴 → RED 2)으로 vacuous 가 아님을 확인했고
  (`review/code/2026/08/30/17_36_15/testing.md`), 이번 라운드는 핵심 로직을 건드리지
  않았으므로 그 실측이 유효하다.
- Mock 위임 설계(`mockTxManagerQuery` → `mockExecutionRepo.query` 위임, 매 호출마다
  `mockExecutionRepo.query` 를 다시 참조)는 클로저 고정 문제를 피해 개별 테스트의
  `mockResolvedValueOnce` 재무장이 정확히 반영된다 — 실행 확인: 위임 대상 SQL
  (`SELECT ... FOR UPDATE`)과 위임 트리거 SQL(`UPDATE execution ...`)이 텍스트상 겹치지
  않아(정규식 오매칭 없음, `lockNonTerminalExecutionRow` 실제 SQL 직접 대조) 두 갈래가
  서로를 침범하지 않는다.
- 테스트 격리: `beforeEach` 가 `TestingModule` 을 매번 재컴파일하고 모든 mock 을 새로
  만든다 — `txCallsBefore` 상대값 비교, `mockTxManagerQuery.mockClear()` 는 절대 호출
  횟수 가정을 피하는 방어적 습관으로 무해하다.
- 실제 실행으로 재확인: `엔진 스펙 단독 456/456`, plan/RESOLUTION 문서가 기록한 숫자와
  일치한다.

## 요약

핵심 변경(`updateExecutionStatus` else 분기 트랜잭션 래핑) 자체는 직전 라운드에서 이미
뮤테이션 검증을 거쳤고, 이번 라운드는 그 로직을 건드리지 않고 테스트 이름 축소·JSDoc
캐버트·헬퍼 추출(`finishStatusTransition`)만 얹었다 — 세 변경 모두 직접 코드 대조로
의도대로 반영됐음을 확인했고 회귀 테스트가 그대로 유효하다(456/456 재실행 확인, 5/6회).
유일한 특이사항은 검증 중 1회 관측된 간헐적 테스트 실패인데, 6회 재실행 중 재현되지 않았고
코드 로직상 실패할 경로가 없어 병렬 리뷰 세션 간 ts-jest 캐시 경합 등 harness 잡음일
가능성이 가장 높다 — 코드 결함으로 단정할 근거는 없어 INFO 로만 기록한다. 새로 추가된
private 헬퍼는 기존 WARNING #9 회귀 테스트가 양쪽 분기에서 이미 그 행동을 고정하고 있어
전용 테스트 없이도 커버리지 갭이 아니다.

## 위험도

LOW — 코드 동작에 영향을 주는 테스트 결함은 발견되지 않았다. 관측된 1회성 간헐적 실패는
재현되지 않아 확정적 결론을 내릴 수 없으므로 INFO 로 기록만 한다.
