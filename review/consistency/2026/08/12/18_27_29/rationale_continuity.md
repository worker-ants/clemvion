### 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** `15-external-interaction.md` §Rationale 에 R8 갭 해소 이력 병기 검토 (선택)
  - target 위치: `spec/data-flow/15-external-interaction.md` `## Rationale` — "§1.5 구현 갭 — 해소 이력 (C3 fix)" 항목과 대응되는 자리
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` R8 ("Idempotency-Key 와 `submit_form` 검증 실패의 관계" — 캐시 대상은 `2xx`·`409`·`410` 뿐인 닫힌 목록)
  - 상세: 이번 diff (`idempotency.interceptor.ts`/`.spec.ts`/`external-interaction.e2e-spec.ts`)는 `interaction:idempotency:<key>` 캐시가 `409`/`410`(error 채널로 throw 되는 `ConflictException`/`GoneException`)까지 적재하도록 고쳐, R8 이 요구하는 닫힌 목록(`2xx`·`409`·`410`, `400 VALIDATION_ERROR`·`5xx` 제외)을 처음으로 실제 구현과 일치시켰다. `isErrorStatusCacheable` 의 docstring 은 R8 Rationale 의 경고("단일 비교로 축약하지 말 것 — `>= 400` 은 409·410 을 떨구고 `=== 400` 은 다른 400 계열·5xx 를 캐시한다")를 그대로 인용하며, 종전 코드 주석의 "선재 결함"·"백로그: `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속" 문구는 diff 의 `-` 라인으로 전부 제거됐다(고쳐졌으므로). target 문서 본문 §2.2 표(line 302, 변경 없음)는 원래부터 "닫힌 목록"이라는 **의도된 최종 상태**만 서술해 왔으므로 target 문서 자체에 정정할 stale 서술은 없다. 다만 §1.5 에는 이미 유사한 과거 갭 해소 이력(secret rotation `secretRef` 우선순위 충돌)을 남기는 선례가 있어, 동일한 스타일로 "R8 캐시 범위 구현 갭 — 해소 이력"을 짧게 남기면 이 문서의 이력 추적 관례와 대칭을 이룬다.
  - 제안: 필수 아님. 원한다면 target `## Rationale` 에 §1.5 와 나란히 짧은 절을 추가해 "이전 구현은 `statusCode >= 400` 조건으로 409·410 을 함께 캐시 대상에서 제외해 EIA-RL-02 를 그 범위에서 위반했고(2026-05-21 원본 구현부터), 이번 fix 로 R8 의 닫힌 목록과 정합됐다"는 한 문장을 남겨도 좋다. `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 해당 체크리스트 항목은 이미 `[x]` 로 표시돼 있어 plan 쪽 동기화는 이미 맞다.

### 요약
이번 diff 는 spec 문서(`spec/data-flow/**`, `spec/5-system/14-external-interaction-api.md`)를 전혀 건드리지 않는 순수 코드 변경이며, 그 내용은 [Spec EIA §R8](../../spec/5-system/14-external-interaction-api.md#r8-idempotency-key-와-submit_form-검증-실패의-관계)의 "캐시 대상은 닫힌 목록이다(`2xx`·`409`·`410`)"라는 기존 Rationale 결정을 처음으로 정확히 구현한 것이다. 기각된 대안의 재도입도, 합의 원칙 위반도, 무근거 번복도 없다 — 오히려 R8 Rationale 이 명시적으로 경고한 두 가지 잘못된 축약(`>= 400`, `=== 400`)을 코드 docstring 이 그대로 인용하며 회피했고, target data-flow 문서(§2.2 표)는 그 닫힌 목록을 원래부터 정확히 서술해 왔으므로 target 문서 자체를 갱신할 필요도 없다. Rationale 연속성 관점에서 위험 신호는 발견되지 않았다.

### 위험도
NONE
