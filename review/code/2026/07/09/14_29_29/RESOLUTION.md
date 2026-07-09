# RESOLUTION — 워크스페이스 슬러그 라우팅 phase 2 (에디터 slug화)

3라운드 ai-review 수렴 기록. **Critical 0 전 라운드.** 대상: `feat 61407b761` + `docs e1be4bd81` +
`test 772b36efb` (phase 2 본체) 이후 WARNING 조치 커밋 `5c4ffd5b7`(R1) · `d8cf62554`(R2).

## 조치 항목

| Round / SUMMARY | 카테고리 | 조치 | commit |
|---|---|---|---|
| R1 13_37_11 W1 | Architecture | `WorkspaceSlugGate` 행위 SoT 테스트(`workspace-slug-gate.test.tsx`) 신설 + 두 layout 테스트를 게이트 wiring 1케이스로 축소(4×2 복붙 제거) | `5c4ffd5b7` |
| R1 13_37_11 W2 | Architecture | 두 raw-href guard 스캐닝 골격을 `href-guard-utils.ts`(`collectSourceFiles`·`findRawHrefOffenders`) 공유 헬퍼로 추출 | `5c4ffd5b7` |
| R1 13_37_11 W3 | Requirement | `use-workspace-slug.ts` stale 주석("editor 등 slug 밖")→"docs·catch-all 등" | `5c4ffd5b7` |
| R1 13_37_11 W4 | Documentation | `CHANGELOG.md` phase 2 항목 추가 | `5c4ffd5b7` |
| R1 13_37_11 W5 | Testing | `buildEditorHref` 직접 단위 테스트 3케이스 | `5c4ffd5b7` |
| R2 14_06_57 W1 | Requirement/Testing | buildEditorHref 콜사이트 slug-present 회귀 테스트: execution-list "Open in Editor"·workflows create-then-push·dashboard recent-workflow(각 활성 slug → `/w/<slug>/workflows/<id>`) | `d8cf62554` |
| R2 14_06_57 W2 | Documentation | `sidebar.tsx:442` stale 주석("editor 등 slug 밖")→"slug 밖 라우트(docs 등)" | `d8cf62554` |
| impl-done 14_08_26 (plan_coherence) | Plan | `spec-sync-user-profile-gaps.md:25` 노트 "editor phase 1 후속"→"phase 2 편입 완료, docs만 slug 밖" | `d8cf62554` |
| R3 14_29_29 W1·W2·W3 | 문서/추적성 | (본 RESOLUTION) defer 근거 기록 + plan S3 등록 + 커버리지 표현 정정(e2e=URL-레벨) + plan 노트의 `plan/complete/` 선참조를 "editor-slug-phase2 plan" 으로 완화. **코드 무변경** — review/plan 문서 조치라 재리뷰 대상 아님 | (review/plan) |

## TEST 결과

- **lint**: 통과 (0 errors; 12 warnings 전부 pre-existing, `slide-drawer.tsx:30` 등 미변경 파일).
- **unit**: 통과 (266 files, 5175 passed / 1 skipped).
- **build**: 통과 (`next build --webpack`, 101/101 정적 페이지). **두 route group `(main)`·`(editor)` 이
  `/w/[slug]/workflows/[id]` prefix 를 충돌 없이 공존**(빌드 산출로 실증) — 잠금한 접근 확정.
- **e2e**: 통과 (`make e2e-test-full` — backend jest + Playwright `slug-routing.spec.ts` 에디터 케이스 2건
  포함 `status:passed`). ※ 진행 중 members·profile-change-password 테스트가 각 1회 timeout flake(둘 다
  phase-2 무관, 재실행 시 클린 통과) — e2e 타이밍 flake 로 판정, 마지막 실행 0-fail.

## 보류·후속 항목

- **buildEditorHref 콜사이트 클릭-스루 테스트 3곳 defer** — `triggers/page.tsx:716`·`usage-node-list.tsx`·
  `overview-card.tsx`. **근거**: (a) 세 콜사이트 소스 배선(`useWorkspaceSlug()`→`buildEditorHref`) 정확성
  reviewer 직접 대조 확인(기능 결함 0), (b) `buildEditorHref` unit 테스트 + `no-raw-editor-href` guard(raw
  리터럴 CI 차단)로 회귀 클래스 커버, (c) slug-present 클릭-스루 단언은 이미 4개 대표 콜사이트(schedules·
  execution-list·workflows·dashboard)에 확보. **정정**: e2e `slug-routing.spec.ts`는 URL-레벨 deep-link/
  redirect 검증이며 위 3페이지의 클릭-스루는 미포함(R2 커밋 메시지의 "e2e 3중 안전망"은 이 범위로 이해).
  후속 여력 시 3곳 클릭-스루 테스트 추가.
- **14-execution-history.md Overview 구조 이질**(impl-done convention WARNING, pre-existing) → project-planner.
