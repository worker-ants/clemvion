STATUS=success rationale_continuity 완료 — CRITICAL 0 · WARNING 0 · INFO 2 (그중 1건은 기존에 이미 planner 인계 등재된 사전 갭)

# Rationale 연속성 검토 — EIA idempotency 캐시 손상 처리 하드닝

## 검토 범위

- target: `spec/data-flow/` (특히 `15-external-interaction.md` — EIA idempotency 캐시 관련)
- diff-base `origin/main...HEAD`: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
  `idempotency.interceptor.spec.ts` 만 변경 (spec/ 문서는 이 범위에서 무변경 — `git diff origin/main...HEAD -- spec/`
  결과 0건).
- 관련 spec Rationale 대조: `spec/data-flow/15-external-interaction.md` `## Rationale`(Fail-open 정책의 일관 표기),
  `spec/5-system/14-external-interaction-api.md` `## Rationale` R8(Idempotency-Key), R14 등.

## 발견사항

- **[INFO]** `data-flow/15` §2.2·§4 표의 "전 경로 fail-open (warn)" 문구가 실제 5경로 중 4경로에만 해당 — 이미 추적 중인 사전 갭
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표 (idempotency 캐시 행 인접, L302) 및
    §4 외부 의존 표 L352 "Redis | 내부 | blacklist · idempotency · seq · BullMQ. 전 경로 fail-open (warn) — 가용성 우선"
  - 과거 결정 출처: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` 클래스 docstring
    (이번 diff 로 "세 경로" → "다섯 경로" 로 정밀화, 그중 "경로 1(기동 시 미주입)은 warn 을 남기지 않는다"고 명시).
    `spec/data-flow/15-external-interaction.md` 의 "Redis … 전 경로 fail-open (warn)" 인용도 이 docstring 을 근거로 든다.
  - 상세: 코드 쪽 표는 이번 PR 로 5경로 중 4경로만 warn 한다는 것을 정확히 서술하게 됐지만, spec 문서의 요약 문구는
    여전히 "전 경로 warn" 으로 뭉뚱그려져 있어 spec이 코드보다 한 칸 넓다. 단, 이 diff 가 만든 drift 가 아니다 —
    이미 이전 라운드(`review/consistency/2026/08/12/23_48_39/rationale_continuity.md`)에서 INFO 로 지적됐고,
    developer 가 `spec/` 쓰기 권한 밖이라 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 planner 인계로
    정식 등재됐다(커밋 `dff218f17`). 이번 라운드(`22e68459d`~`c51809a0b`)의 후속 커밋들은 이 문구를 건드리지 않아
    갭이 그대로 남아 있을 뿐, 새로 벌어지거나 방치된 것은 아니다.
  - 제안: 별도 조치 불요(이미 등재됨). planner 가 해당 backlog 항목을 처리할 때 §2.2/§4 표 각주에 "구성 미주입(경로 1)은
    장애가 아니라 설정 상태라 warn 제외" 한 줄만 추가하면 닫힌다.

- **[INFO]** Rationale "Fail-open 정책의 일관 표기" 가 원인을 "Redis/DB 미가용" 으로만 서술 — "캐시 손상"(신규 5번째 경로)은 다른 원인 축인데 명시되지 않음
  - target 위치: `spec/data-flow/15-external-interaction.md` `## Rationale` § "Fail-open 정책의 일관 표기" (L375-389)
  - 과거 결정 출처: 동일 Rationale 절 — "토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB
    미가용 시 fail-open (기능 저하 + warn 로그) 이다."
  - 상세: 이번 diff 가 `idempotency.interceptor.ts` 에 추가한 5번째 fail-open 경로("캐시 엔트리·payload 손상")는
    Redis 자체는 가용하지만 저장된 값이 손상된 경우다 — 기존 Rationale 프로즈가 열거하는 "Redis/DB 미가용" 과는
    별개의 원인 축이다. 동작(요청은 살리고 warn 남김)과 잔여 위험(멱등성 저하 → 다운스트림 중복 실행 가능)은
    기존 Rationale 이 이미 서술한 것과 완전히 동형이라 **원칙 위반은 아니다** — 다만 원인 목록이 코드의 새 실패
    형태를 아직 포함하지 않아 문서가 코드보다 한 걸음 뒤처져 있다.
  - 제안: 위 항목과 같은 절이므로 함께 정리 가능. "Redis/DB 미가용" 뒤에 "및 캐시 엔트리 자체의 손상(문법·형태 불일치)"
    을 병기하면 이번 diff 가 추가한 새 실패 형태까지 Rationale 이 포괄한다. CRITICAL/WARNING 대상은 아니다 — 새
    동작이 기존에 선언된 fail-open 원칙·잔여위험 서술과 정확히 같은 형태이기 때문이다.

