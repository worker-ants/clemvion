# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**세션**: `review/code/2026/06/11/23_14_40/`

---

## 매트릭스 적재 결과

`.claude/config/doc-sync-matrix.json` 기준 총 18개 row 적재 완료. 변경 파일 집합을 두 커밋으로 나눠 분석했다.

- 커밋 A (`429d32d5`): `error-codes.ts`, `http-request.handler.ts`, `http-request.handler.spec.ts`, spec 파일 다수
- 커밋 B (`961f79a5`, HEAD): `http-request.handler.ts` (주석), `backend-labels.ts` (HTTP_BLOCKED ERROR_KO 추가), 리뷰 산출물, spec 파일

---

## 발견사항

### [INFO] new-error-code trigger 매칭 — HTTP_BLOCKED ERROR_KO 매핑, HEAD 에서 이미 해소됨

- 변경 파일: `codebase/backend/src/nodes/core/error-codes.ts` (커밋 A)
- 매트릭스 항목: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- 상태: 커밋 A 에서 `HTTP_BLOCKED` enum 이 `error-codes.ts` 에 추가됐고, 동일 PR 내 커밋 B (`961f79a5`) 에서 `backend-labels.ts` `ERROR_KO` 에 `HTTP_BLOCKED` 한국어 라벨이 추가됐다. 커밋 A 단독으로는 누락이었으나 리뷰 fix 커밋(B)이 동일 세션에서 보강했으므로 HEAD 기준 누락 없음.
- 현재 파일: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/frontend/src/lib/i18n/backend-labels.ts` line 584 에 `HTTP_BLOCKED` 매핑 확인됨.

### [INFO] new-node / node-schema-change trigger — http-request 핸들러 변경, docs MDX 갱신 불필요

- 변경 파일: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- 매트릭스 항목: `new-node` / `node-schema-change` — glob `codebase/backend/src/nodes/**` 매칭
- 판정: 이번 변경은 노드 신규 추가나 스키마(필드·라벨·타입) 변경이 아니다. 핸들러 내부 SSRF 가드 조건 제거(인증 방식 게이트 삭제) + configEcho 주석 정정에 해당한다. `http-request.schema.ts` 변경 없음. `02-nodes/integration.mdx` 의 FieldTable 이나 dict 키 갱신 의무 없음. 해당 없음.

### [INFO] node-schema-change trigger — `env-runtime-change` (환경 변수 운영 문서) 점검

- 매트릭스 항목: `env-runtime-change` — "README.md" 갱신
- 상태: `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수는 이번 변경에서 신규로 사용 범위가 확대(integration 전용 → 전 인증)됐다. 그러나 이 env var 은 이미 이전 구현에서 `http-safety.ts` 에 배선된 기존 값이며 이번에 새로 도입된 것이 아니다. README.md 의 환경 변수 목록 갱신 의무가 발생하는지는 README.md 의 현재 기재 여부에 달려 있으나, 이 trigger 는 "제품 최종 상태"의 신규 env var 추가일 때 해당하므로 기존 값의 적용 범위 확대는 INFO 수준이다. 리뷰 SUMMARY #23 (INFO)에서 "외부 운영 문서 갱신 항목 추가" 권장으로 이미 포착됐음.

---

## 요약

매트릭스 18개 row 중 glob 매칭되는 trigger 는 `new-node`·`node-schema-change`(`codebase/backend/src/nodes/**`) 및 `new-error-code`(`codebase/backend/src/nodes/core/error-codes.ts`) 3개. 실질 trigger 매칭 2개(new-error-code, node-glob) 중 new-error-code 의 동반 갱신(HTTP_BLOCKED ERROR_KO 한국어 매핑)은 HEAD 커밋(B)에서 해소됐다. 노드 스키마 변경이나 신규 노드 추가는 없어 FieldTable·dict 갱신 의무 없음. i18n parity 위반(한쪽만 등록), 신규 섹션 디렉토리 locale 등록 누락, docs MDX 갱신 누락은 발견되지 않는다. 전체적으로 HEAD 기준 유저 가이드 동반 갱신 누락 0건.

---

## 위험도

NONE

STATUS=success ISSUES=0
