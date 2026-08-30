# Plan 정합성 검토 — spec-draft-followups-drain-2026-08-30.md

## 검토 방법

target 4건(§1 statusCode Rationale, §2 Redis 각주, §3 egress-masking 캐비엇 회수 +
`ws-event-types-extract.md` 이동, §4 EventType 명명 규칙)을 각각의 근거 plan 원문과
대조했다. 특히 `plan/in-progress/ws-event-types-extract.md`(전문, 522줄),
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(해당 4개 트래커 항목 전문),
`plan/in-progress/backend-lint-gate-broken-on-main.md`(§R8 문장의 실제 작성 경위),
`spec/conventions/egress-masking.md`·`spec/data-flow/15-external-interaction.md`·
`spec/5-system/4-execution-engine.md §9`·`spec/conventions/redis-keys.md §3` 원문을 직접
읽어 실측 대조했다(생략 파일 목록에 있던 것도 전부 Read).

## 발견사항

- **[WARNING]** §1·§2 가 해소하는 트래커 항목 두 개가 그대로 **미체크로 남는다**
  - target 위치: §1 (전체), §2 (전체)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1949`
    (`- [ ] **14-external-interaction-api.md:1264 의 "값 범위는 아직 보지 않는 선재 갭" 문장을
    완료형으로 정정**`) 및 `:1988`
    (`- [ ] **§4 외부 의존 표의 Redis 행 각주 … 를 명확화하거나 §2.2 참조로 통합**`)
  - 상세: 두 항목 모두 target §1·§2 가 지금 처리하려는 것과 **글자 그대로 같은 결함**이고
    (실측표까지 동일 — `4b1f899b7`/`1e9f3f238` 순서, `redis-keys.md` 미등재 오독), 두 항목이
    바로 이 draft 착수의 근거다. 그런데 target 본문 어디에도 이 두 체크박스를 **같은 PR 에서
    닫는다**는 지시가 없다 — §3 은 `ws-event-types-extract.md → complete/` 이동과
    `spec-sync-external-interaction-api-gaps.md:1386` 링크 갱신을 명시하는데(정확히 이 패턴을
    잘 처리함), §1·§2 는 그 짝이 빠졌다. 이 저장소가 같은 트래커 안에서 이미 자기 관측으로
    기록한 위험이 정확히 이것이다 — *"트래커 항목은 **자기를 닫은 PR 이 자기 이름을 부르지
    않으면** 영영 미체크로 남는다"* (`spec-sync-external-interaction-api-gaps.md:2036` 부근,
    2026-08-29 재판정 절). 이 draft 의 PR 은 title/diff 에 그 트래커 파일을 안 건드릴 가능성이
    높아, 두 항목은 **이미 존재하지 않는 갭을 계속 가리키는 죽은 참조**로 남는다.
  - 제안: target §1·§2 각각에 "동시에 `spec-sync-external-interaction-api-gaps.md:1949`/`:1988`
    를 `[x]` 로 닫고 처분 결과(§1: planner 턴 채택 + 취소선 미사용 근거, §2: 주어 명시로 해소)를
    한 줄 남긴다" 를 §3 과 같은 톤으로 추가해야 한다.

- **[WARNING]** §2 의 재작성문이 여전히 "표 없는 절" 을 "그 표" 로 가리킨다
  - target 위치: §2 변경안 두 번째 문장 — `[실행 엔진 §9.1](../5-system/4-execution-engine.md#91-키-패턴)
    의 표는 엔진이 소유한 키 전용이라…`
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1988`
    (같은 항목이 이미 "실제로는 `4-execution-engine.md §9.2`(엔진 소유 키 전용 표) 기준
    서술" 이라고 명시적으로 진단했다)
  - 상세: `spec/5-system/4-execution-engine.md` §9.1(`키 패턴`)은 **표가 없는 산문**이다 —
    "Redis 키 형태 규칙과 저장소 전역 인벤토리의 SoT 는 `conventions/redis-keys.md`" 라고만
    말하고 "아래 §9.2 는 실행 엔진이 소유하는 키만 다룬다" 로 §9.2 를 가리킨다. 실제 `키 패턴 |
    용도 | TTL` 표는 **§9.2**(`spec/5-system/4-execution-engine.md:1159` `### 9.2 용도별 키 정의
    및 TTL`)에 있다. 같은 spec 파일의 §R8 Rationale 도 이 구분을 지켜 `exec:seq:<executionId>`
    선례를 `[실행 엔진 §9.2](./4-execution-engine.md#92-용도별-키-정의-및-ttl)` 로 정확히
    인용한다(`14-external-interaction-api.md:1266`). target §2 변경안만 "§9.1 의 표" 라고 써서
    표가 없는 절을 표가 있는 절처럼 인용한다 — 이 draft 가 고치려는 바로 그 "주어를 생략한
    부재 서술" 결함과 같은 종류의 정밀도 문제를 새 문장에 다시 심는 모양이 된다. (내용상
    결론 — EIA 계열 키가 엔진 표에 없다는 것 — 은 §9.1 이든 §9.2 든 참이라 사실관계 오류는
    아니지만, 인용 앵커는 §9.2 여야 "그 표" 가 가리키는 대상이 맞는다.)
  - 제안: 앵커를 `#91-키-패턴` → `#92-용도별-키-정의-및-ttl` 로, 절 번호를 §9.1 → §9.2 로
    바꾸거나, "§9.1(SoT 포인터)·§9.2(용도별 정의 표) 모두" 로 명시해 "표" 가 실제로 있는
    절을 가리키게 한다.

## 교차 검증 결과 (문제 없음 — 참고용)

- §3 의 핵심 전제 — *"`ws-event-types-extract.md` 완료 이동이 `egress-masking.md:89` 캐비엇에
  막혀 있다"* — 는 `ws-event-types-extract.md` 체크리스트의 마지막 미체크 항목(2026-08-29
  추가분) 원문과 **완전히 일치**한다. `spec_impact` 7개 파일 목록·`spec-sync…:1386` 형제
  링크·"`plan/complete/` 4건은 옛 경로 유지" 주장도 실측(`grep -rln
  "ws-event-types-extract" spec/ plan/`)으로 전수 확인했다 — complete/ 4건 + egress-masking.md
  + 자기 자신 + 이 draft 자신 + spec-sync 문서, 정확히 target 이 말한 구성이다.
