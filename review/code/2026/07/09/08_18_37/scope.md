# 변경 범위(Scope) Review — round-2 슬러그 라우팅 warning 조치 커밋

커밋 `6248480` (`refactor(navigation): 슬러그 라우팅 round-2 ai-review/impl-done Warning 조치`) 11개 파일 전수 검토.

## 발견사항

- **[INFO]** CHANGELOG 항목이 "round-2 warning 조치" 커밋에 전체 phase 1 기능 설명(26페이지 이동·reconcile 정책·backend 무변경 등)을 통째로 담고 있어, 커밋 규모 대비 다소 방대해 보인다.
  - 위치: `CHANGELOG.md` 신규 삽입 블록(라인 53-57 상당, "## Unreleased — 워크스페이스 슬러그 URL 라우팅 phase 1")
  - 상세: 다만 커밋 메시지 자체가 `docs: CHANGELOG 슬러그 라우팅 항목 추가`를 명시적 action item으로 나열하고 있고, 이는 라운드-1 ai-review에서 누락으로 지적된 항목을 메우는 것이므로 의도된 추가다. 범위 이탈이 아니라 "지연된 필수 항목의 뒤늦은 반영"으로 판단.
  - 제안: 조치 불요(정보 공유 목적).

- **[INFO]** `resolve-fallback.ts`는 코드 변경 없이 JSDoc 주석만 갱신됐다(3번째 소비처로 `workspace-store.setWorkspaces` 추가를 문서화).
  - 위치: `codebase/frontend/src/lib/workspace/resolve-fallback.ts` 주석 블록
  - 상세: 순수 문서 갱신이지만 같은 커밋의 `workspace-store.ts` DRY 리팩터(라운드-1 architecture warning 조치)와 1:1 대응되므로 "관련 없는 주석 변경"이 아니라 그 리팩터의 필연적 부산물.
  - 제안: 조치 불요.

## 스코프 대조 결과

커밋 메시지가 명시한 action item 목록과 실제 diff를 1:1 대조:

| 커밋 메시지 action item | 대응 파일 | 매칭 |
|---|---|---|
| security: `buildWorkspaceHref` backslash/제어문자 정규화 | `href.ts`, `href.test.ts` | 일치 — 정확히 해당 정규식만 확장, 그 외 로직 무변경 |
| architecture(DRY): `workspace-store.setWorkspaces`도 `resolveFallbackWorkspace` 위임 | `workspace-store.ts`, `resolve-fallback.ts`(주석) | 일치 — 인라인 폴백 3줄을 헬퍼 호출 1줄로 교체, 그 외 store 로직(전환/토스트 등) 무변경 |
| docs: CHANGELOG 항목 추가 + RESOLUTION dangling anchor 정정 | `CHANGELOG.md`, `review/code/2026/07/08/18_24_41/RESOLUTION.md` | 일치 — RESOLUTION 은 fresh review 경로 참조 2곳만 갱신, 나머지 본문 무변경 |
| consistency --impl-done: `11-error-empty-states §1.3` 각주 | `spec/2-navigation/11-error-empty-states.md` | 일치 — 표에 행 1개 추가뿐 |
| consistency --impl-done: `0-dashboard·1-workflow-list·4-ai-assistant·13-replay-rerun` bare-path 산문 각주 | `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/13-replay-rerun.md` | 일치 — 각 파일 1문장/1행 수준의 국소 수정, 표 구조·본문 나머지 무변경 |

11개 변경 파일 전체가 위 6개 action item 중 하나에 정확히 대응되며, 목록에 없는 파일이나 목록 밖 코드 영역 수정은 발견되지 않았다. 각 diff hunk 도 few-line 단위로 국소적이며, 대상 외 라인의 재포맷·주변 코드 정리·무관 임포트 추가/삭제는 없었다.

## 요약

본 커밋은 직전 라운드(2026-07-08 18:24) ai-review SUMMARY의 Warning 3건(security/architecture/docs)과 consistency `--impl-done` 이 지적한 spec 각주 누락 5건을 그대로 조치하는 "fix-only" 커밋이다. 검토한 11개 파일 diff 전부가 커밋 메시지에 나열된 action item과 정확히 1:1 대응하며, 매 hunk 가 몇 줄 이내로 최소화돼 있어 의도 이상의 변경·무관한 리팩토링·기능 확장·포맷팅 오염·불필요한 임포트/주석 변경 소견이 없다. `resolve-fallback.ts`의 주석 갱신은 코드 변경이 아니지만 동일 커밋의 DRY 리팩터를 문서화하는 필연적 후속이라 스코프 이탈로 보지 않는다.

## 위험도

NONE
