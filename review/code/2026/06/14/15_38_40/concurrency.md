# 동시성(Concurrency) 리뷰

리뷰 대상: config-call-history 변경 (§A.3 호출 이력 — 소스 IP·응답 코드·기간별 호출 수)
리뷰일: 2026-06-14

---

## 발견사항

### [INFO] Promise.all 병렬 쿼리 — QueryBuilder 독립 객체 분리 적절

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 내 `Promise.all([...])` 블록
- 상세: 3개의 TypeORM `createQueryBuilder` 호출(getCount / getRawOne / getMany)을 `Promise.all`로 병렬 실행한다. 각 호출이 독립 QueryBuilder 객체를 생성하므로 파라미터 혼용 없이 안전하다. `now = Date.now()`를 `Promise.all` 이전 단일 지점에서 캡처해 3개 rolling window 기준 시각의 일관성을 보장한다. 스펙 주석(W-4, W-11)이 이 설계 의도를 명시하고 있으며 테스트(`makeExecutionRepo`의 독립 QB 모킹)도 이를 검증한다.
- 제안: 현행 유지. 이슈 없음.

### [INFO] `extractClientIp` 중복 호출 제거 — 단일 지점 캡처 적절

- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleWebhook()` 및 `handleChatChannelWebhook()` 각 메서드 상단
- 상세: 두 메서드 모두 메서드 진입 초기에 `const clientIp = extractClientIp(input.headers)`를 한 번만 호출하고 인증 IP whitelist 검증과 `execute()` options 전달에 공용으로 재사용한다. 이전 코드는 인증 검증 시점에만 인라인 호출했고 호출 이력 영속에는 미전달이었으나, 이번 변경에서 단일 지점으로 통합했다. Node.js 단일 스레드 이벤트 루프 환경에서 동일 요청 처리 컨텍스트 내 재할당 경쟁 조건은 없다.
- 제안: 현행 유지. 이슈 없음.

### [INFO] `Promise.all` 부분 실패 전파 동작 확인

- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `Promise.all([getCount, getRawOne, getMany])`
- 상세: `Promise.all`은 하나라도 reject되면 전체가 reject된다(fail-fast). 3개 쿼리 중 하나가 DB 오류로 실패하면 나머지 두 쿼리 결과가 버려지고 예외가 상위로 전파된다. 이는 의도된 동작으로 보이며(부분 결과 반환보다 전체 실패가 안전), 현재 서비스 레이어에서 별도 fallback 처리 요건이 없다.
- 제안: 현행 유지. 단, 향후 부분 결과(예: periodCounts 실패 시 totalCalls만 반환) 요건이 생기면 `Promise.allSettled`로 교체를 고려한다.

---

## 요약

이번 변경의 핵심 동시성 관련 코드는 `auth-configs.service.ts`의 `getUsage()` 메서드에서 3개 독립 DB 쿼리를 `Promise.all`로 병렬 실행하는 부분이다. 각 QueryBuilder가 독립 객체로 분리되어 파라미터 혼용 위험이 없고, rolling window 기준 시각(`now`)을 단일 지점에서 캡처해 세 윈도우 간 일관성을 보장한다. `hooks.service.ts`의 `extractClientIp` 단일 지점 호출도 중복 부수효과를 제거한 올바른 패턴이다. Node.js 단일 스레드 환경이므로 공유 가변 상태 경쟁 조건·데드락·스레드 안전성 문제는 해당 없다. async/await 누락·이벤트 루프 블로킹·리소스 풀 이상도 발견되지 않았다.

## 위험도

NONE

---

STATUS=success ISSUES=0
