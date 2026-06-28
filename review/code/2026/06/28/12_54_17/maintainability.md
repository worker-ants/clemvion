# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `warn.mockRestore()` try/finally 전환 — spy cleanup 방어 강화 적절
  - 위치: `execution-seq-allocator.service.spec.ts` diff hunk L56–L70
  - 상세: 이번 변경의 핵심 중 하나인 `warn.mockRestore()` 를 `finally` 블록으로 이동한 것은 올바른 방향이다. expect 실패 시 spy 잔류를 방지하는 표준 Jest 패턴이며, `seqKeyTtlSeconds` describe 블록에서 `afterEach` 로 env 를 복구하는 기존 패턴과 의도가 일치한다. 구현 방식(try/finally vs afterEach)만 다를 뿐 효과는 동일하다.
  - 제안: 현 상태 유지. 추후 spy 사용 테스트가 늘어날 경우 `afterEach(() => jest.restoreAllMocks())` 또는 jest.config `restoreMocks: true` 로 통일하는 것이 일관성 측면에서 유리하다(후속 리팩).

- **[INFO]** `as unknown as` 언캐스팅 패턴 신규 2건 추가 — 기존 누적 문제와 동일
  - 위치: `execution-seq-allocator.service.spec.ts` L333–L337 (logger spy), L461–L463 (sanitize const)
  - 상세: 이번 커밋으로 `(alloc as unknown as { logger: { warn: (m: string) => void } }).logger` 와 `(ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize` 두 패턴이 추가됐다. 파일 전체에서 이 패턴은 7회 이상 반복된다(`fallbackCounters`, `seqKeyTtlSeconds`, `getClient`, 등). 신규 2건은 기존 파일 패턴과 일관되어 코드 스타일 불일치는 없으나, 향후 내부 필드명 변경 시 수정 지점이 분산되어 있다는 구조적 누적 문제가 그대로 이어진다.
  - 제안: 파일 상단에 `type AllocatorInternals = { logger: { warn: (m: string) => void }; sanitize: (v: string) => string; fallbackCounters: Map<string, number>; seqKeyTtlSeconds: number; getClient: () => unknown }` 헬퍼 타입을 선언하고 전체 캐스팅을 `(alloc as unknown as AllocatorInternals).xxx` 로 통일하는 것을 별도 후속 리팩 PR 로 진행. 본 PR 범위 외이므로 현 상태 수용.

- **[INFO]** `sanitize` describe 블록 상단의 `const sanitize` 모듈 평가 시점 선언
  - 위치: `execution-seq-allocator.service.spec.ts` L461–L463
  - 상세: `const sanitize = (ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize` 가 describe 블록 진입 시 즉시 평가된다. `ExecutionSeqAllocator` 가 이미 임포트된 이후이므로 현재는 안전하나, 같은 파일의 `ttlOf(alloc)` 나 `makeAllocatorForTtl()` 처럼 래퍼 함수 형태로 선언하면 호출 시점 평가로 초기화 의존성이 명확해지고, 위의 `AllocatorInternals` 타입 통합 시 한 곳에서만 수정하면 된다.
  - 제안: `const sanitize = ...` 대신 `function callSanitize(v: string): string { return (ExecutionSeqAllocator as unknown as { sanitize: (v: string) => string }).sanitize(v); }` 로 변경. `ttlOf` 헬퍼 함수 패턴과 일관성 확보. 기능 영향 없음 — INFO.

- **[INFO]** 신규 경계 케이스 테스트(`it(...)`)가 기존 `it('128자 초과는 cap ...')` 과 같은 describe 블록에 연속 배치 — 가독성 양호
  - 위치: `execution-seq-allocator.service.spec.ts` diff hunk L86–L89
  - 상세: `'x'.repeat(200)` cap 테스트 직후에 `'x'.repeat(128)` / `'x'.repeat(129)` 경계 케이스가 배치된 구조는 논리적 순서(전형 케이스 → 경계 케이스)에 맞아 읽기 쉽다. 두 어설션을 한 `it` 블록에 묶은 것은 "동일 경계의 양 방향" 이라는 단위가 명확해 분리의 필요성이 낮다.
  - 제안: 현 상태 유지.

- **[INFO]** `expect(warn).toHaveBeenCalledWith(expect.stringContaining('exec-del-fail'))` 단독 어설션 — 메시지 전체 포맷 미검증
  - 위치: `execution-seq-allocator.service.spec.ts` diff hunk L64–L66
  - 상세: `stringContaining` 으로 executionId 포함 여부만 검증한다. warn 메시지 전체 포맷(예: `"[SeqAllocator] DEL failed for exec-del-fail: ..."`)을 `toHaveBeenCalledWith(expect.stringMatching(/패턴/))` 으로 고정하면 메시지 구조 회귀도 감지할 수 있다. 단, 메시지 포맷이 구현 내부에 해당하므로 느슨한 검증이 과잉 결합을 방지하는 의도적 선택일 수 있다.
  - 제안: 현 상태 유지 가능. 메시지 구조를 spec 으로 고정해야 한다면 `stringMatching` 으로 보강 고려(선택, 후속).

## 요약

이번 변경(신규 5개 테스트 케이스 — sanitize 경계·비문자열·warn 메시지 검증, spy try/finally cleanup, 주석 보강)은 기존 파일의 네이밍·구조·주석 수준과 일관성을 유지하며, 의도가 한국어 인라인 주석으로 명확히 문서화되어 있다. try/finally spy 정리, 경계 케이스 배치, 주석 보강 모두 유지보수성 관점에서 개선이다. 남은 문제는 이번 변경으로 신규 도입된 것이 아니라 파일 전반의 기존 누적 패턴(`as unknown as` 산재, `const sanitize` 즉시 평가)이며, 모두 INFO 수준으로 기능·안전성에 즉각적인 영향이 없다. Critical/Warning 발견 없음.

## 위험도

NONE
