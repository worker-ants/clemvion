# 부작용(Side Effect) 리뷰

## 발견사항

### 테스트 파일 (`execution-seq-allocator.service.spec.ts`)

- **[INFO]** `process.env` 수정이 `afterEach` 복원으로 올바르게 격리됨
  - 위치: `seqKeyTtlSeconds` describe 블록 (라인 401~437)
  - 상세: `process.env[ENV]` 를 직접 쓰는 테스트가 이미 존재하며, `afterEach` 에서 원래 값으로 복원한다. 이번 변경은 이 블록을 건드리지 않았으므로 환경 변수 부작용 없음.
  - 제안: 없음 (현행 유지)

- **[INFO]** `jest.spyOn` 이 `try/finally` 로 감싸져 spy 잔류 부작용 해소
  - 위치: `DEL 이 reject 해도 throw 하지 않고 swallow + warn` 테스트 (라인 326~356)
  - 상세: 이전 코드는 `warn.mockRestore()` 를 try 블록 말미에 배치해 `expect` 실패 시 spy 가 복원되지 않아 후속 테스트로 `logger.warn` mock 이 새어 들어갈 수 있었다. 변경 후 `finally` 에서 복원하므로 공유 상태(`logger` 의 `warn` 메서드) 오염이 제거됨.
  - 제안: 없음 (개선 완료)

- **[INFO]** `private getClient` monkey-patch 는 테스트 내부 상태에만 적용
  - 위치: `makeAllocator` 함수 및 `Redis 정상 발급 후 장애 전환` 테스트 (라인 188~197, 283~285)
  - 상세: `alloc` 인스턴스 프로퍼티를 직접 교체하는 방식으로, 모듈 레벨 프로토타입이나 전역 상태에는 영향 없음.
  - 제안: 없음

### 계획 문서 (`plan/in-progress/seq-allocator-test-cov.md`)

- **[INFO]** 체크박스 상태 갱신만으로 어떤 런타임 부작용도 없음
  - 위치: `검증` 섹션
  - 상세: 순수 마크다운 문서 변경. 상태 표시를 사실에 맞게 갱신.
  - 제안: 없음

### 리뷰 산출물 (`review/code/2026/06/28/12_45_28/RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`)

- **[INFO]** 신규 생성 파일이며 기존 파일 덮어쓰기 없음
  - 위치: `review/code/2026/06/28/12_45_28/` 하위 세 파일 (new file mode)
  - 상세: 모두 `new file mode 100644` 로 생성됨. 기존 파일을 수정하거나 삭제하지 않는다. 파일시스템 부작용 없음.
  - 제안: 없음

## 요약

이번 변경은 순수 테스트 코드 강화 커밋이다. 프로덕션 코드는 일절 변경되지 않았으며, 외부 서비스 호출·전역 변수·환경 변수 조작·공개 API 시그니처 변경은 발생하지 않는다. 기존에 `warn.mockRestore()` 위치 문제로 spy 가 테스트 간 누출될 수 있던 잠재적 부작용이 `try/finally` 패턴으로 오히려 제거됐다. 환경 변수 테스트 블록은 `afterEach` 복원을 유지하고 있어 격리가 유지된다. 리뷰 산출물 3개 파일은 신규 생성으로 기존 파일에 대한 덮어쓰기 충돌이 없다.

## 위험도

NONE
