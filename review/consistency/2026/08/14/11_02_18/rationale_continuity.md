# Rationale 연속성 검토 결과

## 검토 대상 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 프롬프트 번들이 컨텍스트 예산 초과로 `14-external-interaction-api.md` 본문과 `git diff` 본문을 절단했으므로,
  워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)를 절대경로로 직접
  열어 확인했다: `spec/5-system/14-external-interaction-api.md`(§5.1 R8 캐시 키 스코프 포함 전문) ·
  `spec/5-system/6-websocket-protocol.md` §4.4 + `## Rationale`(prompt 번들에 포함돼 있어 그쪽에서 확인) ·
  `git diff origin/main...HEAD --stat` · `git show 81f2c60d6` · `git show 5df89cda6`.
- `origin/main...HEAD` 실 diff: `spec/**` 파일은 **전혀 변경되지 않았다**(project-planner 미개입, developer 권한
  범위 내). 코드 변경은 `codebase/backend/src/modules/websocket/websocket.service.ts` +
  `websocket.service.spec.ts` 뿐이며, 커밋 두 개로 구성된다:
  1. `81f2c60d6` — 외부 fanout `llmCalls` strip 을 depth-1(top-level only)에서 깊이 무관(전체 트리)으로 강화.
  2. `5df89cda6` — 위 강화 구현이 `__proto__` bracket 대입으로 CWE-1321 프로토타입 오염을 일으키던 것을
     스프레드 기반 own-property 대입으로 수정 + 지연 할당 + 깊이 상한(`MAX_SANITIZE_DEPTH`) 적용.
- 워크트리 이름(`eia-r8-cache-scope`)이 가리키는 "EIA §R8 캐시 키 스코프"(`14-external-interaction-api.md`
  `## Rationale` R8, Idempotency-Key 캐시 네임스페이스 스코프 결정)는 **이번 diff 와 무관**하다 — plan 문서
  (`plan/in-progress/eia-terminal-payload.md`)가 자체적으로 "워크트리 이름이 작업과 무관하다"고 명시하고
  있으며, 실제 diff 는 WS 이벤트 fanout 의 `llmCalls` strip 보안 수정이다. R8 관련 코드(idempotency
  interceptor)는 이번 diff 에 등장하지 않는다.

## 발견사항

CRITICAL/WARNING 급 Rationale 위반은 발견되지 않았다.

- **[INFO]** 보안 강화 이력이 spec `## Rationale` 에 addendum 으로 반영되지 않음 (전회 라운드 `10_32_29`
  rationale_continuity INFO 와 동일 — 이번 라운드(`5df89cda6`)에도 여전히 미해소)
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `stripExternalOnlyFields`/`stripDeep`
    (커밋 `81f2c60d6`, `5df89cda6`)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "`ai_message.llmCalls[]` 외부
    수신자 strip (strip-only 결정)", 및 `spec/5-system/14-external-interaction-api.md` §6.5 "debug 전용
    `llmCalls` 필드는 … fanout seam 에서 strip 되어 어댑터에 도달하지 않는다"
  - 상세: 두 spec 문서 모두 "llmCalls 는 **모든** 외부 fanout 수신자에서 제거된다"는 **의미 수준**의 결정만
    적고, strip 구현의 깊이(top-level 전용 vs 전체 트리)는 규정하지 않는다. 따라서 이번 diff(깊이 무관 strip
    으로 강화 + `__proto__` 오염 재발 방지)는 그 결정을 번복하거나 기각된 대안을 재도입한 것이 아니라, depth-1
    구현이 실제로는 그 결정의 문언에 못 미쳤던 **보안 결함**(중첩 경로 `turnDebug.llmCalls`·
    `nodeOutput.meta.turnDebug[].llmCalls` 두 곳에서 raw LLM payload 가 새고 있었음, 테스트로 실증)을 바로잡아
    원 결정 취지에 더 가깝게 정합시킨 것이다. 코드 JSDoc(`stripDeep` 주석, CHANGELOG.md)에는 이 경위·실측치·
    기각 사유가 상세히 남았지만, `spec/5-system/6-websocket-protocol.md` `## Rationale` 자체에는 이 2026-08-14
    보안 수정 이력에 대한 언급이 여전히 없다. `plan/in-progress/eia-terminal-payload.md` (구 `spec-draft-eia-62-
    waiting-payload.md` 조사 기록)도 "planner 인계 (선택): `## Rationale` 의 strip-only 결정 항목에 addendum
    한 줄" 을 체크박스 미완료 상태로 스스로 남겨 두고 있다 — 즉 팀 자신도 이 갭을 인지하고 있으나 developer 는
    `spec/` 쓰기 권한이 없어 미반영 상태로 남았다.
  - 제안: 필수는 아니다(developer 권한 밖 · CRITICAL/WARNING 아님). project-planner 턴에서
    `6-websocket-protocol.md` "strip-only 결정" 항목 말미에 "2026-08-14: depth-1 구현이 중첩 경로 2곳에서
    실제로 누출되고 있었음을 발견, 깊이 무관 strip + `__proto__` 오염 방지로 강화(`81f2c60d6`, `5df89cda6`)"
    한 줄을 addendum 으로 남기면, 향후 이 strip 로직을 다시 여는 사람이 "왜 depth-1 이 아니라 깊이 무관 +
    스프레드 방어인가"를 코드가 아닌 spec 에서도 확인할 수 있다. `plan/in-progress/eia-terminal-payload.md`
    의 미완료 체크박스가 이미 같은 제안을 등재해 두었으므로 중복 신설이 아니라 기존 항목의 재확인이다.

