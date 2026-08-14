# Rationale 연속성 검토 결과

## 검토 대상 요약

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `origin/main...HEAD` 실제 diff(코드): `codebase/backend/src/modules/websocket/websocket.service.ts` +
  `websocket.service.spec.ts` 만 변경 (커밋 `81f2c60d6` "fix(security): 외부 fanout 의 llmCalls
  strip 이 depth-1 이라 raw 프롬프트가 새고 있었다"). `spec/5-system/**` 자체는 이번 diff 에서
  변경되지 않음.
- 번들이 컨텍스트 예산 초과로 `14-external-interaction-api.md` 와 diff 본문을 절단했으므로, 절대경로로
  `spec/5-system/14-external-interaction-api.md` §6.5, `spec/5-system/6-websocket-protocol.md` §4.4 +
  `## Rationale`, 그리고 `git diff origin/main...HEAD -- codebase/backend/src/modules/websocket/*` 를
  직접 열어 확인했다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 Rationale 위반은 발견되지 않았다.

- **[INFO]** 보안 버그 수정에 대한 짧은 Rationale addendum 부재
  - target 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `stripExternalOnlyFields`/`stripDeep` (커밋 `81f2c60d6`)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "`ai_message.llmCalls[]` 외부 수신자 strip (strip-only 결정)", 및 `spec/5-system/14-external-interaction-api.md` §6.5 "debug 전용 `llmCalls` 필드는 … fanout seam 에서 제거되어 외부 수신자에는 전달되지 않는다"
  - 상세: 기존 "strip-only 결정" Rationale 은 **"llmCalls 는 모든 외부 fanout 수신자에서 제거된다"**는 의미 수준의 결정만 기술하고 있고, 구현 깊이(top-level만 vs 전 깊이)는 명시하지 않았다. 즉 이번 diff 는 결정을 번복한 것이 아니라, 그 결정이 실제로는 depth-1 구현 때문에 **불완전하게 지켜지고 있던 보안 결함**(중첩 `turnDebug.llmCalls`/`nodeOutput.meta.turnDebug[].llmCalls` 두 경로가 새고 있었음, 테스트로 실증됨)을 고쳐 결정의 원 취지("모든 외부 수신자에서 제거")에 더 가깝게 정합시킨 것이다. 코드 JSDoc 은 이 경위를 상세히 남겼지만, spec 쪽 `## Rationale` 에는 이 이력(2026-08-14, 보안 결함 발견·수정)에 대한 언급이 없다.
  - 제안: 필수는 아니나, `6-websocket-protocol.md` 의 "strip-only 결정" 항목 말미에 "2026-08-14: strip 구현이 depth-1 이라 중첩 경로 2곳(turn1 orchestrator 스냅샷 · 누적 turnDebug)에서 실제로 누출되고 있었음을 발견, 깊이 무관 strip 으로 강화(`81f2c60d6`)" 한 줄을 addendum 으로 남기면, 향후 이 결정을 다시 여는 사람이 "왜 depth-1 이 아니라 깊이 무관인가"를 코드가 아닌 spec 에서도 확인할 수 있다.

## 상세 확인 내역 (참고)

- `spec/5-system/6-websocket-protocol.md` §4.4 표(`llmCalls[].requestPayload`/`responsePayload`)와 본문 blockquote는 "**모든** 외부 fanout 수신자 — SSE / notification webhook / chat-channel — 에서는 strip 된다"고 명시하며 depth 를 한정하지 않는다. `spec/5-system/14-external-interaction-api.md` §6.5 도 동일하게 "fanout seam 에서 제거되어 외부 수신자에는 전달되지 않는다"고만 서술한다 → 이번 diff 의 depth-independent strip 은 이 spec 서술과 **정합**하며, 오히려 이전 depth-1 구현 쪽이 spec 서술에 미달했던 상태였다.
- 삭제된 옛 JSDoc("Strip 은 top-level 필드만 수행한다 (depth-1 shallow delete)")은 spec 의 `## Rationale`에 있던 **채택된 결정**이 아니라, 코드 자체의 구현 한계를 알리는 캐비엇이었다. 따라서 이번 변경은 "기각된 대안의 재도입"도 "합의된 원칙 위반"도 아니다.
- `EXTERNAL_STRIPPED_FIELDS` 필드 추가 시 WS spec §4.4 + `EiaAiMessageEvent` JSDoc 동시 갱신 규약은 diff 후에도 JSDoc 에 그대로 유지된다(문구 이동만, 규약 자체는 보존).
- `stripDeep` 의 clone-on-write("제거할 게 없으면 새 객체 생성 없이 입력을 그대로 반환")는 기존 `stripExternalOnlyFields` 의 "no allocation on the common path" 성능 원칙을 그대로 계승하며, 이를 검증하는 신규 단위 테스트(`제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다`)도 추가됐다 — 원칙 위반 없음.
- `spec/5-system/14-external-interaction-api.md` R10 ("WebsocketService 단일 sink 정책의 확장")과의 정합도 확인: strip 로직은 여전히 `WebsocketService` 단일 sink 경로 내부에 위치하며, sink 를 늘리거나 엔진이 외부 sink 종류를 알게 만드는 변경이 아니다.
- `spec/5-system/**` 전역에서 "depth-1"/"top-level 전용 strip" 을 여전히 주장하는 stale 서술은 남아있지 않다(grep 확인, 무관한 항목 2건만 매치).
- 신규 untracked plan(`plan/in-progress/eia-terminal-payload.md`)은 별도의 "종결 이벤트 payload 일괄 정리" 작업이며 아직 `--impl-prep` BLOCK:YES 로 구현 착수 전 상태다. 이번 diff(코드 변경분)와는 별개 트랙이라 본 rationale 연속성 판정에는 포함하지 않았다(코드 변경 없음).

## 요약

이번 diff(`websocket.service.ts` 의 fanout strip 깊이 확장)는 `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md` 의 기존 "llmCalls strip-only" Rationale/결정을 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 depth-1 구현이 그 결정의 문언("모든 외부 수신자에서 제거")에 못 미쳤던 보안 결함을 바로잡아 spec 서술과의 정합을 강화했다. 유일한 보완 여지는 이 보안 수정 이력을 spec `## Rationale` 에도 한 줄 addendum 으로 남기는 것(INFO, 비차단).

## 위험도
NONE
