# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/14-external-interaction-api.md` (EIA spec) 및 `spec/5-system/16-system-status-api.md` (system-status spec 개정)
구현 파일: `codebase/backend/src/modules/external-interaction/**`, `codebase/backend/src/modules/system-status/**`

---

## 발견사항

### [INFO] `TOKEN_INVALID` / `TOKEN_EXPIRED` 코드명 — 레이어 중복 (의도된 설계)
- **target 신규 식별자**: `TOKEN_INVALID`, `TOKEN_EXPIRED` (EIA 표면, `spec/5-system/14-external-interaction-api.md §5.1`)
- **기존 사용처**: `spec/5-system/3-error-handling.md §1.2` 및 `codebase/backend/src/modules/auth/auth.service.ts` — 워크스페이스 JWT(access-token) 만료·무효 응답 코드로 이미 사용 중
- **상세**: 두 코드명의 문자열이 완전히 동일하나, spec §5.1 의 "코드 네임스페이스 주석"이 이 상황을 인지하고 "진입점(`/api/external/*`)·토큰 family(`iext_*`/`itk_*` vs access-token)로 레이어가 구분된다"고 명시함. 실제로 두 토큰 계층은 별개 Guard(`InteractionGuard` vs JWT Strategy)와 별개 경로로 분리되므로 런타임 충돌은 없음.
- **제안**: 충돌은 아니나, 차후 로그·모니터링 대시보드에서 두 에러 코드 문자열을 집계할 때 EIA 계층과 JWT 계층의 발생 건이 혼합될 수 있다. 필요 시 EIA 전용 코드에 `INTERACTION_TOKEN_INVALID` / `INTERACTION_TOKEN_EXPIRED` prefix를 부여해 통계 분리를 명확히 할 수 있으나, spec이 이미 이 트레이드오프를 인지하고 수용했으므로 현 설계 유지도 무방하다.

---

### [INFO] `terminal-revoke-reconcile` 큐 — spec/16 큐 레지스트리 표에 미등재
- **target 신규 식별자**: 큐 이름 `terminal-revoke-reconcile` (`codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.types.ts`)
- **기존 사용처**: `spec/5-system/16-system-status-api.md §1` 의 모니터링 대상 큐 레지스트리 표
- **상세**: 코드 `system-status.constants.ts`의 `MONITORED_QUEUES`에는 `terminal-revoke-reconcile`이 정상 등재되어 있다. 그러나 `spec/5-system/16-system-status-api.md §1` 의 큐 레지스트리 표에는 해당 큐 행이 누락되어 있다 — 표 마지막 행은 `alerts-evaluator`이며 `terminal-revoke-reconcile`이 없다. `spec/data-flow/0-overview.md §4` 카탈로그 및 `spec/data-flow/15-external-interaction.md`에는 정상 기재됨.
- **제안**: `spec/5-system/16-system-status-api.md §1` 큐 레지스트리 표에 `terminal-revoke-reconcile | system | 1 (기본) | terminal revoke reconciliation sweep (per-minute repeatable)` 행을 추가해 data-flow 카탈로그 및 코드 레지스트리와 동기화한다. (코드와 data-flow는 정확하므로 spec/16만 보완 필요.)

---

### [INFO] `makeshop-token-refresh` 미등재 각주 부정확 — 코드에는 이미 등재됨
- **target 신규 식별자**: spec/16 §1 표의 `makeshop-token-refresh`, `agent-memory-extraction` 행
- **기존 사용처**: `codebase/backend/src/modules/system-status/system-status.constants.ts` (`MONITORED_QUEUES`)
- **상세**: spec/16 §1 각주(구현 갭)에서 "`makeshop-token-refresh`와 `agent-memory-extraction`이 아직 미등재"임을 명시하고 있으나, 실제 확인 결과 `makeshop-token-refresh`는 코드 `MONITORED_QUEUES`에 이미 등재되어 있다(`system-status.constants.ts` line 71). 미등재 상태인 것은 `agent-memory-extraction` 하나뿐이다.
- **제안**: spec/16 §1 각주를 "`agent-memory-extraction`만 미등재"로 정정한다. 신규 식별자 충돌 아님 — spec drift 정정 사항.

---

### [INFO] `DEV_EPHEMERAL_SECRET` — module-scoped 파일 로컬 상수, 충돌 없음
- **target 신규 식별자**: `DEV_EPHEMERAL_SECRET` (`codebase/backend/src/modules/external-interaction/interaction-token.service.ts`)
- **기존 사용처**: 없음. 해당 파일 외에 동명 상수 없음.
- **상세**: 파일 스코프 `const`로 export되지 않으므로 외부 충돌 경로 없음. 충돌 없음.

