# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 검토 범위

`git diff origin/main...HEAD` 기준 실질 변경분:

- `spec/5-system/_product-overview.md` — NF-OB-07 메트릭 카탈로그에 `clemvion.redis.fail_open` 1행 추가
- `spec/data-flow/9-observability.md` — 동일 메트릭 미러 문장 + `## Rationale` 하위 절 추가
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordRedisFailOpen()` 신설,
  `RedisFailOpenComponent`/`RedisFailOpenReason` 리터럴 유니온 타입 신설
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — fail-open 5경로에
  `recordRedisFailOpen()` 배선
- 각 대응 spec/테스트 파일

prompt 번들이 컨텍스트 예산으로 diff 본문·다수 `spec/conventions/*.md`(예: `swagger.md`,
`error-codes.md`, `audit-actions.md` 뒤쪽 절)를 생략했으므로, 위 diff 와 관련 conventions 파일은
워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff`/`Read` 로 직접 재조회해 검토했다.

## 발견사항

없음. CRITICAL/WARNING 대상 위반을 발견하지 못했다.

## 준수 확인된 항목 (검토했으나 위반 없음)

- **명명 규약 (메트릭/라벨)**: 신규 `clemvion.redis.fail_open` 은 §NF-OB-07 표 서두 규칙("OTel
  instrument 이름은 dot 표기 `clemvion.*`, 모든 라벨은 bounded cardinality")과 기존 5행
  (`clemvion.execution.total`·`clemvion.queue.depth`·`clemvion.llm.tokens`·`clemvion.node.duration`
  등)의 명명 패턴을 그대로 따른다. 라벨 값(`component`: idempotency, `reason`: get_failed/
  set_failed/serialize_failed/entry_corrupt/payload_corrupt)은 코드의 리터럴 유니온
  (`RedisFailOpenComponent`/`RedisFailOpenReason`, `business-metrics.service.ts`)으로 타입
  강제되어 있어 `spec/conventions/error-codes.md` §1 이 경고하는 "무제한 문자열이 계약처럼 굳는"
  패턴과 무관하다. 이 값들은 `error.code` 봉투가 아니라 OTel Prometheus 라벨이므로
  `error-codes.md`(§1 `UPPER_SNAKE_CASE`)의 적용 대상도 아니다 — 레이어가 다르다(동일 문서 §3
  historical-artifact 레지스트리의 판단 축과 같은 논리).
- **frontmatter-evidence 제외 정합**: 변경된 두 spec 파일 모두
  [`spec/conventions/spec-impl-evidence.md` §1](../../../../spec/conventions/spec-impl-evidence.md)
  의 명시 제외에 해당한다 — `_product-overview.md` 는 밑줄 prefix(`_*.md`)로 frontmatter 의무
  대상이 아니고, `spec/data-flow/**` 는 영역 전체가 §1 에서 제외된다. 실측(`head -5`)으로 두
  파일 모두 frontmatter 없이 유지됨을 확인 — diff 도 frontmatter 추가를 시도하지 않아 정합.
- **문서 구조 규약(Overview/본문/Rationale)**: `spec/data-flow/9-observability.md` 는 기존
  `## Overview`(L7) → 본문(§1~§4) → `## Rationale`(L211) 3섹션 구조를 유지한 채, 신규 근거
  ("`clemvion.redis.fail_open` 의 `component` 를 실제 배선된 값만 열거하는 이유", L261)를
  **`## Rationale` 절 내부**에 정확히 추가했다. SoT 인 `_product-overview.md` 표 갱신과
  data-flow 미러 문장 갱신도 동시에 이뤄져 두 SoT/미러 사이 drift 가 없다(직전 라운드
  `review/code/2026/08/13/{08_36_21,09_57_11}` 가 지적한 SPEC-DRIFT 가 해소된 상태를 재확인).
  이 항목은 원래 `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md` draft 검토
  (`review/consistency/2026/08/13/09_48_44`)에서 "`## Rationale` 대신 `## 판단이 필요한 지점`"
  으로 WARNING 처리됐던 건인데, 현재 plan 파일(L64 `## Rationale`)도 spec 반영본도 모두 정정
  완료된 상태다.
- **API 문서 규약(Swagger/DTO)**: 해당 없음 — 이번 diff 는 REST controller/DTO 를 건드리지 않는다
  (`git diff --stat -- '**/*.controller.ts' '**/*.dto.ts'` 매치 0건). `spec/conventions/swagger.md`
  적용 대상이 아니다.
- **금지 항목**: `spec/conventions/**` 전수(로컬 워크트리 재조회 포함)에서 이번 변경과 충돌하는
  명시적 금지 패턴을 찾지 못했다. 라벨을 `string` 으로 열어두지 않고 리터럴 유니온으로 닫은
  설계는 오히려 `error-codes.md` §1 이 강조하는 "무제한 문자열 계약 금지" 정신과 정합적이다.
- **Redis 키 네이밍(`spec/5-system/4-execution-engine.md` §9)**: 이번 diff 는 신규 Redis 키를
  만들지 않는다(OTel 카운터 계측만 추가) — 해당 컨벤션과 무관.

## 참고 — 이전 라운드와의 관계

동일 변경분에 대해 `review/consistency/2026/08/13/{09_36_31,09_48_44}` 가 draft plan 단계에서
convention_compliance 를 이미 검토했다(1차 BLOCK:YES → frontmatter 3필드 보강 → 재검토 BLOCK:NO,
WARNING 1건 = `## Rationale` 명명 → 조치 완료). 본 세션(`10_20_59`)은 그 spec draft 가 실제
spec/코드에 반영된 **이후** 상태를 diff 기준으로 재검토한 것이며, 위 확인 항목들은 prior 세션의
판정을 재검증(recheck)한 결과다 — 새로 뒤집힌 항목은 없다.

## 요약

`clemvion.redis.fail_open` OTel 카운터 도입 diff 는 명명(dot 표기·닫힌 라벨 유니온), 문서 구조
(Overview/본문/Rationale 배치, SoT-미러 동시 갱신), frontmatter-evidence 제외 판정, API 문서 규약
무관성 등 검토 관점 5개 전 축에서 `spec/conventions/**` 위반을 발견하지 못했다. 직전 두 라운드
(draft 단계 convention_compliance, impl 단계 code-review 3라운드)에서 지적된 사항은 모두 조치되어
반영본에 재발하지 않았다.

## 위험도

NONE
