# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base origin/main)

## 발견사항

- **[WARNING]** `backend-lint-gate-broken-on-main.md` 의 대응 체크리스트 항목이 이번 구현 착지를 반영하지 못했다
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
    (`redisKey` 조립부 — `${REDIS_KEY_PREFIX}${executionId}:${route}:${rawKey}`) 및 동반
    `idempotency.interceptor.spec.ts`/`external-interaction.e2e-spec.ts`(`IDEM-4`/`IDEM-5`)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L561~L593
    (체크박스 `[ ]` **"idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는다"**)
  - 상세: 이 plan 항목은 정확히 지금 target 이 구현한 것을 기술한다 — "조치 방향:
    `interaction:idempotency:${executionId}:${route}:${rawKey}` (**3 세그먼트**)" 라고 명시했고,
    L583 의 사후 메모는 "선행 spec 해소(2026-08-12) … **이제 구현만 남았다**" 라고 적어
    구현 착수를 명시적으로 대기 중이었다. target 은 그 3-세그먼트 스코프를 코드·단위테스트·
    e2e(`IDEM-4` execution 축, `IDEM-5` route 축) 로 정확히 그 사양대로 착지시켰고, spec
    (`spec/data-flow/15-external-interaction.md` §2.2, `spec/5-system/14-external-interaction-api.md`
    §R8)도 이미 사전 정합 상태다(`plan/complete/spec-draft-eia-idempotency-key-scope.md` 로 완료
    이관됨, 커밋 `31f0bec9b`). 그런데 이번 diff 가 건드린 plan 파일은
    `spec-draft-eia-idempotency-key-scope.md` 단 하나뿐이고(`git diff origin/main...HEAD --stat -- plan/`
    로 확인), **원 지적이 등재된 `backend-lint-gate-broken-on-main.md` L561 체크박스는 여전히
    미체크**로 남아, 그 파일만 읽는 사람은 이 취약점이 아직 열려 있다고 오독하게 된다
    (프로젝트 교훈 "plan 체크박스 = 실제 상태" · "체크리스트 두 군데는 양쪽 동기화" 위반 형태).
  - 제안: `backend-lint-gate-broken-on-main.md` L561 항목을 `[x]` 로 전환하고 "구현 완료
    (`eia-r8-cache-scope-4ae434`, PR ___) — 3-세그먼트 스코프(`executionId:route:rawKey`) 로
    착지, e2e `IDEM-4`/`IDEM-5` 로 실 파이프라인 관측" 같은 짧은 완료 메모를 남길 것. (같은
    plan 의 L594 "responseJson 손상 무방비", L602 "readKey/hashBody 경계값 테스트 부재", L617
    "EIA Redis 키 §9.1/§9.2 레지스트리 미등재" 는 이번 target 범위 밖이라 그대로 두는 것이 맞다.)

## 요약

target(멱등 캐시 키를 `<executionId>:<route>:<key>` 로 스코프)은 선행 planner 턴이 완료해 둔
`plan/complete/spec-draft-eia-idempotency-key-scope.md` 의 결정(스코프 단위=execution, jti 아님 ·
route 축 별도 · ctx 부재 시 전역 fallback 금지)을 정확히, 이견 없이 구현했고 spec
(`spec/data-flow/15` §2.2, `spec/5-system/14` §R8)도 이미 사전에 그 결정대로 갱신돼 있어 target 과
완전히 정합한다. `spec-draft-eia-r8-alignment.md`(별도 관심사 — 캐시 대상 상태코드 조건)와의 경계도
겹치지 않고 충돌하지 않는다. 유일한 결함은 같은 취약점을 원래 등재했던
`backend-lint-gate-broken-on-main.md` 의 체크박스가 이번 구현 착지 후에도 갱신되지 않아 두 plan
문서 간 상태가 불일치한다는 점이다 — 결정 충돌이나 선행조건 미해소는 아니고 순수한 사후 기록
누락이라 WARNING 으로 판단한다.

## 위험도
LOW
