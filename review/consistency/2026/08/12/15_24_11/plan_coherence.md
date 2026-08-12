# Plan 정합성 검토 — spec/data-flow/ (impl-done, eia-idempotency-fixes)

## 검토 범위

- Target: `spec/data-flow/` 번들(특히 `15-external-interaction.md`), diff = `idempotency.interceptor.ts` / `idempotency.interceptor.spec.ts` (catchError fail-open 추가) + `CHANGELOG.md` + `plan/in-progress/backend-lint-gate-broken-on-main.md` 자체 갱신.
- `plan/in-progress/**` 56개 중 예산 초과로 elided 된 파일은 `spec-sync-external-interaction-api-gaps.md` · `eia-context-schema-followups.md` 포함 — 관련성 높은 두 건은 워크트리에서 직접 `Read` 로 재확인함.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 이번 PR 이 만든 결정이 plan 의 "결정 보류" 상태를 정상적으로 해소함
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` docstring / `spec/data-flow/15-external-interaction.md` §외부 의존·§Rationale "Fail-open 정책의 일관 표기" (기존 서술, 이번 PR 무변경)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 "`IdempotencyInterceptor` 의 fail-open 주장이 런타임 reject 를 안 덮는다" 항목
  - 상세: 해당 plan 항목은 원래 "`catchError` 로 fail-open 을 만들거나, docstring 을 좁히거나 — **EIA spec 의 가용성 요구 확인이 먼저**" 라며 결정을 보류해 두었다. 이번 PR 은 `spec/data-flow/15-external-interaction.md` 의 기존 서술("Redis … 전 경로 fail-open (warn) — 가용성 우선", §외부 의존 표 + §Rationale)을 근거로 `catchError` 쪽을 택했고, 이는 target 문서가 **이미 명시한** 요구사항을 그대로 따른 것이라 "미해결 결정을 일방적으로 우회"한 것이 아니다. plan 항목도 같은 PR 안에서 `[x]` 로 갱신하고 근거를 남겼다(`plan/in-progress/backend-lint-gate-broken-on-main.md` 해당 항목 처리 완료 blockquote).
  - 제안: 조치 불필요. 결정과 근거가 diff 내 plan 문서 갱신에 이미 반영됨.

- **[INFO]** 신규 후속 항목("idempotency fail-open 구간의 관측·중복 억제")이 스코프 안에서 적절히 분리됨
  - target 위치: 없음(코드 변경 아님, plan 신규 항목)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속, `[ ]` 신규 항목 "idempotency fail-open 구간의 관측·중복 억제"
  - 상세: fail-open 이 열리는 동안 같은 `Idempotency-Key` 재요청이 캐시 미스로 판정돼 다운스트림 중복 실행이 가능해지는 잔여 위험을 별도 미해결 항목으로 올바르게 분리했다. 이 위험은 `idempotency.interceptor.ts` docstring·`CHANGELOG.md`에도 동일하게 명시되어 3곳(코드 주석/CHANGELOG/plan)이 서로 어긋나지 않는다. 다른 in-progress plan(`exec-intake-followups.md`, `execution-engine-residual-gaps.md` 등, grep 확인) 에 이 위험을 이미 추적하는 중복 항목은 없다.
  - 제안: 조치 불필요.

- **[INFO]** target 이 touch 하지 않은 인접 미해결 항목(§R8 캐시 제외 조건)과의 경계가 명확히 유지됨
  - target 위치: `spec/data-flow/15-external-interaction.md` §1.2/§2.2 "4xx 캐시 제외" 서술 (이번 PR 무변경)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속 "idempotency 캐시 제외 조건이 Spec EIA §R8 보다 넓다 — 선재 결함" (여전히 `[ ]`) 및 "planner 인계 — R8 요약이 SoT 보다 넓다" (`[ ]`)
  - 상세: `idempotency.interceptor.ts` 의 `if (statusCode >= 400) return;` 이 spec EIA §R8("400 VALIDATION_ERROR 만 캐시 제외, 409/410 은 캐시")보다 넓게 4xx 전체를 캐시에서 제외하는 선재 결함이 별도로 문서화돼 있고, planner 턴이 필요하다고 명시돼 있다. 이번 PR 의 diff 는 이 로직(`statusCode >= 400` 분기)을 건드리지 않았고 catchError 위치도 이 분기 앞(`switchMap` 이전)에 정확히 배치돼 있어 두 항목은 서로 다른 축(Redis 장애 시 fail-open vs 정상 응답의 캐시 제외 조건)으로 충돌 없이 공존한다.
  - 제안: 조치 불필요 — 그대로 별도 후속으로 유지.

## 요약

이번 PR(`eia-idempotency-fixes`)은 `plan/in-progress/backend-lint-gate-broken-on-main.md`가 이전 라운드에서 "결정 보류"로 명시적으로 남겨 둔 idempotency fail-open 갭을, target 문서(`spec/data-flow/15-external-interaction.md`)에 이미 존재하는 "전 경로 fail-open — 가용성 우선" 요구를 근거로 해소했다. 같은 diff 안에서 plan 체크박스를 갱신하고 새로 발견된 잔여 위험(관측·중복 억제)을 별도 미해결 항목으로 분리해 등재했으며, 이는 CHANGELOG·코드 docstring과 표현이 일치한다. 인접한 선재 결함(§R8 캐시 제외 조건 범위 불일치)은 이번 diff가 건드리지 않았고 plan 상에서도 별도 축의 미해결 항목으로 정확히 경계가 유지된다. `spec-sync-external-interaction-api-gaps.md`·`eia-context-schema-followups.md` 등 예산 초과로 elided 된 인접 plan 문서를 직접 열어 확인한 결과도 충돌·중복이 없다. Plan 정합성 관점에서 CRITICAL/WARNING 없음.

## 위험도

NONE
