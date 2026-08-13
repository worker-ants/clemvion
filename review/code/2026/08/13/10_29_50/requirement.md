# 요구사항(Requirement) 리뷰 — `clemvion.redis.fail_open` OTel 카운터 (4차 라운드)

## 검토 방법

프롬프트 diff 는 대부분(파일 8~48 부근) 이전 리뷰/일관성 검토 세션(`08_36_21`, `09_57_11`,
`10_13_11`, `review/consistency/2026/08/13/{09_36_31,09_48_44,10_20_59}`)의 산출물이라 그 자체가
"요구사항" 이 아니라 **직전 라운드의 결과 기록**이다. 실질 코드/스펙 변경은 다음 9개 파일뿐이며,
전부 `Read`/`grep` 으로 워크트리 원본을 직접 열어 대조했다:

- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` / `.spec.ts`
- `codebase/backend/src/modules/metrics/business-metrics.service.ts` / `.spec.ts`
- `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` (신규, `plan/in-progress/` 에서 rename)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (체크리스트 갱신)
- `spec/5-system/_product-overview.md`, `spec/data-flow/9-observability.md`

`git log`/`git diff origin/main...HEAD --stat` 로 이번 라운드(`10_29_50` 직전 마지막 커밋
`e8d10ce20`)가 소스 코드를 건드리지 않고 `plan/in-progress/spec-draft-nf-ob-07-redis-fail-open.md`
→ `plan/complete/`로 `git mv`(rename, similarity 99%, frontmatter `status: complete` 로 정정)한 것과
`/consistency-check` 산출물만 추가했음을 확인했다(`R099` rename 으로 정상 추적됨 — 유령 사본 없음).

## 기능 요구사항 대조

의도: fail-open 다섯 경로(GET 실패·SET 실패·직렬화 실패·엔트리 손상·payload 손상)를 OTel 카운터
`clemvion.redis.fail_open{component,reason}` 로 관측 가능하게 한다.

- `idempotency.interceptor.ts` 를 직접 읽어 `recordRedisFailOpen` 호출 4곳(149→161, 245-248→257,
  332→344, 341→353 부근, 실제 줄 161/257/344/353)을 확인 — `get_failed`(161행) ·
  `entry_corrupt`/`payload_corrupt`(257-260행, `discardCorruptEntry` 의 `what` 삼항으로 갈림) ·
  `serialize_failed`(344행) · `set_failed`(353행). `RedisFailOpenReason` 유니온 5개 값과 정확히
  1:1 대응 — 누락·중복 없음.
- 정상 경로(2xx 성공/캐시 히트)에는 호출이 없음을 코드·테스트(`idempotency.interceptor.spec.ts:1150-1160`
  "정상 경로에서는 카운터가 오르지 않는다")로 확인 — 거짓 알람(false positive) 경로 없음.
  `RESOLUTION.md` 의 "뮤턴트 5/5 사살" 주장과 `business-metrics.service.spec.ts:106-119`
  ("reason 이 호출마다 그대로 갈린다")가 실제로 손상 두 갈래를 뭉개는 회귀를 잡는 형태로
  존재함을 확인했다.
- `metrics` 는 `@Optional()`(`idempotency.interceptor.ts:106`)이고, 미주입 시 fail-open 경로가
  죽지 않는 회귀 테스트(`idempotency.interceptor.spec.ts:1162-1178`)가 있음 — `MetricsModule`
  미배선 환경에서도 인터셉터 생성/동작이 깨지지 않는다.
- `recordRedisFailOpen(component: RedisFailOpenComponent, reason: RedisFailOpenReason)`
  (`business-metrics.service.ts:134-139`)이 리터럴 유니온으로 좁혀져 "닫힌 집합" docstring 주장이
  타입으로 강제됨을 확인 — 자매 `recordExecutionError` 의 런타임 클램핑과 다른 방식이지만 동등한
  방어 수준(컴파일 타임 vs 런타임)이라는 RESOLUTION.md 의 근거가 타당하다.

## 엣지 케이스 / 반환값 / 에러 시나리오

- 5개 경로 각각 독립 테스트(`it.each` 4건 + 직렬화 1건)로 커버되고, "미주입" · "정상 경로 미상승"
  캐너리도 있어 함수 전체 표면(정상/실패/미배선)이 빠짐없이 검증됨.
- `recordRedisFailOpen` 자체는 항상 `void` 를 반환(부수효과만) — 반환값 계약에 이상 없음.
- side_effect 리뷰가 이미 지적했듯 `Counter.add()` 호출이 try/catch 로 격리되지 않아 향후 OTel
  SDK 회귀 시 fail-open 경로 자체가 예외를 전파할 이론적 표면이 있으나, 인접 `logger.warn` 도
  동일하게 무방비인 기존 관례이고 OTel API 계약상 `add()` 는 던지지 않도록 설계돼 CRITICAL 로
  볼 근거가 없다(기존 라운드 INFO 유지, 새 지적 아님).

## TODO/FIXME

grep 결과 신규 소스 4개 파일에 `TODO|FIXME|HACK|XXX` 없음 — 미완성 표식 없음. `plan/complete/`
draft 의 "후속" 항목(다른 Redis fail-open 소비자 배선)은 명시적 비목표로 문서화된 것이지 숨겨진
미완성이 아니다.

## 관련 spec 본문 일치 여부 (spec fidelity)

- `spec/5-system/_product-overview.md` §NF-OB-07 표(83-88행 부근, 실제로는 88행)에
  `clemvion.redis.fail_open | Counter | component (idempotency), reason
  (get_failed/set_failed/serialize_failed/entry_corrupt/payload_corrupt) | ...` 행이 추가돼
  있고, 코드의 `RedisFailOpenComponent = 'idempotency'` · `RedisFailOpenReason` 5값과 문자열
  그대로 일치한다(line-level 대조 완료).
- `spec/data-flow/9-observability.md` L202-204 미러 문장에 "Redis fail-open 강등
  (`clemvion.redis.fail_open`)" 이 추가됐고, `## Rationale` 에 `component` 를 `idempotency` 하나로
  유지하는 근거(실측 grep 포함)가 별도 절로 기록돼 있다 — SoT(표)·미러(문장)·근거(Rationale)
  세 곳이 서로 어긋나지 않는다.
