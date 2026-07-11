---
worktree: gracious-poitras-0e068b
started: 2026-07-12
owner: developer
---

# 웹채팅 위젯 multi-turn 히스토리 복원 통합 테스트 (PR #874 후속)

## 배경

PR #874 (위젯 세션 컨트롤 + 새로고침 히스토리 복원) 의 복원 경로는 **부품 단위**만 테스트돼 있다:
- `conversation.roleOf` / `threadToMessages` — `src/lib/conversation.test.ts` (unit, source→role 매핑·marker strip·presentations)
- getStatus 시드 표면 — `use-widget-eager-start.test.ts` "race fix: getStatus 가 buttons waiting 표면을 주면…" (pending.type 만 단언, **messages 미검증**)

없는 것: 여러 turn 을 담은 실제 복원 시나리오 통합 회귀 테스트
(getStatus mock(waiting_for_input + 다중 turn conversationThread) → seedWaitingFromStatus →
WAITING dispatch → mergeMessages → `state.messages` role/text/순서). 그리고 `widget-state.ts`
비공개 `mergeMessages` 의 snapshot vs local 분기(둘 다) 미커버.

## 범위 (test-only, 제품 코드 무변경)

- [x] `src/lib/widget-state.test.ts` — WAITING+`threadMessages` mergeMessages 분기 전수:
  - snapshot 이 빈 local 시드 / snapshot>local / snapshot==local(`>=` 경계, durable 우선) → snapshot 채택
  - snapshot<local → 라이브 로컬 메시지 보존(스냅샷이 최신 라이브를 덮지 않음)
  - `threadMessages` 없으면 messages 불변
- [x] `src/widget/use-widget-eager-start.test.ts` — 새로고침 복원 통합 테스트:
  저장 세션 pre-seed → boot → getStatus(waiting_for_input, 다중 turn thread) →
  `state.messages` role/text/순서 시드 + `[user-input]` marker strip + 복원 세션(신규 webhook POST 0)

## 워크플로 체크박스

- [x] TEST WORKFLOW — worktree lint PASS(43s)·unit PASS(33 pkg)·build PASS(91s)·e2e PASS(253 tests, 216s)
- [ ] `/ai-review` + SUMMARY
- [ ] `/consistency-check --impl-done spec/7-channel-web-chat` (테스트 파일이 `1-widget-app.md` `code:` glob 에 spec-linked → 가드 의무)

## 결정 메모

- **`--impl-prep` 스코프 아웃**: 제품 코드·spec·신규 식별자·API 변경 0 인 순수 테스트 추가(기존 §2 대화 렌더 규약·§3 상태기계 문서화된 동작을 characterization). impl-prep 은 착수할 구현의 spec 충돌 사전검출용이라 vacuous. (memory: "impl-prep 은 좁은 경로로 스코핑".) `--impl-done` 은 spec-linked 라 가드 의무 → 수행.
- **e2e = 수행(면제 아님)**: `*.test.ts` 전용 변경은 `PROJECT.md §e2e 면제 화이트리스트`의 회색지대(명시적으로 화이트리스트 밖)라 e2e 수행. backend Jest e2e PASS(253 tests, 229s).
- **환경 정비(사전 결함, 본 변경 무관)**: worktree 는 fresh checkout 이라 `pnpm install` 1회로 dist 빌드. (main root 에서 최초 시도 시 관측된 stale `frontend/playwright-report/` eslint 오염·stale package dist 는 worktree 엔 부재.)
