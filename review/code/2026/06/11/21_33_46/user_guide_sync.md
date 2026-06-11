# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [CRITICAL] 신규 `CODE_MEMORY_LIMIT` ErrorCode 의 `ERROR_KO` 한국어 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/core/error-codes.ts`
- **매트릭스 항목**: `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)" / `codebase/backend/src/nodes/core/error-codes.ts` glob match
  - targets: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블에 `CODE_MEMORY_LIMIT` 항목 없음
- **상세**: `error-codes.ts` 에 `CODE_MEMORY_LIMIT: 'CODE_MEMORY_LIMIT'` 이 신규 추가됐다. `backend-labels.ts` 의 `ERROR_KO` 테이블은 이미 존재하며(라인 568) `GRAPH_VALIDATION_FAILED` / `EXECUTION_TIME_LIMIT_EXCEEDED` / `MODEL_CONFIG_INVALID` 등을 매핑하고 있으나 `CODE_MEMORY_LIMIT` 항목이 없다. 코드 노드 실행 중 메모리 한도를 초과하면 사용자에게 영문 raw 코드 `'CODE_MEMORY_LIMIT'` 이 그대로 노출된다. `data.mdx` / `data.en.mdx` 에는 `CODE_MEMORY_LIMIT` 에러 코드 행이 정상 추가됐으나 이것은 static MDX 설명이고, 런타임 에러 메시지 번역 경로(`ERROR_KO` → `translateBackendError` 함수)는 별도로 매핑이 필요하다.
- **제안**: `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블에 다음 항목 추가:
  ```
  CODE_MEMORY_LIMIT: '코드 실행 중 메모리 한도(128MB)를 초과했어요.',
  ```
  추가 후 `cd codebase/frontend && npm test -- backend-labels` 로 가드 통과 확인.

---

### [WARNING] docs MDX 에러 코드명 정합성 — 기존 레거시 코드명 교체 (참고)

- **변경 파일**: `codebase/frontend/src/content/docs/02-nodes/data.mdx`, `codebase/frontend/src/content/docs/02-nodes/data.en.mdx`
- **매트릭스 항목**: `node-schema-change` — "노드 schema 변경 (필드 추가·라벨 변경)"
  - targets: `02-nodes/<cat>.mdx` FieldTable + `backend-labels.ts` label/errorCode
- **상태**: 이번 변경 set 에 `data.mdx`/`data.en.mdx` 양쪽 모두 동반 갱신됨. `EXECUTION_TIMEOUT` → `CODE_TIMEOUT`, `CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`, 신규 `CODE_MEMORY_LIMIT` 행 추가 — ko/en 쌍 모두 갱신 완료. i18n parity 위반 없음.
- **누락 없음**: MDX docs 동반 갱신은 정상 완료됐으나, 위 CRITICAL 항목(`ERROR_KO` 매핑)이 이와 연동되는 누락임을 명시.

---

## 요약

매트릭스 전체 18개 trigger 중 2개 trigger 가 이번 변경 set 에 매칭됐다: `new-error-code`(glob: `error-codes.ts`) 와 `node-schema-change`(glob: `nodes/**`). `node-schema-change` 는 docs MDX 양쪽 갱신이 완료돼 이상 없다. `new-error-code` trigger 에서 `CODE_MEMORY_LIMIT` 의 `ERROR_KO` 한국어 매핑 1건이 누락됐다 — `ERROR_KO` 테이블이 이미 존재하므로 미등록 시 사용자에게 영문 raw 코드가 그대로 노출되는 runtime 문제다.

## 위험도

CRITICAL
