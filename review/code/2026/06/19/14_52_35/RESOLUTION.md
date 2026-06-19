# RESOLUTION — 통합 삭제 차단 다이얼로그 (PR #633 후속 ⑥)

SUMMARY.md 의 발견사항 처리 결과.

## 1. [requirement, WARNING/BLOCK] §4.7 삭제 흐름 순서 역전 → FIXED
- spec §4.7: "`Delete integration` 클릭 시 GET /usages 조회 → 0건이면 확인, ≥1건이면 차단 다이얼로그".
- 기존 구현: 첫 클릭은 인라인 confirm 만 띄우고, 두 번째 "Confirm delete" 클릭의 `mutationFn` 에서 usages 조회+분기 → spec 의 사전조회 순서와 역전.
- 조치: `DangerTab` 의 단일 `deleteMutation` 을 두 개로 분리.
  - `precheckMutation` — 첫 "Delete integration" 클릭에서 `GET /usages` 조회. ≥1건 → 즉시 차단 다이얼로그, 0건 → 인라인 confirm 노출.
  - `deleteMutation` — 인라인 "Confirm delete" 클릭에서만 실제 `DELETE`. 409 race 시 응답 body 의 usages 로 동일 다이얼로그 fallback.
- 파일: `page.tsx`. 테스트도 새 순서(첫 클릭 사전조회 / 0건일 때만 confirm)에 맞춰 갱신.

## 2. [maintainability, WARNING] `invalidateQueries` 앞 `void` 누락 → FIXED
- `deleteMutation.onSuccess` 의 `queryClient.invalidateQueries(...)` 에 `void` 추가. 파일 내 다른 호출(라인 102-103)과 일관.

## 3. [maintainability, WARNING] `mutationFn` 사전조회+삭제 혼합 → FIXED
- 위 #1 의 precheck/delete 분리로 자연 해소. 이제 `precheckMutation.isPending` = 조회 중, `deleteMutation.isPending` = 삭제 중으로 의미가 명확.

## 4. [maintainability, INFO] `DangerTab` 테스트 전용 export 의도 미명시 → FIXED
- `/** @internal exported for unit testing (danger-tab.test.tsx) only. */` JSDoc 추가.

## 5. [user-guide-sync, WARNING] user-guide 누락 → FIXED
- `integration-management.mdx` + `.en.mdx` 의 Danger zone FieldTable 행 + Tips 항목을 갱신: 삭제 차단 다이얼로그(사용처 목록·MCP 배지·워크플로우 링크) 흐름 반영. KO/EN parity 유지.

## 6. [requirement/side-effect, INFO] — 의도 확인, 무조치
- §7.2 mockup 의 단일 `[Open Workflow A →]` vs 구현의 워크플로우별 링크: 다수 워크플로우 케이스의 합리적 개선. 코드 유지.
- 409 + usages 빈 배열 → toast fallback: spec 미정의 방어 처리. 유지.
- `├─` 트리 문자: 기존 코드에서 추출만 함(이번 변경 도입 아님). 범위 밖.

## 검증
- `npx tsc --noEmit`: src 0 error (e2e/playwright 모듈 미해결은 사전 존재 환경 이슈, 본 변경 무관).
- `npx eslint <changed files>`: 0 error / 0 warning.
- `npx vitest run "src/app/(main)/integrations"`: 7 files, 75 tests PASS (danger-tab 4건 포함).

→ BLOCK 사유 전부 해소. fresh 상태 BLOCK: NO.

## Fresh re-review (수정 후)
- 수정(특히 §4.7 흐름 분리)을 커버하는 fresh `requirement-reviewer` 재검토 1회 수행.
- 결과: 선행 §4.7 WARNING 완전 해소 확인, §7.2 다이얼로그 내용·409 fallback·테스트 커버리지 모두 일치. 신규 Critical/Warning 0. **BLOCK: NO** (위험도 NONE).
- INFO(무조치): §7.2 mockup 은 단일 `[Open Workflow A →]` 예시지만 구현은 워크플로우별 링크 — 합리적 확장.
