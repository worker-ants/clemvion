# 유지보수성(Maintainability) Review

대상: 커밋 `52078f329da3d8f6ffa46b482c76e6ed2204d26f` (delta 리뷰 23_44_04 WARNING 조치 — sanitizer 회귀 가드 테스트 추가 + JSDoc 보강)

실질 코드 변경은 2곳뿐이다: `execution-engine.service.spec.ts` 신규 unit 1건, `execution-engine.service.ts` JSDoc 5줄 추가. 나머지 파일(RESOLUTION.md, SUMMARY.md, `_retry_state.json`, `architecture.md` 등)은 이전 리뷰 세션의 산출물 스냅샷으로 이번 변경의 리뷰 대상 로직이 아니다.

## 발견사항

- **[WARNING]** 신규 테스트가 기존 `callDispatch` 헬퍼를 재사용하지 않고 동일 캐스팅 보일러플레이트를 인라인 중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:766-790` (신규 `it('알림 메시지의 원본 예외를 새니타이징한다...')`)
  - 상세: 같은 `describe('dispatchExecutionFailedNotification ...')` 블록 상단(623-638)에 정확히 이 용도로 만들어진 `callDispatch(execution, createMany)` 헬퍼가 있다. 이 헬퍼는 `notificationsService` mock 주입과 `service as unknown as { dispatchExecutionFailedNotification: ... }` 이중 캐스팅을 캡슐화해, 이후 6개 테스트케이스(640, 674, 696, 732, 747)가 모두 이를 통해 짧게 작성됐다. 그런데 신규 테스트만 메시지 인자를 `'boom'`으로 고정한 헬퍼 시그니처 제약 때문에 헬퍼를 우회하고, 헬퍼 내부와 동일한 12줄짜리 캐스팅+주입 블록을 처음부터 다시 작성했다. 그 결과 (a) 같은 파일 안에 동일 패턴이 두 벌 존재하게 되어 향후 `dispatchExecutionFailedNotification` 시그니처가 바뀌면 두 곳을 동시에 고쳐야 하고, (b) 왜 이 테스트만 헬퍼를 안 쓰는지 읽는 사람이 바로 알기 어렵다(코멘트로 설명되어 있지 않음).
  - 제안: `callDispatch`에 `message: string = 'boom'` 선택 인자를 추가해 `callDispatch(execution, createMany, 'connect failed postgres://user:secret@db.internal:5432/app')` 형태로 재사용하도록 리팩터링. 신규 테스트 본문이 캐스팅 보일러플레이트 없이 4~5줄로 줄어들고, 헬퍼가 파일 내 유일한 dispatch 호출 경로가 되어 일관성이 회복된다.

- **[INFO]** JSDoc 추가는 간결하고 근거(spec 경로 §1.1) 포함 — 가독성 양호
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2452-2455` (`finalizeResumedExecutionOutcome` JSDoc)
  - 상세: 4줄 추가로 side-effect(best-effort 알림 발사)와 근거 spec 위치를 명시해 다음에 이 메서드를 수정하는 사람이 알림 발사 로직을 놓치지 않도록 돕는다. 함수 길이·중첩·복잡도에는 영향 없음(주석만 추가).
  - 제안: 없음. 현행 유지 권장.

- **[INFO]** 신규 테스트명이 다소 길지만 기존 컨벤션과 일치
  - 위치: `execution-engine.service.spec.ts:766` — `'알림 메시지의 원본 예외를 새니타이징한다 (connection string redact — 이메일 노출 방어)'`
  - 상세: 같은 블록의 다른 테스트명들도 `'workflow 조회가 throw 해도 dispatch 는 reject 안 함 (best-effort)'`처럼 한글 설명 + 괄호 보충 설명 패턴을 쓰고 있어, 신규 테스트명이 스타일 일관성을 해치지는 않는다.
  - 제안: 없음.

## 요약

이번 diff의 실질 변경 폭은 매우 작다(테스트 1건 추가, JSDoc 5줄 추가). JSDoc 추가는 목적이 명확하고 근거를 spec 위치까지 명시해 유지보수성에 순기여한다. 유일한 아쉬운 점은 신규 테스트가 같은 파일 안에 이미 존재하는 `callDispatch` 헬퍼를 재사용하지 않고 동일한 캐스팅 보일러플레이트(약 10줄)를 그대로 복제한 것으로, 헬퍼에 선택적 message 인자 하나만 추가했으면 피할 수 있었던 국소적 중복이다. 함수 길이, 중첩 깊이, 매직 넘버, 순환 복잡도 등 다른 항목에서는 문제가 발견되지 않았다.

## 위험도
LOW
