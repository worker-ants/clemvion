### 발견사항

- **[INFO]** `jest.spyOn` + `mockRestore()` 패턴 — logger.warn spy 격리 적절
  - 위치: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` L339~353 (전체 파일 기준)
  - 상세: `warn.mockRestore()`가 테스트 블록 말미에서 호출되어 spy가 복원된다. `afterEach`가 아닌 인라인 복원이므로 해당 테스트가 예외로 실패할 경우 spy가 잔존할 수 있다. 그러나 `expect(() => alloc.release(...)).not.toThrow()` 이후 spy를 거는 구조이고 `release`는 동기 반환이므로 실제 예외 경로가 없어 실질 위험은 낮다.
  - 제안: `afterEach(() => warn.mockRestore())` 또는 `try/finally`로 감싸면 완전히 안전해진다.

- **[INFO]** `sanitize` private static 직접 접근 — 런타임 상태 변경 없음
  - 위치: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` L459~461 (전체 파일 기준)
  - 상세: `ExecutionSeqAllocator`를 `unknown`으로 캐스팅하여 private static `sanitize`를 참조한다. 클래스 자체를 수정하지 않고 함수 참조만 취득하므로 전역 상태 변경 없음. 테스트 전용 파일이고 프로덕션 코드는 무변경.
  - 제안: 현상 유지 가능. 향후 `sanitize`가 리네임/제거되면 `undefined is not a function` 런타임 에러로 탐지된다.

- **[INFO]** `makeRedis` 클로저 내 공유 배열 — 테스트 간 격리 확인
  - 위치: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` L150~185 (전체 파일 기준)
  - 상세: `ops`와 `store`는 `makeRedis()` 호출마다 새로 생성되므로 테스트 간 상태 누수 없음. 신규 두 `it` 블록 모두 독립 `makeRedis(...)` 호출로 격리됨.

- **[INFO]** `plan/in-progress/seq-allocator-test-cov.md` 신규 파일 생성
  - 위치: `plan/in-progress/seq-allocator-test-cov.md`
  - 상세: 의도된 plan 파일 생성이며 CLAUDE.md 규약상 `plan/in-progress/` 위치가 정상이다. `/ai-review` 체크박스가 미완 상태(`[ ]`)로 커밋되어 있는데, 이는 현재 리뷰 수행 중임을 나타내므로 정상 상태.
  - 제안: 리뷰 완료 후 체크박스 업데이트 필요.

### 요약

이번 변경은 프로덕션 코드를 전혀 수정하지 않는 순수 테스트 추가다. 신규 두 `it` 블록(`DEL reject swallow` 및 `sanitize` 직접 호출 3케이스)은 기존 helper(`makeRedis`, `makeAllocator`)를 재사용하며 각 테스트마다 독립 인스턴스를 생성한다. `jest.spyOn`은 `warn.mockRestore()`로 복원되어 공유 상태 누수 위험이 낮다. 함수 시그니처·인터페이스·환경 변수·네트워크 호출 변경은 전무하다. 발견된 항목은 모두 INFO 수준이며 차단 요인이 없다.

### 위험도

NONE
