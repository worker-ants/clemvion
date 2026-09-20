# Rationale 연속성 검토 — `spec/2-navigation` (rotate lost-update, --impl-prep)

## 스코프 정정

프롬프트가 지정한 target(`spec/2-navigation`, 18개 파일 예산 초과 생략)만으로는 판정할 수 없어
다음을 `Read`로 직접 열었다: `spec/2-navigation/4-integration.md`(§9 API·§Rationale 전문),
`plan/in-progress/rotate-lost-update.md`(체크 대상 실제 설계), `plan/complete/spec-draft-rotate-conflict.md`
(철회된 선행안), `plan/complete/trigger-config-lost-update.md`(인용된 선례),
`codebase/backend/src/modules/integrations/integration-oauth.service.ts`(CONC H-3 실제 코드),
`codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()`(현행 구현).

이번 `--impl-prep` 호출의 실질 target은 `spec/2-navigation` 디렉터리 자체가 아니라, 그 스코프 안에서
구현을 시작하려는 `plan/in-progress/rotate-lost-update.md`의 설계(§B: 외부 호출은 락 밖, 락 안에서
재읽기)다. 이 설계가 같은 파일(`4-integration.md`)의 `## Rationale`이 이미 내린 결정들과 정합하는지를 본다.

## 발견사항

