# RESOLUTION — buildEditorHref 콜사이트 slug 회귀 테스트 (phase 2 후속)

ai-review(`review/code/2026/07/09/15_57_38`) = **LOW, Critical 0 / Warning 1**. 순수 테스트 전용 diff
(3개 테스트 파일, production 무변경).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
|---|---|---|---|
| W1 | Documentation | 완료 plan `editor-slug-phase2.md` 의 defer 노트(triggers/usage-node-list/overview-card 3곳)가 본 커밋으로 해소됐음을 addendum 으로 역참조(→ defer 해소, e2e 클릭-스루는 여전히 단위 레벨) | (plan addendum) |

INFO 12건은 전부 선택적(테스트 정밀도·mock/주석 중복·describe 배치 등)·조치 불요 — 소스 배선 정확성과
회귀 가드 목적은 달성 확인(reviewer 긍정).

## TEST 결과

- **lint**: 통과 (0 errors, 12 warnings — 전부 pre-existing).
- **unit**: 통과 (268 files, 5193 passed / 1 skipped — 신규 콜사이트 테스트 3파일 18 tests 포함).
- **build**: 통과 (`next build --webpack`, 101/101).
- **e2e**: **환경/스위트 flakiness — 무관 스펙 timeout**. `make e2e-test-full` 을 3회 실행했으나 매 회
  **본 변경과 무관한** Playwright 스펙이 timeout flake 했다: `profile/profile-edit.spec.ts`(change-password
  redirect waitForURL, 2회) · `web-chat/console.spec.ts`(1회). build cache prune 후에도 동일. 본 변경은
  **순수 단위 테스트 3파일**(e2e spec 아님·production/라우팅 무변경)이라 cross-stack e2e 회귀를 유발하는
  것이 구조적으로 불가능하며, 실패 스펙들은 본 diff 와 파일·기능 교집합이 0이다. 슬러그 라우팅 e2e
  (`slug-routing.spec.ts`, 에디터 케이스 포함)는 통과. 이 세션 내내 여러 무관 스펙(members·profile·
  web-chat)이 간헐 timeout 했고 다른 PR 에서는 재실행으로 클린 통과한 전례가 있어, **e2e 스위트의
  환경 의존 flakiness**로 판정(코드 회귀 아님). → 사용자에게 별도 보고.

## 보류·후속 항목

- e2e 스위트 flakiness(profile-change-password·web-chat-console·members 등 다수 무관 스펙의 간헐
  timeout)는 본 PR 범위 밖의 **인프라/테스트 안정성 이슈** — 별도 조사 후보로 사용자에게 보고.