## 원칙 정합성 확인 (위반 없음, 근거 기록)

diff 가 건드린 로직을 R8·EIA-RL-02·기존 Rationale 대비 개별 대조한 결과, 아래는 전부 **일치** — 별도 발견사항 아님:

- **닫힌 캐시 대상 목록(2xx·409·410) 불변**: `isErrorStatusCacheable()` 은 diff 로 손대지 않았고 여전히
  `statusCode === 409 || statusCode === 410` 명시 비교 — R8 이 금지한 "단일 비교로 축약"(`>= 400` 등) 재도입 없음.
- **fail-open = "멱등성 포기 + 요청 통과"**: 신규 `discardCorruptEntry()` 는 손상 엔트리를 버리고 `processFresh()`
  (다운스트림 재실행)로 넘어간다 — 이는 R8 Rationale 이 명시한 "이 인터셉터의 다른 실패 경로(Redis 미주입·GET/SET
  실패·직렬화 실패)가 모두 '멱등성을 포기하고 요청은 통과' 인 것과 일관된다" 원칙을 그대로 확장한 것이지 새 Rationale
  없이 뒤집은 결정이 아니다.
  - `dfnew`: bodyHash 판정을 payload 파싱보다 **먼저** 두도록 순서를 바꾼 것도 R8 이 보장하려는 "같은 키+다른 body →
    409" 를 손상 상태에서도 지키기 위함이라 R8 취지 강화 방향.
- **캐시 키 스코프(execution+route)**: 이번 diff 는 `redisKey` 산출 로직을 건드리지 않았다 — R8 "캐시 키 스코프"
  결정(및 그 폐기된 대안: 헤더 값 단독 키·토큰 jti 스코프·전역 fallback)은 이 diff 범위 밖이며 이미 `origin/main`
  (커밋 `8a2d13031`)에 반영돼 있다.
- **§R14(토큰 검증 401 통일)·§R10(단일 sink)**: 이번 diff 와 무관 — 손대지 않음.

## 요약

이번 diff 는 EIA idempotency 캐시(`Idempotency-Key`, §R8)의 **손상 처리**만 하드닝한다 — 캐시 스코프·닫힌 상태코드
목록·fail-open 원칙 등 R8/R14/R10 이 확정한 결정 어느 것도 재도입·번복·우회하지 않았고, 오히려 "손상돼도 요청은
살리고 warn 을 남긴다"는 기존 Rationale 원칙을 놓치고 있던 두 자리(안쪽 payload 파싱, 형태 검증)에 정확히 맞춰
확장했다. 유일한 잔여 이슈는 spec 문서 표현이 코드보다 한 칸 거친 두 자리(§2.2/§4 표의 "전 경로 warn" 요약,
Fail-open Rationale 의 원인 열거)이며, 전자는 이미 이전 라운드에서 발견돼 developer 권한 밖으로 planner
backlog(`plan/in-progress/backend-lint-gate-broken-on-main.md`)에 정식 등재된 상태다. 둘 다 CRITICAL/WARNING 급
결정 충돌이 아니라 문서 정합 보완 수준이다.

## 위험도
LOW
