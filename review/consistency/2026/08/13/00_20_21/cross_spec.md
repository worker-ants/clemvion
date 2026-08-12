### 발견사항

- **[INFO]** EIA §R8 Rationale 의 "다른 실패 경로" 열거가 코드의 5-경로 표보다 한 칸 좁다
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표 (`interaction:idempotency:...` 행) 및 §Rationale "Fail-open 정책의 일관 표기"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §R8 Rationale L1068 — "이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET 실패·직렬화 실패)가 모두 '멱등성을 포기하고 요청은 통과'인 것과 일관된다" / 구현 diff `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스 docstring 신규 5-경로 표(기동 시 미주입·조회 실패·적재 실패·직렬화 실패·**캐시 엔트리·payload 손상**)
  - 상세: 이번 diff 로 `IdempotencyInterceptor` docstring 이 fail-open 경로를 "다섯 경로"로 정밀화하면서 5번째(엔트리/payload 손상)를 명시했다. 그런데 EIA 시스템 spec §R8 Rationale 의 병렬 서술(L1068)은 여전히 "Redis 미주입·GET/SET 실패·직렬화 실패" 세 범주만 나열해 이 다섯 번째 경로(캐시 값 자체의 손상 — Redis 가용성과 무관)를 포함하지 않는다. 두 문서가 직접 모순되는 것은 아니다(EIA L1068 은 완전한 열거를 의도한 문장이 아니라 "req.interaction 없음→스코프 없는 fallback 금지" 논지의 부연이다) — 다만 같은 인터셉터의 fail-open 표면을 서술하는 두 곳의 "경로 개수" 가 어긋나 있어, 다음에 경로를 추가/삭제할 때 어느 한쪽만 갱신되면 drift 가 굳어질 위험이 있다.
  - 제안: 이 항목은 이미 `plan/in-progress/backend-lint-gate-broken-on-main.md` (동일 세션의 `23_48_39` rationale_continuity INFO 1 이 `spec/data-flow/15-external-interaction.md` §308 "전 경로 fail-open (warn)" 표현에 대해 지적한 것)에 planner 인계 항목으로 이미 기록돼 있다. 신규 발견이 아니라 기존 추적 항목의 다른 표현형이므로 별도 조치 불요 — planner 가 EIA §R8 Rationale·data-flow §2.2/§Rationale 양쪽에 "기동 시 미주입(설정 상태, warn 제외)"·"엔트리/payload 손상(신규 5번째 경로)" 을 한 번에 반영할 때 이 지점도 함께 정렬하면 된다.

이 외에는 cross-spec 관점에서 유의미한 충돌 없음을 확인했다:

- **데이터 모델**: 이번 diff 는 Postgres/Redis 스키마를 바꾸지 않는다. Redis 캐시 값 shape (`{bodyHash, responseJson, statusCode}`) 은 `spec/data-flow/15-external-interaction.md` §2.2 표와 `idempotency.interceptor.ts` 의 `IdempotencyEntry`/`isIdempotencyEntry` 가 정확히 일치 — 신규 `isIdempotencyEntry` 형태 검사는 이 기존 계약을 **집행**할 뿐 재정의하지 않는다.
- **API 계약**: 캐시 대상 닫힌 목록(`2xx`/`409`/`410`, `400 VALIDATION_ERROR` 제외)을 판정하는 `isErrorStatusCacheable(statusCode === 409 || statusCode === 410)` 은 diff 전후 불변 — `spec/5-system/14-external-interaction-api.md` §R8("**캐시 대상은 닫힌 목록이다**")·`spec/data-flow/15-external-interaction.md` §2.2 와 계속 정합. 엔드포인트·HTTP method·request/response shape 변경 없음(손상 캐시를 만난 요청이 이제 "신규 처리"로 정상 처리되는 것은 상태 코드 계약을 넓히거나 좁히지 않고, 기존에 문서화된 fail-open 정책을 코드가 뒤늦게 이행하는 것).
- **요구사항 ID**: 신규 ID 부여 없음. 기존 `EIA-IN-11`/`EIA-RL-02`(§R8) 참조만 코드 주석에 인용되며 그 의미를 바꾸지 않는다.
- **상태 전이**: execution/토큰 상태 머신 불변 (`iext_*`/`itk_*` 상태도, execution terminal/waiting_for_input 판정도 diff 범위 밖).
- **RBAC**: `InteractionGuard` 인증 경계 불변 — 인터셉터는 Guard 이후 단계이며 이번 diff 는 스코프 키(`executionId`+`route`) 판정 순서(엔트리 파싱 → `bodyHash` 비교 → payload 파싱)만 바꿨을 뿐 Guard 가 검증한 `executionId`/`route` 스코프 자체(§R8 "캐시 키 스코프")는 그대로 사용한다.
- **계층 책임**: 변경은 `IdempotencyInterceptor` 단일 클래스 내부(신규 private 헬퍼 `discardCorruptEntry`, 모듈 함수 `isIdempotencyEntry`/`describeShape`)에 국한 — external-interaction 모듈 내 계층 분할(Guard/Interceptor/Service/Engine)에 변화 없음.
- 관련 spec 영역(`spec/5-system/14-external-interaction-api.md` §R8·§EIA-IN-11/EIA-RL-02, `spec/5-system/4-execution-engine.md` §1.3 waiting_for_input 컨벤션)을 직접 대조했고, target 번들에서 컨텍스트 예산 초과로 절단된 두 핵심 파일(`spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`)은 워크트리 절대경로로 직접 읽어 확인했다.

### 요약

이번 diff(`codebase/backend/src/modules/external-interaction/idempotency.interceptor.{ts,spec.ts}`)는 캐시 엔트리 안쪽 `responseJson` 손상이 500 으로 마스킹되던 선재 갭을 닫는 순수 내부 하드닝이며, `spec/data-flow/15-external-interaction.md`·`spec/5-system/14-external-interaction-api.md`(§R8) 가 이미 약속한 "전 경로 fail-open" 정책을 코드가 더 충실히 이행하도록 만들 뿐 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 기존 spec 과 새로 모순되지 않는다. 유일한 관찰(EIA §R8 Rationale 의 실패-경로 열거가 신규 5번째 경로를 포함하지 않는 문서 drift)은 이미 동일 세션 `23_48_39` rationale_continuity 검토와 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 planner 인계 항목으로 기록돼 있어 중복 조치가 불필요한 INFO 수준이다.

### 위험도
NONE
