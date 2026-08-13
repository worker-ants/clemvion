# Cross-Spec 일관성 검토 — spec/data-flow/ (impl-done, EIA r8 cache-scope)

## 검토 범위 확인

- 실제 코드 diff(`origin/main...HEAD`)는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (+ 대응 spec test)와 `CHANGELOG.md` 뿐이다. `spec/**` 자체는 이번 diff 에서 변경되지 않았다 (`git diff origin/main...HEAD --stat -- spec/` 결과 없음).
- 코드 변경 내용: (1) `rawKey` null 판정을 truthiness(`!rawKey`)에서 `rawKey === null` 명시 비교로 교체, (2) 캐시 엔트리 `statusCode` 검증을 `typeof === 'number'` 에서 `isHttpStatusCode`(정수 + 100~599 범위)로 강화. 둘 다 **방어 로직 보강**이며 API 응답 shape·상태 코드 목록·캐시 키 스코프 등 spec 이 규정하는 관측 가능한 계약은 바꾸지 않는다.
- prompt 번들에서 `spec/5-system/14-external-interaction-api.md`(target 문서가 API 계약의 SoT로 지목하는 파일)가 컨텍스트 예산 초과로 절단되어 있었다. 이 파일이 정확히 이번 diff 의 근거(EIA-IN-11 / EIA-RL-02 / §R8)를 담고 있어 cross-spec 판정에 필수적이므로, 절대경로로 **직접 읽어 검증**했다(HEAD 워킹트리 `/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`).

## 대조 결과

- **캐시 키 스코프 (§R8)**: target 문서 §2.2 의 `interaction:idempotency:<executionId>:<route>:<key>` 표기가 코드의 `REDIS_KEY_PREFIX = 'interaction:idempotency:'` + `` `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}` `` 와 정확히 일치. `spec/5-system/14-external-interaction-api.md` §Rationale R8("캐시 키 스코프", 1061행)의 "`<executionId>` 는 `InteractionGuard` 가 토큰 검증 후 합성" 서술도 코드 주석과 동일.
- **닫힌 캐시 대상 목록 (2xx/409/410, 400 제외)**: target 문서·EIA §R8 (1053~1066행)과 코드의 `isErrorStatusCacheable`(409·410만) + `cacheTapped` 의 `2xx` 판정이 일치. 이번 diff 는 이 목록 자체를 건드리지 않았다.
- **요구사항 ID**: `EIA-IN-11`(81행) / `EIA-RL-02`(140행) / `§R8`(1053행) 모두 `spec/5-system/14-external-interaction-api.md` 에 실존하며 코드 주석의 인용과 의미가 일치. 새로 부여된 ID는 없다(diff 는 순수 내부 헬퍼 `isHttpStatusCode`/`MIN_HTTP_STATUS_CODE`/`MAX_HTTP_STATUS_CODE` 추가로, spec 요구사항 ID 네임스페이스와 무관).
- **에러 코드 카탈로그**: `IDEMPOTENCY_KEY_CONFLICT`/409 가 `spec/5-system/3-error-handling.md` 166행의 전역 에러 코드 표와 일치.
- **상태 전이·RBAC·계층 책임**: 이번 diff 는 `iext_*`/`itk_*` 토큰 상태 머신, RBAC, 계층 분리(controller/guard/service/interceptor)에 어떤 변경도 가하지 않는다 — 순수 interceptor 내부의 타입 좁히기·엣지케이스 방어.
- 다른 data-flow 문서(0-overview, 1-audit, 3-execution, 5-integration, 6-knowledge-base 등)와 `5-system/4-execution-engine.md`, `5-system/12-webhook.md`, `5-system/13-replay-rerun.md`, `5-system/3-error-handling.md` 를 대조했으나 idempotency 관련 언급은 서로 다른 도메인(webhook body-parser 자체 idempotency 가드, replay-rerun 의 별개 v2+ 기능 A3, 에러 코드 카탈로그 미러)이라 충돌 없음.

## 발견사항

없음 — CRITICAL / WARNING / INFO 모두 해당 없음.

## 요약

이번 변경은 `spec/data-flow/15-external-interaction.md` 및 그 SoT인 `spec/5-system/14-external-interaction-api.md` §R8/EIA-IN-11/EIA-RL-02 가 이미 규정한 "idempotency 캐시는 `<executionId>:<route>:<key>` 로 스코프하고 2xx/409/410 만 캐시한다"는 계약을 그대로 유지한 채, 그 계약을 구현하는 인터셉터 내부의 null 판정·캐시 엔트리 형태 검증만 강화한 순수 방어적 패치다. 코드 diff 는 `spec/**` 를 전혀 건드리지 않았고, 절대경로로 직접 재확인한 `5-system/14-external-interaction-api.md`(prompt 번들에서는 예산 초과로 절단됨) 대조 결과 API 계약·요구사항 ID·에러 코드 카탈로그 어디에도 모순이 없다. 데이터 모델·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하지 않는다.

## 위험도

NONE