- `IdempotencyInterceptor` 클래스 docstring 의 fail-open 표(71-80행)는 "경로" 를 구조적 5행(row
  1 은 metrics 미대상인 생성자 null)으로 세는 반면, `RedisFailOpenReason` docstring(40행)은
  "다섯 경로에 1:1 대응" 이라 적어 같은 "다섯" 이라는 말이 서로 다른 것(5개 테이블 행 vs 5개
  reason 값, row 5 가 `entry_corrupt`+`payload_corrupt` 두 reason 을 한 행에 묶음)을 가리킨다.
  **기능적으로는 불일치가 없다** — 5개 reason 값이 정확히 5개의 실제 실패 상황에 대응하고,
  숫자 "5" 자체는 양쪽 다 맞다. 다만 두 "다섯" 을 같은 것으로 오독하기 쉽다는 점은 이미 직전
  라운드(`09_57_11` documentation.md)가 INFO(선택 사항)로 지적했고 이번에도 미반영 상태로 남아
  있다 — CRITICAL/WARNING 격상 근거 없음(반복 지적 아님, 재확인만).

## 비즈니스 로직

- Prometheus label cardinality 를 닫힌 집합으로 유지한다는 요구가 타입(컴파일 타임)으로 강제되고,
  현재 호출부 4곳 전부 상수/리터럴만 사용 — 문서화된 "닫힌 집합" 계약과 구현이 일치.
- `component` 를 `idempotency` 하나로 한정하고 다른 Redis fail-open 소비자(rate limiter 등)를
  의도적으로 미배선 상태로 둔 것은 `plan/complete/.../Rationale` 이 명시적 근거(실측 grep, "spec
  에 미리 적으면 문서가 구현보다 넓어진다")를 남겼고, cross-spec 검토(`09_36_31/cross_spec.md`)도
  다른 4개 영역 문서와 충돌 없음을 확인했다 — 의도된 스코프 축소이지 누락이 아니다.

## 발견사항

(신규 CRITICAL/WARNING 없음 — 이전 3개 라운드가 발견한 WARNING 5건은 전부 코드·spec·plan을
직접 열어 반영 확인했다.)

- **[INFO]** (반복 재확인, 조치 불요) `IdempotencyInterceptor` 클래스 docstring 의 fail-open 표에
  `reason` 라벨 매핑이 없어 "다섯 경로"(표 행 수)와 "다섯 reason"(유니온 값 수)의 대응 관계가
  코드를 직접 안 읽으면 명확하지 않다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스
    docstring 표 (71-80행 부근)
  - 상세: 위 "spec fidelity" 절 참고. 기능·spec 정합성에는 영향 없음 — 순수 문서 명료성 이슈이며
    `09_57_11` documentation 리뷰가 이미 선택 사항으로 표시한 것과 동일한 관찰이다.
  - 제안: 표에 `reason` 열을 추가하거나 5행 손상 행을 둘로 쪼개 표기(선택 사항, 이번에도 조치
    불요로 유지 가능).

## 요약

이번 changeset 의 핵심 요구사항(다섯 fail-open 경로 각각에 구분되는 `reason` 라벨로 OTel 카운터를
배선해 "비율·추세로 알람을 걸 수 있게" 한다)은 코드 4개 파일을 직접 열어 line-level 로 대조한
결과 완전히 구현돼 있다 — 5개 reason 값이 정확히 5개의 실제 fail-open 호출 지점에 1:1 매핑되고,
정상 경로 미상승·optional DI 안전성·손상 두 갈래 구분까지 전부 회귀 테스트로 고정돼 있다. spec
카탈로그(`_product-overview.md` §NF-OB-07)와 미러 문서(`data-flow/9-observability.md`)도 코드와
문자열 단위로 일치하며, `component`=`idempotency` 단독 스코프는 명시적 근거(실측 grep)를 갖춘
의도된 설계다. `plan/complete/` 이동도 rename 으로 깨끗이 추적되고 체크리스트 상태(frontmatter
`complete`, 본문 체크박스 전항목 `[x]`, 미완료 "후속" 항목은 별도 섹션에 명시적으로 열어 둠)가
실제 완료 범위와 정확히 일치한다. 신규 CRITICAL/WARNING 없음 — 유일한 잔여 관찰은 이미 두 차례
보고된 선택적 문서 명료성 INFO 하나뿐이다.

## 위험도

NONE
