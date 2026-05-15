# 변경 범위(Scope) 리뷰

## 변경 의도 요약

Cafe24 Private 통합 상세 페이지에서 `[Request scopes]` 버튼을 눌렀을 때 백엔드가 `cafe24_private_pending` 응답을 반환해도 UI 에 아무런 변화가 없던 버그 수정. 핵심 변경: `requestMutation.onSuccess` 에 `cafe24_private_pending` 분기 추가 + inline amber alert 표시.

---

## 발견사항

### 파일 1: `scope-tab.tsx` (신규 생성) — ScopeTab 모듈 분리

- **[INFO]** ScopeTab 컴포넌트를 `page.tsx` 에서 별도 파일로 추출한 것은 범위 확장처럼 보이나, 이는 직접적인 버그 수정 방법론상 불가피한 전제 조건이다.
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` (신규 파일)
  - 상세: Next.js `page.tsx` 는 named export 를 지원하지 않아, 테스트 파일이 `ScopeTab` 을 직접 import 하려면 별도 모듈로 분리가 필수다. 커밋 메시지도 이 제약을 명시적으로 기술하고 있다. 컴포넌트 로직 자체는 `page.tsx` 에서 완전히 이동(삭제 후 신규 파일에 재생성)됐으며, 기능 변경은 `cafe24_private_pending` 분기 추가 한 가지뿐이다.
  - 제안: 의도적·필수적 추출이므로 범위 이탈로 보지 않는다. 이상 없음.

### 파일 2: `open-oauth-popup.ts` (신규 생성) — openOAuthPopup 모듈 분리

- **[INFO]** `openOAuthPopup` 함수를 `page.tsx` 에서 별도 파일로 추출했다.
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` (신규 파일)
  - 상세: `scope-tab.tsx` 에서 `openOAuthPopup` 을 import 해야 하므로, `page.tsx` 와 `scope-tab.tsx` 양쪽이 모두 사용할 공용 함수를 공유 모듈로 추출한 것은 자연스러운 결과다. 함수 내용 자체는 기존 `page.tsx` 의 코드와 동일하며 기능 변경 없음.
  - 제안: 이상 없음.

### 파일 3: `page.tsx` — ScopeTab/openOAuthPopup 제거 및 import 정리

