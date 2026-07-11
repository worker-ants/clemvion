# Plan 정합성 검토 — eia-context-schema-followups.md (--impl-done RE-RUN)

- diff-base: `1682777fe..HEAD` (5 commits: `964e887af`·`428134b64`·`dedc411fd`·`52e244034`·`25e098f76`)
- target: `plan/in-progress/eia-context-schema-followups.md`
- 재검증 사유: 직전 실행(`review/consistency/2026/07/11/12_33_05/plan_coherence.md`)이 WARNING 2건(항목 2·4 체크박스 과소 표기, W-spec-edit 후속 미등재)을 발견 → 5번째 커밋 `25e098f76`(`docs(review): impl-done 반영 — §4.2 SoT 에 frontend/src 추가 + plan flip`)이 이를 수정했다고 주장.
- 검증 worktree: `/Volumes/project/private/clemvion/.claude/worktrees/eia-client-context-types-33e771`

## 발견사항

이번 재검증에서 CRITICAL/WARNING 발견 없음. 직전 WARNING 2건 모두 실제 diff·리뷰 산출물 대조로 해소 확인됨.

- **[INFO]** 직전 WARNING-1(항목 2·4 체크박스 과소 표기) — 해소 확인
  - target 위치: `plan/in-progress/eia-context-schema-followups.md` `## 항목` 리스트, 항목 2·4
  - 상세: 커밋 `25e098f76`에서 두 항목 모두 `[x]`로 flip 됐고, 완료 노트가 실제 구현 diff 와 정확히 일치한다.
    - 항목 2(client `context` 정밀화): 노트가 주장하는 "위젯 `as WaitingForInputEvent` 캐스트 제거"는 `codebase/channel-web-chat/src/widget/use-widget.ts` diff 로 확인(`status.context as WaitingForInputEvent` → `status.context`, 주석으로 근거 명시). "SDK 를 harness(cmd_unit/cmd_build)에 배선"은 `.claude/test-stages.sh` diff 로 확인(`pnpm --filter @workflow/sdk test`/`build` 추가). "negative `@ts-expect-error` 테스트로 union 닫힘 고정"은 `eia-events.test.ts`·`client.spec.ts` 양쪽에 실존. "lint·unit·build·e2e(250) 통과"는 `review/code/2026/07/11/11_44_59/RESOLUTION.md` TEST 결과 표(lint PASS·unit PASS·build PASS·e2e 250 passed)로 뒷받침됨. 과장 없음.
    - 항목 4(spec 링크 가드 확장): "`spec-impl-evidence.md §4.2` SoT 표 + test 주석 동기화"는 `spec/conventions/spec-impl-evidence.md`(3-루트 → `{backend,frontend,channel-web-chat,packages}` 4-루트로 정정) diff 로 확인. `collectCodebaseSources`/`findBrokenSpecLinksInSources` 함수, 16곳 링크 수정도 diff 로 확인.
  - 결론: 완료 노트는 실측 근거가 있고 overclaim 없음.

- **[INFO]** 직전 WARNING-2(W-spec-edit 후속 미등재) — 해소 확인
  - target 위치: `plan/in-progress/eia-context-schema-followups.md` `## 리뷰 후속` 섹션
  - 상세: 커밋 `25e098f76`에서 5번째 항목 `"spec-impl-evidence.md §4.2 편집 절차 사후 확인 (planner/사용자)"`가 신설됐다. 내용이 `review/code/2026/07/11/11_44_59/RESOLUTION.md`의 `W-spec-edit`(acknowledged) 서술과 정합 — "developer 가 CLAUDE.md 상 planner 트랙인 `spec/` 를 정합화 목적으로 편집, impl-done 이 사후 검증, 절차상 planner 사후 리뷰 권고"를 정확히 반영한다. 직전 리뷰가 제안한 두 옵션(등재 또는 명시적 불필요 사유 기록) 중 "등재"를 선택해 이행함.
  - `## 리뷰 후속` 섹션은 이제 5항목(C2·W-spec-link-ci·spec-links 중복·타 packages 배선·§4.2 편집 절차 확인) — 모두 `RESOLUTION.md`의 deferred/acknowledged 판정과 1:1 대응.

## 정합 확인된 부분 (참고)

- 항목 1(DTO 디렉토리 정규화)·3(swagger §1-4 본문)은 여전히 `[ ]` — 프런트매터 상단 진행 배너("범위 밖으로 남긴다")와 일치, `plan/in-progress/`에 남는 것이 정합.
- `25e098f76`가 함께 정정한 `spec-link-integrity.test.ts` 의 주석(4-루트 서술)도 실제 `spec-links.ts`의 `CODEBASE_SOURCE_ROOTS` 배열(`codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src`·`codebase/packages`)과 일치 — 문서-코드 stale 없음.
- 이번 3차 변경(commit `25e098f76`)은 spec §4.2 서술 1행 + test 주석 + plan 문서만 건드리고 실행 코드는 무변경(커밋 메시지 자체가 "e2e 면제(주석 전용)"라 명시) — 이 주장도 diff stat 로 확인(`spec-link-integrity.test.ts` 는 주석 diff 만, 실행 코드 라인 변경 없음).
- 다른 `plan/in-progress/*.md` 문서 중 이 PR 변경 표면(`eia-types.ts`·`use-widget.ts`·`client.ts`·`spec-link-integrity.test.ts`·`spec-links.ts`·`spec-impl-evidence.md` §4.2 등)을 전제하거나 참조하는 항목은 발견되지 않음 — 후속 항목 누락·선행 plan 미해소 충돌 없음(직전 검토와 동일 결론 유지).
- 체크박스 과대 표기(미완료인데 `[x]`)는 이번에도 발견되지 않음.

## 요약

직전 실행이 지적한 WARNING 2건(항목 2·4 체크박스 과소 표기, W-spec-edit 사후 확인 미등재)은 커밋 `25e098f76` 하나로 모두 정확하게 해소됐다. 체크된 두 항목(2·4)의 완료 노트는 실제 diff·2회의 ai-review(11_44_59 → fresh 12_15_40)·lint/unit/build/e2e(250 passed) 산출물과 문장 단위로 대조해도 과장이나 누락이 없다. 미해결 항목(1·3)은 여전히 `[ ]`로 정확히 남아 plan 이 `in-progress/`에 유지되는 판단도 정합하다. `## 리뷰 후속` 섹션은 5항목 전부가 RESOLUTION 의 deferred/acknowledged 판정과 1:1 대응해 durable 하게 등재됐다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 관점에서도 추가 발견사항 없음.

## 위험도

NONE
