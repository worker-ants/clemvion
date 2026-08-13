# Rationale 연속성 검토 — spec-draft-nf-ob-07-redis-fail-open.md

## 검토 범위

target: `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`
(NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 1행 등재 — `spec/5-system/_product-overview.md`,
`spec/data-flow/9-observability.md` 대상)

교차 확인한 Rationale:
- `spec/data-flow/9-observability.md` `## Rationale` 전체(liveness/readiness 분리, health S3 ping,
  window_iso, failure_rate 표본 가드, Dashboard 비정규화)
- `spec/data-flow/15-external-interaction.md` `## Rationale` "Fail-open 정책의 일관 표기"
- `spec/5-system/4-execution-engine.md` `## Rationale` "fail-closed 원칙"("프로젝트의 fail-open
  선례는 인프라 가용성(Redis/DB) 시나리오 한정")
- `spec/5-system/_product-overview.md` — 확인 결과 이 파일에는 `## Rationale` 섹션 자체가 없음
  (요구사항 카탈로그 문서라 Rationale 은 다른 spec 파일들에 분산)
- git 이력(`git log -S NF-OB-07`, `-S recordRedisFailOpen`) — commit `1657c0435`(#600, NF-OB-07
  최초 도입, "사용자 결정 '표준 3종 + 노드 지연·에러율'"), `451974407`(fail_open 카운터 도입),
  `aec0ad17e`(리터럴 유니온으로 타입 강제) 로 target 이 인용하는 코드 사실관계를 대조 검증

## 발견사항

없음 — target 이 기각된 대안을 재도입하거나 Rationale 의 합의 원칙을 위반하는 지점을 찾지 못했다.

세부 대조:

1. **기각된 대안 재도입 여부** — 없음. `component: idempotency` 단일값 스코프는 코드 도입 시점
   (`451974407`)부터 원래 그 범위였다(`grep recordRedisFailOpen` → 호출처 1곳). 과거에 더 넓은
   범위였다가 좁혀진 이력이 없어 "번복"이 아니라 최초 스코프의 정직한 등재다.
2. **합의된 원칙 위반 여부** — 없음. Redis 의존 기능의 fail-open 은 `4-execution-engine.md`
   Rationale 이 명시한 프로젝트 선례("인프라 가용성(Redis/DB) 시나리오 한정" fail-open 허용)와
   `15-external-interaction.md` Rationale "Fail-open 정책의 일관 표기"(저하 모드의 잔여 위험을
   운영자가 추적할 수 있게 명시해야 한다는 원칙)에 정확히 부합한다 — 오히려 이 알람 메트릭은 그
   원칙이 요구하는 "관측 가능성"을 사후에 이행하는 것이다. 표 라벨 인라인 표기 관례
   (`_product-overview.md` 기존 `status`/`state` 행)도 그대로 따른다.
3. **결정의 무근거 번복 여부** — 없음. 새로 뒤집는 과거 결정이 없다. "component 를 idempotency
   하나로 둔다"는 판단은 번복이 아니라 신규 스코프 결정이며, target 문서 "판단이 필요한 지점"
   섹션에 근거(실측 grep 결과)와 함께 자체 서술돼 있고 "후속" 체크리스트에 확장 조건까지
   명시했다 — 오히려 "문서가 구현보다 넓어지면 안 된다" 원칙(이 세션에서 반복 학습된 교훈과
   `4-execution-engine.md` 의 유사 사례들 — 예: Redis context store 미채택 시 "실손실은 수용된
   trade-off로 명시"하는 패턴)을 잘 따른 사례다.
4. **암묵적 가정 충돌 여부** — 없음. `_product-overview.md` "관측 대상의 이원화 정책"(OTel/Prometheus
   = 실시간 운영 알람, Statistics API = 제품 분석 SoT)과 정합 — Redis fail-open 은 명백히 운영
   알람 대상이라 OTel 카탈로그가 맞는 위치다.

## 참고 (Rationale 위반은 아니나 연속성 강화 여지 — INFO 미만, 기록만)

target 의 "component: idempotency 하나로 둘 것인가 — 그렇다" 판단은 근거가 실측으로 뒷받침되지만,
이 판단 자체는 `plan/` 문서에만 남고 `spec/data-flow/9-observability.md` `## Rationale` 에는
반영되지 않는다(체크리스트 상 아직 표 갱신 전 단계). 프로젝트 관례상(`결정의 배경·근거 → 해당
spec 문서 끝의 ## Rationale`) 표 갱신 시 이 스코프 판단을 관측 spec Rationale 에 한 줄 남기면,
plan 문서가 향후 `plan/complete/` 로 이동한 뒤에도 "왜 component 값이 하나뿐인가"에 대한 근거가
spec 자체에서 추적 가능해진다. 이는 결함이 아니라 완료 단계에서의 선택 사항이다.

## 요약

target 은 이미 구현·리뷰된 사실(코드에 존재하는 6번째 instrument)을 SoT 카탈로그에 등재하는
순수 문서 정합화 작업이며, 관련된 모든 spec Rationale(fail-open 선례, 관측 이원화 정책, 표 관례)과
충돌 없이 정합한다. 과거에 기각된 대안을 되살리거나 합의 원칙을 어기는 지점, 근거 없이 결정을
뒤집는 지점이 발견되지 않았다. 유일한 판단 지점("component=idempotency 단일값")은 번복이 아닌
신규 스코프 결정이며 target 문서 내에서 스스로 근거를 남기고 후속 확장 조건까지 명시해 두어
Rationale 연속성 관점에서 양호하다.

## 위험도

NONE
