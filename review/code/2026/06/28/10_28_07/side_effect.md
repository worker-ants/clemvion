# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `makeAllocatorForTtl()` 헬퍼 함수 도입 — 스코프·가시성 확인
  - 위치: `describe('seqKeyTtlSeconds …')` 블록 내부 (라인 369-374)
  - 상세: 함수는 `describe` 클로저 내부에 정의되어 외부로 노출되지 않는다. `makeAllocator`(outer scope) 와 이름이 명확히 구분되어 있고, 동일 describe 내부의 `ttlOf` 헬퍼 및 `afterEach` 정리 훅과만 상호작용한다. 전역 상태·모듈 레벨 변수를 참조하거나 변경하지 않는다.
  - 제안: 현 구조 유지. 이름이 의도를 충분히 설명한다.

- **[INFO]** `process.env[ENV]` 수정은 변경 전후 동일한 패턴을 유지
  - 위치: 세 개의 `it` 블록 내부
  - 상세: `process.env` 변경은 원래 코드에서도 동일하게 수행하던 것이며, `afterEach` 훅이 `orig` 값으로 복원하는 구조도 그대로다. `makeAllocatorForTtl()` 도입이 env 읽기/쓰기 시점을 변경하지 않는다. `makeAllocatorForTtl()` 는 호출 시점에 env를 읽는 생성자를 호출할 뿐이므로 각 `it` 블록이 env를 세팅한 뒤 호출하는 흐름이 유지된다.
  - 제안: 없음.

## 요약

이번 변경은 `describe('seqKeyTtlSeconds …')` 내부에서 세 개의 `it` 블록이 동일하게 반복하던 `new ExecutionSeqAllocator(makeRedisConn() as unknown as RedisConnectionProvider)` 인스턴스 생성 코드를 `makeAllocatorForTtl()` 헬퍼로 추출한 순수 리팩터링이다. 함수는 `describe` 클로저에 국한되어 전역·모듈 레벨 상태를 건드리지 않고, 시그니처·공개 API·환경 변수 처리 순서·이벤트·네트워크 호출 등 어떤 부작용 관점에서도 행동 변경이 없다. 기존의 `afterEach` 복원 로직과 `process.env` 세팅 순서도 그대로 유지된다.

## 위험도

NONE
