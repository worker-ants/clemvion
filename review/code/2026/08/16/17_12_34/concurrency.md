# 동시성(Concurrency) Review

## 발견사항

없음.

## 분석 메모 (참고용)

이번 변경셋은 대부분 문서(`plan/**`, `spec/**`, `review/consistency/**`, `.claude/docs/plan-lifecycle.md`)
재정리이고, 실질 코드 변경은 다음 6개 파일에 한정된다:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (+spec) — 신규 순수 함수.
  `deepRedactSecrets` 위임, 입력 비변이(복사본 반환), `await` 없는 완전 동기 함수.
- `codebase/backend/src/modules/executions/executions.service.ts` — 이미 조회된 엔티티/배열에
  `redactStoredErrorForResponse` 를 적용하는 동기 변환 4곳(`findById`/`getChain`/`stop`/`toExecutionDto`)
  + `stripPrivateRelations` → `toResponseExecution` 이름·기능 확장 + `stop()` 을 `stop()`/`stopInternal()`
  로 분리.
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (+spec) —
  `toNodeExecutionDto` 안 동일한 동기 마스킹 적용.

점검 관점별 확인 결과:

1. **경쟁 조건** — 신규/변경 코드는 모두 이미 fetch 된 데이터에 대한 동기 변환(마스킹)이며 공유
   가변 상태를 새로 도입하지 않는다. 경쟁 조건 없음.
2. **TOCTOU/원자성** — `stop()` 의 핵심 로직(`executions.service.ts` `stopInternal`, 함수/메서드
   `stopInternal`)에 있던 "동시 stop 요청에 대한 단일 원자 UPDATE (`status IN [...]`)" 보호는 이번
   diff 에서 **그대로 보존**된다. 변경은 `stop()` 이 `stopInternal()` 의 반환값을 `toResponseExecution()`
   으로 감싸는 것뿐이고, 이 wrapping 은 `await` 이후의 순수 동기 변환이라 원자 UPDATE 의 4개 반환
   지점(`waiting` 경로 · `affected=0` 재조회 · 정상 재조회 · 폴백) 사이의 인터리빙에 영향을 주지 않는다.
   테스트(`executions.service.spec.ts` `④-b`)도 `affected=0`(경쟁 패배) 분기가 같은 마스킹 관문을
   통과하는지를 검증하도록 갱신되어 있다.
3. **데드락/동기화(mutex 등)** — 해당 변경에 락·세마포어·다중 락 획득이 없다.
4. **스레드 안전성** — Node.js 단일 이벤트 루프 전제. `redactStoredErrorForResponse`/`deepRedactSecrets`
   호출부는 모두 `await` 없는 동기 실행 구간 안에서 완결되므로 요청 간 인터리빙 지점이 없다.
   (참고: `deepRedactSecrets` 가 의존하는 `sanitize-error-message.ts` 의 module-level `WeakMap` 캐시는
   기존 코드이고 이번 diff 의 수정 대상이 아니며, 객체 identity 키·완전 동기 walk 라 요청 간 오염 소지가
   없다 — 정보 제공 차원의 메모이며 이슈로 등재하지 않음.)
5. **async/await** — 신규 호출부에서 `await` 누락·불필요한 순차화(응당 병렬 가능한데 직렬화) 는
   관찰되지 않는다. `getChain` 의 기존 `Promise.all([manager.find(...), manager.find(...)])` 병렬 조회는
   이번 diff 로 변경되지 않았고, 그 이후에 추가된 `NodeExecution.error` 마스킹(`.map(...)`)은 이미 resolve
   된 배열에 대한 동기 매핑이다.
6. **이벤트 루프 블로킹** — `deepRedactSecrets` 는 재귀 깊이 상한(`MAX_REDACT_DEPTH=10`)이 있는 구조라
   응답 크기에 비례한 블로킹 시간이 크게 늘어날 우려는 없다(기존 소비처와 동일한 한도 재사용).
7. **리소스 풀링** — 커넥션 풀 크기·트랜잭션 매니저 관련 코드는 이번 diff 에 없다. `plan/complete/
   eia-stalled-atomicity.md` (신규 파일)는 **이미 별도 PR(#1173)로 머지된 트랜잭션 하드닝 작업의 plan
   문서를 `in-progress/` → `complete/` 로 이동**한 것뿐이며, 이번 diff 에 해당 서비스 코드(`finalizeStalledExhausted`
   등)는 포함되어 있지 않다 — 즉 동시성 관련 "코드" 변경이 아니라 문서 이동이다.

## 요약

이번 변경셋은 EIA 관련 응답 egress 마스킹(`Execution.error`/`NodeExecution.error`) 적용과 그에 따른
소규모 리팩터링(`toResponseExecution` 개명·`stop()`/`stopInternal()` 분리), 그리고 plan/spec/review
문서 정리로 구성된다. 실질 코드 변경은 전부 이미 조회·확정된 데이터에 대한 순수 동기 변환이고, 기존에
존재하던 stop 경로의 TOCTOU 방지 원자 UPDATE 로직은 그대로 보존된다. 락·트랜잭션·풀·비동기 오케스트레이션을
새로 도입하거나 변경한 지점이 없어 동시성 관점에서 지적할 결함이 없다.

## 위험도

NONE
