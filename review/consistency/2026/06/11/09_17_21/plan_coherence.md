# Plan 정합성 검토 결과

검토 대상: V-02 AI 노드 override UI 누락 해소 — IE/TC auto-form 이행  
diff-base: origin/main  
검토 시각: 2026-06-11

---

## 발견사항

### [INFO] spec-code-cross-audit plan 의 V-02 항목이 main 트리에서 아직 `[ ]`(잔여) 상태
- target 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/override-registry.ts` 및 `ai-configs.tsx` 삭제
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 라인 30 — `잔여: V-02(AI override UI), V-04~V-06...`
- 상세: main 트리의 `spec-code-cross-audit-2026-06-10.md` 에서 V-02 는 "잔여: 결정 대기" 목록에 여전히 남아 있다. 그러나 현재 worktree(`ai-node-override-fields`) 안의 동일 파일은 V-02 를 `[x]` 로 마킹하고 "ai-node-override-fields 브랜치(본 PR)에서 해소" 라고 기록되어 있다. 이는 PR 머지 전 정상적인 상태(pre-merge worktree 갱신)로 충돌이 아니다. 다만 PR 머지 시 main 트리의 cross-audit plan 도 함께 갱신되어야 한다.
- 제안: PR 머지 커밋에 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 V-02 라인 갱신을 포함하거나, 머지 직후 별도 커밋으로 정리. 현재 worktree 파일은 이미 최신화되어 있으므로 PR 범위에 해당 plan 변경이 포함되어 있는지 확인.

### [INFO] node-output-redesign plan 의 text-classifier / information-extractor 미해소 `(impl)` 항목과의 분리 확인
- target 위치: `ai-configs.tsx` 삭제, `override-registry.ts` 에서 두 노드 항목 제거
- 관련 plan: `plan/in-progress/node-output-redesign/text-classifier.md` (라인 202–205), `plan/in-progress/node-output-redesign/information-extractor.md` (라인 224–231)
- 상세: 두 node-output-redesign 하위 plan 에는 다음 미해소 `(impl)` 항목들이 있다.
  - text-classifier: `meta.llmCalls` 위치 통일 검토, `output.error.details.originalInput` 500자 cap 경계 테스트, legacy `error: z.string().optional()` 제거.
  - information-extractor: `output.maxTurns`/`output.message` 제거, `status: 'resumed'` 구현, waiting config echo 보강, multi-turn ConversationThread push, `turnDebugHistory` cap.
  - 이 항목들은 모두 backend handler/schema 영역(`text-classifier.handler.ts`, `information-extractor.handler.ts` 등)이며, 이번 target diff(`ai-configs.tsx` 삭제 + `override-registry.ts` 수정) 는 **frontend 설정 패널 등록 해제** 만 다룬다. 두 영역은 직교하므로 충돌 없음.
  - 단, text-classifier 와 information-extractor 의 bespoke UI 를 삭제하면 이 두 노드는 완전히 auto-form(schema-driven) 으로 전환된다. node-output-redesign 의 향후 (impl) 항목들이 schema 를 변경할 때, auto-form 렌더링에 반영되는지 UI 레벨 검증이 필요하다(zod schema 의 uiHint 를 통해 auto-form 이 필드를 렌더하므로 schema 변경 시 자동 반영될 가능성이 높음).
- 제안: 후속 node-output-redesign Phase E 착수 시 "text-classifier·information-extractor 가 auto-form 전환됨"을 각 plan 파일 헤더에 INFO 한 줄 추가. 해당 항목이 frontend 별도 컴포넌트를 전제하지 않음을 명시하면 충돌 우려를 차단.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: 동일 파일(`node-configs/override-registry.ts`, `ai-configs.tsx`) 을 건드리는 다른 active worktree 를 확인했다.

활성 worktree 목록 (`git worktree list`):
- `claude/auth-refresh-rotation-atomic` — node-configs 영역 diff 없음. Skip.
- `claude/kb-banner-refactor-76a800` — node-configs 영역 diff 없음. Skip.
- `claude/unified-model-mgmt-5af7ee` — node-configs 영역 diff 없음. Skip.

stale 판정 cascade:
- 세 worktree 모두 Step 1 (`merge-base --is-ancestor`) → ACTIVE (main 의 조상 아님).
- Step 2 (GitHub PR state) — gh pr list 결과 empty (원격 push 미완료 또는 내부 repo). Step 3 보수적 fallback → active 로 처리.
- 그러나 세 worktree 모두 `codebase/frontend/src/components/editor/settings-panel/node-configs/` 에 diff 가 없어 §5 worktree 충돌 해당 없음.

Stale 로 skip 한 worktree: **0건**.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target diff (V-02: `ai-configs.tsx` 삭제 + `override-registry.ts` 에서 `text_classifier`·`information_extractor` 제거) 는 진행 중인 plan 들과 실질적 충돌이 없다. `spec-code-cross-audit-2026-06-10.md` 가 V-02 를 해소 대상으로 명시하고, 해당 worktree 내 plan 파일에서 이미 `[x]` 처리되어 있어 plan 과 implementation 이 정합하다. `node-output-redesign/text-classifier.md` 및 `information-extractor.md` 의 미해소 `(impl)` 항목들은 backend 영역으로 이번 frontend 변경과 직교한다. 다른 active worktree 는 동일 파일을 건드리지 않는다. worktree 충돌 후보 중 stale 판정으로 skip 한 건은 0건.

---

## 위험도

LOW

STATUS: OK
