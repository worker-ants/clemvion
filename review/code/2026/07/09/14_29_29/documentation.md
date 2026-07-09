# 문서화(Documentation) Review

대상 커밋: `d8cf625547515856fe07bc531bb6366f865eb764` — "test(frontend): ai-review R2 조치 — buildEditorHref 콜사이트 slug 회귀 테스트 + sidebar 주석"
(직전 review/code/2026/07/09/14_06_57 의 WARNING #1·#2 조치 커밋)

## 발견사항

- **[WARNING]** plan 노트가 아직 존재하지 않는 경로(`plan/complete/editor-slug-phase2.md`)를 확정적으로 링크
  - 위치: `plan/in-progress/spec-sync-user-profile-gaps.md` (본 커밋이 수정한 25번 항목 줄)
  - 상세: 수정된 문장은 "editor(`/workflows/[id]`)는 **phase 2 에서 slug 편입 완료**(`plan/complete/editor-slug-phase2.md` — ...)" 라고 서술한다. 그러나 실제 `plan/in-progress/editor-slug-phase2.md` 를 확인하면 `REVIEW WORKFLOW`(`/ai-review` + `/consistency-check --impl-done`) 체크박스가 아직 `[ ]`(미완료) 이고, 파일은 여전히 `plan/in-progress/` 에 있다 — 프로젝트 plan 라이프사이클 규칙상 완료 후에야 `plan/complete/` 로 이동한다. 즉 이 커밋 시점에 `plan/complete/editor-slug-phase2.md` 를 실제로 열면 존재하지 않는 경로다. 선반영(anticipatory) 표기라 하더라도, 지금 이 diff 만 두고 보면 "완료됨"과 "완료 예정 경로"가 뒤섞여 SoT 부정확성을 만든다.
  - 제안: (a) plan 이 실제로 `plan/complete/` 로 이동하는 커밋과 이 참조 갱신을 원자적으로 묶거나, (b) 지금은 `plan/in-progress/editor-slug-phase2.md`(진행 중, REVIEW WORKFLOW 대기)로 정정하고 이동 시점에 다시 갱신한다.

- **[WARNING]** deferred 회귀 테스트 커버리지 결정이 plan 문서에 durable 하게 기록되지 않음
  - 위치: `plan/in-progress/editor-slug-phase2.md` (S3 항목, 체크박스 `[x]`) / `review/code/2026/07/09/14_06_57/`
  - 상세: 커밋 메시지는 "triggers/usage-node-list/overview-card 는 buildEditorHref unit+no-raw-editor-href guard+e2e 3중 안전망 커버로 defer — RESOLUTION 기록" 이라 명시한다(실제로 이 3개 콜사이트에 대한 개별 회귀 테스트는 이번 diff 에 없음 — `grep buildEditorHref` 확인 결과 `href.test.ts`/`no-raw-editor-href.test.ts`(범용 가드)만 존재, 콜사이트별 단위 테스트는 없음). 그러나 (1) 이 defer 결정과 근거를 담을 `review/code/2026/07/09/14_06_57/RESOLUTION.md` 가 이번 diff 시점에 아직 작성되지 않았고, (2) `editor-slug-phase2.md` 플랜 본문 어디에도 "3곳은 unit 대신 guard+e2e 커버로 defer" 라는 근거가 등록돼 있지 않다. 과거 프로젝트 이력상 "RESOLUTION 의 후속 이관 결정은 committed plan 에 등록해야 durable(그렇지 않으면 review 세션이 정리된 뒤 근거가 유실)" 이라는 교훈이 반복 확인된 바 있다 — review/ 산출물은 세션별 스냅샷이라 plan 만큼 오래 참조되지 않는다.
  - 제안: `RESOLUTION.md` 작성 시 defer 근거를 명시하고, `editor-slug-phase2.md` S3 항목 아래에도 "triggers/usage-node-list/overview-card 콜사이트는 개별 단위 테스트 대신 `buildEditorHref` unit + `no-raw-editor-href` guard + e2e 로 커버 — 회귀 시 guard/e2e 가 우선 포착" 한 줄을 남겨 REVIEW WORKFLOW 체크박스를 닫기 전에 근거가 durable 하게 남도록 한다.

- **[INFO]** 신규 회귀 테스트의 인라인 주석 품질은 양호
  - 위치: `dashboard-page.test.tsx`, `execution-list-page.test.tsx`, `workflows-page.test.tsx` 의 신규 `it` 블록
  - 상세: 세 파일 모두 "왜 이 테스트가 필요한가"(예: "slug 라우팅 phase 2: 에디터 링크(buildEditorHref)도 활성 slug 를 붙여야 한다")를 설명하는 한글 주석을 달았고, 기존 "slug-누락 회귀 가드"(schedules/execution-list row-click) 패턴과 서술 스타일이 일관된다. `dashboard-page.test.tsx` 는 과거 회귀(PR #865, bare-push) 를 정확히 인용한다. 추가 조치 불필요 — 문서화 관점에서 모범 사례로 기록.

- **[INFO]** `sidebar.tsx:442` 주석 수정은 정확하고 짝 파일과 일관됨
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx:442`
  - 상세: "editor 등 slug 밖" → "slug 밖 라우트(docs 등)" 로 정정한 내용이 실제 라우팅 현황(에디터는 phase 2 편입 완료, docs 만 slug 밖 유지)과 일치하며, 동일 클래스 주석을 가졌던 `use-workspace-slug.ts` 표현과도 짝을 맞췄다(직전 리뷰 WARNING #2 정확히 해소). 런타임 판정(`pathname.startsWith` dual-check)에는 영향 없는 순수 주석 정정.

- **[INFO]** CHANGELOG 갱신 불필요 — 이미 반영됨
  - 위치: `CHANGELOG.md` (본 diff 에는 미포함)
  - 상세: phase 2 항목은 선행 커밋(`5c4ffd5b7`)에서 이미 `## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 2` 로 추가돼 있다. 이번 R2 커밋은 테스트·주석·plan 노트 전용(사용자 대면 동작 변경 없음)이라 별도 CHANGELOG 항목이 불필요하다는 판단은 타당.

## 요약

이번 커밋은 직전 리뷰(14_06_57)의 WARNING 2건(buildEditorHref 콜사이트 slug 회귀 테스트 공백, sidebar.tsx stale 주석)을 정확하고 근거가 명확한 방식으로 조치했다 — 신규 테스트의 인라인 주석 품질이 좋고, 주석 정정도 짝 파일과 일관되며 실제 코드 동작과 부합한다. 다만 문서 SoT 정확성 관점에서 두 가지 아쉬움이 있다: (1) plan 노트가 아직 `plan/in-progress/` 에 머물러 있는 `editor-slug-phase2.md` 를 `plan/complete/` 경로로 선반영 링크해 현재 시점엔 존재하지 않는 경로를 가리키고, (2) 3개 콜사이트(triggers/usage-node-list/overview-card)에 대한 defer 결정이 review 세션 산출물에만 의존하고 plan 문서 자체에는 등록되지 않아 durability 가 약하다. 둘 다 기능 결함은 아니며 후속 커밋(plan 이동, RESOLUTION.md 작성)에서 자연스럽게 해소될 여지가 있지만, 지금 시점의 diff 만으로는 문서 정합성 공백으로 남는다.

## 위험도

LOW
