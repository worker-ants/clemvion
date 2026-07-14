# Rationale 연속성 검토 — spec/5-system/14-external-interaction-api.md (--impl-done)

## 검토 방법

payload 의 "관련 Rationale 발췌" 는 스코프와 무관한 다수 spec(navigation/schedule/integration 등)에서
키워드 매칭으로 수집돼 1370라인 지점에서 잘려, 정작 본 diff 와 가장 밀접한
`spec/5-system/14-external-interaction-api.md`(target 본인) · `spec/5-system/4-execution-engine.md`
§7.5.1 · `spec/5-system/15-chat-channel.md` 의 Rationale 은 payload 에 포함되지 못했다. 이 갭은
HEAD 워킹트리에서 대상 spec 파일과 `git log`/`git show` 를 직접 조회해 보완했다 (아래 근거는 모두
`/Volumes/project/private/clemvion/.claude/worktrees/conversation-thread-secret-hardening-6477bb` 기준).

## 발견사항

검토 결과 **기각된 대안의 재도입 / 합의 원칙 위반 / 무근거 번복 / invariant 우회 사례를 찾지 못했다.**
오히려 이 변경은 기존 Rationale 을 명시적으로 인용·연장하는 드문 수준의 정합 사례다. 근거:

- **F-1 (`expectedNodeId` 일치 검사)** — `spec/5-system/4-execution-engine.md` §7.5.1 Rationale
  "대기 표면 ↔ 명령 매트릭스"(2026-07-11)는 이미 "이 거부는 EIA-IN-13 필수 요구사항 + EIA §5.1
  `STATE_MISMATCH` 행이 약속한 동작이라, 코드가 그 미이행 갭을 메운 것이지 새 계약이 아니다" 라고
  명시한다. target 문서 §5.1 에도 오늘자(2026-07-14) 커밋(`e0d4ddf51`)으로 "`STATE_MISMATCH` 강제
  정합(2026-07)" 메모가 이미 추가되어 있어, 이번 diff(engine/interaction 코드) 는 그 spec 약속을
  구현으로 따라잡는 것이지 과거 결정의 번복이 아니다.
- **`in_process_trusted` nodeId 면제** — `interaction.service.ts` 의 `isInternalCtx(ctx)` 분기는
  target §3.3.1 EIA-AU-08 이 정의한 구조적 invariant("HTTP 진입점이 합성하는 ctx 는 `scope` 필드를
  set 하지 않는다" · "`scope: 'in_process_trusted'` 는 서버 내부 모듈만 set 가능")를 그대로 재사용한
  타입 가드이며, 이를 우회하거나 재정의하지 않는다. 면제 정책 자체도 `4-execution-engine.md §7.5.1`
  "nodeId 검사 진입점별 커버리지" 표(및 그 직전 커밋 `3bbe3cc90` 의 ai-review CRITICAL "spec
  overclaim" 수정 이력)로 이미 명문화돼 있고, diff 의 코드·주석이 그 표와 1:1 대응한다.
- **F-2 (surfaceMismatch 안내 발송)** — `hooks.service.ts` 의 `sendSurfaceMismatchNotice` 도입은
  `spec/5-system/15-chat-channel.md` §4.1.1 이 이미 명시한 `CCH-ERR-04`("분류 표에 없는 코드 …
  silently swallow 금지")의 원칙을 대기-표면 불일치 케이스로 확장한 것이며, 같은 spec 문서가
  "종전엔 로그만 남기던 조합에 사용자 피드백을 준다" 고 명시적으로 인과관계를 서술한다. `hooks.service.ts`
  구코드 주석("사용자 대상 안내 문구는 후속 항목 F-2")도 이 변경이 처음부터 계획된 후속이었음을
  뒷받침한다 — 별도 근거 없는 임의 번복이 아니다.
- **`nodeId: 'chat-channel'` placeholder 제거** — 이 placeholder 를 spec 어디에서도 "의도된 설계
  결정"으로 문서화한 적이 없다(존재 검사만 만족시키던 구현상의 임시 값). F-1 도입으로 실제 nodeId
  검사가 생기면서 placeholder 가 오해를 낳으므로 제거한 것이며, `4-execution-engine.md`·
  `data-flow/15-external-interaction.md` 양쪽 모두 이미 `expectedNodeId=undefined` 로 갱신되어 있어
  코드·spec·data-flow 세 위치가 정합한다.
- **breaking-behavior(202→409) 처리** — `plan/in-progress/eia-command-waiting-surface-guard.md` F-3
  항목이 "외부 공지 여부"를 사용자 결정으로 명시 기록하고, 그 근거("EIA §5.1 은 처음부터 이 조합에
  409 를 공표된 계약으로 명시 — 종전 202 는 결함")를 target 문서 §5.1 에 새 Rationale 각주로
  동시에 남겼다. "결정 번복 시 새 Rationale 동반" 기준을 정확히 충족한다.

이상 5개 항목 모두 **CRITICAL/WARNING 판정에 해당하는 정합성 결함이 없다.**

## 요약

이번 diff(F-1 `expectedNodeId` 검사 + F-2 `surfaceMismatch` 안내)는 기각된 대안을 재도입하거나 원칙을
어기는 대신, EIA-IN-13·EIA §5.1 `STATE_MISMATCH`·EIA-AU-08 in-process-trusted invariant·
CCH-ERR-04 silently-swallow 금지 등 기존 Rationale 을 명시적으로 인용해 "약속됐지만 미구현이던 갭"을
메우는 방식으로 구현됐다. 코드 변경에 선행/병행해 `4-execution-engine.md §7.5.1`·`14-external-interaction-api.md
§5.1`·`15-chat-channel.md §4.1.1`·`data-flow/15-external-interaction.md` 가 모두 갱신돼 있고, plan
문서(F-1/F-2/F-3)에 결정 근거·검토 이력(ai-review CRITICAL 수정 포함)까지 남아 있어 Rationale
연속성 관점에서는 모범적인 사례에 가깝다. payload 자체의 "관련 Rationale 발췌"가 대상과 무관한
문서로 채워져 정작 필요한 발췌(target/execution-engine/chat-channel)가 누락된 것은 orchestrator
쪽 개선 여지이나, 이는 본 checker 의 최종 판정에 영향을 주지 않도록 HEAD 워킹트리에서 직접 보완했다.

## 위험도

NONE
