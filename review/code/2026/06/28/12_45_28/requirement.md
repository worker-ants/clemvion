# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: execution-seq-allocator.service.spec.ts

- **[INFO]** sanitize CR/LF/탭 테스트 어설션 정확성 확인
  - 위치: 라인 88–89 (`sanitize('a\r\nb\tc')` → `'a  b c'`)
  - 상세: `'a\r\nb\tc'` 에 대해 정규식 `/[\r\n\t]/g` 가 `\r`, `\n`, `\t` 를 각각 공백 1개로 치환 → 결과 `'a  b c'` (6자). 어설션과 정확히 일치. 프로덕션 구현과 일치함.

- **[INFO]** 128자 cap 테스트 정확성 확인
  - 위치: 라인 92–93 (`'x'.repeat(200)` → `toHaveLength(128)`)
  - 상세: 프로덕션 코드 `.slice(0, 128)` 와 일치. 200자 입력 → 128자 cap 어설션 올바름.

- **[INFO]** 비문자열 입력 강제 변환 테스트 정확성 확인
  - 위치: 라인 96–98 (`sanitize(123 as unknown as string)` → `'123'`)
  - 상세: 프로덕션 코드 `String(value)` 가 숫자 123을 `'123'` 으로 변환 후 `.replace(…).slice(…)` 통과. `'123'` 은 3자이므로 cap 미적용. 어설션 올바름.

- **[INFO]** release DEL reject swallow + warn 테스트 정확성 확인
  - 위치: 라인 51–73
  - 상세: 프로덕션 `release()` 에서 `client.del(key).catch((err) => { this.logger.warn(…); return 0; })` 패턴 확인. 테스트는 `await Promise.resolve()` 로 microtask 큐를 flush 한 후 `warn` 1회 호출을 검증함 — `.catch()` 의 promise microtask timing 을 정확히 반영. `expect(() => alloc.release(…)).not.toThrow()` 로 동기 반환(fire-and-forget) 계약도 검증됨. 구현과 일치.

- **[INFO]** private static 메서드 직접 호출 방식 (캐스팅)
  - 위치: 라인 84–86 (`ExecutionSeqAllocator as unknown as { sanitize: … }`)
  - 상세: TypeScript `private static` 을 테스트에서 직접 호출하는 관용 패턴. 리팩토링 시 static 메서드 이름이 바뀌면 테스트가 runtime 에서만 감지됨(컴파일 타임 보호 없음). 단, 계약 고정 목적이 명확히 주석으로 명시되어 있어 의도적 선택임. 기능 정확성에는 영향 없음.

- **[INFO]** `makeAllocator` 가 `getClientOrNull` 을 위해 provider mock 을 통해 동일 redis stub 을 반환하도록 구성됨 — release DEL reject 테스트의 spy 가 정확한 `alloc.logger` 인스턴스를 대상으로 설정되어 있음. NestJS `Logger` 를 내부 프로퍼티로 접근하는 방식(`(alloc as …).logger`)이 생산 코드 `private readonly logger = new Logger(…)` 와 일치함.

- **[INFO]** spec fidelity 확인
  - 상세: `spec/5-system/4-execution-engine.md §9.2` 에서 `exec:seq:<executionId>` 키에 대해 "terminal event 발송 후 best-effort DEL", "Redis 미가용 시 in-memory per-instance degraded fallback", "`EXECUTION_SEQ_TTL_SECONDS` 기본 86400" 을 정의. `sanitize` 및 log injection 방어 자체는 spec 본문에 명시적 요구사항 ID로 정의되지 않음 — 구현 내부 보안 방어이며 spec 침묵 영역.
  - `release` best-effort DEL 동작과 swallow 계약은 spec §9.2 서술("terminal event 발송 후 best-effort `DEL`")과 일치하며, 테스트가 이 계약을 정확히 검증함.

### 파일 2: plan/in-progress/seq-allocator-test-cov.md

- **[INFO]** `/ai-review` 체크박스 미완료 (`- [ ] /ai-review`)
  - 위치: 검증 섹션
  - 상세: 본 파일이 바로 해당 ai-review 를 수행하는 PR 이므로, 리뷰 완료 후 해당 체크박스를 체크하는 것이 plan-lifecycle 규약 (`feedback_plan_checkbox_actual_state.md`)에 따른 후속 작업임. 현재 상태는 예상된 미완료 상태로 기능 결함이 아님.

## 요약

이번 변경은 프로덕션 코드 무변경 전제 하에 `ExecutionSeqAllocator` 의 두 미검증 경로(private static `sanitize` 로그 인젝션 방어 + `release` DEL reject swallow)에 대한 단위 테스트를 추가한다. 5개 신규 테스트 케이스 모두 프로덕션 구현과 정확히 일치함을 확인했다: `sanitize` 의 CR/LF/탭 → 공백 치환·128자 cap·`String()` 강제 변환 어설션이 `/[\r\n\t]/g` + `.slice(0, 128)` 구현과 정확히 일치하며, `release` DEL reject 테스트도 `Promise.resolve()` microtask flush 타이밍 + `logger.warn` 1회 검증으로 `.catch()` 계약을 올바르게 고정한다. 관련 spec(`spec/5-system/4-execution-engine.md §9.2`)의 best-effort DEL 서술과도 일치한다. `sanitize` 자체는 spec 본문에 명시적 요구사항 ID가 없으나 구현 내부 보안 방어이므로 spec 침묵 영역(INFO)이다. 기능 완전성·엣지 케이스·비즈니스 로직 모든 관점에서 문제 없음.

## 위험도

NONE
