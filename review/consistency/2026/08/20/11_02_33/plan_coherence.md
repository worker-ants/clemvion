# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base origin/main)

## 발견사항

- **[WARNING]** 선행 precondition plan(`eia-masked-prefill-roundtrip-guard.md`)이 이미 origin/main 에 병합됐는데도 `plan/in-progress/` 에 미해결 상태로 남아 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (`token` 계열 확장 불릿, 2026-08-17) — 이 target 변경(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 의 `token` 계열 확장)은 `plan/in-progress/eia-secret-pattern-token-family.md` 본문에서 명시적으로 "사용자가 프리필 가드(#1181) 다음 순서로 지정했다" 고 밝히며, 그 순서 근거가 되는 문서가 바로 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 다.
  - 관련 plan: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` — 마지막 줄 "`token=` 패턴 확장은 이 PR 에 넣지 않는다 — 사용자가 순서를 택했다. 그 확장은 마스킹 대상을 넓혀 이 왕복 오염 범위도 함께 넓히므로, 가드가 선 뒤에 하는 것이 맞다."
  - 상세: git log 실측 — 이 target 이 만들어진 브랜치(`eia-secret-pattern-token`)의 부모 커밋은 `c9cc2a923`(`fix(frontend): 마스킹된 폼 기본값이 프리필돼…(#1181)`)이고, 이 커밋이 정확히 `origin/main` 의 tip 이다(`git merge-base HEAD origin/main` == `c9cc2a923`). 즉 시퀀싱 전제("가드가 먼저 landing")는 실제로 충족됐다. 다만 그 근거 문서인 `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 자체는 `frontmatter.worktree: eia-masking-round2-53afc8`(다른 worktree)를 그대로 두고, 체크리스트 마지막 항목 `- [ ] push → PR` 이 미체크 상태이며, `plan/complete/` 로 이동되지 않았다. plan 파일만 보면 "아직 push 도 안 된, 진행 중인 작업"으로 읽히지만 실제로는 이미 main 에 병합된 완료 작업이다.
  - 제안: `eia-masked-prefill-roundtrip-guard.md` 를 소유한 worktree/세션 쪽에서 체크박스를 완료로 갱신하고 `plan/complete/` 로 이동해야 한다(이 target 워크트리의 책임 범위 밖이라 이 리뷰에서 직접 고치지 않음). 방치하면 이후 다른 세션의 plan_coherence 재검토가 "가드가 아직 안 섰다" 는 stale 정보를 SoT 로 오인해, 이미 해소된 전제를 다시 "미해결 선행 plan" 으로 재지적하거나 실제로 landing 여부를 재확인하지 않고 넘어갈 위험이 있다.

## 정합성 확인 (문제 없음 — 참고용)

- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `"SECRET_LEAK_PATTERNS` 가 bare `token=` 을 안 잡는다"` 항목은 `[x]` 로 닫혀 있고, 그 해소 서술이 target 코드 diff·`11-mcp-client.md`/`14-external-interaction-api.md` §R17 변경과 정확히 일치한다(값 패턴 + `CREDENTIAL_KEY_PATTERN` 2곳 + MCP 전용 배열 흡수).
- 같은 트래커의 **workflow-assistant `maskSensitiveFields`** 항목(`[ ]`, 미해결·"결정 필요" 항목: 값-패턴 마스킹을 겹칠지 여부)은 target 이 **건드리지 않았고**, `14-external-interaction-api.md` §R17 캐비엇("다만 이 확장은 잔여 ③ 에 미치지 않는다")이 그 경계를 명시적으로 기록해 미해결 결정을 우회하지 않았음을 확인.
- `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 가 세운 마커 가드(`MASKED_MARKERS`/`isMaskedMarker`, backend `sanitize-error-message.ts` ↔ frontend `dynamic-form-ui.tsx`)는 패턴-무관(마커 문자열 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 자체만 검사)이므로, 이번 target 의 `token` 계열 확장으로 마스킹 대상이 넓어져도 별도 갱신 없이 자동으로 커버된다(코드 실측: `VALUE_MASK_MARKER = '***'` 가 `MASKED_MARKERS` 양쪽 SoT 에 동일). 위 plan 이 우려했던 "가드가 선 뒤에 확장" 순서·안전성 요건은 실제로 충족됨.
- `plan/in-progress/ie-resume-turn-boundary-cancel.md` 의 `USER_MESSAGE` secret 마스킹 비대칭 항목은 이미 "해소(2026-08-17)" 로 자체 종결돼 있고 target 변경과 충돌 없음(오히려 target 의 `token` 계열 확장으로 커버리지가 함께 넓어짐).
- `spec-sync-external-interaction-api-gaps.md` 의 "자격증명 없는 연결 문자열" 항목(`[ ]`, 별건)은 target plan(`eia-secret-pattern-token-family.md`) 이 "트래커 전제가 반증됐다"며 명시적으로 분리·미착수 상태를 유지 — 결정 우회 아님.

## 요약

target(`spec/5-system/`)의 `token` 계열 값·키 마스킹 확장은 자신이 의존하는 두 개의 진행 중 plan(마스킹 프리필 왕복 가드 `#1181`, workflow-assistant `maskSensitiveFields` 미해결 결정)과 범위·순서 양쪽에서 정합했다 — 순서는 git 이력으로 실측 확인되고, 미해결 결정(마스킹 방식 우선순위)은 target 이 손대지 않은 채 spec 캐비엇으로 경계만 기록했다. 유일한 흠은 그 순서 전제를 세운 `eia-masked-prefill-roundtrip-guard.md` 자체가 이미 병합됐음에도 `plan/in-progress/` 에 미해결 상태(unchecked 체크박스·구 worktree 이름)로 남아 있는 plan 위생 문제로, target 의 코드/spec 정합성 자체를 해치지는 않지만 이후 검토자를 오도할 수 있어 별도 정리가 필요하다.

## 위험도

LOW
