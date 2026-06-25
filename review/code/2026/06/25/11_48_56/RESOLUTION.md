# RESOLUTION — web-chat console e2e locator 수정 리뷰

리뷰 세션: `review/code/2026/06/25/11_48_56` (RISK=LOW, Critical 0, Warning 1)

## 조치 항목

| SUMMARY # | 카테고리 | 발견사항 | 조치 | fix commit |
|---|---|---|---|---|
| WARNING #1 | Testing | 생성 플로우 e2e 가 만들기 제출 후 dialog dismiss 상태를 검증하지 않음 — UI 가 dialog 를 안 닫는 회귀를 놓칠 수 있음 | `console.spec.ts` 생성 플로우 테스트에 `await expect(dialog).not.toBeVisible({ timeout: DIALOG_TIMEOUT })` 를 신규 봇 목록 버튼 assertion 앞에 추가. CreateWebChatDialog 가 mutate 성공 시 `onOpenChange(false)` 로 닫히는 동작과 일치 확인. | `25d8003b4` |

INFO 13건은 전부 "현행 유지" 권고 — 조치 불필요.

## TEST 결과

- lint: 통과 (`_test_logs/lint-20260625-115508.log`)
- unit: 통과 (warning fix 직전 동일 worktree 전체 통과 — vitest testMatch 가 `e2e/` 제외라 e2e-spec 변경에 불변. `_test_logs/unit-20260625-113030.log`)
- build: 통과 (next/nest build 는 e2e-spec 미포함 — e2e-spec 변경에 불변. `_test_logs/build-20260625-113118.log`)
- e2e: 통과 — `make e2e-test-full`, backend supertest 214/214 (36 suites) + playwright **40/40** (warning fix 의 dialog dismiss assertion 포함). 직전 main 은 37/40 (web-chat console 3건 실패) 였음.

## 보류·후속 항목

없음.
