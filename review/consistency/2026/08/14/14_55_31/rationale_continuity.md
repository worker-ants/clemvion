# Rationale 연속성 검토 — rationale_continuity

## 검토 대상 요약

`origin/main...HEAD` diff 는 `spec/5-system/`(target scope)의 **본문을 전혀 건드리지 않는
코드-only 보안 수정 시리즈**다(`git diff origin/main...HEAD --stat -- spec/` = 0줄). 핵심은
`llmCalls`(raw LLM 요청/응답 — 시스템 프롬프트·대화 이력 포함) 외부 노출 차단을 depth-1
shallow strip → 깊이 무관 strip 으로 강화하고, `InteractionService.getStatus` 의 세 출구
(waiting `nodeOutput` · terminal `result` · terminal `error`)를 `redactAndStrip` 헬퍼로 통일한
것이다. 대조 대상은 `spec/5-system/6-websocket-protocol.md` §4.4 Rationale("`ai_message.llmCalls[]`
외부 수신자 strip — strip-only 결정")과 `spec/5-system/14-external-interaction-api.md` §Rationale
R17("`nodeOutput.conversationConfig` + terminal `result`/`error` (강제됨 — bypass 차단)").

직전 라운드(`review/consistency/2026/08/14/14_30_36/rationale_continuity.md`)가 CRITICAL 로 지적한
"terminal `result`/`error` 는 `deepRedactSecrets` 단독으로 남아 R17 이 요구하는 대칭이 깨졌다"는
결함은, 이번 라운드가 보는 최신 커밋(`7fa12301c` "같은 함수의 세 출구 중 하나만 막았다 — 헬퍼로 묶어
분리 불가능하게")에서 `redactAndStrip(value)` 단일 헬퍼로 세 출구를 통일해 **해소됨을 코드로 재확인**
했다(`interaction.service.ts` waiting/`result`/`error` 세 지점 모두 `redactAndStrip(...)` 호출,
`RESOLUTION.md` 도 뮤테이션으로 "헬퍼에서 strip 을 빼면 3건 전부 RED" 를 확인했다고 기록).

---

## 발견사항

### [WARNING] §R17("secret-shape 만 치환")이 새 구현(마스킹+필드삭제 병행)보다 좁아졌다 — 단, planner 인계로 이미 등재됨

- **target 위치**: 코드 자체는 diff 범위 안(`codebase/backend/src/modules/external-interaction/interaction.service.ts`
  의 `redactAndStrip`)에서 이미 올바르게 동작한다. 문제는 **spec 문서가 diff 로 갱신되지 않았다는 것**
  — `spec/5-system/14-external-interaction-api.md` §Rationale R17 (라인 1346-1352)의 현재 텍스트.
- **과거 결정 출처**: 같은 문서 §Rationale R17 "`nodeOutput.conversationConfig` + terminal `result`/`error`
  (강제됨 — bypass 차단)": "`getStatus` 는 `nodeOutput` 전체 + terminal `result`(COMPLETED)/`error`(FAILED)의
  `outputData` 를 `deepRedactSecrets` 로 마스킹한다 ... 마스킹은 secret-shape 만 치환". 이 문장은
  `getStatus` 의 방어를 **값-마스킹 단독**으로 규정한다.
- **상세**: `sanitize-error-message.ts` 확인 결과 `deepRedactSecrets` 는 문자열 secret 패턴/credential
  키만 치환하는 **값 마스킹**이지 필드 제거가 아니다. 그런데 이번 diff 는 `getStatus` 의 세 출구 모두에
  `stripExternalOnlyFields`(필드 자체를 깊이 무관으로 삭제)를 추가로 걸었다 — 즉 **실제 코드는 R17
  텍스트가 서술하는 것보다 더 넓게(강하게) 보호한다.** 이는 `spec/5-system/6-websocket-protocol.md`
  §4.4 Rationale "strip-only 결정"이 명시적으로 기각한 "값-레벨 마스킹은 부분적" 대안을 코드가 이제
  더 이상 채택하지 않는다는 뜻이라 방향 자체는 올바르다. 다만 **spec 이 구현을 따라가지 못해 R17 텍스트가
  현재 보안 태세를 정확히 서술하지 않는 상태**로 diff 가 종료됐다 — Rationale 은 "왜 이렇게 방어하는가"의
  SoT 인데, SoT 가 실제보다 약한 방어를 서술하면 다음 리더가 방어 수준을 과소평가할 위험이 있다.
  - 다만 이것이 **방치된 drift 는 아니다** — developer 는 `spec/` 쓰기 권한이 없어(CLAUDE.md §Skill
    체계) 직접 고치는 대신, `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 항목 "(7) `llmCalls`
    strip SoT 가 실제 누출 표면을 안 덮는다"에 정확한 교정 문구를 이미 등재했다 — "§R17 정정: 현행은
    `getStatus` 를 'secret-shape 만 치환'으로 서술하는데 실제로는 값 마스킹 + 필드 삭제를 병행한다.
    세 출구 전부에 적용됨을 명시할 것" + WS §4.4 제목·스코프 확장("위치·이벤트 무관") + EIA §6.2 명시
    문장 추가까지 구체적으로 초안화돼 있다. `review/code/2026/08/14/14_30_35/RESOLUTION.md` W7 도
    "코드가 spec 을 앞질렀다"고 동일하게 자인·등재했다.
  - `plan/in-progress/eia-terminal-payload.md` 체크리스트의 "planner 턴" 항목은 아직 미체크 —
    즉 이 교정은 **아직 spec 파일에 반영되지 않은 상태**로 이번 diff 가 마무리됐다.
- **제안**: 다음 planner 턴에서 draft (7)의 내용을 실제로 `spec/5-system/14-external-interaction-api.md`
  §R17 과 `spec/5-system/6-websocket-protocol.md` §4.4 Rationale·본문에 반영해 SoT 텍스트를 구현과
  재정합할 것. 그 전까지 이번 diff 를 "완결"로 간주하지 말고, SUMMARY 에 "spec 텍스트 갱신 대기 중"
  임을 유지 항목으로 남길 것.

### [INFO] `EXTERNAL_STRIPPED_FIELDS` 확장 시 "spec 동반 갱신" 절차 문구가 새 공유 유틸로 이관되며 유실

- **target 위치**: `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(신설) —
  `EXTERNAL_STRIPPED_FIELDS` JSDoc.
- **과거 결정 출처**: diff 에서 삭제된 `websocket.service.ts` 의 예전 주석 — "`EXTERNAL_STRIPPED_FIELDS`
  에 새 필드를 추가할 때는 반드시 WS spec §4.4 과 `EiaAiMessageEvent` 주석을 함께 갱신한다."
- **상세**: 이는 spec 문장 자체는 아니지만, spec-code 동기화를 지키기 위해 코드에 박아둔 절차적 합의였다.
  신설 파일의 JSDoc 은 SoT 참조 링크(WS §4.4 / EIA §6.5 / chat-channel CCH-MP-01)는 유지했지만, "필드
  목록 확장 시 spec 동반 갱신" 이라는 명령형 절차 문구는 옮겨지지 않았다. 이번 diff 자체는 필드 목록을
  바꾸지 않아(`['llmCalls']` 그대로) 규율을 어긴 것은 아니지만, 향후 두 번째 strip 대상 필드가 추가될 때
  이 절차가 다시 유실될 위험이 있다 — 정확히 위 WARNING 이 지금 재현 중인 "코드가 spec 을 앞지르는" 패턴의
  재발 소지.
- **제안**: 새 파일 JSDoc 에 "`EXTERNAL_STRIPPED_FIELDS` 확장 시 WS §4.4 + EIA §6.2/§6.5 + 본 파일
  JSDoc 을 동시 갱신한다"는 절차 문구를 복원.

---

## 요약

이번 diff 는 이전 라운드(`12_06_21`·`14_30_36`)가 지적한 CRITICAL(REST `getStatus` 세 출구 중
terminal `result`/`error` 가 fanout 과 다른 약한 방어를 쓰던 문제)을 `redactAndStrip` 단일 헬퍼로
세 출구 전부에 강제 적용해 코드 레벨에서 실제로 닫았다 — WS §4.4 Rationale 이 명시적으로 기각한 "값-마스킹
단독" 대안으로 되돌아간 부분은 없다(오히려 그 대안을 완전히 제거하는 방향). 다만 그 결과 `spec/5-system/
14-external-interaction-api.md` §R17 텍스트("secret-shape 만 치환")가 실제 구현(마스킹+필드삭제 병행)
보다 좁아졌는데, 이 gap 은 spec 쓰기 권한이 없는 developer 가 은폐하지 않고 `plan/in-progress/
spec-draft-eia-62-waiting-payload.md` 항목(7)에 구체적 교정 문구로 이미 등재했고 `RESOLUTION.md` W7 도
동일하게 자인했다 — CLAUDE.md 의 "spec 변경 필요 시 developer 는 멈추고 planner 위임" 절차를 정상적으로
따른 상태다. 남은 리스크는 그 planner 턴이 실제로 실행되기 전까지 SoT 문서가 구현보다 약한 방어를
서술한다는 점뿐이며, 이는 절차 위반이 아니라 미완결 후속 작업이다.

## 위험도

LOW
