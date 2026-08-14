# Rationale 연속성 검토 — `spec/5-system/` (--impl-done, diff-base=origin/main)

## 검증 방법

prompt_file 이 컨텍스트 예산 초과로 target(`spec/5-system/14-external-interaction-api.md`)와 `git diff` 본문을 생략했으므로, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)를 절대경로/`git -C`로 직접 열어 실제 diff·Rationale 원문을 대조했다:

- `git diff origin/main...HEAD --stat` (140개 파일, 실 코드 변경은 6개: `interaction.service.ts(.spec.ts)`, `websocket.service.ts(.spec.ts)`, `strip-external-only-fields.ts(.spec.ts)`)
- `git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md spec/5-system/6-websocket-protocol.md spec/1-data-model.md`
- `spec/5-system/14-external-interaction-api.md` R17, `spec/5-system/6-websocket-protocol.md` "`ai_message.llmCalls[]` 외부 수신자 strip" Rationale 항목 전문
- `spec/5-system/15-chat-channel.md` R-CC-15 / CCH-ERR-04 현재 텍스트
- `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (관련 plan)
- `codebase/backend/src/shared/utils/strip-external-only-fields.ts`(.spec.ts), `interaction.service.ts`, `websocket.service.ts` diff 전문

이 시점(HEAD `4b13ca5ae`)은 오늘 다섯 차례 이상의 `/ai-review`+`/consistency-check` 라운드(07:44~15:36)를 거쳐 수렴한 상태로, 각 라운드의 CRITICAL/WARNING 이 다음 커밋에서 처방된 흔적이 커밋 메시지·JSDoc·spec 본문에 그대로 남아 있다.

## 발견사항

이번 diff 는 두 가지 결정 번복을 포함하지만, **둘 다 새 Rationale 을 동반**하고 있어 CRITICAL/WARNING 에 해당하는 항목을 찾지 못했다.

1. **strip 깊이: top-level(depth-1)-only → 필드명 기준 깊이 무관** — 종전 `websocket.service.ts` 의 `EXTERNAL_STRIPPED_FIELDS`/`stripExternalOnlyFields` JSDoc 은 "Strip 은 top-level 필드만 수행한다 (depth-1 shallow delete)"를 **의도된 설계**로 명시했었다. 이번 diff 는 이를 재귀·깊이무관 strip(`shared/utils/strip-external-only-fields.ts`, `maxDepth` 파라미터화)으로 뒤집었다. 그러나 (a) 이 depth-1 제약은 `spec/5-system/6-websocket-protocol.md` 의 `## Rationale`(정본 결정 문서)에는 애초에 기록된 적이 없고 코드 주석에만 있었으며(`git show origin/main:...` 대조로 확인), (b) 번복 이유가 CHANGELOG.md 신규 항목 + `strip-external-only-fields.ts` JSDoc(§"왜 공유 유틸인가") + WS Rationale 본문 갱신("필드명 기준으로 어느 중첩 깊이에서든 제거한다") 세 곳에 함께 기록됐다. 따라서 criterion 3(무근거 번복)에 해당하지 않는다.
2. **`getStatus` 값-마스킹-only → 값 마스킹 + 필드 삭제 병행** — `EIA §R17` 의 기존 문구("secret-shape 만 치환")를 "값 마스킹 + 필드 삭제를 병행"으로 확장하면서, 같은 절에 `> 값 마스킹만으로는 부족하다 — ...` 새 blockquote(날짜 2026-08-14 명시)를 추가해 번복 근거를 남겼다. `## Rationale` "`ai_message.llmCalls[]` 외부 수신자 strip (strip-only 결정)" 항목의 **"기각된 대안: 값-레벨 마스킹은..."** 문단은 이번 diff 에서 삭제되지 않고 그대로 보존돼 있다 — 즉 이번 변경은 그 기각된 대안(마스킹만으로 대체)을 되살린 것이 아니라, strip 메커니즘 자체의 **적용 범위**(WS fanout 단독 → WS fanout + EIA REST `getStatus()` 양쪽, top-level → 깊이무관)를 넓힌 것이다. 직전 라운드(`15_20_28` rationale_continuity)가 동일하게 확인한 패턴과 일치한다.

