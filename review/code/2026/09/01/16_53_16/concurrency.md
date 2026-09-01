# 동시성(Concurrency) 리뷰

## 발견사항

없음. 이번 diff 는 다음 성격의 변경만 포함하며, 새로운 공유 자원 접근·락·async 흐름을 도입하지 않는다.

- `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 의 기존
  `catch` 블록 안에 `this.metrics?.recordAuditWriteFailed(entry.resourceType)` 호출과 그것을
  감싸는 내부 `try`/`catch` 를 추가했다. `recordAuditWriteFailed` 는 동기(sync, `void` 반환)
  메서드이므로 미처리 Promise 나 await 누락 문제가 없다. `record()` 자체는 호출마다 로컬
  `log` 변수만 다루고 공유 가변 상태를 갱신하지 않으므로, 동시 다발 호출(여러 요청이 동시에
  감사 기록)에도 경쟁 조건이 없다 — 이 구조는 diff 이전과 동일하다.
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — 신규 `auditWriteFailed`
  Counter 와 `recordAuditWriteFailed()`/`clampLabel()` 헬퍼를 추가했다. OTel `Counter.add()` 는
  동기 호출이며 내부적으로 카운터 자체 상태만 갱신한다(호출부가 직접 다루는 공유 mutable
  state 아님). 같은 파일의 `observeQueues()`(provider 스냅샷 + `Promise.allSettled` 병렬
  폴링)는 이전 라운드에서 이미 동시성 리뷰·수정이 끝난 부분이고, 이번 diff 의 hunk 범위에
  포함되지 않는다(신규 카운터·`clampLabel` 추가는 그 위쪽 섹션에 국한).
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `recordAudit` 의
  `action` 파라미터 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof
  AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힌 컴파일 타임 전용 변경이다. 런타임 제어 흐름·await
  순서·공유 상태 접근에는 영향이 없다.
- `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (+ fixture/spec) —
  TypeScript AST(`ts.forEachChild`)를 동기적으로 순회하는 정적 분석 가드다. `async`/`await`/
  `Promise` 사용이 없고(grep 확인), 테스트 러너가 단일 프로세스에서 순차 실행하므로 동시성
  표면이 없다.
- 나머지 파일(`CHANGELOG.md`, `plan/**`, `review/**`, `*.spec.ts` 테스트 파일들)은 문서·테스트
  더블(jest.fn 스텁) 변경으로 런타임 동시성과 무관하다.

## 요약

이번 변경 세트는 감사 로그 적재 실패에 대한 관측성(OTel 카운터·로그 메시지 확장) 추가와
`recordAudit` action 파라미터의 타입 좁히기, 그리고 그 바인딩을 강제하는 정적 AST 가드
신설로 구성된다. 새로 추가된 `recordAuditWriteFailed` 호출은 동기 메서드이고 기존 `try`/
`catch` swallow 계약 안에 안전하게 격리되어 있어 await 누락·미처리 Promise·경쟁 조건 소지가
없다. `BusinessMetricsService` 는 요청 간 공유되는 싱글턴이지만 이번 diff 로 추가된 카운터는
상태를 갖지 않는 stateless `add()` 호출뿐이다. 이전 라운드에서 지적·수정됐던 `observeQueues()`
의 동시성 이슈(provider 스냅샷 격리, `Promise.allSettled` 병렬화)는 이번 diff 의 변경 범위
밖이며 그대로 유지된다. 동시성 관점에서 새로 도입된 위험은 없다.

## 위험도
NONE
