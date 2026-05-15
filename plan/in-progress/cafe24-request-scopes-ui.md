---
worktree: cafe24-request-scopes-ui-b6e34d
started: 2026-05-16
owner: developer
---

# Cafe24 Private — `request-scopes` 상세페이지 UI 안내 누락 수정

## 배경

운영 사용자 보고 (2026-05-16):

- Cafe24 Private 통합이 `connected` 인 상태에서 상세 페이지의 `[Request scopes]` 버튼으로 추가 scope 를 요청
- `POST /api/integrations/:id/request-scopes` 호출은 200 으로 정상 응답 (`mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded`)
- 그러나 UI 상으로 **아무런 변화가 없음** — popup 도 안 뜨고 toast 도 없음
- 사용자가 다음에 무엇을 해야 하는지 알 수 없음

## 원인

`frontend/src/app/(main)/integrations/[id]/page.tsx:548-558` 의 `requestMutation.onSuccess`:

```ts
onSuccess: (res) => {
  if ("authUrl" in res && res.authUrl) {
    openOAuthPopup(res.authUrl);
    toast.success(t("integrations.scopeRequestOpened"));
  }
  onChanged();
},
```

`mode === 'cafe24_private_pending'` 분기 처리가 빠져 있어 응답이 와도 아무 표시 안 됨.

(비교) `frontend/src/app/(main)/integrations/new/page.tsx:165` 의 신규 통합 흐름은 동일한 응답 shape 에 대해 `Cafe24PrivatePending` 패널로 전환하는 처리가 있음.

## spec 근거

`spec/2-navigation/4-integration.md:270` (§4.4 `[Request scopes]` 행):

> ② **Cafe24 Private** — popup 진입점 없음. 응답: `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: [...] }` + 사용자 안내 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다."

→ 안내 문구는 spec 에 이미 정의되어 있고, UI 가 그것을 표시하지 못하는 버그.

## 결정

- **컴포넌트 재사용 안 함**: `Cafe24PrivatePending` 은 신규 통합의 `pending_install` 상태를 polling 으로 추적하는 컴포넌트 (전체 step 전환). request-scopes 의 경우는 통합이 이미 `connected` 이고 단지 안내만 필요. 별도 inline alert 가 더 적합.
- **inline alert** 로 상세 페이지의 scope panel 안에 안내문을 표시한다 (modal 보다 영구 표시, 사용자가 cafe24 작업 중 계속 참조 가능).
- 동시에 `toast.info` 로 즉시 알림.

## 변경 범위

- `frontend/src/app/(main)/integrations/[id]/page.tsx` — `requestMutation.onSuccess` 에 cafe24_private_pending 분기 추가 + inline alert 렌더링
- `frontend/src/lib/i18n/dict/ko.ts`, `frontend/src/lib/i18n/dict/en.ts` — 안내 문구 i18n 키 추가
  - `cafe24PrivateScopeRequestTitle`
  - `cafe24PrivateScopeRequestDesc` (spec §4.4 의 안내 문구)
  - `cafe24PrivateScopeRequestScopesAdded`
  - (consistency W-3 권고: 신규 통합 흐름의 `cafe24PrivatePending*` 계열과 맥락 분리를 위해 `cafe24PrivateScopeRequest*` prefix 채택)
- frontend unit test 보강 — `[id]/page.tsx` 의 ScopesTab 컴포넌트에 대한 RTL 테스트가 있다면 새 분기 추가

## 체크리스트

- [x] spec / plan 분석
- [x] worktree 생성
- [x] consistency-check --impl-prep (BLOCK: NO, W-3 반영하여 i18n prefix 조정 — `cafe24PrivateScopeRequest*`)
- [x] i18n 키 추가 (ko/en) — `cafe24PrivateScopeRequest{Title,Desc,ScopesAdded}` + `noScopeOptionsAvailable`
- [x] requestMutation.onSuccess 분기 + inline alert 렌더링 (`scope-tab.tsx` 신규 모듈로 분리, page.tsx 의 named export 제약 해소)
- [x] 단위 테스트 추가 7건 (cafe24_private_pending / authUrl / onError / 빈 scopesAdded / 재요청 시 alert 리셋 / 빈 scope options / non-oauth2 fallback)
- [x] lint / unit test / build — frontend 1355/1355 통과
- [x] `[skip-e2e]` 표기 — e2e 범위 아님 (단일 컴포넌트 분기 추가)
- [x] ai-review + RESOLUTION — `review/code/2026/05/16/01_00_34/`
- [ ] spec 역반영 follow-up (project-planner 위임): consistency I-1·I-2·I-4 — `spec/2-navigation/4-integration.md §4.4` 에 영문 안내 문구 예시, `scopesAdded` UI 표현 방식, "inline alert + toast.info" 결정 흡수
- [ ] spec/Rationale 보완 follow-up (project-planner 위임): consistency W-1 (폐기 결정 cross-reference), W-2 (구 flat 경로 참조 교정)
- [ ] plan complete 이동 (위 follow-up 들은 별도 plan/in-progress 로 분리해 옮긴 뒤 본 plan 은 complete)

## 영향 범위

- backend 변경 없음 (응답 shape 이미 spec 대로 동작)
- frontend 만 — 한 페이지의 한 mutation onSuccess 분기 추가
- 신규 통합 흐름의 `Cafe24PrivatePending` 컴포넌트는 건드리지 않음

## 관찰된 사전(pre-existing) 이슈

- `frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-list-page.test.tsx` 가 본 worktree 의 전체 suite 실행 시 ~20% 확률로 flake (`findByText("Completed")` 또는 row-click navigation 단계의 async 타이밍). 격리 실행은 항상 성공, main worktree(suite 118 files) 도 안정적으로 통과. 본 worktree 가 새 test file 을 추가하면서 vitest 워커 스케줄링이 바뀌어 잠재 timing-flake 가 드러난 것으로 추정. 본 작업 범위 밖 — 별도 flake-fix plan 으로 분리 권고.
- spec/2-navigation/4-integration.md 의 옛 flat-path Rationale 참조(W-2) 및 폐기 결정 cross-reference 누락(W-1) 은 spec write 권한 밖 — project-planner 에 위임.
