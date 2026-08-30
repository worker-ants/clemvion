# Rationale 연속성 검토 — `spec-draft-followups-drain-2026-08-30.md`

## 조사 방법

프롬프트에 조립된 관련 Rationale 번들은 예산 초과로 이번 target 이 직접 건드리는 3개 파일
(`spec/5-system/14-external-interaction-api.md` §R8, `spec/5-system/6-websocket-protocol.md`
Rationale, `spec/conventions/egress-masking.md`)의 본문이 **모두 생략**돼 있었다. 이 상태로는
정확한 연속성 판정이 불가능하므로, 세 파일 + `spec/data-flow/15-external-interaction.md` 를
저장소에서 직접 `Read`/`grep` 하고, target 이 인용하는 커밋(`4b1f899b7`/`1e9f3f238`)·PR
(`#1159`/`#1162`/`#1188~#1191`/`#1194`/`#1238`)·소스 라인(`terminal-error-payload.ts`,
`idempotency.interceptor.ts` 호출부 5곳)을 전수 대조했다.

## 발견사항

- **[WARNING] §1 의 replacement 가 spec 이 확립해 둔 "정정에는 실측 근거를 인라인으로 남긴다" 관행에서 벗어난다**
  - target 위치: §1 "변경안" 블록 (`plan/in-progress/spec-draft-followups-drain-2026-08-30.md:73-81`)
  - 과거 결정 출처: (a) 같은 문제를 먼저 등재한 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1979-1984`
    ("소정정으로 갈 경우 원문을 취소선으로 남기고 위 실측표를 함께 실어야 하며…") · (b) 이 저장소
    Rationale 섹션 전반의 확립된 정정 패턴 — `spec/conventions/node-cancellation.md` §"왜 취소 시각
    보존 메커니즘이 두 가지인가"(취소선 + 실측 경위 인라인 보존) · `spec/conventions/egress-masking.md`
    §3 "그 예고는 틀렸다 — 집행하고 실측하니…" 블록(실측표·근거 인라인 보존) · `spec/5-system/4-execution-engine.md`
    §"C-1 god-class strangler-fig 분할" 의 "멤버 수 갱신 (2026-07-27)"(수치 변경 시에도 근거 인라인 유지)
  - 상세: target 은 §1 의 대체 문장에서 커밋 해시(`4b1f899b7`/`1e9f3f238`)·`git merge-base`
    확인·"쓰일 때 이미 거짓이었다" 는 핵심 사실을 **spec 본문에는 싣지 않고** "경위는 이 draft 와
    커밋 메시지에 남긴다" 로만 처리한다. 이 저장소의 동종 정정(위 세 선례)은 예외 없이 그 근거를
    Rationale 본문에 그대로 박아 둔다 — 나중에 spec 만 읽는 사람은 git blame/plan 아카이브를
    파야 "왜 이 문장이 이렇게 됐는지" 를 알 수 있다. 취소선을 안 쓰는 target 의 판단 자체("결정이
    아니라 한 번도 참이 아닌 상태 서술")는 사전에 없던 케이스에 대한 합리적 신규 판단으로 보이나
    (developer 자기-반증형 소정정 예외의 "취소선 필수" 조건은 이번이 planner 턴이라 문자 그대로
    구속하지 않는다 — CLAUDE.md 조건 4 는 그 예외 경로 한정), **근거를 인라인에서 완전히 제거하는
    것**은 별개 문제이고 이 저장소가 지금까지 지켜온 관행과 거리가 있다.
  - 제안: 대체 문장 뒤에 한 줄만 덧붙여도 충분하다 — 예: *"(갭을 닫은 `#1159`(`4b1f899b7`)가
    이 문장을 쓴 `#1162`(`1e9f3f238`)보다 먼저 머지됐다 — 이 문장은 작성 시점에 이미 거짓이었다.)"*.
    커밋 메시지만 SoT 로 두면 이 저장소가 반복 지적해 온 "정본 구현/근거가 코드에만 있고 문서엔
    없다" 클래스의 축소판이 spec Rationale 안에서도 재현된다.