- **[WARNING]** 인접 Rationale(advisory lock 기각)과의 구분을 명시하지 않음
  - target 위치: `plan/in-progress/rotate-lost-update.md` §B "처방 — 외부 호출은 락 밖, 락 안에서 다시 읽어 머지"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` → "BullMQ `cafe24-token-refresh` 큐 —
    멀티 인스턴스 race 해소" 의 "검토 후 배제한 대안" 항 — *"PostgreSQL advisory lock
    (`pg_advisory_xact_lock(hashtext(integrationId))`): 코드 단순하지만 lock 보유 중 HTTP 요청(Cafe24
    endpoint)을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고 …"* 라며 **같은 파일 안에서** DB
    락과 외부 HTTP 호출을 한 트랜잭션에 묶는 설계를 명시적으로 기각한 바 있다.
  - 상세: 이 plan이 채택한 설계(`dataSource.transaction` + `lock: { mode: 'pessimistic_write' }`,
    연결 테스트는 락 **밖**)는 실제로는 그 기각 사유("락 보유 중 HTTP 요청을 트랜잭션 안에 묶는다")를
    피해 가는 **다른** 설계다 — row-level pessimistic lock이고 외부 호출은 트랜잭션 밖에 있다.
    따라서 재도입은 아니다. 다만 같은 문서 안에 "advisory/DB 락 + 외부 호출 = 기각" 이라는 문장이
    이미 있는 상태에서, 새 설계가 "DB 락 + (락 밖) 외부 호출"이라는 것을 **명시적으로 대조**하지
    않으면 다음 독자(또는 후속 리뷰어)가 두 설계를 같은 것으로 오인해 "기각된 대안의 재도입"으로
    잘못 플래그할 위험이 있다. 이 저장소는 정확히 이 위험을 이미 한 번 문서화된 관행으로 대응한
    적이 있다 — 인용된 선례 `trigger-config-lost-update.md`의 "반대 선례와의 대조 — advisory lock 은
    이미 한 번 기각됐다" 절이 바로 이 `4-integration.md`의 같은 기각 문구를 인용하며 *"그 사유가
    정확히 이 설계가 지키는 제약이다 … 기각된 대안의 재도입이 아니라 그 반론을 받은 설계임을
    커밋·PR에 적는다"* 라고 못박았고, 그 절 자체가 *"`--impl-prep` rationale_continuity INFO#3 ·
    plan_coherence INFO#7 이 같은 대조를 권고"* 했다고 기록한다 — 즉 이 리뷰어 역할이 동일 클래스의
    설계 변경에서 이미 한 번 이 비교를 요구한 선례가 있다. 현재 plan은 같은 파일(`4-integration.md`)의
    같은 기각 문구를 대상으로 하면서도 이 비교를 적지 않았다.
  - 제안: 구현 시 `IntegrationsService.rotate()`의 락 블록 주석(또는 이 plan의 §B)에
    "`4-integration.md`의 cafe24 advisory-lock 기각과 다른 이유 — row-level `pessimistic_write`이고
    연결 테스트는 트랜잭션 밖에 있다"는 한 줄을 명시한다. `spec_impact: none`을 유지하려면(즉 spec
    파일은 건드리지 않으려면) 이 대조는 스펙이 아니라 **코드 주석 + plan 본문**에만 적어도 된다 —
    실제로 이 plan이 근거로 삼는 CONC H-3 자체도 스펙에는 없고 코드 주석에만 있다(아래 요약 참고).

- **[INFO]** 락 대기 상한(lock_timeout) 미검토
  - target 위치: `plan/in-progress/rotate-lost-update.md` §B 다이어그램 ("[락 안] transaction + SELECT … FOR UPDATE")
  - 과거 결정 출처: `plan/complete/trigger-config-lost-update.md` "5라운드 리뷰 처분" W2 — *"`remove()` 가
    되돌릴 수 없는 정리 뒤에 무한 대기를 신설했다"* → `SET LOCAL lock_timeout = 5000ms` 로 수정한 선례.
  - 상세: 이 저장소는 이미 한 번 "row lock을 새로 잡는 설계는 무한 대기 가능성을 검토해야 한다"는
    교훈을 명문화했다. 다만 그 결함은 "삭제(되돌릴 수 없는 정리) **뒤**의 락 대기"에 특유했고, 이
    plan이 인용하는 더 가까운 선례(CONC H-3, `integration-oauth.service.ts`)는 동일한
    `pessimistic_write` 패턴을 lock_timeout 없이 이미 프로덕션에 두고 있다 — 그래서 이 plan이 CONC
    H-3을 그대로 따르는 것 자체는 기존 코드와 정합적이며 새로운 원칙 위반은 아니다. 다만 두 개의
    서로 다른 선례(CONC H-3=무제한 대기 허용, trigger-config=명시적 타임아웃)가 공존하는 상태에서
    이 plan이 어느 쪽을 따르는지 결정을 적지 않았다.
  - 제안: 구현 단계에서 "무제한 대기 허용(CONC H-3과 동일 리스크 계급)"인지 "타임아웃 추가"인지
    한 줄로 결정하고 근거를 남긴다. 필수 차단 사유는 아니다.

## 정합 확인 (참고 — 위반 없음)

- §B의 "외부 호출은 락 밖, 락 안에서 재읽기" 구조는 `trigger-config-lost-update.md`가 일반화한 처방
  및 `integration-oauth.service.ts` CONC H-3 코드 주석(2026-05-16, 실측 확인됨 — 인용이 정확하다)과
  형태·근거가 일치한다.
- §B "부분 `update`는 유지한다"는 `integrations.service.ts` `rotate()`의 기존 코드 주석
  (`:1131-1136`, "엔티티 전체를 save하면 logUsage가 원자적으로 쓴 lastUsedAt을 되돌린다")이 실제로
  존재함을 확인했다 — 근거 날조 없음.
- §C의 철회 근거(3가지: `status: implemented` 하향 문제, 선례 미검토, "범용 conflict 코드 없음"의
  과잉 일반화)는 `spec/5-system/2-api-convention.md §5.3`의 409 기본값(`RESOURCE_CONFLICT`)과
  `error-handling.md`의 `WORKFLOW_VERSION_CONFLICT` 선례 존재를 정확히 반영한다.
- `spec_impact: none` 결정은 이 plan이 직접 선례로 드는 CONC H-3 — 동일 클래스의 락 기반 lost-update
  수정이면서 스펙 Rationale에 전혀 등재되지 않고 코드 주석에만 남은 사례 — 와 대칭이라 근거가 있다.
  (반대로 "BullMQ cafe24-token-refresh 큐"·"reactive_401 jobId unique화"는 스펙에 등재됐지만, 그
  결정들은 큐 dedup·재시도 정책처럼 **운영 관측 가능한 외부 동작**이 바뀐 경우였고, rotate 쪽은
  §9.2/§9.4에 이미 적힌 "테스트 → 성공 시만 커밋" 계약이 문자 그대로 유지된다는 점에서 구분된다.)
- §D(권한 재확인)는 기존 §8 권한 표·감사 로그 서술과 충돌하지 않으며, `trigger-config-lost-update.md`가
  확립한 "게이트는 락 안에서 재계산한다"는 원칙을 오히려 강화하는 방향이다.

## 요약

target(`spec/2-navigation/4-integration.md`)의 `## Rationale`이 이미 여러 차례 "동시성·락 설계"에
대한 결정(§CONC 계열, BullMQ 큐, advisory lock 기각, reactive_401 jobId unique화)을 쌓아 온 영역에서,
`rotate-lost-update.md`가 제안하는 처방(외부 호출은 락 밖 + 락 안 재읽기, row-level `pessimistic_write`)은
기각된 대안(advisory lock을 외부 호출과 한 트랜잭션에 묶는 설계)을 실제로 재도입하지 않으며, 인용한
선례(CONC H-3, trigger-config-lost-update)도 실측상 정확하다. 다만 같은 문서 안에 있는 "advisory lock
기각" 문구와 표면적으로 닮은 설계를 도입하면서도 그 구분을 명시적으로 적지 않은 점은, 이 저장소가
동일 클래스 상황에서 이미 한 번 명시를 권고받아 대응한 선례(trigger-config-lost-update의 "반대
선례와의 대조" 절)가 있다는 점에서 재발 방지 차원의 보완이 필요하다. `spec_impact: none` 결정과
409 미도입 결정은 근거가 충분하고 선례와 정합한다.

## 위험도

LOW
