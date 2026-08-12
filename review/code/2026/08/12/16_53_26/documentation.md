# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `IdempotencyInterceptor` 클래스 상단 요약 JSDoc 이 이번에 확장된 캐시 대상(에러 채널의 `409`/`410`)을 한 줄로 요약해 주지 않는다 — 상세 설명은 `cacheTapped()`/`isErrorStatusCacheable()`/`IdempotencyEntry.responseJson` 쪽에 정확히 있지만, 클래스를 처음 훑는 사람이 보는 최상단 bullet 목록은 이번 diff 대상이 아니라서 갱신되지 않았다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:49-57` (클래스 docstring, `- 같은 키로 재요청 시 같은 응답을 그대로 재현 (멱등).` 등 5개 bullet)
  - 상세: 이 bullet 목록은 "같은 키+다른 body → 409 Conflict"(캐시 미스 시 즉시 발생하는 `IDEMPOTENCY_KEY_CONFLICT`)만 409 사례로 언급하고, 이번 PR 이 새로 다루는 "캐시 히트 시 `409`/`410` 을 예외로 재현"(서비스가 throw 한 `STATE_MISMATCH`/`EXECUTION_TERMINATED` 를 24h 뒤에도 그대로 돌려줌)은 언급이 없다. 틀린 내용은 아니고(메서드/필드 docstring 이 정확히 보완한다), 이번 diff 의 핵심 동작 변경이 클래스 최상단 요약에는 반영되지 않은 것뿐이라 심각도는 낮다.
  - 제안: 필수는 아니나, 여유가 있으면 "캐시 대상은 2xx·409·410 의 닫힌 목록([Spec EIA §R8])" 한 줄을 bullet 에 추가해 최상단 요약만 보고도 R8 범위를 알 수 있게 한다.

- **[INFO]** 이전 리뷰(`16_29_45`)의 WARNING(테스트 파일 모듈 docstring 이 "R8 위반 상태를 고정하는 캐너리" 라는 옛 서술을 남겨 두던 문제)이 이번 diff 에서 정확히 해소됨을 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-15`
  - 상세: 모듈 docstring 이 "Spec EIA §R8 의 **캐시 대상 닫힌 목록**(`2xx`·`409`·`410`)을 고정하는 회귀 테스트를 담는다" 로 갱신됐고, `409`·`410` 을 **error 채널**로 행사해야 하는 이유(성공 채널 mock 은 실제로 발생하지 않는 상태를 검사)까지 이유와 함께 남겼다 — 개별 `it` 제목·인라인 주석과도 정확히 일치한다.
  - 제안: 없음 — 확인용 기록.

- **[INFO]** CHANGELOG·구현 docstring/인라인 주석·spec(`data-flow/15`)·plan 체크리스트가 이번 재설계(1차 실패 → 2차 성공)의 전체 경위를 정직하게 상호 정합적으로 갱신함을 확인
  - 위치: `CHANGELOG.md:3-27`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:39-241`, `spec/data-flow/15-external-interaction.md:258`, `plan/in-progress/backend-lint-gate-broken-on-main.md:549-611`
  - 상세: CHANGELOG 는 "조건식만 바꿔서는 고쳐지지 않았다" 는 재설계 배경까지 서술해 클라이언트 영향 문단이 실제 동작과 일치한다. `cacheTapped()`/`isErrorStatusCacheable()` JSDoc 은 `2xx`·`409`·`410` 이 각각 다른 RxJS 채널(next/error)로 온다는 이 구현의 핵심 사실과 `>= 400`/`=== 400` 두 오답이 왜 틀리는지를 코드 옆에 정확히 남겼다. `spec/data-flow/15` 의 "⚠️ 현행 구현 갭" 캐비트는 실제로 갭이 닫혔으므로 삭제 상태 유지가 맞다. plan 체크박스는 `[x]` 로 완료 처리하면서도 "1차 시도는 실패였다" 는 사실과 그 원인(dead code, vacuous test)·교훈을 감추지 않고 그대로 남겼고, 새 e2e 백로그 항목까지 근거와 함께 추가했다. 새 env 변수·README 대상 설정 변경은 없음(순수 인터셉터 내부 재설계).
  - 제안: 없음 — 참고용 기록.

## 요약

이번 diff 는 idempotency 캐시가 §R8 의 닫힌 목록(`2xx`·`409`·`410`)을 실제로 error 채널까지 포괄하도록 재설계한 수정이며, 이전 리뷰(`16_29_45`)가 지적한 CRITICAL(dead code)·WARNING(테스트 파일 모듈 docstring stale)·3xx 조용한 축소 등을 문서 관점에서 모두 정확히 반영했다. CHANGELOG 는 1차 시도의 실패 원인까지 포함해 사실과 일치하는 클라이언트 영향을 서술하고, 구현/테스트 docstring·인라인 주석은 RxJS 채널 분기라는 이 코드의 핵심 사실과 두 가지 오답 축약을 정확히 설명하며, spec 미러(`data-flow/15`)와 plan 체크리스트(1차 실패 기록 포함)도 동기화되어 있다 — 어디에도 코드와 어긋나는 "오래된 주석" 이 남아 있지 않다. 새 API·환경변수·README 대상 표면이 없어 그쪽 문서화 요구도 해당 없음. 유일하게 남는 것은 클래스 최상단 요약 JSDoc 이 이번에 확장된 409/410 캐시 재현을 bullet 로 명시하지 않는다는 경미한 개선 여지뿐이다.

## 위험도

NONE
