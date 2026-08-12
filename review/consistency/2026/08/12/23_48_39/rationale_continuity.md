# Rationale 연속성 검토 — spec/data-flow/ (eia-r8-cache-scope)

## 검토 범위

- target: `spec/data-flow/`(전체 번들, 특히 `15-external-interaction.md`)
- 구현 diff: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` +
  `idempotency.interceptor.spec.ts` (origin/main...HEAD)
- 대조 Rationale: `spec/5-system/14-external-interaction-api.md` §R8("Idempotency-Key 와
  `submit_form` 검증 실패의 관계" — 특히 "캐시 키 스코프" 소절), `spec/data-flow/15-external-interaction.md`
  자체 Rationale("Fail-open 정책의 일관 표기")

## 발견사항

- **[INFO]** Fail-open 5-경로/4-warn 세분화가 data-flow 문서의 "일괄 warn" 서술과 결이 다름
  - target 위치: `spec/data-flow/15-external-interaction.md` §2.2 Redis/BullMQ 표의
    `interaction:idempotency:...` 행, 및 하단 Rationale "Fail-open 정책의 일관 표기"
    ("토큰 blacklist·idempotency·jti 추적·notification enqueue 모두 Redis/DB 미가용 시
    **fail-open** (기능 저하 + warn 로그) 이다")
  - 과거 결정 출처: 같은 문서 자신의 Rationale (위 인용) — "모두 … warn 로그" 로 뭉뚱그려 서술
  - 상세: diff 된 `idempotency.interceptor.ts` JSDoc 은 fail-open 경로를 5가지로 세분하고,
    그중 "경로 1: 기동 시 미주입(생성자 `null`)" 은 의도적으로 warn 을 **남기지 않는다**
    ("설정 상태이지 장애가 아니다"). 이것이 기존 문서가 말하는 "Redis/DB 미가용" 시나리오와
    카테고리가 다르다는 코드 주석의 구분은 타당하지만, target 문서의 "모두 … warn 로그" 라는
    표현만 보면 이 예외가 빠진 것처럼 읽혀 두 문서 사이에 미묘한 어긋남이 생긴다. 이는 기각된
    결정의 재도입이나 원칙 위반이 아니라 — 오히려 기존 Rationale 이 요구하는 "fail-open + warn"
    을 실제로 **더 정확히 충족**시키는 방향의 변경(조회 실패·손상 엔트리에도 새로 warn 을 추가)
    이다. 다만 "미주입은 warn 안 함" 이라는 세분화가 spec 문서에는 아직 반영돼 있지 않다.
  - 제안: 필수 아님(코드 주석이 이미 근거를 명시). 원한다면 §2.2 표 각주나 Rationale 문단에
    "구성 미주입(기동 시 null)은 장애가 아니므로 warn 제외" 한 줄만 추가해 두 문서의 표현
    granularity 를 맞추는 것으로 충분 — 새 Rationale 항목 신설까지는 불필요.

- **[없음]** `bodyHash` 판정을 `responseJson` 파싱보다 앞에 두는 순서 변경(및 `discardCorruptEntry`
  로의 통합)은 [Spec EIA §R8](../spec/5-system/14-external-interaction-api.md) 의 "캐시 대상은
  닫힌 목록이다" / "캐시 키 스코프" 결정과 충돌하지 않는다 — 무엇을 캐시하는지(닫힌 목록)·어디에
  캐시하는지(executionId+route 스코프) 는 이 diff 가 손대지 않았고, 손상된 엔트리를 신규 처리로
  강등하며 가시성(warn)을 추가하는 것은 기존 "전 경로 fail-open" 원칙의 **결손 보완**이지 번복이
  아니다. 종전 "안쪽 `responseJson` 파싱 실패 시 500 마스킹" 은 어떤 spec Rationale 도 의도한
  적이 없는 순수 버그였고, 이번 수정은 그 갭을 fail-open 원칙에 맞춰 닫은 것으로 별도의 신규
  Rationale 이 필요한 "결정 번복"에 해당하지 않는다.

## 요약

이번 diff(`idempotency.interceptor.ts`/`.spec.ts`)는 spec/data-flow/15-external-interaction.md 와
그 배경 근거인 [Spec EIA §R8](../spec/5-system/14-external-interaction-api.md)의 기존 Rationale —
"캐시 대상 닫힌 목록", "캐시 키는 executionId+route 스코프", "Redis/DB 미가용 시 fail-open(+warn)" —
를 재도입·번복·우회하지 않는다. 변경은 이 원칙들을 그대로 유지한 채 (a) 손상된 캐시 엔트리·payload
경로에도 warn 가시성을 추가하고 (b) `bodyHash` 판정 순서를 payload 파싱보다 앞으로 당겨 `409`
판정이 손상에 의해 무력화되는 것을 막는 버그 수정이며, 두 변경 모두 diff 자체의 JSDoc/테스트
주석에 근거가 충분히 기록돼 있다. spec 문서(target) 자체는 이번 diff 에서 변경되지 않았고, 코드와
문서 사이에 남는 것은 "fail-open 경로 세분화(경로 1 은 warn 제외)" 를 문서가 아직 그 결의 세밀도로
반영하지 않았다는 정도의 표현 격차뿐이며 이는 새 Rationale 을 요구하는 결정 번복이 아니다.

## 위험도

LOW
