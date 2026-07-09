# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

대상: 커밋 `fa228b635a7f9581ed7db54c599e25c99b5ee3a8` (refactor(navigation): 슬러그 라우팅
ai-review Warning 4건 조치) — 18개 파일. 매트릭스 SSOT(`.claude/config/doc-sync-matrix.json`
19개 행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재해 각 행의 trigger 에 대조했다.

## 변경 파일 구성 확인

1. `codebase/frontend/src/app/(main)/[...rest]/page.tsx` — `resolveFallbackWorkspace` 로 폴백 로직 교체 (로직만, 신규 문자열 없음)
2. `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` — 동일 리팩터
3. `codebase/frontend/src/lib/integrations/__tests__/use-cafe24-pending-polling.test.tsx` — slug-prefix 케이스 테스트 추가
4. `codebase/frontend/src/lib/integrations/__tests__/use-makeshop-pending-polling.test.tsx` — 동일
5. `codebase/frontend/src/lib/workspace/__tests__/href.test.ts` — open-redirect 방어 테스트 추가
6. `codebase/frontend/src/lib/workspace/__tests__/resolve-fallback.test.ts` — 신규
7. `codebase/frontend/src/lib/workspace/__tests__/use-workspaces.test.tsx` — 신규
8. `codebase/frontend/src/lib/workspace/href.ts` — 선두 슬래시 정규화(보안 수정), 반환 문자열 포맷 불변
9. `codebase/frontend/src/lib/workspace/resolve-fallback.ts` — 신규 순수 함수(DRY 추출)
10-18. `review/code/2026/07/08/18_24_41/{RESOLUTION,SUMMARY,architecture,maintainability,requirement,security,testing}.md` + `meta.json`/`_retry_state.json` — 이전 리뷰 세션 산출물을 뒤늦게 커밋한 것(리뷰 대상 코드 아님, 문서 산출물)

## 매트릭스 trigger 대조 결과

- **새 노드 추가 / 노드 schema 변경** — trigger `codebase/backend/src/nodes/**` 미매칭 (백엔드 노드 파일 변경 없음)
- **신규 UI 문자열 (TSX)** — trigger `codebase/frontend/src/**/*.tsx`(semantic) 는 파일 1·2(page.tsx/layout.tsx)에 형식적으로 매칭되나, diff 내용은 import 추가 + 폴백 로직 함수 호출 교체뿐이고 신규 JSX/문자열 리터럴 없음(기존 `role="status"` spinner 마크업 무변경). `.test.tsx` 파일들의 신규 텍스트는 코드 주석(예: "slug 는 store 파생이므로...")과 테스트 description 뿐으로 렌더링되는 UI 문자열이 아니다 — i18n dict 갱신 대상 아님
- **통합 신규/제공자 변경** — cafe24/makeshop 훅 변경은 provider 설정·필드·동작이 아니라 리다이렉트 목적지 URL 조립(내부 라우팅) 변경뿐 — `06-integrations-and-config/` 문서·dict 키에 영향 없음
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 신규 디렉토리 없음 (mdx 파일 자체가 이 diff 에 없음)
- **인증·권한·세션 흐름 변경** — trigger `codebase/backend/src/modules/auth/**` 미매칭. `layout.tsx` JSDoc 도 "backend 인가 모델(header-first→토큰 클레임)은 불변" 을 명시 — FE-only URL 라우팅 변경이며 백엔드 인가 흐름 자체는 변경되지 않음. `07-workspace-and-team/` 동반 갱신 트리거 대상 아님
- **표현식 언어 변경 / 실행·디버깅 흐름 변경** — 관련 파일(`packages/expression-engine/**`, 실행 엔진) 미변경
- **신규 warningCode/errorCode 발행** — backend `warningRules`/`error-codes.ts` 변경 없음 → `backend-labels.ts` 매핑 이슈 없음
- **spec 신규/대규모 변경** — 이번 diff 에 `spec/**` 파일 자체가 포함되지 않음(스코프는 `codebase/`·`review/` 뿐). 참고로 RESOLUTION.md 가 언급한 `spec/2-navigation/9-user-profile.md §3` SPEC-DRIFT 는 이 커밋에서 다루지 않고 후속 커밋(`a9eaab83e docs(spec): 슬러그 URL 라우팅 구현 반영`)으로 이미 별도 처리된 것으로 git log 상 확인됨 — 이 리뷰 세션의 payload 범위 밖

## 발견사항

없음 — 매칭되는 trigger 가 없다.

## 요약

매트릭스 19개 행 전체를 대조했으나 이번 diff(커밋 `fa228b635`, 18개 파일)는 어떤 trigger 에도 매칭되지 않는다. 실질 변경은 (a) `buildWorkspaceHref` 의 open-redirect 방어(문자열 정규화, 반환 포맷 불변), (b) `resolveFallbackWorkspace` 순수 함수 추출(로직 이동, 신규 UI 없음), (c) 신규/보강 유닛테스트 5종, (d) 이전 ai-review 세션 산출물(`review/code/2026/07/08/18_24_41/**`) 뒤늦은 커밋 — 전부 노드·스키마·UI 문자열·통합 제공자·문서 섹션·인증 흐름·표현식 언어·실행 흐름·warning/error 코드 어느 것도 건드리지 않는 FE-only 라우팅 리팩터 + 테스트 + 문서 산출물이다. 유저 가이드(MDX)·i18n dict·backend-labels.ts 동반 갱신 의무는 발생하지 않는다.

## 위험도

NONE