- §1 의 커밋 계보(`4b1f899b7` 가 `1e9f3f238` 의 선조)도 `backend-lint-gate-broken-on-main.md:768-786`
  에서 **그 문장을 실제로 쓴 planner 턴(`eia-failopen-wording`, 2026-08-13)의 1차 기록**을
  찾아 대조했다 — 그 턴이 작업하던 **로컬 브랜치**에는 그 시점 `#1159`(값 범위 검사)가
  머지돼 있지 않아 "선재 갭" 표현이 **그 브랜치 기준으로는 작성 당시 참**이었는데, main 으로
  머지되는 순서(`#1159` 먼저)가 그걸 거짓으로 만들었다는 target 의 설명과 정합한다. 이 부분은
  단순 낡음이 아니라 "병렬 PR 상태 혼동" 이라는, 그 plan 문서가 이미 스스로 기록한 교훈과도
  일치해 신뢰도가 높다.
- §4 의 "기각한 대안" 근거 `#1194`(`bdcfdc514`, "egress 마스킹 좌표계를 정식 규약으로 승격")도
  실제 커밋이며, `egress-masking.md` 자체의 `## Rationale`(`왜 이 문서를 신설했나`)이 "신설이
  자동으로 옳지 않았다" 를 그대로 담고 있어 target 의 인용이 지어낸 선례가 아님을 확인했다.
- `spec/conventions/`·`plan/in-progress/**` 전수 grep(`EventType`, `statusCode`,
  `redis-keys`, `egress-masking`) 으로 target 의 4개 변경과 충돌하는 별도의 "결정 필요" 표류
  항목은 없음을 확인했다. `spec-draft-eia-62-waiting-payload.md`·
  `spec-draft-eia-notification-payload-contract.md` 가 같은 두 spec 파일
  (`14-external-interaction-api.md`·`6-websocket-protocol.md`)을 건드리지만 편집 위치(§4.4
  llmCalls strip-only 결정, §6 도입부)가 target 의 §R8/EventType 명명 위치와 겹치지 않는다.

## 요약

target 의 4건 중 §3(egress-masking 캐비엇 회수 + `ws-event-types-extract.md` 이동)·§4(EventType
명명 Rationale 추가)는 근거 plan(`ws-event-types-extract.md`)의 미체크 항목이 요구하는 것과
문면까지 정확히 일치해 즉시 집행 가능한 수준이다. §1(statusCode)·§2(Redis 각주)도 사실관계는
`spec-sync-external-interaction-api-gaps.md`·`backend-lint-gate-broken-on-main.md` 원문과
교차 검증되어 신뢰할 수 있으나, 두 가지가 빠져 있다 — (a) 두 항목의 **원 출처 트래커
체크박스를 같은 PR 에서 닫는다는 지시가 없어** 이 저장소가 이미 겪은 "죽은 트래커 항목" 패턴을
재발시킬 위험이 있고, (b) §2 재작성문이 "표" 를 가리키는 앵커를 여전히 표가 없는 §9.1 로 남겨
둔다. 둘 다 WARNING 급이며 CRITICAL 급 결정 우회나 선행 plan 미해소는 발견되지 않았다.

## 위험도

MEDIUM
