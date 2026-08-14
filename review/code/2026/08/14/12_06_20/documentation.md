# 문서화(Documentation) 리뷰

리뷰 대상은 실질적으로 코드 변경이 있는 `websocket.service.ts`/`websocket.service.spec.ts`,
`CHANGELOG.md`, 두 plan 문서(`eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`)다.
나머지 `review/code/**`·`review/consistency/**` 신규 파일은 이전 리뷰/컨시스턴시 라운드의
산출물(계획 문서 아님, 코드 아님)이라 "독스트링/README/주석 정확성" 관점의 적용 대상이 아니다.

이번 라운드(`12_06_20`)는 직전 두 라운드(`10_32_27`, `11_02_16`)에서 나온 documentation
지적(CHANGELOG 누락, plan 체크리스트 drift, `stripDeep` 할당 주장 과장, 깊이 경계 연산자
불일치)이 모두 후속 커밋(`a9574f823`, `5df89cda6`, `2ef826dc5`, `b49ee4310`)으로 조치된
뒤의 최종 상태를 다시 검토한 것이다. 실제로 `websocket.service.ts`의 `stripDeep`/
`sanitizePayloadForWs` JSDoc, `CHANGELOG.md` 신규 항목, `spec-draft-eia-62-waiting-payload.md`
체크리스트는 대부분 잘 동기화돼 있었다. 다만 **가장 마지막 커밋(`b49ee4310`)이 도입한
테스트 JSDoc 하나가 같은 커밋에서 고친 코드와 즉시 어긋난다.**

## 발견사항

- **[WARNING]** 신규 테스트 JSDoc 이 "`stripDeep` 은 `depth >= MAX_SANITIZE_DEPTH`" 라고 현재형으로 서술하는데, 실제 코드는 **같은 커밋에서 이미 `>` 로 통일**돼 이 서술이 거짓이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:798`(`* \`stripDeep\` 은 \`depth >= MAX_SANITIZE_DEPTH\` 에서 멈추고 형제` 로 시작하는 JSDoc 블록, 795~817)
  - 상세: 이 JSDoc(795~817)은 `11_02_16` CRITICAL 1(리뷰어 넷의 결론이 깊이 경계 연산자 어긋남 때문에 갈렸던 사건)을 설명하며 "`stripDeep` 은 `depth >= MAX_SANITIZE_DEPTH` 에서 멈추고 형제 `sanitizePayloadForWs` 는 `depth > MAX_SANITIZE_DEPTH` 에서 … 치환한다 — 경계 연산자가 다르다" 라고 적었다. 이 문장에는 "종전엔"/"당시엔" 같은 과거 시제 표지가 없어 **현재도 유효한 사실**처럼 읽힌다. 그런데 바로 이 커밋(`b49ee4310`)의 같은 diff 가 `stripDeep` 자체를 `depth >= MAX_SANITIZE_DEPTH` → `depth > MAX_SANITIZE_DEPTH` 로 고쳤다(`websocket.service.ts:393`, `git show b49ee4310 -- websocket.service.ts` 로 확인: `-  if (depth >= MAX_SANITIZE_DEPTH) return value;` / `+  if (depth > MAX_SANITIZE_DEPTH) return value;`). `websocket.service.ts:360`·`:388-392` 의 함수 JSDoc/인라인 주석은 "형제와 **같은 경계 연산자**를 쓴다"·"종전 `>=` 는 형제보다 한 단계 얕게 멈춰…" 라고 정확히 과거형으로 정정해 두었는데, 정작 같은 커밋이 새로 쓴 테스트 쪽 JSDoc(`websocket.service.spec.ts:798-800`)만 그 정정을 반영하지 못한 채 "연산자가 다르다" 는 옛 사실을 그대로 남겼다 — 자기 자신이 고친 코드와 자기 자신이 쓴 주석이 같은 커밋 안에서 모순되는 사례다. 이 테스트의 판별력 표(`depth 0·5`=RED, `8 이상`=판별력 없음)는 연산자 통일 여부와 무관하게 여전히 유효하지만, "경계 연산자가 다르다" 는 문장 자체는 향후 이 테스트를 읽는 사람에게 "아직 `stripDeep` 이 `>=` 를 쓰고 있다" 는 잘못된 인상을 준다.
  - 제안: "경계 연산자가 다르다" 문장에 과거 시제를 명시하거나(예: "…에서 멈췄었고(수정 전)"), 함수 JSDoc(`websocket.service.ts:388-392`)처럼 "종전엔 `>=` 였다가 이 커밋에서 `>` 로 통일했다" 로 바꿔 현재 상태(연산자 통일 완료)를 명확히 반영한다.

