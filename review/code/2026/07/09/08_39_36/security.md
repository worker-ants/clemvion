# 보안(Security) Review

대상: `rerun-modal.tsx` 재실행 성공 네비게이션 slug 부착 fix + 회귀 테스트 3종 + RESOLUTION 문서 갱신
(commit 865e6b93, round-3 ai-review W1 대응).

## 발견사항

- **[INFO]** open-redirect 방어 구현이 두 곳에 비대칭 존재 (`buildWorkspaceHref` vs `isSafeRedirectPath`)
  - 위치: `codebase/frontend/src/lib/workspace/href.ts` (본 diff 범위 밖, 컨텍스트로만 참조) / `review/code/2026/07/09/08_18_37/RESOLUTION.md` W3
  - 상세: `buildWorkspaceHref` 는 선두 `//`·`\\`·tab/CR/LF 를 모두 정규화하는 강화된 open-redirect 방어를 갖췄고 본 diff 의 `href.test.ts` 가 `it.each` 로 이를 꼼꼼히 회귀 테스트한다(더블 백슬래시, tab, CR, LF, slug 조합 케이스 포함) — 이 자체는 방어적으로 건전하다. 다만 RESOLUTION 문서에 기록된 대로 `error-page.tsx` 의 `isSafeRedirectPath` 는 `//` 케이스만 방어해 두 유틸의 강도가 다르다. 현재는 `isSafeRedirectPath` 를 소비하는 redirect 파라미터 배선이 없어 실제 도달(exploit) 경로는 없다고 판단되나, 추후 로그인/에러 페이지에 `?redirect=` 류 파라미터 소비가 추가되면 약한 쪽 유틸이 그대로 쓰일 위험이 있다.
  - 제안: 이미 후속 항목으로 defer 기록되어 있음(W3) — 신규 조치 불요. redirect 파라미터 소비 기능이 실제로 추가되는 시점에 반드시 `buildWorkspaceHref` 수준의 정규화를 재사용하도록 트래킹 유지.

- **[INFO]** `router.push` 대상 문자열에 `original.workflowId` / `result.id` 를 이스케이프 없이 템플릿 삽입
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:971-976` (`buildWorkspaceHref(slug, \`/workflows/${original.workflowId}/executions/${result.id}\`)`)
  - 상세: `workflowId`/`result.id` 는 클라이언트가 임의로 넣는 값이 아니라 백엔드 API 응답(생성된 실행 ID 등)에서 오는 값이라 공격자가 직접 통제하기 어렵고, `buildWorkspaceHref` 가 선두 슬래시 계열만 정규화하므로 중간에 삽입된 값이 프로토콜-상대 URL 을 만들 수는 없다(항상 `/workflows/` 로 시작). 실질적 위험은 낮음.
  - 제안: 별도 조치 불요. 다만 백엔드가 이 ID 값들에 대해 형식 검증(UUID 등)을 강제하고 있는지는 이번 diff 범위 밖이라 확인하지 않았음 — 이미 알려진 선례(다른 곳에서 동일 패턴 반복 사용)로 보아 특별한 신규 리스크는 아님.

- 그 외 항목: 하드코딩된 시크릿, SQL/커맨드/LDAP 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 에러 노출, 알려진 취약 의존성 사용 — 본 diff (테스트 파일 3종 + `rerun-modal.tsx` 네비게이션 수정 1줄 + RESOLUTION 문서 2건) 범위에서 해당 사항 없음.

## 요약

이번 변경은 신규 기능이 아니라 이전 라운드(round-2) ai-review 가 놓친 실버그 — 재실행 성공 시 `router.push` 가 워크스페이스 slug 없이 bare path 로 네비게이션하던 것 — 를 기존에 이미 검증된 `buildWorkspaceHref` 유틸로 감싸 교정한 fix 이며, 여기에 open-redirect 방어(CR/LF/tab/백슬래시 조합) 회귀 테스트와 워크스페이스 스토어 폴백 로직 단위테스트를 보강한 것이다. `buildWorkspaceHref` 자체(선두 슬래시/백슬래시 접기 + 제어문자 제거)는 변경되지 않았고 diff 는 그 안전한 경로를 새로 소비하는 지점을 늘렸을 뿐이므로 새로운 공격 표면을 추가하지 않는다. 인젝션·시크릿·인증/인가·암호화·에러 노출·의존성 관점에서 발견된 신규 이슈는 없다. 유일하게 언급할 가치가 있는 것은 이미 RESOLUTION 에 기록·defer 된 `isSafeRedirectPath` 와의 방어 강도 비대칭(현재 도달 불가능한 dead code)으로, 후속 추적 대상일 뿐 이번 PR 을 막을 사유는 아니다.

## 위험도

NONE
