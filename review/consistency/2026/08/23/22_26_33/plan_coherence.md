# Plan 정합성 검토 — spec/5-system/14-external-interaction-api.md (`--impl-prep`)

## 발견사항

- **[WARNING]** `NODE_OUTPUT_ALLOWED_KEYS` "wire 전용" 그룹에 4키를 더 추가하면서, 같은 그룹을 대상으로 이미 등재된 convention_compliance 미해결 항목("4키")을 갱신하지 않는다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 하단 `NODE_OUTPUT_ALLOWED_KEYS` 서술(allowlist 집합 = 핸들러 공개 키 + wire 전용 키) — 실제 소스는 `codebase/backend/src/shared/utils/node-output-allowlist.ts`
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미체크 항목 **"wire-only 4키가 `node-output.md` Principle 0 의 닫힌 레지스트리 밖이다"** (2026-08-23 등재, `20_09_38` convention_compliance W3) — `formConfig`·`conversationConfig`·`buttonConfig`·`interactionType` **네 키**만 열거하며 "planner 소관: Principle 0 에 각주를 다는 편이 낫다"고 미해결 상태로 남아 있다.
    - `plan/in-progress/sse-nodeoutput-allowlist.md` — 같은 `NODE_OUTPUT_ALLOWED_KEYS` "wire 전용" 그룹에 `payload`·`title`·`rendered`·`nodeType` **4키를 추가**한다(작업 항목 2번째: "NODE_OUTPUT_ALLOWED_KEYS 에 chat-channel wire 4키 추가"). 실제로 이미 코드에 반영돼 있다(`git diff` 로 확인, 미커밋) — `node-output-allowlist.ts` 주석이 스스로 "표면별로 목록을 가르지 않는다... 이 넷도 §R17 이 정의한 '렌더에 필요한 키'"라 적어, 기존 4키와 **같은 성격·같은 그룹**임을 인정한다.
  - 상세: convention_compliance 미해결 항목은 "wire-only 4키가 `NodeHandlerOutput` 닫힌 레지스트리 밖"이라는 사실을 planner 결정 대상으로 지목하며 **정확히 4개**를 열거한다. 이 SSE 플랜이 완료되면 같은 wire-only 그룹이 **8개**로 늘어나는데, 두 plan 문서 어디에도 서로에 대한 참조가 없다. 결과적으로 (a) convention_compliance 항목의 "4키" 서술이 착수 시점부터 stale 이 되고, (b) 장차 planner 가 Principle 0 각주를 작성할 때 이 SSE plan 이 늘린 4키를 놓칠 위험이 있다 — 이 저장소가 반복 지적해 온 "적용 범위는 총칭이 아니라 열거다"·"미러 한쪽만 고친다" 패턴과 같은 형태다.
  - 제안: `sse-nodeoutput-allowlist.md` 작업 목록에 "convention_compliance 미해결 항목(`20_09_38` W3)의 키 열거를 4→8로 갱신 또는 상호 참조 추가" 를 넣거나, 최소한 완료 시 그 항목의 "4키" 문구를 8키로 정정하는 후속 커밋을 남길 것. planner 턴에서 Principle 0 각주를 쓸 때는 반드시 이 시점의 실제 wire-only 키 전량(8개)을 재실측할 것.

- **[INFO]** `node-output-allowlist.ts` 재배치 후속 항목이 "이 SSE 작업과 함께 정하라"고 명시했는데 plan 작업 목록에 반영이 없다
  - target 위치: 해당 파일 자체는 target 문서 밖(코드)이나, 그 배치 근거는 §R17 서술과 직결
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md` 의 **"`node-output-allowlist.ts` 를 `shared/utils/` 밖으로 재배치"** (2026-08-23 등재, `19_24_24` architecture INFO 1) — "위 SSE 항목이 소비처를 하나 늘리므로 **그 작업과 함께 정하는 편이 낫다** — 소비처가 둘이 되면 배치 답이 달라진다"고 명시적으로 이번 SSE plan 과 묶어 판단하라 지시한다.
  - 상세: `sse-nodeoutput-allowlist.md`의 작업 목록(9개 항목)에는 이 재배치 결정(수행이든 명시적 defer 든)이 전혀 등장하지 않는다. 소비처가 실제로 하나(`getStatus`)에서 둘(`getStatus` + `toFanoutEnvelope`/`external-interaction` 모듈)로 늘어나는 것은 이번 plan 이 정확히 만드는 변화이므로, 그 순간이 "재배치 여부 판단"의 적기라고 트래커 스스로 못박아 뒀다.
  - 제안: INFO 등급이라 완료 차단 사유는 아니지만, `sse-nodeoutput-allowlist.md`에 "재배치는 이번 라운드에 안 한다(사유)" 한 줄이라도 남겨 트래커 항목의 "함께 정하라" 지시에 응답할 것 — 안 그러면 다음 세션이 이 판단 근거(소비처 카운트)를 다시 조사해야 한다.

- **[INFO]** (정합 확인, 결함 아님) SSE/fanout 잔여 항목의 cross-plan 참조는 이미 정합하다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 표 마지막 행("SSE/fanout emit ... deny-list 유지(잔여)")
  - 관련 plan: `spec-sync-external-interaction-api-gaps.md`("SSE/fanout 의 `nodeOutput` 은 여전히 fail-open deny-list다") ↔ `sse-nodeoutput-allowlist.md` ↔ `spec-draft-eia-62-waiting-payload.md`(§(7) 불릿의 2026-08-23 addendum: "부분 종결이다 — ... SSE·fanout 은 잔여로 정본 트래커에 별도 항목이 서 있다. §R17 의 범위 표가 그 셋의 SoT")
  - 상세: 세 문서가 서로 참조하며 "§R17 표가 SoT"라는 단일 진실을 일관되게 가리키고 있다. `sse-nodeoutput-allowlist.md`의 마지막 작업 항목("(planner 턴) §R17 표의 SSE 행 flip")도 developer 권한(spec 쓰기 불가) 경계를 정확히 지킨다. 이 축에는 미해결 결정 충돌이나 선행조건 미해소가 없다.

## 요약

target(`spec/5-system/14-external-interaction-api.md`)과 활성 작업 plan(`sse-nodeoutput-allowlist.md`)의 핵심 축 — §R17 표의 "SSE/fanout 잔여" 항목 flip, `getStatus` allowlist 와의 역할 분리, planner-턴 분리 — 은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 및 인접 plan(`spec-draft-eia-62-waiting-payload.md`)과 정합하며 미해결 결정을 우회하는 부분은 없다. 다만 이 plan 이 건드리는 `NODE_OUTPUT_ALLOWED_KEYS` "wire 전용" 그룹은 같은 트래커의 **다른 두 미해결 항목**(convention_compliance 의 "4키가 Principle 0 밖" 열거, architecture 의 "재배치는 이 작업과 함께 정하라")과 직접 맞닿아 있는데 plan 작업 목록이 그 둘을 언급하지 않아 완료 후 트래커 drift(4→8 키 미갱신)가 발생할 소지가 있다. CRITICAL 은 없다.

## 위험도
LOW
