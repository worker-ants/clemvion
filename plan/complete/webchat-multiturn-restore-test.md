---
worktree: gracious-poitras-0e068b
started: 2026-07-12
owner: developer
spec_impact: none
---

# 웹채팅 위젯 multi-turn 히스토리 복원 통합 테스트 (PR #874 후속) — 완료

> **완료(2026-07-12)**: test-only characterization PR. 4 commit(261794ec6·462a23e4e·cb530720b·866d3f62d).
> spec 본문 무변경(`spec_impact: none`) — 기존 §2/§3 문서화된 동작을 회귀 테스트로 고정.
> 아래 "후속" 항목은 모두 **defer/외부 이관 완료**(open 항목 0): non-blocking INFO 는 backlog carve-out,
> consistency 사전 결함 3건은 별도 task chip 으로 분리.

## 배경

PR #874 (위젯 세션 컨트롤 + 새로고침 히스토리 복원) 의 복원 경로는 **부품 단위**만 테스트돼 있다:
- `conversation.roleOf` / `threadToMessages` — `src/lib/conversation.test.ts` (unit, source→role 매핑·marker strip·presentations)
- getStatus 시드 표면 — `use-widget-eager-start.test.ts` "race fix: getStatus 가 buttons waiting 표면을 주면…" (pending.type 만 단언, **messages 미검증**)

없는 것: 여러 turn 을 담은 실제 복원 시나리오 통합 회귀 테스트
(getStatus mock(waiting_for_input + 다중 turn conversationThread) → seedWaitingFromStatus →
WAITING dispatch → mergeMessages → `state.messages` role/text/순서). 그리고 `widget-state.ts`
비공개 `mergeMessages` 의 snapshot vs local 분기(둘 다) 미커버.

**명시적 out-of-scope(carve-out)**: 복원 표면이 `ai_conversation` 다중 turn 인 경우만 통합 검증한다.
`buttons`/`form` interactionType 복원 시 `threadMessages` 시드 여부는 본 PR 스코프 밖 — 필요 시 후속
백로그. (mergeMessages·threadToMessages 자체는 interactionType 과 무관하게 동작하므로 회귀 위험 낮음.)

## 범위 (test-only, 제품 코드 무변경)

- [x] `src/lib/widget-state.test.ts` — WAITING+`threadMessages` mergeMessages 분기 전수:
  - snapshot 이 빈 local 시드 / snapshot>local / snapshot==local(`>=` 경계, durable 우선) → snapshot 채택
  - snapshot<local → 라이브 로컬 메시지 보존(스냅샷이 최신 라이브를 덮지 않음)
  - 빈 배열 스냅샷(`[]`, length-0 경계) → local 비면 빈 유지·비어있지 않으면 로컬 보존 (ai-review WARNING#1 후속)
  - `threadMessages`=undefined(타입 레벨 방어 분기, 프로덕션 미도달) → messages 참조 불변
- [x] `src/widget/use-widget-eager-start.test.ts` — 새로고침 복원 통합 테스트:
  저장 세션 pre-seed → boot → getStatus(waiting_for_input, 다중 turn thread) →
  `state.messages` role/text/순서 시드 + `[user-input]` marker strip + 복원 세션(신규 webhook POST 0)
- [x] `src/lib/widget-state.ts` — `mergeMessages` JSDoc 정정(합치/dedup 서술 → 실제 length-기반 select 정책, ai-review WARNING#2)

## 워크플로 체크박스

- [x] TEST WORKFLOW — worktree lint·unit(33 pkg)·build·e2e(253 tests) PASS. fix(`462a23e4e`) 후 재수행도 전부 PASS.
- [x] `/ai-review` + SUMMARY — 1차 `01_10_15`: RISK=LOW, Critical 0, Warning 2(둘 다 fix `462a23e4e`), side_effect disk-write gap 재실행(NONE). fix 후 fresh `01_40_43`: **Critical 0, Warning 0**(전부 INFO, WARNING 해소 재검증). review-guard CODE-REVIEW gate 통과.
- [x] `/consistency-check --impl-done spec/7-channel-web-chat` — `01_41_42`: **BLOCK: NO**(Critical 0). SPEC-CONSISTENCY gate 통과. WARNING 3건은 전부 **본 diff 무관 사전 결함**(demo/example 해요체·backend `embed-config.dto.ts` 파일명·완료 plan `spec-draft-pr874-deferred-docs` 잔류) → 별도 후속 task 로 분리(스코프 밖).

## ai-review INFO 후속 (non-blocking, defer)

- `fetchMock` GET-status 골격 공용 헬퍼 추출(`installFetchWithStatusContext`) — maintainability/testing 공통 INFO, RESOLUTION 에 defer 기록.
- `mergeMessages` 함수명·describe 제목의 "병합" 어휘를 정정된 JSDoc("선택", interleave/dedup 아님)과 일치(예: `selectMessages`) — 낮은 우선순위, 향후 접촉 시.
- `seedWaitingFromStatus` soft-fail 경로·`buttons`/`form` 복원 시드 커버리지 — plan carve-out 대로 후속 백로그.

## 결정 메모

- **`--impl-prep` 스코프 아웃**: 제품 코드·spec·신규 식별자·API 변경 0 인 순수 테스트 추가(기존 §2 대화 렌더 규약·§3 상태기계 문서화된 동작을 characterization). impl-prep 은 착수할 구현의 spec 충돌 사전검출용이라 vacuous. (memory: "impl-prep 은 좁은 경로로 스코핑".) `--impl-done` 은 spec-linked 라 가드 의무 → 수행.
- **e2e = 수행(면제 아님)**: `*.test.ts` 전용 변경은 `PROJECT.md §e2e 면제 화이트리스트`의 회색지대(명시적으로 화이트리스트 밖)라 e2e 수행. backend Jest e2e PASS(253 tests) — 2회 수행: 최초 main-root 검증 229s, 이후 worktree 검증 216s(동일 결과).
- **환경 정비(사전 결함, 본 변경 무관)**: worktree 는 fresh checkout 이라 `pnpm install` 1회로 dist 빌드. (main root 에서 최초 시도 시 관측된 stale `frontend/playwright-report/` eslint 오염·stale package dist 는 worktree 엔 부재.)
