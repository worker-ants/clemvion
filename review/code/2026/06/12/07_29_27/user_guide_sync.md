# 유저 가이드 동반 갱신(User Guide Sync) Review

## 분석 개요

매트릭스 적재: `.claude/config/doc-sync-matrix.json` — 19개 rows 확인.
변경 파일 식별: `git diff origin/main...HEAD --name-only` 기준 30개 파일.

**유저 가이드 동반 갱신 관련 trigger 매칭:**
- `new-error-code` (glob: `codebase/backend/src/nodes/core/error-codes.ts`) — 매칭됨
- `new-node` / `node-schema-change` (glob: `codebase/backend/src/nodes/**`) — 파일 glob 은 매칭되나 아래 분석 참조

---

## 발견사항

### 매칭 1: `new-error-code` — DB_HOST_BLOCKED 신설 (PASS)

- 변경 파일: `codebase/backend/src/nodes/core/error-codes.ts`
- 매트릭스 항목: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- 동반 갱신 상태: `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 `DB_HOST_BLOCKED` 한국어 매핑이 동일 PR 안에서 추가됨 (line 588).
- 판정: **동반 갱신 완료** — CRITICAL 조건 미해당.

### 매칭 2: `node-schema-change` / `new-node` — database-query.handler.ts 변경 (해당 없음)

- 변경 파일: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts`
- 분석: 해당 변경은 노드 스키마(입력 필드·출력 필드·라벨) 변경이 아닌 SSRF 가드 동작 내부 변경 — 에러 코드 승격 로직 추가. 노드 입력/출력 FieldTable 변경 없음. `02-nodes/integrations.mdx` 에 Database Query 에러 코드 열거 섹션이 없어 갱신 대상 없음.
- 판정: **해당 없음** — docs MDX FieldTable 동반 갱신 트리거 조건 미해당.

### 참고 (INFO): EMAIL_HOST_BLOCKED 기존 갭

- `EMAIL_HOST_BLOCKED` 가 `ERROR_KO` 에 미등재 상태임이 확인됨.
- 본 PR 이전부터 존재하던 pre-existing gap 으로 RESOLUTION.md 에서도 "pre-existing gap, 본 PR 범위 밖" 으로 명시됨.
- 판정: **본 PR 범위 밖** — 별도 follow-up 필요.

---

## 요약

유저 가이드 동반 갱신 관점 평가: 매트릭스 19개 trigger 중 실질 매칭 1개 (`new-error-code`). 해당 trigger 의 필수 동반 갱신 대상인 `codebase/frontend/src/lib/i18n/backend-labels.ts` ERROR_KO 매핑이 동일 PR 안에서 완료됐으므로 누락 없음. docs MDX (`02-nodes/`, `06-integrations-and-config/`) 및 i18n dict 변경은 이번 변경의 성격(기존 노드 에러코드 승격)상 필요 없음. EMAIL_HOST_BLOCKED 미등재는 pre-existing gap 으로 본 PR 외 사항. 매칭 trigger 1개, 누락 0개.

## 위험도

NONE