두 항목 모두 CRITICAL/WARNING 기준(기각된 대안의 조용한 재도입, 원칙 위반, 무근거 번복, invariant 우회)에 해당하지 않아 등재하지 않는다. 참고로 남길 만한 INFO 한 건:

- **[INFO]** `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 체크리스트가 이미 반영된 spec 변경을 아직 미완료로 표시
  - target 위치: (참고 파일이며 `spec/5-system/` 본체는 아님) `plan/in-progress/spec-draft-eia-62-waiting-payload.md` `## 체크리스트` (`- [ ] spec 반영 — 7항목`, `- [ ] eia-terminal-payload.md 차단 해제...`)
  - 과거 결정 출처: 해당 plan 자신의 `## Overview` — "초판은 '안쪽이 통째로 허구이니 실측 shape 으로 재작성' 이라 결론냈고, 그건 틀렸다 ... 아래 (1)에서 철회했다"(WS Rationale PR #945 "직접 재작성 대신 caveat" 원칙을 따름)
  - 상세: HEAD 커밋 `4b13ca5ae`("docs(spec): 코드가 앞질러 있던 서술 7곳을 따라잡힌다")의 커밋 메시지가 바로 이 plan 의 (1)(2)(3)(6) 항목("§6.2 봉투 payload 래퍼 추가"·"interaction 블록 Planned 명시"·"URL 상대경로화"·"blockquote 화살표 정정")을 그대로 실행했음을 자인하는데, plan 체크박스는 여전히 미체크다. Rationale 자체의 무결성 문제는 아니지만(번복이 아니라 정확히 계획된 이행), 다음 세션이 체크박스만 보고 "아직 미착수"로 오판해 이미 채택된 caveat 패턴을 다시 "전면 재작성"으로 되돌릴 절차적 위험을 남긴다 — plan Overview 의 철회 caveat 가 보존돼 있어 즉시 위험은 낮다.
  - 제안: plan_coherence 검토자 영역이나, 겸사겸사 `spec-draft-eia-62-waiting-payload.md` 체크리스트를 실제 상태(스펙 반영 완료)로 갱신 권장.

## 요약

diff 의 핵심 두 결정 번복(strip 깊이 확장, `getStatus` 마스킹→마스킹+삭제 병행)은 모두 대응하는 spec `## Rationale`(WS §"llmCalls 외부 수신자 strip", EIA `R17`) 항목을 같은 커밋 내에서 함께 갱신했고, 기존 "기각된 대안" 문단은 삭제 없이 보존됐다. 특히 EIA §6.2 payload 예시를 "안쪽 JSON 실측 재작성" 대신 §6.3/§6.4 와 같은 봉투 caveat 패턴으로 정정한 것은, 해당 plan(`spec-draft-eia-62-waiting-payload.md`)이 스스로 "초판 결론(전면 재작성)은 WS Rationale 의 기존 채택 원칙(PR #945 caveat 패턴)과 충돌해 철회한다"고 명시한 뒤 그 원칙을 따른 것으로, 기각된 대안 재도입을 능동적으로 회피한 사례다. `1-data-model.md`/`15-chat-channel.md`(CCH-ERR-04)의 nullable `error.code` 반영도 EIA 본문의 새 결정과 정합한다. 코드(`strip-external-only-fields.ts`)의 `maxDepth` 경계 처리 역시 spec 이 말하는 "깊이 무관"의 실제 의미(경계 밖은 자매 sanitizer 의 collapse 가 보완)를 JSDoc·테스트로 정확히 반영해 spec-code 간 invariant 불일치가 없다. Rationale 연속성 관점에서 문제되는 항목은 발견하지 못했다.

## 위험도

NONE
