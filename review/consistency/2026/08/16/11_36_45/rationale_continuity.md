# Rationale 연속성 검토 — spec/5-system/ (impl-done)

## 조사 방법 및 스코프 정정

prompt 번들의 `spec/5-system/*` 상당수와 `<git diff origin/main...HEAD -- code_areas>` 가 컨텍스트
예산 초과로 절단돼 있어, 실제 diff·대상 spec 전문을 워크트리에서 직접 재확인했다
(`git diff origin/main...HEAD --stat`, `git diff ... -- codebase/...`, `Read` on
`spec/5-system/14-external-interaction-api.md`).

**핵심 사실**: 이 diff 는 `spec/5-system/**/*.md` 를 **전혀 건드리지 않는다** (`git diff --stat`
에 `spec/` 경로 0건 — 변경분은 `codebase/backend/src/shared/utils/terminal-error-payload.ts` ·
`codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`(docstring) ·
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` · `CHANGELOG.md` · review 산출물뿐).
따라서 "target 문서가 spec 의 Rationale 을 어긴다" 류의 직접 충돌은 구조적으로 발생할 수 없고,
본 검토는 **코드 변경이 spec/5-system 의 기존 Rationale(특히 EIA §R17)과 정합하는가**로 스코프를
재정의해 수행했다.

## 발견사항

- **[INFO]** EIA §R17 "표면 제약(보안)" 마스킹 카탈로그가 이번에 추가된 5번째 egress 지점을
  아직 나열하지 않음
  - target 위치: (spec 미변경 — 코드) `codebase/backend/src/shared/utils/terminal-error-payload.ts`
    신설 `redactTerminalError`/`toTerminalErrorPayload` 호출 경로
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 "표면 제약(보안)" —
    현재 4개 불릿(`conversationThread` · `execution.ai_message` · `nodeOutput.conversationConfig`
    + terminal `result`/`error`(`outputData` 기반) · `nodeOutput` 일반 키 allowlist(미구현))만 등재
  - 상세: 이번 PR 이 `Execution.error`(종결 emit `EXECUTION_FAILED` 4곳 + `chat-channel.dispatcher`)
    에 `deepRedactSecrets` egress 마스킹을 신설했다. 이는 R17 이 이미 확립한 "egress-only masking"
    원칙(§R17 "egress-only(의도)" 문단 — DB write 시점엔 걸지 않고 emit 초크포인트에서만 마스킹)을
    **정확히 따르는** 구현이라 Rationale 위반은 아니다. 다만 R17 카탈로그의 4개 불릿은 자신을
    "표면 제약(보안)" 의 완결 목록처럼 서술하는데, 실제로는 `Execution.error` egress 마스킹(5번째
    지점, `outputData` 기반 3번째 불릿의 `result`/`error` 와는 **다른 컬럼**)이 빠져 있어 spec 이
    구현보다 좁아진 상태다.
  - 참고: 이 갭은 이미 `plan/in-progress/eia-terminal-error-sanitize.md` "후속 (이 PR 범위 밖)" 에
    `10_19_31 plan_coherence W1` 로 자체 등재돼 있고, "spec 본문은 developer 권한 밖" 이라는 이유로
    planner 턴으로 명시 이관돼 있다 — 침묵 누락이 아니라 추적된 백로그다.
  - 제안: 별도 조치 불요(이미 추적됨). planner 턴에서 R17 "표면 제약(보안)" 에 5번째 불릿(`Execution.error`
    → `toTerminalErrorPayload` egress 마스킹, 대상 컬럼이 `outputData` 아닌 `Execution.error` 임을
    3번째 불릿과 구분해 명시)을 추가할 때 이 리포트를 근거로 인용 가능.

- **[INFO]** `SECRET_LEAK_PATTERNS` 의 방어 범위(자격증명 한정)를 확장하지 않기로 한 결정 — 기존
  "blast radius 분리" 관행과 정합
  - target 위치: `terminal-error-payload.ts` `redactTerminalError` JSDoc "여기서 넓히지 않은 이유"
  - 과거 결정 출처: 없음(신규 결정) — 다만 EIA §R17 자체가 이미 같은 논리(구조적 필드 vs 자유
    텍스트, 저장 시점 redaction 미채택 이유로 "blast radius" 유사 판단)를 쓰고 있어 원칙과 결이 같다
  - 상세: `postgres://db.internal:5432/prod`(자격증명 없음)·내부 호스트명·스택 프래그먼트는 여전히
    통과한다는 잔여 갭을 CHANGELOG·plan·JSDoc 세 곳에 일관되게 "의도된 defer" 로 명시했다.
    번복이 아니라 신규 결정이고 근거(다른 `deepRedactSecrets` 소비자로의 blast radius)가 함께
    기록돼 있어 §3 "무근거 번복" 기준에 해당하지 않는다.
  - 제안: 없음(현재 상태로 충분).

- **[INFO]** 이전 라운드(`09_25_29`)에서 실제로 R17 위반이 있었고 이미 자체 교정됨 — 프로세스가
  의도대로 작동한 사례로 기록
  - target 위치: `plan/in-progress/eia-terminal-error-sanitize.md` "어디서 새니타이즈할 것인가 —
    처음 답이 틀렸고 게이트가 잡았다" 절
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` §R17 "egress-only(의도)"
  - 상세: 최초 안은 **DB write 시점** 마스킹이었고, 이는 R17 의 egress-only 원칙을 근거 없이
    뒤집는 것이었다(§R17: "저장 시점(append) redaction 은... 채택하지 않았다"). 동일 세션의
    `09_25_29` rationale_continuity 검토가 이를 W1 으로 잡았고, 최종 diff 는 emit 초크포인트
    (`toTerminalErrorPayload`)로 전환해 R17 을 뒤집지 않는 형태로 귀결됐다(DB 는 무변경).
  - 제안: 없음 — 이미 해소. 참고용으로만 기록.

## 요약

이번 diff 는 `spec/5-system/**/*.md` 를 전혀 변경하지 않으며, 유일한 관련 코드 변경(종결 `Execution.error`
의 egress 마스킹 신설)은 `spec/5-system/14-external-interaction-api.md` §R17 이 확립한 "egress-only
masking" 원칙과 "emit 초크포인트에서 구조적으로 빠질 수 없게" 라는 설계 관행(#1174/#1175 계열)을
그대로 따른다 — 기각된 대안의 재도입도, 합의 원칙 위반도, 무근거 번복도 없다. 오히려 초안 단계에서
발생했던 실제 R17 위반(DB write 시점 마스킹안)은 같은 파이프라인의 이전 라운드 리뷰가 잡아 교정됐음이
plan 기록으로 확인된다. 유일한 잔여 항목은 R17 의 마스킹 카탈로그가 신설된 5번째 egress 지점을
아직 나열하지 않는다는 문서 완결성 격차이며, 이는 developer 의 spec 쓰기 권한 밖이라는 이유로
이미 planner 턴 백로그로 명시 이관돼 있어 신규 위험이 아니다.

## 위험도
LOW