## 상세 확인 내역 (참고)

- `spec/5-system/6-websocket-protocol.md` §4.4 표 및 blockquote 는 "**모든** 외부 fanout 수신자 — SSE /
  notification webhook / chat-channel — 에서는 strip 된다"고 명시하며 깊이를 한정하지 않는다.
  `spec/5-system/14-external-interaction-api.md` §6.5(및 `15-chat-channel.md` CCH-MP-01 의 cross-ref)도
  동일하게 "fanout seam 에서 strip 되어 어댑터에 도달하지 않는다"고만 서술한다 → 이번 diff 의 깊이 무관 strip
  은 이 서술과 **정합**하며, 이전 depth-1 구현 쪽이 오히려 spec 서술에 미달했던 상태였다.
- 삭제된 옛 JSDoc("Strip 은 top-level 필드만 수행한다(depth-1 shallow delete)")은 spec `## Rationale` 의
  **채택된 결정**이 아니라 코드 자체의 구현 한계를 알리는 캐비엇이었다. 따라서 "기각된 대안의 재도입"도
  "합의된 원칙 위반"도 아니다.
- `EXTERNAL_STRIPPED_FIELDS` 필드 추가 시 WS spec §4.4 + `EiaAiMessageEvent` JSDoc 동시 갱신 규약은 diff 후에도
  JSDoc 에 그대로 유지된다(문구 이동·정정만, 규약 자체는 보존).
- `spec/5-system/14-external-interaction-api.md` R10("WebsocketService 단일 sink 정책의 확장")과의 정합:
  strip 로직은 여전히 `WebsocketService` 단일 sink 경로 내부(엔진 외부 facade 층)에 위치하며, 새 sink 를
  늘리거나 엔진이 외부 sink 종류를 알게 만드는 변경이 아니다 — 위반 없음.
  R7("seq 동일 공유")·R15/RL-06(terminal token revoke)등 인접 Rationale 도 이번 diff 범위(strip 함수 내부)와
  겹치지 않는다.
  R8 "캐시 키 스코프"(Idempotency-Key 네임스페이스 = `interaction:idempotency:<executionId>:<route>:<key>`)는
  이번 diff 에 관련 코드가 전혀 없어(idempotency interceptor 미변경) 검토 대상에서 제외했다.
- `stripDeep` 의 lazy clone-on-write 원칙(제거가 실제 없으면 새 객체 생성 없이 입력을 그대로 반환)은 기존
  "no allocation on the common path" 성능 원칙을 계승하며 신규 identity 단위테스트로 검증된다 — 원칙 위반 없음.
  `5df89cda6` 은 오히려 "할당 없음" 주장이 초판 구현(매 레벨 `out={}` 후 폐기)보다 넓었던 것을 실제 지연 할당
  구현으로 정정해 JSDoc-구현 정합을 강화했다(주장을 축소해 사실에 맞춘 것 — 새 Rationale 이 필요한 결정 번복이
  아니라 버그 수정).
- `plan/in-progress/eia-terminal-payload.md` 내 "(b) emit 에서 빼기가 유력 → (a) 깊이 우선 채택" 처방 뒤집힘은
  spec `## Rationale` 항목이 아니라 developer 자신의 조사 중 임시 메모였고, 뒤집은 이유(경로가 둘이라 (b)로는
  못 막음, 필드명이 이미 "문서화된 비밀 마커")를 같은 문서에 명시했다 — "무근거 번복"에 해당하지 않는다.
- `spec/5-system/**` 전역에서 "depth-1"/"top-level 전용 strip" 을 여전히 주장하는 stale 서술은 남아있지 않다.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(project-planner draft)와
  `plan/in-progress/eia-terminal-payload.md`(developer, `--impl-prep` BLOCK:YES 상태로 구현 미착수)는 별도
  트랙("종결 이벤트 payload 일괄 정리")이며 이번 diff(코드 변경분)에 포함되지 않는다 — spec 파일 변경이 없으므로
  이 트랙 자체는 본 라운드의 Rationale 연속성 판정 범위 밖이다(코드·spec 변경 없음).

## 요약

이번 diff(`websocket.service.ts` fanout strip 을 깊이 무관으로 강화 + `__proto__` 오염 방지 후속 수정)는
`spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md`의 기존 "llmCalls strip-only" 결정이나
"WebsocketService 단일 sink" 원칙(R10)을 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 depth-1 구현이 그
결정의 문언("모든 외부 수신자에서 제거")에 못 미쳤던 실제 보안 누출을 바로잡아 spec 서술과의 정합을 강화했고,
후속 커밋은 그 수정 자체가 낳은 새 결함(프로토타입 오염)까지 조치했다. spec 파일 자체는 이번 diff 에서 변경되지
않았으며(developer 권한 범위 내 코드 수정), 유일한 보완 여지는 전회 라운드부터 이어지는 동일 INFO — 이 보안
수정 이력을 spec `## Rationale`에 한 줄 addendum으로 남기는 것(비차단, planner 턴 대기 중으로 이미 plan 문서에
등재됨). 워크트리명이 가리키는 "R8 캐시 키 스코프" 결정은 이번 diff 와 무관해 별도 위반 소지가 없다.

## 위험도
NONE
