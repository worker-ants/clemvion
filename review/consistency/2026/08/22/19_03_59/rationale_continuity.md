STATUS=success rationale_continuity checked spec/4-nodes/7-trigger/ bundle against cross-spec Rationale (EIA §R17 등)

===REPORT_MARKDOWN_BELOW===

### 발견사항

이번 impl-prep 스코프(`spec/4-nodes/7-trigger/`)에서 **기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회**로 분류할 CRITICAL/WARNING 항목을 찾지 못했다. 대신 확인 과정에서 나온 저-강도 관찰 1건만 INFO 로 남긴다.

- **[INFO]** `1-manual-trigger.md` 가 마커 리터럴 SoT(공유 패키지)를 직접 인용하지 않음
  - target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표 각주("egress 마스킹 마커(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)") 및 Rationale "`masked_value_resubmitted` 검사 시점" 절
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 (2026-08-21 갱신) — "마커 집합과 깊이 상한의 SoT 는 공유 패키지 `@workflow/masked-markers` 다 … backend `sanitize-error-message.ts` 와 프런트 `lib/utils/masked-markers.ts` 는 재export shim"
  - 상세: target 은 마커 세 문자열을 리터럴로만 나열하고 "정의 SoT 는 EIA §R17" 로 정확히 위임하고 있어 **모순은 아니다**. 다만 `plan/complete/masked-marker-shared-package.md` (2026-08-21 완료)로 SoT 가 `sanitize-error-message.ts` 단독에서 공유 패키지 `@workflow/masked-markers` 로 이관됐는데, target 은 여전히 리터럴 세 문자열을 직접 나열해 "이 표는 무엇을 SoT 로 보는가"가 EIA §R17 을 열어봐야만 명확하다. 결정 번복이나 원칙 위반은 아니고, cross-reference 를 한 단계 더 좁히면 좋을 정도의 보완 여지.
  - 제안: 이번 PR 은 spec_impact: none(코스메틱 4건, 코드 주석/Swagger/JSDoc 만 변경)이므로 이 항목 때문에 spec 을 건드릴 필요는 없다. 향후 `1-manual-trigger.md` 를 다시 만질 기회가 있으면 각주에 `@workflow/masked-markers` 패키지 링크를 한 번 추가하는 정도로 충분(blocking 아님).

### 확인한 정합성 (참고 — 문제 없음으로 판정한 근거)

- `1-manual-trigger.md` §6 의 `masked_value_resubmitted` 검사 시점 서술("adapter `resolveTriggerParameters` **전후** 2단계 — raw 우선 검사 → resolve → 재검사")은 `plan/complete/spec-update-masked-reject-framing.md` 가 명시적으로 금지한 회귀("직후 한 지점으로 되돌리는 것")를 **정확히 피하고 있다**. target 문서 자신도 "이 문장을 '직후' 한 지점으로 되돌리지 말 것" 이라는 명시적 경고를 Rationale 에 보존하고 있어, 과거에 기각된 설계(resolve 직후 단일 검사)가 재도입되지 않았음을 확인했다.
- `1-manual-trigger.md`·`0-common.md` 모두 "마커 재제출 거부는 base(`resolveTriggerParameters`)가 아니라 wrapper(`resolveTriggerParametersRejectingMasked`)가 한다"는 EIA §R17 의 설계(공유 프리미티브를 넓히면 무관한 webhook/schedule 경로가 오염된다는 근거 포함)를 그대로 인용하고 있고, CI 가드(`masked-reject-callers-guard.ts`)명까지 일치한다. 이번 코스메틱 plan 이 계획한 "base JSDoc 에 wrapper 역참조 + 왜 base 가 아닌지" 추가는 이 Rationale 을 문서에 한 겹 더 반영하는 것일 뿐 새로운 결정도, 번복도 아니다.
- `1-manual-trigger.md` §6 의 "Manual 실행경로·Manual re-run 한정(webhook·schedule 은 외부 시스템이 저작하는 페이로드라 대상 아님)" 서술은, `plan/complete/spec-update-masked-reject-framing.md` 가 폐기 대상으로 지목한 구 프레이밍("재제출 경로 한정")이 아니라 이미 정정된 "저작 주체 기준" 프레이밍을 쓰고 있다 — 폐기된 서술의 재도입 없음.
- `spec/5-system/12-webhook.md` Rationale 의 ingestion-time 마스킹 채택("whack-a-mole 우려로 display-time 마스킹 기각")과 EIA §R17 의 egress-time 마스킹 채택은 서로 다른 대상(구조화된 알려진 헤더 key vs 자유 텍스트)에 적용되는 것으로 EIA §R17 자신이 그 우려에 명시적으로 답하고 있어(§R17 "webhook Rationale 의 'whack-a-mole' 우려에 대한 답" 문단), 두 문서가 서로 모순되지 않는다. target 은 이 두 축 중 EIA §R17 계열(Manual 파라미터 값 마스킹/거부)만 다루므로 충돌 없음.
- `restoreVersion` 이 저장 시점 파라미터 스키마 게이트(`invalid_schema` 등 구조 검증)를 건너뛰는 비대칭은 `masked_value_resubmitted` 값 검증과 별개 축(스키마 vs 값)이라 상호 invariant 우회로 보지 않았다.
- Discord/Slack/Telegram provider spec 의 각 Rationale(R-D-*, R-S-*, R1~R5)은 이번 스코프 변경(마스킹 마커 코스메틱)과 무관한 영역이며, 상호간 명시적 "기각" 대안이 재도입된 흔적 없음.
- 이번 코스메틱 plan 이 스코프에서 명시적으로 제외한 3건(`findMaskedResubmissions` 단위 테스트, `throwIfAny` phase 경계 회귀 테스트, `ExecutionsService.reRun` 리팩터)은 트래커에 조건부 defer 로 이미 기록돼 있어 "무근거 번복"이 아니라 "조건 미충족으로 인한 의도적 유지"로 확인했다.

### 요약

target(`spec/4-nodes/7-trigger/` 번들: `1-manual-trigger.md`·`0-common.md`·`providers/*`)은 이번 "마커 시리즈 이월 코스메틱 4건" 작업(spec_impact: none, 코드 주석/Swagger/JSDoc 만 변경)의 근거가 되는 `spec/5-system/14-external-interaction-api.md` §R17 Rationale 을 문구 수준까지 일치시켜 인용하고 있으며, 과거 기각된 설계(resolve 직후 단일 검사, "재제출 경로 한정" 프레이밍)를 재도입한 흔적이 없다. 오히려 target 문서 자신이 "이 문장을 되돌리지 말 것"이라는 회귀 방지 경고를 Rationale 에 명시적으로 남겨 두고 있어 연속성이 특히 견고하다. 발견한 유일한 항목은 마커 리터럴 SoT 를 공유 패키지로 한 단계 더 명확히 가리키면 좋겠다는 INFO 수준 보완 제안이며, 이는 이번 PR 의 spec-불변 원칙과도 상충하지 않는다.

### 위험도

NONE
