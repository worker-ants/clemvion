# Cross-Spec 일관성 검토 — cross_spec

- 검토 모드: `--impl-done`
- scope: `spec/conventions/` (실질 target: `spec/conventions/interaction-type-registry.md`)
- diff-base: `origin/main`
- HEAD 워킹트리(코드 SoT): `/Volumes/project/private/clemvion/.claude/worktrees/result-detail-props-hook-94eca4`
- 커밋: `b6a9c6cf5`(hook 추출) · `358f12ca1`(레터 연속화 + hook test 강화)

## 사전 메모 — 입력 payload 이슈

`_prompts/cross_spec.md` 는 2801줄 지점에서 `... (truncated due to size limit) ...` 로 잘려 있고, 실제 변경 대상인 `interaction-type-registry.md` 본문·diff 가 payload 안에 포함되지 못한 채 무관한 `spec/conventions/` 하위 문서(cafe24 카탈로그, 데이터 모델 등)만 나열돼 있었다. 이 산출물은 payload 대신 워킹트리에서 직접 `git diff origin/main..HEAD`, `git show`, 관련 코드 파일을 절대경로로 읽어 작성했다 — payload 미포함 사실 자체를 orchestrator 에 알릴 필요가 있다(재현 시 prompt 조립 로직 점검 권장, 이 세션에서는 target 파일이 좁고 명확해 직접 조회로 충분히 커버 가능했다).

## 변경 요약

1. **코드**: `ResultDetail` 소비처(에디터 드로어 `run-results-drawer.tsx` + 실행 상세 `executions/[executionId]/page.tsx`)가 각자 유도하던 waiting selector·resume 콜백·타입별 대기 플래그를 `use-result-detail-waiting.ts` 의 `useResultDetailWaiting()` + `deriveFlags(isSelectedWaiting)` 로 단일화.
2. **spec**: `spec/conventions/interaction-type-registry.md` §1.2 매트릭스의 frontend 처리 분기 열에서 drawer(옛 (d))·page(옛 (e)) 개별 항목을 hook `deriveFlags` 단일 사이트로 교체, 레터를 (a)~(f) 로 재연속화. rule 3 의 `REGISTRY_SITES` 서술을 "4개 파일"→"3개 파일"(`use-execution-events.ts`/`apply-execution-snapshot.ts`/`use-result-detail-waiting.ts`)로 갱신 + drawer 잔여 `isLiveConversation` subset 소비처 설명 추가.
3. **테스트**: `interaction-type-exhaustiveness.test.ts` 의 `REGISTRY_SITES` 배열이 실제로 4→3 파일로 교체됨(drawer/page 제거, hook 추가).

## 코드 검증

- `use-result-detail-waiting.ts` 확인: `deriveFlags` 가 `isWaitingForm`/`isWaitingButtons`/`isWaitingConversation` 3개 플래그를 반환하며, `isWaitingConversation` 은 `ai_conversation` 과 `ai_form_render` 를 모두 흡수 — spec 서술과 일치.
- `run-results-drawer.tsx` : `deriveFlags(isSelectedWaiting)` 호출로 3플래그를 받고, 그와 별개로 `isLiveConversation` 을 로컬에서 plain `||` 비교로 직접 계산 — spec rule 3 의 "subset 소비처, exhaustive 아님" 서술과 정확히 일치.
- `executions/[executionId]/page.tsx` : 동일 hook 사용, `isLiveConversation` 없음 — spec 이 "drawer 잔여" 로 한정한 서술과 일치(과잉 일반화 아님).
- `interaction-type-exhaustiveness.test.ts` : `REGISTRY_SITES` 배열이 정확히 `use-execution-events.ts` / `apply-execution-snapshot.ts` / `use-result-detail-waiting.ts` 3개 — spec rule 3 서술과 일치.
- resume-routing 노트의 "§1.2 매트릭스 `ai_form_render` 행 (f) 참조" — 실제 §1.2 표에서 `ai_form_render` 행의 (f) 는 `resumeFromAiRenderForm` — 레터 재번호 이후에도 정합.

## 발견사항

### INFO — `interaction-type-registry.md` frontmatter `code:` 목록에 신규 hook 파일 미등재

- target 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` (라인 4~13)
- 충돌 대상: 실제 구현 `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts` (§1.2 매트릭스 본문에서 핵심 인용 대상으로 승격됨)
- 상세: 매트릭스 본문은 `use-result-detail-waiting.ts` 를 (d) 위치의 단일 SoT 사이트로 명시적으로 인용하지만, frontmatter `code:` 글로브 목록에는 여전히 옛 9개 항목만 있고 hook 파일이 추가되지 않았다. 다만 `spec-code-paths.test.ts` 가드는 "`code:` 가 ≥1 파일 매치" 만 요구하므로 build 가드 위반은 아니다 — 기존 목록도 `run-results-drawer.tsx`/`page.tsx` 를 애초에 등재한 적이 없어(확인: `git show origin/main:spec/conventions/interaction-type-registry.md` 동일 9개 항목) 이번 PR 이 새로 만든 결손이 아니라 **기존 관례의 연장**이다.
- 제안: 필수 수정 아님. 다음에 이 문서를 만질 때 `code:` 를 매트릭스 본문의 실제 핵심 파일(hook 포함)과 맞추는 정리를 권장.

## 요약

이번 변경은 프론트엔드 리팩터(드로어·페이지 중복 waiting selector → 공용 hook)와 그에 정확히 대응하는 `spec/conventions/interaction-type-registry.md` §1.2 매트릭스·rule 3·`interaction-type-exhaustiveness.test.ts` `REGISTRY_SITES` 의 동시 갱신이다. 코드(hook `deriveFlags`, drawer 의 잔여 `isLiveConversation` subset 분기, page.tsx 의 hook 전용 사용, 실제 테스트 파일 배열)를 직접 워킹트리에서 대조한 결과 spec 서술과 100% 일치하며, 레터 재연속화((a)~(f))도 매트릭스 내부·resume-routing 노트의 교차 참조("(f) 참조")까지 정합하다. 다른 spec 파일(`1-data-model.md`, `chat-channel-adapter.md`, `0-architecture.md`, `i18n-userguide.md`)의 `interaction-type-registry` 참조는 레터·파일 개수를 인용하지 않으므로 이번 변경으로 깨진 cross-reference가 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 모델에는 영향 없음(순수 프론트엔드 내부 리팩터 + 그 설명 문서 동기화). 유일한 관찰 사항은 frontmatter `code:` 목록이 매트릭스 본문의 실제 핵심 파일과 완전히 동기화되어 있지 않다는 것이나, 이는 사전부터 존재한 관례이고 가드도 통과하므로 INFO 수준.

## 위험도

LOW