---

### [INFO] `INTERACTION_JWT_SECRET` 환경변수 — 기존 `JWT_SECRET`과 중첩 fallback 관계
- **target 신규 식별자**: 환경변수 `INTERACTION_JWT_SECRET` (`spec/5-system/14-external-interaction-api.md §8.3`, `interaction-token.service.ts`)
- **기존 사용처**: `JWT_SECRET` (`spec/5-system/1-auth.md`), 기존 `assertProductionConfig`
- **상세**: `INTERACTION_JWT_SECRET` 미설정 시 `JWT_SECRET`으로 fallback하는 설계가 spec과 코드 양쪽에 명시됨. 기존 `JWT_SECRET`은 access-token 서명에 쓰이므로 fallback 시 두 용도가 동일 secret을 공유하게 됨. spec §8.3이 이 구조를 명시하고 프로덕션 fail-closed로 별도 설정을 강제함. 충돌이 아닌 의도된 구조.
- **제안**: 운영 문서·배포 체크리스트에 `INTERACTION_JWT_SECRET`를 `JWT_SECRET`과 다른 값으로 설정할 것을 명시 권장.

---

### [INFO] EIA 요구사항 ID(`EIA-NX-*`, `EIA-IN-*`, `EIA-AU-*`, `EIA-RL-*`, `EIA-NF-*`) — 고유함
- **target 신규 식별자**: `EIA-NX-01`~`EIA-NX-12`, `EIA-IN-01`~`EIA-IN-13`, `EIA-AU-01`~`EIA-AU-08`, `EIA-RL-01`~`EIA-RL-06`, `EIA-NF-01`~`EIA-NF-05`
- **기존 사용처**: 다른 spec 파일에서 `EIA-*` ID를 새로 정의하는 곳 없음. 참조만 있음.
- **상세**: prefix `EIA-`가 `14-external-interaction-api.md` 전용으로 사용됨. 충돌 없음.

---

### [INFO] `ExternalInteractionRequestContext` / `InternalInteractionRequestContext` / `InteractionRequestContext` 타입명 — 고유함
- **target 신규 식별자**: TypeScript interface/type `ExternalInteractionRequestContext`, `InternalInteractionRequestContext`, `InteractionRequestContext` (`interaction.guard.ts`)
- **기존 사용처**: 없음. 기존 코드베이스에 동명 타입 없음.
- **상세**: 충돌 없음.

---

### [INFO] `ExecutionToken` 엔티티 / `execution_token` 테이블 — 고유함
- **target 신규 식별자**: TypeORM entity `ExecutionToken`, DB 테이블 `execution_token` (`entities/execution-token.entity.ts`)
- **기존 사용처**: `execution`, `node_execution`, `execution_node_log` 등 기존 execution 계열 테이블이 있으나 `execution_token`은 없음.
- **상세**: `root-entities.ts`에 정상 등록됨. 충돌 없음.

---

### [INFO] `iext:blacklist:` Redis 키 prefix — 고유함
- **target 신규 식별자**: Redis 키 prefix `iext:blacklist:` (`interaction-token.service.ts`)
- **기존 사용처**: 기존 코드에서 동명 prefix 없음.
- **상세**: 충돌 없음.

---

### [INFO] `interaction-token` Swagger Bearer scheme — `access-token` scheme과 병존
- **target 신규 식별자**: Swagger security scheme 이름 `interaction-token` (`main.ts`, `spec/conventions/swagger.md §2-1`)
- **기존 사용처**: `access-token` scheme (기존 워크스페이스 JWT)
- **상세**: `main.ts`에 두 scheme이 별도 등록되어 Swagger 레벨 충돌 없음. 충돌 없음.

---

## 요약

target 문서(`14-external-interaction-api.md`, `16-system-status-api.md`)가 도입하는 신규 식별자 중 실질적 충돌은 발견되지 않는다. `TOKEN_INVALID`/`TOKEN_EXPIRED` 코드명이 워크스페이스 JWT 계층과 동일 문자열을 쓰는 것은 spec이 이미 인지하고 레이어 구분으로 수용한 설계다. `terminal-revoke-reconcile` 큐가 spec/16 레지스트리 표에 누락된 것과 `makeshop-token-refresh` 미등재 각주가 부정확한 것은 spec drift이나 식별자 의미 충돌이 아닌 문서 보완 사항이다. 환경변수 `INTERACTION_JWT_SECRET`의 `JWT_SECRET` fallback은 설계상 명시적이며 프로덕션 fail-closed로 보완되어 있다. 전반적으로 신규 식별자는 기존 네임스페이스와 명확히 분리되어 있다.

## 위험도

LOW
