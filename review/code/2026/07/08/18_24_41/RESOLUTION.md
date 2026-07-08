# RESOLUTION — 슬러그 라우팅 phase 1 ai-review (2026-07-08 18:24)

전체 위험도 MEDIUM · Critical 0 · Warning 6. Warning 중 코드 4건 수정, SPEC-DRIFT 2건은
spec-sync(§10)로 이관. INFO 12건은 저우선 defer.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 커밋 |
|---|---|---|---|
| W1 | testing | `use-workspaces.test.tsx` 신설 — fetch+store 동기화, `enabled: !!user` 게이트 단언 | 본 refactor 커밋 |
| W2 | testing | cafe24/makeshop pending-polling 테스트에 non-null slug 케이스 추가 — `/w/<slug>/integrations/<id>` 리다이렉트 단언 (+ `beforeEach` store reset 로 누수 방지) | 본 refactor 커밋 |
| W3 | architecture | `resolveFallbackWorkspace()` 순수 함수로 폴백 로직 추출 (DRY) — `layout.tsx`·`[...rest]/page.tsx` 공유 + 단위테스트 4 | 본 refactor 커밋 |
| W4 | security | `buildWorkspaceHref` 선두 슬래시 정규화 — protocol-relative(`//host`) open-redirect 방어 + 테스트 | 본 refactor 커밋 |
| W5 | SPEC-DRIFT | `9-user-profile §3` "Planned" → 구현 완료 flip | **spec-sync(§10)** 로 처리 |
| W6 | SPEC-DRIFT | 이동 페이지 spec 본문 bare-path 산문(15-system-status·16-agent-memory 등) slug-aware 정정 | **spec-sync(§10)** 로 처리 |

## TEST 결과

- **lint**: 통과 (fix 파일 0 issue; repo 잔여 11 warning 은 pre-existing·무관 파일)
- **unit**: 통과 (260 files, 5102 pass / 1 skip — 신규 +9)
- **build**: 통과 (route 충돌 0 — `/[...rest]`·`/docs/[...slug]`·`/workflows/[id]`·`/w/[slug]/*` 공존)
- **e2e**: 통과 (backend supertest 243 + FE Playwright 44, slug-routing 4종). fix 후 재수행 결과는 아래 §재검증 참조

## 보류·후속 항목

- **SPEC-DRIFT (W5·W6)**: spec-sync 단계에서 `9-user-profile §3`·`data-flow-12 Rationale`·`10-auth-flow §7.2` +
  이동 페이지 bare-path 산문(`_layout.md §2.2/§3.1`·`15-system-status`·`16-agent-memory` 등) 정정. `/consistency-check --spec` 검증 후 반영.
- **INFO (defer)**: cafe24 `encodeURIComponent` 대칭화(#1)·cafe24 `lastErrorMessage` i18n 매핑(#2)·`WORKSPACE_ROUTE_PREFIX` 상수화(#8)·
  `useActiveWorkspace()` 상위 훅 통합(#4) — 현행 리스크 낮음, 별도 리팩터 후속.
- **리뷰 커버리지 갭**: Workflow 가 scope/side_effect/documentation/user_guide_sync 4 reviewer 를 "success" 로 보고했으나 output 파일 미존재(디스크-write 갭). fresh `/ai-review` 재수행으로 재검증(§재검증).
