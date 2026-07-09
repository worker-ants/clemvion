# 보안(Security) Review

## 리뷰 대상
- `codebase/frontend/src/app/(main)/w/[slug]/dashboard/__tests__/dashboard-page.test.tsx` (신규 테스트 추가)
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/__tests__/execution-list-page.test.tsx` (신규 테스트 추가)
- `codebase/frontend/src/app/(main)/w/[slug]/workflows/__tests__/workflows-page.test.tsx` (신규 테스트 추가)
- `codebase/frontend/src/components/layout/sidebar.tsx` (주석 1줄 정정, 로직 변경 없음)
- `plan/in-progress/spec-sync-user-profile-gaps.md` (문서 텍스트 정정)

전체 diff 는 (a) `buildEditorHref` 콜사이트가 slug 를 누락하지 않는지 확인하는 회귀 테스트 3건 추가, (b) `sidebar.tsx` 의 stale 주석 1줄 정정, (c) plan 문서의 진행 상태 텍스트 정정으로 구성된다. 프로덕션 런타임 로직(라우팅 헬퍼 `buildWorkspaceHref`/`buildExecutionHref`/`buildEditorHref`, `open-redirect` 방어를 담당하는 `toSafeInternalPath`)은 이번 diff에 포함되어 있지 않다 — 배경 확인을 위해 `codebase/frontend/src/lib/workspace/href.ts` 를 참조했으며, slug/path 정규화 로직은 변경되지 않았다.

### 발견사항

없음. 아래는 참고용 확인 사항이며 조치가 필요한 항목은 아니다.

- **[INFO]** 테스트 전용 변경 — 런타임 공격표면 변화 없음
  - 위치: 파일 1~3 전체
  - 상세: 추가된 3개 테스트는 `useWorkspaceStore.setState(...)` 로 목(mock) 워크스페이스(`slug: "team-x"` 등 정적 문자열)를 주입하고, 클릭 시 `router.push` 가 `/w/team-x/workflows/...` 형태로 호출되는지 단언(assert)한다. 새로운 사용자 입력 처리 경로, 신규 API 호출, 신규 렌더링 로직이 없으므로 인젝션·인가 우회·정보노출 등 보안 관점의 신규 표면이 발생하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 파일 1~3 (mock fixture: `team-x`, `wf-9`, `ws-1` 등)
  - 상세: 테스트 fixture 값은 모두 임의의 placeholder ID/slug 이며 실제 자격증명·API 키·토큰이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `sidebar.tsx` 변경은 순수 주석 정정
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:1458` (구 442라인)
  - 상세: `isActive` 판정 로직(`pathname.startsWith(href) || pathname.startsWith(item.href)`)은 그대로이며, 위에 붙은 한국어 주석 텍스트만 "editor 등 slug 밖" → "slug 밖 라우트(docs 등)" 로 정정되었다. 로직·데이터 흐름·권한 검증에 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** 라우팅 helper 의 open-redirect 방어는 이번 diff 범위 밖이며 변경되지 않음
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` (참고용, diff 대상 아님)
  - 상세: 테스트가 검증하는 `buildEditorHref`/`buildWorkspaceHref` 는 내부적으로 `toSafeInternalPath` 를 통해 protocol-relative(`//host`, `\\host`) 및 제어문자를 same-origin 절대경로로 정규화한다(주석에 "보안 경계"로 명시). 이번 커밋은 이 방어 로직을 건드리지 않고, 그 결과가 slug 콜사이트에서 실제로 소비되는지 확인하는 회귀 테스트만 추가한다.
  - 제안: 조치 불필요. (참고: 이 helper 자체를 변경하는 차기 PR이 있다면 `toSafeInternalPath` 유닛 테스트가 함께 커버되는지 별도 확인 권장.)

- **[INFO]** `router.push` 대상은 서버 측 인가와 무관 (SoT 분리 유지)
  - 위치: 파일 1~3 전체 (FE 라우팅), 프로젝트 메모리 정책 참조
  - 상세: URL 의 workspace slug 는 FE 라우팅 편의를 위한 것이며, 실제 backend 인가는 별도의 `X-Workspace-Id` 헤더 기반으로 수행된다는 것이 기존 아키텍처 결정(§ workspace-slug-routing phase 1)이다. 이번 diff 는 이 경계를 변경하지 않으며, 테스트도 `router.push` 호출 인자만 단언할 뿐 인가 로직을 우회하지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서 변경은 서술 텍스트 정정
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md`
  - 상세: 체크박스 상태·서술을 "editor 는 phase 1 slug 밖" → "editor 는 phase 2 에서 slug 편입 완료"로 정정. 코드/보안 영향 없음.
  - 제안: 조치 불필요.

### 요약
이번 변경분은 실질적으로 프런트엔드 라우팅 회귀 테스트 3건과 주석/문서 텍스트 정정으로만 구성되어 있으며, 신규 사용자 입력 처리·API 호출·인증/인가 로직·암호화·의존성 변경이 전혀 없다. 테스트가 검증하는 `buildEditorHref`/`buildWorkspaceHref` 라우팅 헬퍼는 이번 diff 밖에서 이미 `toSafeInternalPath` 기반 open-redirect 방어를 갖추고 있고 이번 변경으로 그 경계가 약화되지 않는다. 하드코딩된 시크릿, 인젝션 벡터, 인증/인가 우회, 민감정보 노출 등 OWASP Top 10 관련 문제는 발견되지 않았다.

### 위험도
NONE