- **[INFO]** `ServiceDefinition` import 제거 및 ScopeTab/openOAuthPopup 코드 삭제, 새 모듈 import 추가.
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx`
  - 상세: 모듈 추출에 따른 필수 정리다. `ServiceDefinition` 타입은 `scope-tab.tsx` 로 이동했으므로 `page.tsx` 에서 제거가 맞다. 불필요한 import 가 추가되거나, 의도와 무관한 코드 영역이 수정된 흔적 없음.
  - 제안: 이상 없음.

### 파일 4: `integrations.ts` — RequestScopesResult 타입 신설

- **[INFO]** `OAuthBeginResult` 와 분리된 `RequestScopesResult` 타입 추가 및 `requestScopes` 반환 타입 교체.
  - 위치: `frontend/src/lib/api/integrations.ts`
  - 상세: `OAuthBeginResult` 에는 `scopesAdded: string[]` 필드가 없어 기존 타입으로는 Cafe24 Private 응답을 type-safe 하게 다룰 수 없었다. 새 타입 신설은 버그 수정의 type-level 필수 요건이다. 기존 `OAuthBeginResult` 타입은 그대로 보존되어 다른 사용처에 영향 없음.
  - 제안: 이상 없음.

### 파일 5 & 6: `en.ts`, `ko.ts` — i18n 키 추가

- **[INFO]** `cafe24PrivateScopeRequestTitle`, `cafe24PrivateScopeRequestDesc`, `cafe24PrivateScopeRequestScopesAdded` 3개 키 추가.
  - 위치: `frontend/src/lib/i18n/dict/en.ts`, `frontend/src/lib/i18n/dict/ko.ts`
  - 상세: 안내 문구 표시를 위한 최소한의 i18n 키 추가이며, 기존 키 수정이나 삭제 없음. consistency-checker W-3 권고를 반영해 기존 `cafe24PrivatePending*` 계열과 prefix 를 분리했다는 설명도 명시되어 있다. 추가된 키 수와 범위가 버그 수정 범위와 완전히 일치한다.
  - 제안: 이상 없음.

### 파일 7: `plan/in-progress/cafe24-request-scopes-ui.md` — plan 문서 신규 생성

- **[INFO]** 이 worktree 작업에 대한 plan 문서가 커밋에 포함됐다.
  - 위치: `plan/in-progress/cafe24-request-scopes-ui.md`
  - 상세: 프로젝트 CLAUDE.md 규약상 `plan/in-progress/` 에 worktree frontmatter 포함 plan 문서를 두는 것이 강제 사항이므로 적절하다. 체크리스트 항목 중 일부가 미완(`[ ]`)인 상태로 커밋됐는데, 이는 ai-review 와 RESOLUTION 단계가 이 커밋 이후에 진행됨을 의미하므로 정상적인 흐름이다.
  - 제안: 이상 없음.

### 파일 8: `review/consistency/2026/05/16/00_36_35/SUMMARY.md` 및 `_prompts/` 파일들 — 사전 consistency-check 산출물 포함

- **[WARNING]** consistency-check 세션 산출물 전체가 동일 커밋에 포함됐다.
  - 위치: `review/consistency/2026/05/16/00_36_35/` 하위 파일들
  - 상세: CLAUDE.md 규약에 따르면 `review/consistency/**` 는 consistency-checker 의 쓰기 권한 영역이고, `developer` 는 읽기 전용으로 이를 참조한다. 그런데 이 세션 산출물이 구현 커밋에 함께 묶였다. 운영상 위험은 없으나(내용이 correct), 역할 경계상 consistency-check 산출물은 별도 커밋 또는 별도 단계로 분리하는 것이 더 명확하다. 실제로는 사전 검토 → 구현 → commit 을 단일 워크플로로 묶는 과정에서 발생한 것으로, 내용적으로 문제는 없다.
  - 제안: 범위 위반으로 판단하기보다는 프로세스 개선 권고 수준이다. 차후에는 consistency-check 결과를 별도 커밋으로 먼저 push 한 뒤 구현 커밋을 분리하는 것을 고려한다. 현재 변경에서는 내용 정합성 문제 없음.

### 파일 9: `scope-tab.test.tsx` (신규 생성) — 단위 테스트 추가

- **[INFO]** Cafe24 Private 분기와 authUrl 분기에 대한 테스트 2건 추가.
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`
  - 상세: TDD 원칙상 신규 분기 추가 시 단위 테스트는 필수다. 테스트 내용이 해당 버그 픽스 범위(cafe24_private_pending alert 표시, authUrl 팝업 fallback)에 한정되어 있으며, 기존 테스트 수정 없이 신규 파일로만 추가됐다. 범위 이탈 없음.
  - 제안: 이상 없음.

---

## 요약

총 변경 파일은 코드 4개(scope-tab.tsx 신규, open-oauth-popup.ts 신규, page.tsx 수정, integrations.ts 수정), i18n 2개(ko.ts, en.ts), 테스트 1개, plan 1개, review 산출물 다수다. 핵심 버그 수정(`cafe24_private_pending` 분기 추가 + inline alert)과 이를 위해 필요한 모듈 분리(ScopeTab, openOAuthPopup), 타입 분리(RequestScopesResult), i18n 추가, 테스트 추가는 모두 의도된 변경 범위와 일치한다. 의도와 무관한 리팩토링, 과도한 기능 확장, 불필요한 주석·포맷팅 변경, 관련 없는 파일 수정은 발견되지 않았다. 다만 consistency-check 세션 산출물이 구현 커밋에 함께 포함된 점은 역할 경계상 프로세스 분리를 권고하는 수준의 경미한 지적 사항이다.

---

## 위험도

LOW