## 확인했으나 문제 없음 (positive findings)

- `CHANGELOG.md` 신규 "Unreleased" 항목은 두 누출 경로·수신자 범위·"선언이 참이 아니었다"·운영 판단 필요성을 정확히 서술하고, `10_32_27` W9(CHANGELOG 누락 지적)를 제대로 해소했다.
- `websocket.service.ts`의 `stripDeep`/`stripExternalOnlyFields`/`sanitizePayloadForWs` JSDoc은 `10_32_27`·`11_02_16` 두 라운드에서 지적된 "할당 없음 주장이 구현보다 넓다"(W3), "깊이 상한이 호출 순서 의존"(W4), "경계 연산자 통일"(11_02_16 CRITICAL 1), "비용 실측치와 두 pass 를 안 합친 이유" 를 모두 정확하고 구체적으로 반영해 문서와 구현이 일치한다. `__proto__` 오염 방지 근거(어떤 구현이 실제 방어인지 실측으로 가른 경위)까지 JSDoc에 남긴 것은 특히 꼼꼼하다.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md`의 "처분 (실제 상태)" 체크리스트는 완료 항목(`[x]`)과 미완료 항목(`[ ]`)이 실제 구현·커밋 상태와 일치한다 — `10_32_29`/`11_02_18` 라운드가 지적한 체크박스 drift가 이번엔 재발하지 않았다(성능 실측 항목도 정확히 체크됨).
- `websocket.service.spec.ts`의 `describe('llmCalls strip …')` 블록 내 변수명 `wire`(내부 WS 채널 envelope)와 `wireJson`(외부 fanout payload 직렬화 문자열)이 명확히 구분돼 `10_32_27` testing INFO(변수명 재사용 혼동)가 해소됐고, `:639` 근방 주석도 "…했었다" 과거형으로 정정돼 `10_32_27` W7이 반영됐다.
- `plan/in-progress/eia-terminal-payload.md`(별건, BLOCK: YES 상태)는 이번 diff의 실제 코드 변경과 무관하지만 그 사실이 문서(재판정 절)에 스스로 명시돼 있어 오해 소지가 적다.
- README·API 문서·환경변수 문서 갱신이 필요한 새 공개 인터페이스·설정 항목은 이번 diff에 없다(내부 private 함수 리팩터 + 테스트 추가뿐).

## 요약

핵심 보안 수정(`stripExternalOnlyFields`의 depth-1 → 깊이 무관 재귀 전환)에 대한 문서화 작업은 이번까지 세 라운드에 걸쳐 매우 꼼꼼하게 이뤄졌다 — CHANGELOG, JSDoc, plan 체크리스트가 모두 실제 구현·검증 상태와 일치하도록 정정됐고, 이전 라운드의 documentation 지적은 전부 해소됐다. 다만 가장 마지막 커밋(`b49ee4310`, 깊이 경계 연산자 통일)이 새로 추가한 테스트 JSDoc 한 곳(`websocket.service.spec.ts:798`)이 자신이 속한 바로 그 커밋에서 고친 사실("연산자가 다르다")을 과거형으로 정정하지 못해 즉시 stale 해졌다 — 코드는 이미 통일됐는데 주석만 "다르다" 고 남아 있다. 기능적 결함은 아니고 테스트 자체의 판별력에도 영향이 없지만, 향후 이 테스트를 읽는 사람을 오도할 수 있어 WARNING으로 기록한다.

## 위험도

LOW
