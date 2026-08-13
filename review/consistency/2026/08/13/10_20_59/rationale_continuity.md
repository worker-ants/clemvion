# Rationale 연속성 검토 — `clemvion.redis.fail_open` 메트릭 등재 (spec/5-system/)

## 검토 범위와 방법

Target 은 `spec/5-system/` 이며, 이번 세션(diff-base `origin/main`)의 실질 변경은 다음으로 확인했다
(prompt 번들의 `<git diff origin/main...HEAD -- code_areas>` 섹션이 컨텍스트 예산 초과로 절단돼
있었으므로, HEAD 워킹트리에서 `git diff origin/main...HEAD` 를 직접 재실행해 1차 근거를 확보):

- `spec/5-system/_product-overview.md` — NF-OB-07 행에 "Redis fail-open 강등" 문구 추가 + 메트릭
  카탈로그 표에 `clemvion.redis.fail_open` 행 신설
- `spec/data-flow/9-observability.md` — 동일 미러 문장 갱신 + `## Rationale` 에
  `### clemvion.redis.fail_open 의 component 를 실제 배선된 값만 열거하는 이유` 신설 절 추가
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `RedisFailOpenComponent`
  (`'idempotency'` 단일값)/`RedisFailOpenReason`(5종) 닫힌 리터럴 유니온 + `recordRedisFailOpen()`
  신설
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — fail-open 5개
  경로(`get_failed`/`set_failed`/`serialize_failed`/`entry_corrupt`/`payload_corrupt`) 전량에
  `metrics?.recordRedisFailOpen()` 계측 배선
- 두 파일의 `.spec.ts` 테스트 + `CHANGELOG.md`

이 diff 는 오늘 같은 브랜치에서 이미 3라운드 코드 리뷰(`review/code/2026/08/13/{08_36_21,09_57_11,10_13_11}`,
최종 CRITICAL 0/WARNING 0)와 2라운드 consistency 리뷰(`review/consistency/2026/08/13/{09_36_31,09_48_44}`,
rationale_continuity 포함 전 항목 NONE)를 거쳤다. 본 검토는 그 마지막 리뷰(10_13_11, 커밋 시각
10:20:58) 직후 상태를 대상으로 한 재확인이며, 그 사이 신규 커밋은 테스트 1건(`409e7ff6c`, 타입
캐너리 보강)과 리뷰 산출물 커밋뿐이다.

교차 대조한 `## Rationale`:
- `spec/5-system/_product-overview.md` §NF-OB-07 카탈로그 헤더 — "모든 라벨은 bounded cardinality"
  원칙 (기존)
- `spec/data-flow/15-external-interaction.md` "Fail-open 정책의 일관 표기" — "운영자는 이 구간을
  인지할 수단(Redis 실패율 관측)이 필요하다" (기존, 신규 메트릭이 요구하는 바로 그 관측 수단)
- `spec/5-system/4-execution-engine.md` `## Rationale` "대기 표면 ↔ 명령 매트릭스 publisher 사전
  검증" — "프로젝트의 fail-open 선례는 인프라 가용성(Redis/DB) 시나리오 한정" (기존 fail-open 원칙)
- `spec/5-system/14-external-interaction-api.md` `## Rationale` R8(Idempotency-Key 캐시 스코프) —
  fail-open 실패 경로 목록과의 정합
- `spec/data-flow/9-observability.md` `## Rationale` 나머지 절 (liveness/readiness 분리, 표본 가드
  등) — 직접 충돌 없음

## 발견사항

없음. target 이 과거 Rationale 에서 명시적으로 거부한 대안을 재도입하거나, 합의된 설계 원칙을
위반하거나, 근거 없이 결정을 번복하거나, 기록된 invariant 를 우회하는 지점을 찾지 못했다.

세부 대조:

1. **기각된 대안의 재도입 여부** — 없음. `component` 를 `idempotency` 단일값으로 좁힌 것은 번복이
   아니라 코드 도입 시점(`451974407`)부터의 최초 스코프이며, 더 넓은 범위였다가 좁혀진 이력이
   없다. `data-flow/9-observability.md` 신설 절 스스로도 "나머지(rate limiter·quota·conversation)를
   미리 열거하면 문서가 구현보다 넓어진다"는 근거를 명시해 이 프로젝트가 반복적으로 지켜온
   "spec 이 구현보다 넓으면 안 된다" 원칙(메모리: `feedback_documented_guarantee_wider_than_built`)을
   스스로 인용·준수한다.
2. **합의된 원칙 위반 여부** — 없음. (a) fail-open 자체는 `4-execution-engine.md` Rationale 이 이미
   승인한 "인프라 가용성(Redis/DB) 한정 fail-open" 범주에 정확히 속한다. (b) "모든 라벨은 bounded
   cardinality" 원칙(§NF-OB-07 카탈로그 헤더, 기존 문구)을 신규 카운터도 그대로 따르며, 오히려
   과거에는 이 원칙이 텍스트 서술로만 있고 시그니처는 `string` 이었던 것(리뷰 라운드 09_57_11 에서
   지적돼 `aec0ad17e` 로 해소됨 — 이하 참고)을 이번 diff 가 타입으로 강제해 원칙과 구현의 간극을
   메웠다.
3. **결정의 무근거 번복 여부** — 없음. 뒤집는 과거 결정이 존재하지 않는다. 오히려 `data-flow
   /9-observability.md` `## Rationale` 에 새 절을 **함께** 추가해 "왜 component 가 닫힌 집합이고
   왜 idempotency 하나뿐인가"를 스펙 자신의 근거로 남겼다 — 직전 라운드(09_48_44)의 INFO 지적
   ("이 판단이 plan 문서에만 있고 spec Rationale 에는 없다")이 이번 diff 에서 실제로 해소됐음을
   확인했다(신설 절이 `## Rationale` 섹션 내부(L211 시작) 하위에 위치, L261).
4. **암묵적 가정 충돌 여부** — 없음. `_product-overview.md` "관측 대상의 이원화 정책"(OTel=실시간
   운영 알람, Statistics API=제품 분석 SoT)과 정합하며, `interaction.guard` 의 다른 fail-open 실패
   경로들과 동일하게 "요청은 통과, 상태만 저하로 표시" 패턴을 유지한다(캐시 우회 없음, 인가 판정
   순서 변경 없음).

## 요약

이번 diff 는 이미 존재하던 두 Rationale — `data-flow/15-external-interaction.md`의 "Redis 실패율
관측 수단이 필요하다"는 명시적 요청과 `_product-overview.md`의 "모든 라벨은 bounded cardinality"
원칙 — 을 그대로 이행하는 관측 계측 추가이며, 신규 결정 지점(`component=idempotency` 단일값)의
근거를 `data-flow/9-observability.md` `## Rationale` 자체에 함께 기록해 향후 참조 가능하게 했다.
과거 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느 것도 발견되지
않았으며, 직전 리뷰 라운드가 남긴 INFO(스펙 자체 Rationale 미기록)도 이번 diff 로 이미 해소된
상태다.

## 위험도

NONE
