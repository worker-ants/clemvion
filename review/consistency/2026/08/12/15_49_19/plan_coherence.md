# Plan 정합성 검토 — spec draft: EIA §R8 캐시 대상 서술 정합 + fail-open 잔여 위험 카탈로그 보강

## 발견사항

- **[INFO]** 변경 2 diff 헤더의 섹션 라벨이 실제 위치와 다르다
  - target 위치: `plan/in-progress/spec-draft-eia-r8-alignment.md` "변경 2 — `data-flow/15` §외부 의존 표 (현 L258)"
  - 관련 plan: 없음(target 자기 정합성 이슈, plan 문서와 대조 중 발견)
  - 상세: L258 (`interaction:idempotency:<key>` 행)은 실제로는 `### 2.2 Redis / BullMQ`(§2.2, schema 매핑) 표에 있다. `## 4. 외부 의존` 절(§외부 의존, 실측 L302)은 별개 표(외부 webhook endpoint·클라이언트·chat provider·Redis 한 줄 요약)이고 idempotency 행이 없다. 정확한 참조는 `backend-lint-gate-broken-on-main.md`(L618: "§2.1/§2.2 표")가 이미 쓰고 있다 — plan 쪽이 맞고 target 라벨이 틀렸다. 다만 target 이 인용하는 `## Rationale` "Fail-open 정책의 일관 표기" 절의 "본 문서는 각 표에 해당 정책을 명시" 라는 근거 자체는 §2.2 에도 그대로 적용되므로 diff 본문(라인 번호·내용)은 정확하다 — 헤더 라벨만 오기다.
  - 제안: `## 변경 2` 제목을 "§외부 의존 표" → "§2.2 Redis / BullMQ" 로 정정. 커밋 전 사소한 수정이라 CRITICAL/WARNING 은 아님.

## 교차검증 (문제 없음 확인)

- **미해결 결정과의 충돌 없음**: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 남은 3개 EIA §R8 관련 항목을 전수 대조했다.
  1. L616-624 "planner 인계 — data-flow 의 R8 요약이 SoT 보다 넓다"(`--impl-done 13_07_33` cross_spec·rationale_continuity WARNING) → target 변경 1·2 가 정확히 이 항목에 응답. 인용된 §R8 원문("`400 VALIDATION_ERROR` 만 제외, 2xx·409·410 은 캐시")을 `spec/5-system/14-external-interaction-api.md:1055` 실제 텍스트와 대조 확인 — 일치.
  2. L651-658 "planner 인계 — fail-open 잔여 위험 카탈로그에 idempotency 예시 추가"(`--impl-done 15_24_11` rationale_continuity INFO 1) → target 변경 3 이 정확히 이 항목에 응답. `## Rationale` "Fail-open 정책의 일관 표기" 절이 blacklist 예시만 든다는 target 의 서술을 실제 spec 텍스트(L331-337)와 대조 확인 — 일치.
  3. L669-686 "idempotency 캐시 제외 조건이 §R8 보다 넓다 — 선재 결함"(`12_24_14` requirement WARNING, developer 스코프, 미체크) — "착수 시 주의: 올바른 조건은 `=== 400` 이 아니다... spec 확인이 코드보다 먼저" 라는 캐비엇이 있다. target 변경 4(§R8 5xx 명확화 + 닫힌 목록 Rationale)가 정확히 이 캐비엇이 요구하는 "spec 확인"이다. target 은 이 항목을 직접 닫지 않고(비목표에 "구현 수정 안 함" 명시), 정확한 조건만 spec 에 못박아 둔다 — 항목 3의 향후 착수 조건에 정합.
  - target 이 세 항목의 성격(2건 planner 인계 vs 1건 developer 항목의 선행조건)을 정확히 구분해 다루고 있어 결정 우회나 충돌이 없다.

- **선행 plan 미해소 없음**: target 의 "왜 지금 하나" 절이 요구하는 선행조건(§R8 이 정확해야 `statusCode >= 400` 수정 착수 가능)은 target 자신이 채우는 조건이다. `backend-lint-gate-broken-on-main.md` 는 이미 게이트 복구 본체가 완료(`#1104` 머지)돼 있고 §후속만 열려 있어, target 착수를 막는 다른 미해소 선행 plan은 없다.

- **후속 항목 누락 없음**: target 의 체크리스트가 "`backend-lint-gate-broken-on-main.md` 의 planner 인계 2건 체크 + 후속 구현 항목에 spec 이 정확해졌으므로 착수 가능 표시"를 명시해, 위 3개 항목 중 2건 완료 처리 + 1건(구현) 착수 가능 표시까지 루프를 닫는 것을 스스로 계획하고 있다.

- **인접 plan 과의 충돌 없음**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 도 같은 파일(`spec/5-system/14-external-interaction-api.md`)을 대상으로 최근(2026-08-11)까지 활발히 활동했으나(§5.5 `410` 분기, §5.1 에러 코드 표, §R14 Rationale 등), R8/idempotency 캐시 대상 관련 언급이 전혀 없다(전수 grep 확인). 두 plan 은 서로 다른 갭 클래스(스펙 미구현 기능 감사 vs 스펙 서술 정합)를 다루므로 겹치지 않는다. 같은 날(2026-08-12) 별도 worktree `eia-idempotency-fixes` 가 `IdempotencyInterceptor` fail-open 런타임 버그를 코드 레벨에서 이미 고쳤다는 기록(`backend-lint-gate-broken-on-main.md` L636-650)도 target 의 변경 3 서술("idempotency 저하 = 같은 Idempotency-Key 재요청이 전부 캐시 미스로 판정돼 다운스트림 중복 실행 가능")과 정합한다 — 그 코드 fix 가 대응하는 정확히 같은 위험을 spec Rationale 에 반영하는 것이라 방향이 일치한다(동시 worktree 이슈는 검토 대상 아니므로 결함으로 잡지 않음, 참고로만 기록).

## 요약

target 은 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속에 명시적으로 남겨진 두 건의 "planner 인계" 항목(data-flow R8 요약 정정, fail-open 카탈로그 보강)과 세 번째 항목(구현 `statusCode >= 400` 수정)의 선행조건인 "spec 확인"을 정확히 겨냥해 응답하며, 인용한 spec 원문·plan 서술을 모두 실측 대조해 정합함을 확인했다. 결정 우회·선행조건 무시·후속 누락 어느 것도 발견되지 않았다. 유일한 지적은 target 자신의 diff 헤더 섹션 라벨 오기(§외부 의존 표 → 실제로는 §2.2 Redis/BullMQ) 하나로, 커밋 전 정정 권장 수준의 경미한 사안이다.

## 위험도

LOW
