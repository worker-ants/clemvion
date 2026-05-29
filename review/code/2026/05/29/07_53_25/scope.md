# 변경 범위(Scope) 리뷰

대상: chat-channel-form-native-modal PR (파일 1~40)
작업 의도: §4.1 native modal 게이팅 — Slack views.open / Discord MODAL_SUBMIT 경로 신설 (formMode auto/native_modal 추가, supportsNativeForm 플래그, dispatcher form_modal 분기 재정렬, open_form_modal / form_submission command 처리)

---

## 발견사항

### [INFO] 파일 12 (slack-message.renderer.spec.ts) — 기존 테스트 케이스 라벨 변경
- 위치: `describe('renderSlackEvent — form 다단계 (CCH-MP-03)')` 내 첫 번째 it 블록
- 상세: 기존 `'첫 필드 → form_prompt + hint'` 가 `'multi_step opt-out → 첫 필드 form_prompt + hint'` 로 변경되고, `CONFIG` 가 `{ ...CONFIG, uiMapping: { formMode: 'multi_step' } }` 로 수정됐다. 이는 native modal 기본 경로 추가에 따른 테스트 픽스처 보정이므로 범위 내 수정이다. 단, 기존 테스트의 의미 변경(formMode 명시)이 포함되어 있어 기록한다.
- 제안: 이상 없음 — 작업 의도에 필수적인 테스트 픽스처 갱신.

### [INFO] 파일 3 (chat-channel.dispatcher.ts) — renderNode 호출 위치 재배치
- 위치: `handle()` 메서드 내 `adapter.renderNode(...)` 호출을 form 게이팅 블록 이전으로 이동
- 상세: 기존에는 form 게이팅 → renderNode 순이었으나, native modal 분기가 renderNode 결과(form_modal vs form_prompt) 를 보고 결정해야 하므로 renderNode 를 form 게이팅 앞으로 이동했다. 위치 재배치지 코드 자체의 추가 삭제가 아니며, 변경 의도와 직결된다. 오래된 블록 삭제와 신규 블록 추가가 동시에 이뤄져 diff 상 삭제처럼 보이나 실질은 순서 변경이다. 범위 내.

### [INFO] 파일 29~35 (review/consistency/2026/05/29/00_19_26/*) — 사전 consistency-check 산출물 포함
- 위치: `review/consistency/2026/05/29/00_19_26/` 디렉터리 전체
- 상세: 이 PR 에 impl-prep consistency-check 결과 파일들 (`_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`) 이 포함됐다. CLAUDE.md `정보 저장 위치 표` 에 의하면 일관성 검토 산출물은 `review/consistency/<YYYY>/...` 에 저장되며, 이는 정책에 따른 의도된 저장이다. developer 역할이 impl-prep 게이트를 통과한 이력을 커밋에 포함시킨 것으로, 작업 추적 목적의 적법한 포함이다.
- 제안: 이상 없음.

### [INFO] 파일 28 (plan/in-progress/chat-channel-form-native-modal.md) — plan 파일 갱신
- 위치: frontmatter(`worktree`, `status`, `owner`) 및 본문 체크박스·구현 scope 갱신
- 상세: worktree 슬러그 확정, status backlog→in-progress 전환, 구현 scope 구체화, consistency-check 결과 노트 추가. plan lifecycle 정책에 따른 정상 갱신이다.
- 제안: 이상 없음.

### [INFO] 파일 36~40 (spec/*) — spec 파일 변경
- 위치: `spec/4-nodes/7-trigger/providers/discord.md`, `slack.md`, `telegram.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`
- 상세: diff가 프롬프트 크기 한도로 일부 생략됐으나, plan 본문에 "Spec 단계 완료 (2026-05-28)"가 기재되어 있고 impl-prep consistency-check가 수행된 점을 감안하면, spec 변경은 이 작업의 공식 scope(산출물 범위 §2)에 명시적으로 포함된다. telegram.md 는 단 1줄 변경(`§4 다단계 시퀀스` → `§4.2 다단계 텍스트 시퀀스` + `supportsNativeForm=false` 주석 추가)으로 범위 내 최소 수정이다.
- 제안: 이상 없음.

### [INFO] 파일 1 (channel-adapter.registry.spec.ts) — FakeAdapter에 supportsNativeForm 추가
- 위치: `class FakeAdapter` — `readonly supportsNativeForm = false;` 단 1줄 추가
- 상세: `ChatChannelAdapter` 인터페이스에 `supportsNativeForm` 이 추가됨에 따라 기존 테스트 픽스처 `FakeAdapter` 에 해당 필드를 추가한 것. TypeScript 인터페이스 호환성 유지를 위한 최소 수정이며 범위 내.

---

## 요약

전체 40개 파일(백엔드 구현 16개, 테스트 11개, spec 5개, plan 1개, review 산출물 7개)의 변경은 "Form native modal — Slack views.open + Discord MODAL_SUBMIT" 작업의 공식 산출물 범위(`plan/in-progress/chat-channel-form-native-modal.md` §산출물 범위)에 명시된 항목과 일치한다. 범위 밖 리팩토링, 불필요한 포맷팅 변경, 임포트 정리, 무관한 파일 수정은 발견되지 않았다. dispatcher 에서 renderNode 호출 위치를 form 게이팅 블록 앞으로 이동한 것은 native modal 분기가 렌더 결과를 필요로 하는 설계 변경의 직접적인 결과이며, slack-message.renderer.spec.ts 의 기존 테스트 픽스처 수정은 formMode 기본값 변경(undefined → 'auto')에 따른 필수 보정이다. review 산출물 파일 포함은 CLAUDE.md 정책에 따른 적법한 이력 보존이다.

## 위험도

NONE