- **[INFO] §1 이 닫는 항목이 `spec-sync-external-interaction-api-gaps.md` 의 열린 체크리스트를 언급/동기화하지 않는다**
  - target 위치: §1 전체 (라인 48-82)
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1947-1984`
    ("§R8 Rationale 의 `statusCode` 선재 갭 서술이 태어날 때부터 거짓이었다 (2026-08-29 등재)"
    — 미체크 `- [ ]` 항목, 정확히 이 target 의 §1 과 동일 대상·동일 실측)
  - 상세: 두 문서가 같은 문제를 각자 발견·등재했다(교차 검증 자체는 실측이 일치해 정합적이다).
    다만 target 은 이 선행 트래커의 존재를 인용하지 않으므로, 이 PR 이 머지돼도 `spec-sync-external-interaction-api-gaps.md`
    의 해당 항목은 자동으로 체크되지 않고 dangling 미해결 항목으로 남는다. Rationale 자체의
    모순은 아니지만 "동일 결함을 두 트래커가 따로 쫓는" 상태가 이후 세 번째 발견으로 재등재될
    위험이 있다(이 문서 스스로 "이 저장소가 반복해 겪는 클래스" 라고 §Rationale 에 적어 둔
    바로 그 패턴).
  - 제안: 이 PR 커밋/체크리스트에 `spec-sync-external-interaction-api-gaps.md:1949` 체크 처리를
    동반하거나, 최소한 target 본문에 "이 항목이 그 트래커의 §R8 항목도 함께 닫는다" 한 줄을
    추가한다.

## 정합성이 확인된 항목 (기록용)

- **§1** (`14-external-interaction-api.md:1264`, R8): 인용 라인·커밋 순서(`4b1f899b7` → `1e9f3f238`)·
  `isHttpStatusCode()` 실제 시그니처(`Number.isInteger` + 100~599) 전부 실측 일치. 기각/번복이
  아니라 "태어날 때부터 거짓" 인 상태 서술의 정정이며, 인접 R8 문단(캐시 스코프·fail-open
  두 축)과 충돌하지 않는다.
- **§2** (`data-flow/15-external-interaction.md:255,310`): "§4 Redis 각주가 SoT 표를 반영 못 한다"
  는 주장이 실측과 일치(`redis-keys.md:59` 에 `interaction:idempotency:*` 등재 확인). 순수
  누락 참조 보완이며 어떤 Rationale 도 재도입/번복하지 않는다.
- **§3** (`egress-masking.md:89`): 캐비엇이 가리키는 `ws-event-types-extract.md` 의 해당 항목이
  실제로 2026-08-29 체크됨을 확인. 대체 문장의 핵심 주장("`redactTerminalError` → `deepRedactSecrets`,
  `sanitizeErrorMessage` 아님")은 `terminal-error-payload.ts:3,107-115` 및 5개 호출부
  (`chat-channel.dispatcher.ts:551`·`execution-engine.service.ts:668,3400,5030`·
  `retry-turn.service.ts:1001`) 실측과 정확히 일치하며, 기존 §R17(`14-external-interaction-api.md:1492`)의
  "`toTerminalErrorPayload` 가 egress 초크포인트에서 `deepRedactSecrets` 로 마스킹한다" 서술과도
  모순이 없다(오히려 그 서술의 내부 헬퍼 이름을 더 정확히 부연). "확인 전에 전 경로 불변식이라
  쓰면 문서한 보장이 구현보다 넓어진다" 는 같은 문서의 원칙을 그대로 따른 정상적 캐비엇 회수다.
- **§4** (`6-websocket-protocol.md` Rationale 신설): `spec/conventions/` 전수 grep 으로
  `<도메인>EventType` 규칙이 실제로 어디에도 없음을 확인. `#1238`(`ws-event-types-extract.md:425-448`)이
  이 미문서화 규칙을 근거로 실제 개명 결정을 내렸다는 주장도 실측 일치. "conventions/ 신설은
  과하다" 의 근거로 인용한 `#1194`(`egress-masking.md` 신설 PR, `bdcfdc514`)의 "신설이 자동으로
  옳지 않다" Rationale 도 실재 — 인용이 조작되지 않았다(memory 의 "기각된 대안은 실제 이력
  필수" 기준 통과). 두 사례(egress-masking 신설 vs WS enum 신설 안 함)는 "cross-file 불변식이면
  신설, file-local 이면 기존 Rationale 에 편입" 이라는 동일 판단축이라 모순이 아니라 일관된
  적용이다.

## 요약

target 의 네 항목 모두 **기각된 대안의 재도입, 합의 원칙의 직접 위반, 무근거 결정 번복, invariant
우회** 어느 범주에도 해당하지 않는다 — 전부 실측으로 검증 가능한 "부재/낡음 서술의 정정" 이고,
인용된 선례(`#1159`/`#1162`/`#1194`/`#1238`)와 코드 실측이 target 의 주장과 정확히 일치했다.
유일한 흠은 §1 에서 이 저장소가 반복해 온 "정정에는 실측 근거를 spec 본문에 인라인으로 남긴다"
는 (문서화되진 않았지만 사례로 확립된) 관행에서 근거를 커밋 메시지로만 빼돌린 점과, 같은 결함을
이미 쫓고 있던 자매 트래커(`spec-sync-external-interaction-api-gaps.md`)와의 동기화 누락이다.
둘 다 target 을 진행 자체를 막을 사유는 아니다.

## 위험도

LOW
