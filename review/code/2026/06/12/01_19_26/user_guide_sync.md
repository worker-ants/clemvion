# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

### [WARNING] 신규 ErrorCode `DB_HOST_BLOCKED` 의 `ERROR_KO` 한국어 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/core/error-codes.ts`
- **매트릭스 항목**: `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)" — targets: `backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)`
- **누락된 동반 갱신**: `codebase/frontend/src/lib/i18n/backend-labels.ts` — `ERROR_KO` 테이블에 `DB_HOST_BLOCKED` 키 없음
- **상세**: `DB_HOST_BLOCKED` 는 Database Query 노드가 SSRF 가드에 의해 차단됐을 때 error port 로 출력되는 사용자 가시 에러 코드다. `ERROR_KO` 에 등재되지 않으면 한국어 사용자에게 영문 `error.message` 가 그대로 노출된다 (graceful fallback 이 영문 원문 반환). 대칭 코드인 `HTTP_BLOCKED` 는 같은 파일 584번 줄에 한국어 매핑이 이미 등재되어 있어 `DB_HOST_BLOCKED` 만 빠진 상태다.
- **제안**: `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블에 다음 항목 추가:
  ```
  // refactor 04 — DB SSRF 가드. HTTP_BLOCKED 와 대칭.
  DB_HOST_BLOCKED:
    "보안 정책(SSRF 방지)에 의해 해당 데이터베이스 호스트로의 연결이 차단됐어요. 내부망·loopback·클라우드 메타데이터 주소는 기본 차단되며, 자체 호스팅 환경에서 사설망 접근이 필요하면 관리자가 ALLOW_PRIVATE_HOST_TARGETS 를 설정해야 해요.",
  ```
  `EMAIL_HOST_BLOCKED` 도 현재 `ERROR_KO` 에 없으나, 이번 PR 변경 범위 밖의 기존 gap 이므로 별도 후속 plan 대상이다.

---

## 요약

매트릭스 전체 17개 trigger 중 이번 변경 set(`error-codes.ts`, `execution-failure-classifier.ts`, `database-query.handler.ts` 등)이 매칭되는 trigger 는 `new-error-code` (glob: `codebase/backend/src/nodes/core/error-codes.ts`) 1개. 해당 trigger 의 target(`ERROR_KO` 매핑)이 같은 변경 set 에 포함되지 않아 누락 1건(WARNING). 그 외 `new-node` / `node-schema-change` trigger 는 이번 변경이 노드 스키마·필드 추가가 아닌 에러 코드 추가·분류 로직 변경이므로 매칭 제외. `auth-session-flow-change` · `run-debug-flow-change` · `expression-language-change` 는 해당 없음.

## 위험도

WARNING
