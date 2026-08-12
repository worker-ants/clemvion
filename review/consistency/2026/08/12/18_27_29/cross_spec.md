# Cross-Spec 일관성 검토 — EIA idempotency 캐시 스코프 (impl-done)

## 검토 대상 요약

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 실제 diff 는 spec 변경 없이 코드 3개 파일만 포함:
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
  - `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
  - `codebase/backend/test/external-interaction.e2e-spec.ts`
- 변경 내용: `IdempotencyInterceptor` 가 `409`/`410`(둘 다 서비스가 `throw` 하는 error 채널)을
  캐시하지 못하던 선재 결함(구현이 `statusCode >= 400` 전부를 캐시 제외 — dead code)을 고쳐,
  이미 문서화되어 있던 [Spec EIA §R8](../../5-system/14-external-interaction-api.md) 의
  **닫힌 목록**(`2xx`·`409`·`410`, `400 VALIDATION_ERROR` 만 제외)과 일치시켰다. spec 본문(“target”)
  자체는 이번 diff 에서 바뀐 줄이 없다 — `spec/data-flow/15-external-interaction.md` §1.2 mermaid,
  §2.2 Redis 표(304행), `spec/5-system/14-external-interaction-api.md` §R8(7087~7093행)·
  EIA-RL-02(6174행)·EIA-IN-11(6115행)·§5.1 에러 표(6380~6381행)가 모두 코드 수정 **이전부터**
  이 닫힌 목록을 이미 명시하고 있었다. 즉 이번 변경은 "spec 을 새로 쓴 target" 이 아니라
  "이미 있던 spec 에 코드가 뒤늦게 맞춰진" 경우다.

## 발견사항

교차 영역(엔티티/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임) 충돌 없음. 세부 확인:

- **데이터 모델**: `IdempotencyEntry{bodyHash, responseJson, statusCode}` 캐시 shape 는 변경 없음
  (기존 필드 재사용, 저장 대상 상태코드 집합만 확장). `spec/data-flow/15-external-interaction.md`
  304행 표와 필드 이름·TTL(24h) 일치.
- **API 계약**: 캐시된 409/410 재현이 이제 (성공 채널의 수동 `res.status()` 세팅이 아니라)
  `HttpException` throw 로 바뀌어 NestJS 예외 필터를 통과한다 — 응답 envelope 이 표준
  `{error:{code,...}}` 형태로 `err.getResponse()` 페이로드를 그대로 되돌리므로, EIA 에러 코드
  표(6380~6386행, `STATE_MISMATCH`/`EXECUTION_TERMINATED`)와 `spec/5-system/2-api-convention.md`
  (§5.3 에러 응답 규약, 본 번들에서는 예산 초과로 절단되었으나 EIA 문서가 이미 그 규약을
  상속한다고 명시)와 정합. `IDEMPOTENCY_KEY_CONFLICT`(같은 키+다른 body → 409, 6380행)와도 겹치지
  않는다 — bodyHash 비교가 먼저이고 이번 diff 는 그 순서를 바꾸지 않았다.
- **요구사항 ID**: 신규 ID 부여 없음(테스트 케이스 `IDEM-1/2/3` 은 코드 주석용 라벨이며 spec
  요구사항 ID 네임스페이스(`EIA-*`)와 별개, 충돌 없음).
- **상태 전이**: execution `waiting_for_input`/terminal 전이 자체는 무변경 — 이 diff 는 그 전이의
  "재조회 응답을 캐시하느냐" 만 다룬다. `EIA-RL-03`(400 은 waiting_for_input 유지, 재제출 가능)과
  `IDEM-2` e2e(같은 키로 고친 값 재제출 시 202) 가 정합.
- **RBAC/권한**: 토큰 검증(`InteractionGuard`, iext/itk)이나 in-process trusted 우회
  (`EIA-AU-08`/§3.3.1)는 인터셉터 앞단(Guard)에서 처리되어 이번 diff 의 영향 범위 밖. 429
  rate-limit(`InteractionRateLimitGuard`, §8.4/EIA-RL 표)도 Guard 라 인터셉터의 `catchError` 에
  도달하지 않는다 — 새 `isErrorStatusCacheable`(409/410 한정)이 429/401/403 을 캐시할 여지 없음.
- **계층 책임**: 캐시 판정 로직은 여전히 `IdempotencyInterceptor` 내부에 머문다(엔진/서비스 레이어로
  새어나가지 않음) — `spec/data-flow/15-external-interaction.md` 코드 진입점 목록(72~80행)의
  책임 분할과 일치.

### INFO — 관련 spec 일부가 컨텍스트 예산으로 절단되어 미대조

- target 위치: 검토 payload 전체(번들 조립 단계)
- 충돌 대상: `spec/5-system/1-auth.md`, `3-error-handling.md`, `4-execution-engine.md`,
  `6-websocket-protocol.md`, `spec/7-channel-web-chat/1~4.md` 등 다수가 "본문 생략됨 — 컨텍스트
  예산 초과" 로 절단되어 이번 검토에서 원문 대조를 하지 못했다.
- 상세: 위 파일들이 idempotency 캐시나 EIA 에러코드 네임스페이스와 상충하는 서술을 담고 있을
  가능성 자체는 낮다(EIA 문서 6386행이 이미 error-handling 규약과의 override 관계를 스스로
  명시하고 있고, 이번 diff 는 spec 문면을 하나도 바꾸지 않았다). 다만 이 절단은 매 라운드
  반복되는 구조적 한계이므로 기록해 둔다.
- 제안: 조치 불요(이번 diff 범위에서 실질 위험 없음). 반복적으로 문제되면 `--spec` 번들 예산
  정책(관련 스펙 우선순위)을 별도로 조정.

## 요약

이번 변경은 `spec/data-flow/15-external-interaction.md` 와 `spec/5-system/14-external-interaction-api.md`
가 이미 §R8/EIA-RL-02/EIA-IN-11 로 명시해 온 idempotency 캐시 닫힌 목록(`2xx`·`409`·`410`,
`400 VALIDATION_ERROR` 제외)에 코드를 뒤늦게 맞춘 순수 버그 수정이며, 이번 diff 에 spec 문서
변경은 포함되지 않았다. 데이터 모델·API 응답 envelope·요구사항 ID·상태 전이·RBAC·계층 책임 어느
관점에서도 다른 spec 영역과의 직접 모순이나 잠재 충돌은 발견되지 않았다. 유일한 절차적 이슈는
관련 영역 일부(auth/error-handling/execution-engine/websocket/web-chat)가 컨텍스트 예산으로
절단되어 원문 대조를 하지 못한 점이나, 이는 이번 변경의 성격(코드만 변경, 좁은 스코프)상 실질
위험으로 이어지지 않는다.

## 위험도

NONE
