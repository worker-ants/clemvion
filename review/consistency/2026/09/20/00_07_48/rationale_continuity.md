# Rationale 연속성 검토

## 검토 대상

- scope: `spec/2-navigation/` (--impl-done, diff-base `origin/main`)
- 구현 diff: 11개 파일 / 541줄 — `connection-test-codes.ts` 신설 + `IntegrationTestResult.code` 를 `IntegrationTestResultCode` literal union 으로 좁힘 + 테스트 빈칸 3건(mysql SSL 매핑 · 소켓 정리 · rotate TOCTOU 404) 보강.
- 관련 spec: `spec/2-navigation/4-integration.md` §5.3/§5.4/§5.5/§9.1/§14.1 + `## Rationale`(프롬프트 예산 절단으로 워킹트리에서 직접 재확인).
- 관련 plan: `plan/in-progress/connection-test-codes-and-gaps.md`(spec_impact: none), 상위 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`.

## 발견사항

없음 — CRITICAL/WARNING 후보를 찾지 못했다.

교차검증한 근거:

1. **코드 상수화가 기존 Rationale 을 그대로 반영** — `connection-test-codes.ts` 의 `CONNECTION_TEST_CODES`(EMAIL_HOST_BLOCKED · EMAIL_CONNECT_FAILED · DB_HOST_BLOCKED · DB_AUTH_FAILED · DB_CONNECT_FAILED · HTTP_BLOCKED · HTTP_AUTH_FAILED · HTTP_SERVER_ERROR · HTTP_CONNECT_FAILED) 9개는 `4-integration.md` §14.1 "에러 코드 vocabulary" 표 및 `## Rationale` "연결 테스트 — Database · HTTP 는 실제로 접속한다"(2026-09-19) 절이 확정한 코드 집합과 1:1 일치한다. 호스트 차단 코드(`DB_HOST_BLOCKED`·`HTTP_BLOCKED`)가 노드와 같은 이름을 재사용하고 나머지는 "연결 테스트 전용" 이라는 구분도 주석에 그대로 반영돼 있다 — 번복이 아니라 기존 결정의 타입 강화.
2. **`INTEGRATION_CREDENTIALS_UNREADABLE`/`INTEGRATION_INCOMPLETE` 를 상수 밖에 둔 설계**(`TestGateCode`, 주석: "쓰는 곳이 한 함수뿐이고 테스터 어휘가 아니다")는 §9.1 Rationale "연결 테스트 endpoint 의 `pending_install` 가드 — 응답 형식" 이 이 두 코드를 테스터가 아니라 endpoint 진입부 게이트로 분류한 것과 일치한다. `INTEGRATION_CREDENTIALS_UNREADABLE` 을 반환하는 실제 로직(`integrations.service.ts:962-969`)은 이번 diff 이전부터 있던 코드이며, 새 테스트는 그 기존 동작을 고정할 뿐 새 결정이 아니다.
3. **`IntegrationTestResultCode` 명명**은 원래 `--impl-prep`(`review/consistency/2026/09/19/23_02_33`) 에서 `ConnectionTestResultCode` 로 초안됐다가 WARNING(소유 인터페이스 `IntegrationTestResult` 와 이름을 맞추라)을 받아 현재 이름으로 반영됐다 — plan 체크리스트에 그 경위가 남아 있고, 코드도 그대로 구현됐다.
4. **`HttpCredentialsResult` 의 `INTEGRATION_AUTH_UNSUPPORTED`** 가 union 에 `Extract<HttpCredentialsResult, {ok:false}>['code']` 경로로 포함되어 있어, 트래커가 지적한 spec 표 누락(§5.3/§14.1 문서 갱신 필요 — 별도 planner 항목으로 이미 대기 중, `... §5.3 · §14.1 이 HTTP 연결 테스트의 INTEGRATION_INCOMPLETE · INTEGRATION_AUTH_UNSUPPORTED 를 적지 않는다`)는 이번 diff 의 코드 자체와는 충돌하지 않는다(코드는 이미 이 값을 다루고 있고, 미반영은 문서 쪽 남은 backlog).
5. **테스트 빈칸 3건**(mysql SSL `require`/`verify-full` → `rejectUnauthorized: true`, DB 소켓 정리 `try/finally`, rotate 의 재조회 `null` → 404)은 모두 §5.4 본문("SSL 매핑은 … Database 노드와 같다") 및 기존 동작을 고정하는 회귀 테스트이며 동작 변경이 아니다 — 새 Rationale 이 필요한 "결정 번복"에 해당하지 않는다.
6. `error-codes.md` convention 의 명명·rename 안정성 정책과 대조해도, 이번 diff 는 신규 코드를 만들거나 기존 코드를 rename 하지 않는다(상수로 감싸기만 함) — §2 rename=breaking 정책과 무충돌.
7. plan(`connection-test-codes-and-gaps.md`, `spec_impact: none`)과 상위 트래커의 두 항목("연결 테스트 결과 코드가 원시 문자열로 흩어져 있다", "연결 테스트 spec 의 빈칸 셋")이 이번 구현으로 해소됐다고 기록돼 있고, `--impl-prep`/`/ai-review` 라운드 산출물과 diff 내용이 서로 부합한다.

## 요약

이번 변경은 `spec/2-navigation/4-integration.md` 의 `## Rationale`(특히 "연결 테스트 — Database · HTTP 는 실제로 접속한다"·"§9.1 의 `IntegrationDto` 인벤토리 주장 경계"·"연결 테스트 endpoint 의 `pending_install` 가드")이 이미 확정한 코드 집합·namespace 구분·게이트 분류를 그대로 타입으로 강화하는 순수 리팩터/테스트 보강이며, 기각된 대안을 재도입하거나 원칙을 위반하거나 근거 없이 결정을 뒤집는 지점을 찾지 못했다. spec 델타 0(scope `spec/2-navigation/`)은 `spec_impact: none` 으로 명시된 plan 과 일치해 정상이다.

## 위험도

NONE
