# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** sanitize 테스트가 `slice(0, 128)` 의 포함 경계를 정확히 검증
  - 위치: `execution-seq-allocator.service.spec.ts` L475-478 (신규 케이스 "정확히 128자는 보존, 129자는 128 로 cap")
  - 상세: 프로덕션 `sanitize` 는 `.slice(0, 128)` 로 구현돼 있어 128번째 문자까지 포함(0-indexed offset 0..127 = 128자). 신규 테스트는 `'x'.repeat(128)` 이 128자를 보존하고 `'x'.repeat(129)` 가 128자로 잘리는 것을 모두 검증한다. off-by-one 방향이 구현과 일치하며 계약을 올바르게 고정한다.
  - 제안: 현 상태 유지.

- **[INFO]** warn 메시지 내 `executionId` 포함 검증이 실제 프로덕션 경로와 일치
  - 위치: `execution-seq-allocator.service.spec.ts` L350-352 (`expect(warn).toHaveBeenCalledWith(expect.stringContaining('exec-del-fail'))`)
  - 상세: 프로덕션 `release()` 의 `.catch` 핸들러는 `ExecutionSeqAllocator.sanitize(executionId)` 를 warn 메시지에 포함시킨다(`seq 키 DEL 실패 (${sanitize(executionId)}): ...`). 테스트는 `executionId = 'exec-del-fail'` 으로 특수 문자 없는 ASCII 문자열을 사용하므로 `sanitize` 후에도 원형이 유지된다. `stringContaining('exec-del-fail')` 은 해당 포함 여부를 충분히 검증한다.
  - 제안: 현 상태 유지.

- **[INFO]** `try/finally` 로 spy 복원 위치 이동 — 의도·구현 일치
  - 위치: `execution-seq-allocator.service.spec.ts` L342-356
  - 상세: `warn.mockRestore()` 를 `finally` 블록으로 이동해 `expect()` 실패 시에도 spy 가 다음 테스트로 새지 않도록 했다. Jest 의 test isolation 요구사항을 정확히 충족한다. 주석도 의도를 명확히 서술하고 있다.
  - 제안: 현 상태 유지.

- **[INFO]** spec 참조 — sanitize 의 128자 cap 및 로그 인젝션 방지 정책은 spec 미기재
  - 위치: `spec/5-system/4-execution-engine.md` §9.2 / `spec/5-system/6-websocket-protocol.md` 전체
  - 상세: spec 은 `ExecutionSeqAllocator` 의 존재, Redis 키 `exec:seq:<executionId>`, sliding-window TTL, in-memory degraded fallback, best-effort DEL 동작을 명시하고 있다. 그러나 `sanitize` 헬퍼의 구체적 규칙(CR/LF/탭 → 공백 치환, 128자 cap, 비문자열 강제 변환)은 spec 본문에 기술돼 있지 않다. 이 구현은 로그 인젝션 방지를 위한 합리적 보안 조치이며, spec 이 침묵하는 구현 세부사항(internal security detail)이다. spec 을 위반하는 것이 아니라 spec 이 다루지 않는 영역이다.
  - 제안: INFO 수준. spec 이 `sanitize` 정책을 별도 명세할 필요성은 낮으나, 프로덕션 코드 주석(`/** 로그 인젝션 방지 — CR/LF/탭 제거 + 128자 cap */`) 이 이미 충분한 문서 역할을 한다.

- **[INFO]** `release` DEL 실패 warn 경로의 미검증 잔존 — 메시지 오류 상세 부분
  - 위치: `execution-seq-allocator.service.spec.ts` L327-357
  - 상세: 현재 테스트는 warn 이 1회 호출되었으며 메시지에 `executionId` 가 포함됨을 검증한다. 프로덕션 코드의 warn 메시지는 `seq 키 DEL 실패 (${sanitize(executionId)}): ${err.message}` 형태다. err.message 부분(`'DEL failed'`)이 포함됐는지는 검증하지 않는다. 이는 치명적 누락이 아니며, executionId 추적성이 확보된 이상 에러 상세까지 검증하는 것은 이미 충분한 커버리지 강화를 넘는 수준이다.
  - 제안: 현 상태로도 요구사항 충족. 추가 검증을 원하면 `expect.stringContaining('DEL failed')` 를 병행 추가할 수 있으나 선택사항.

## 요약

이번 변경은 프로덕션 코드를 일절 수정하지 않고 테스트 파일에만 5개 케이스를 추가한 순수 커버리지 보강이다. plan(C-1)의 두 작업 단위 — `sanitize` 직접 테스트(CR/LF/탭 치환·128자 cap·128/129 off-by-one 경계·비문자열 강제)와 `release` DEL reject swallow + warn 검증 — 이 모두 구현됐다. 신규 추가된 3개 변경사항(off-by-one 경계 케이스, warn 메시지 내용 검증, try/finally spy 복원)은 각각 프로덕션 구현의 `.slice(0, 128)` 계약, `sanitize(executionId)` warn 포함 계약, test isolation 요구사항과 정확히 대응하며 의도와 구현 간 괴리가 없다. spec 은 `ExecutionSeqAllocator` 의 고수준 동작(키 형식·TTL·fallback 정책·best-effort DEL)을 정의하지만 `sanitize` 의 세부 규칙은 기술하지 않아 spec fidelity 위반은 없다. 요구사항 관점에서 Critical 및 Warning 수준의 문제가 없다.

## 위험도

NONE
