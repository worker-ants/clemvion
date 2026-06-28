# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** private static 메서드 직접 호출을 위한 `as unknown as` 이중 캐스팅 반복
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 59–61 (DEL reject 테스트), 라인 459–461 (sanitize describe 블록 상단), 라인 341–344
  - 상세: `(alloc as unknown as { logger: { warn: ... } }).logger` 와 `(ExecutionSeqAllocator as unknown as { sanitize: ... }).sanitize` 패턴이 이미 기존 코드에도 다수 등장한다(`fallbackCounters`, `seqKeyTtlSeconds` 등). 신규 추가 2건은 기존 파일 패턴과 일관되나, 같은 형태의 타입 언캐스팅이 파일 전체에서 7회 이상 반복된다. 헬퍼 타입(`type PrivateAllocator = { logger: ...; sanitize: ...; fallbackCounters: ...; seqKeyTtlSeconds: ... }`)으로 한 곳에 모아 두면 향후 내부 필드명이 바뀔 때 수정 지점을 단일화할 수 있다.
  - 제안: 파일 상단에 `type AllocatorInternals = { logger: ...; sanitize: ...; fallbackCounters: Map<string, number>; seqKeyTtlSeconds: number }` 를 선언하고 `(alloc as unknown as AllocatorInternals).xxx` 로 통일. (기존 코드 정리와 함께 별도 후속 리팩터링으로 처리 가능 — 본 PR 단독 변경 범위는 신규 2건에 한정.)

- **[INFO]** `warn.mockRestore()` 명시적 호출 대신 `afterEach` 훅 부재
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 71 (신규 추가 it 블록)
  - 상세: `jest.spyOn` 으로 얻은 spy 를 it 블록 내에서 직접 `mockRestore()` 하는 방식은 기능상 문제없지만, 테스트 도중 expect 가 실패하면 `mockRestore()` 가 실행되지 않아 spy 가 잔류할 수 있다. 기존 파일의 다른 spy 사용처는 없어 비교 근거가 제한적이나, Jest 관례상 `afterEach(() => jest.restoreAllMocks())` 또는 `afterEach(() => warn.mockRestore())` 가 더 방어적이다. `seqKeyTtlSeconds` describe 블록은 `afterEach` 로 env 를 복구하는 패턴을 이미 사용하고 있어, 동일 패턴 적용 가능.
  - 제안: DEL reject 테스트의 `warn.mockRestore()` 를 `afterEach` 로 이동하거나, `jest.config` 에 `restoreMocks: true` 가 설정돼 있다면 명시적 `mockRestore()` 제거. (현재 기능 영향 없음 — INFO 등급 유지.)

- **[INFO]** `sanitize` describe 블록의 상수 선언 위치 — 모듈 레벨 `const`
  - 위치: `execution-seq-allocator.service.spec.ts` 라인 459–461
  - 상세: `const sanitize = (ExecutionSeqAllocator as unknown as ...).sanitize` 가 describe 블록 내부 상단에 모듈 평가 시 즉시 실행되는 형태로 선언돼 있다. `ExecutionSeqAllocator` 가 임포트된 이후라 기능상 안전하지만, private static 에 대한 계약이 클래스 재정의·상속으로 깨질 경우 초기화 순서 오류가 런타임 전까지 드러나지 않는다. 기존 `ttlOf`, `makeAllocatorForTtl` 헬퍼 함수 패턴처럼 `function sanitize(v: string)` 래퍼 함수로 감싸면 호출 시점 평가로 초기화 의존성이 명확해진다.
  - 제안: `const sanitize = ...` 대신 `function callSanitize(v: string): string { return (ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize(v); }` 형태로 래핑. 동일 파일의 `ttlOf` 헬퍼 함수 패턴과 일관성 확보.

## 요약

신규 추가된 5개 테스트 케이스(DEL reject 경로 1건, sanitize 3건)는 기존 파일의 네이밍·구조·주석 수준과 잘 일치하며, 의도가 한국어 주석으로 명확하게 문서화되어 있다. 함수 길이·중첩 깊이·매직 넘버 측면에서는 신규 코드 자체에 문제가 없다. 다만 `as unknown as` 언캐스팅 패턴이 파일 전반에 걸쳐 산재하는 구조적 누적 문제가 있고, spy cleanup 이 테스트 실패 시 잔류할 수 있는 경미한 위험이 있다. 모두 INFO 수준이며 기능·안전성에 즉각적인 영향은 없다.

## 위험도

NONE
