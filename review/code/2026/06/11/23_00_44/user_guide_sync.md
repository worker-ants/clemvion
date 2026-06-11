# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] 신규 ErrorCode `HTTP_BLOCKED` — `backend-labels.ts` `ERROR_KO` 매핑 누락

- **변경 파일**: `codebase/backend/src/nodes/core/error-codes.ts`
- **매트릭스 항목**: `new-error-code` — "신규 errorCode 발행 (ErrorCode enum 추가)"
  - 매트릭스 target 원문: "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시 (후속 plan 에서 ERROR_KO 신설 검토)"
- **누락된 동반 갱신**: `/Volumes/project/private/clemvion/.claude/worktrees/http-ssrf-all-auth/codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 테이블에 `HTTP_BLOCKED` 키 부재
- **상세**:
  - `error-codes.ts` 에 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 가 신규 추가됐다.
  - `backend-labels.ts` 의 `ERROR_KO` 테이블(line 568~582)에 `HTTP_BLOCKED` 항목이 없다. 현재 등록된 코드는 `GRAPH_VALIDATION_FAILED`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `MODEL_CONFIG_INVALID`, `MODEL_CONFIG_NOT_FOUND`, `ENCRYPTION_KEY_MISSING` 5개뿐이다.
  - `HTTP_BLOCKED` 에러는 이번 변경으로 `authentication=none`/`custom` 포함 전 인증 방식에서 발생할 수 있게 됐다. 기존보다 더 넓은 사용자 시나리오에서 노출되는 에러 코드다.
  - `ERROR_KO` 매핑이 없으면 `translateErrorCode` 함수의 fallback 경로(`ERROR_KO[code] ?? value`)에 의해 영문 메시지가 그대로 사용자에게 노출된다.
  - plan 파일(`plan/in-progress/http-ssrf-all-auth.md`)은 `HTTP_BLOCKED enum` 을 spec 반영 완료 항목으로 체크했으나, 매트릭스 요건인 "사용자 가시 ko 노출을 PR 본문에 명시 + 후속 plan 에서 ERROR_KO 신설 검토" 에 해당하는 내용이 명시되지 않았다.
- **제안**:
  - 옵션 A (동일 PR): `backend-labels.ts` `ERROR_KO` 에 `HTTP_BLOCKED: 'SSRF 보안 정책에 의해 해당 주소로의 요청이 차단되었어요. 내부망이나 클라우드 메타데이터 서버 주소는 접근할 수 없어요.'` 추가.
  - 옵션 B (후속 plan): 동일 PR 에 추가하지 않는 경우, PR 본문 및 `plan/in-progress/http-ssrf-all-auth.md` 에 "HTTP_BLOCKED 는 현재 ERROR_KO 미등록 — 한국어 사용자에게 영문 메시지 노출됨. follow-up plan 에서 ERROR_KO 등록 예정" 을 명시.
  - 매트릭스 trigger 가 glob(`codebase/backend/src/nodes/core/error-codes.ts`) 직접 매칭이므로 이 갱신은 선택이 아닌 필수 검토 사항이다.

---

## 요약

매트릭스 rows[] 총 19개 중 이번 변경 파일 집합(`codebase/backend/src/nodes/core/error-codes.ts`, `http-request.handler.ts`, `http-request.handler.spec.ts`, `plan/**`, `review/**`)에 대해 매칭된 trigger는 `new-error-code` 1개다. `new-node`/`node-schema-change` trigger 도 `codebase/backend/src/nodes/**` glob 에 매칭되나 이번 변경은 기존 노드의 SSRF 가드 refactor 이며 신규 노드 추가나 스키마 필드 변경이 없어 해당 없다. `new-ui-string`·`expression-language-change`·`auth-session-flow-change` 는 변경 파일 중 해당 경로가 없어 매칭 없다. 누락 1건(WARNING): `HTTP_BLOCKED` 신규 ErrorCode 에 대한 `backend-labels.ts` `ERROR_KO` 한국어 매핑 또는 PR 본문 명시가 빠져 있다.

## 위험도

WARNING

STATUS=success ISSUES=1
