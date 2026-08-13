# Rationale 연속성 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 발견사항

### INFO — EIA Redis 키 레지스트리 갭은 이미 R8 선례로 정당화되나 §9.1/§9.2 등재는 여전히 미해결
- target 위치: 체크리스트 `[ ] EIA 계열 Redis 키가 실행 엔진 §9.1/§9.2 키 레지스트리에 없다` (약 L737-745)
- 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R8 Rationale 말미
  ("실행 단위로 스코프한 Redis 전역 키는 선례가 있다 — 실행 엔진 §9.2 의 `exec:seq:<executionId>` ·
  `exec:cont:seq:<executionId>` 가 'executionId 가 이미 전역 유일 UUID' 를 근거로 같은 형태를 쓴다.")
  vs `spec/5-system/4-execution-engine.md` §9.1 ("**모든** Redis 키는
  `{service}:{workspaceId}:{resource}:{id}:{sub}` 를 따른다")
- 상세: 이번 PR(`eia-r8-cache-scope-4ae434`)이 착지시킨
  `interaction:idempotency:${executionId}:${route}:${rawKey}` 는 `workspaceId` 를 담지 않는다.
  §R8 Rationale 은 이를 `exec:seq`/`exec:cont:seq` 선례를 인용해 명시적으로 정당화하고 있고,
  execution-engine.md §9.2 도 그 두 키를 "예외 각주"로 이미 등재해 뒀다 — 즉 **패턴 자체는
  기존에 합의된 예외 카테고리를 따른 것**이라 이번 PR 이 새로 만든 위반은 아니다. 다만
  `interaction:idempotency:*`·`iext:blacklist:<jti>` 등 EIA 계열 키 자체가 §9.2 예외 각주
  목록에 아직 이름으로 올라가 있지 않다는 별개의 등재 갭이 target 에 이미 열린 항목으로
  정확히 남아 있다(발견 라운드 `19_56_51` convention_compliance INFO 4).
- 제안: 이미 target 이 `spec_impact` planner 후속으로 정확히 열어 둔 상태라 추가 조치 불요.
  다만 착수 시 "왜 workspaceId 없이도 괜찮은가"의 근거로 §R8 의 선례 문단을 그대로 재사용하면
  같은 논증을 두 번 만들지 않아도 된다는 점만 남긴다.

## 정합 확인 (참고, 위반 아님)

target 의 실질 스코프(이 developer 세션이 착지시킨 부분)는 EIA idempotency 캐시 관련 결정들이며,
모두 **과거 Rationale 을 먼저 갱신한 뒤 구현**하는 순서를 지켰다:

- **캐시 제외 조건 열거(`>= 400`→`2xx||409||410`)**: `spec/5-system/14-external-interaction-api.md`
  §R8 이 명시적으로 기각한 두 축약(`=== 400`·`>= 400`)을 재도입하지 않았다 — 오히려 그 기각을
  뮤테이션 테스트(각 축약을 뮤턴트로 넣어 RED 확인)로 코드에 고정했다.
- **캐시 키 스코프(`<executionId>:<route>:<key>`)**: 이 결정은 먼저 planner 턴
  (`eia-idempotency-key-scope`, #1156)이 §R8 에 "캐시 키 스코프" Rationale 문단을 신설한 뒤,
  이 developer 턴이 그 문단이 서술한 형태·근거(execution 축·route 축·"토큰이 아닌 이유"·
  ctx 부재 시 전역 fallback 금지)를 그대로 구현했다 — 결정 번복 시 새 Rationale 을 동반하지
  않은 사례에 해당하지 않는다.
- **fail-open 정책**: `data-flow/15-external-interaction.md` §Rationale "Fail-open 정책의
  일관 표기" (두 축: 미가용/손상, 다섯 경로 중 넷만 warn)와 target 이 서술하는 구현·완료 이력이
  일치한다. 이 Rationale 문단 자체도 이번 관련 세션(`eia-failopen-wording`)에서 실측을 반영해
  갱신됐고, target 이 그 갱신 경위(§R8 CRITICAL/WARNING 정정 포함)를 정확히 남겨 뒀다.
- **`mock 에 LIKE 해석기` 기각 근거 보존**: 각주 철회 항목에서 과거 기각 사유를 지우지 않고
  보존해, 재도입 압력이 있는 대안이 근거 없이 다시 검토되는 것을 막았다 — 이 checker 의 관점 1
  (기각된 대안의 재도입 방지)에 부합하는 모범 사례.

CRITICAL·WARNING 급 발견은 없다.

## 요약

target 문서(`backend-lint-gate-broken-on-main.md`)는 lint 게이트 복구 plan 이 EIA idempotency
캐시 스코프 작업(이 developer 세션의 실제 스코프)까지 흡수하며 방대해졌지만, spec 의
`## Rationale` 과 충돌하는 지점은 발견되지 않았다. 특히 EIA §R8·data-flow §15 의 캐시 제외
조건·캐시 키 스코프·fail-open 정책과 관련된 모든 완료 항목이 (a) 과거에 명시적으로 기각된
대안(`=== 400`/`>= 400` 축약, 전역 키 fallback, mock LIKE 해석기)을 재도입하지 않았고,
(b) 결정을 번복할 때는 항상 planner 턴이 먼저 spec Rationale 을 갱신한 뒤 구현이 따라갔으며,
(c) execution-scoped Redis 키라는 설계는 execution-engine.md §9.2 에 이미 존재하는 예외
선례를 인용해 정당화됐다. 유일하게 남은 항목(EIA 계열 키의 §9.1/§9.2 레지스트리 등재)은
target 스스로 이미 열어 둔 pre-existing gap 이며 이번 PR 이 새로 만든 위반이 아니다.

## 위험도
NONE
