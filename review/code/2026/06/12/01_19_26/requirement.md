# 요구사항(Requirement) 리뷰

## 발견사항

### [WARNING] [SPEC-DRIFT] `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 서술이 구현과 불일치
- **위치**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/2-database-query.md` line 106
- **상세**: spec §4 callout 은 여전히 "차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보)" 라고 기술한다. 그러나 구현은 이를 의도적으로 개선해 `DB_HOST_BLOCKED` IntegrationError 를 throw 하고 error 포트로 surface 하도록 변경됐다. 코드가 "향후 통일 후보"를 현 PR 에서 이행한 것이므로 코드가 옳고 spec 이 낡은 케이스다.
- **제안**: 코드 유지 + spec 반영. `spec/4-nodes/4-integration/2-database-query.md` line 106 callout 을 갱신: "차단 시 코드는 `INTEGRATION_CALL_FAILED`" → "`DB_HOST_BLOCKED` (`IntegrationError('DB_HOST_BLOCKED', ...)`)로 surface 된다. HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 대칭." + "향후 통일 후보" 문구 제거 + 메시지 일반화(host/IP 미노출) 요건 추가.

### [WARNING] [SPEC-DRIFT] `spec/5-system/3-error-handling.md` §1.4 / §3.2 Database 에러 코드 목록에 `DB_HOST_BLOCKED` 누락
- **위치**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` line 80 (§1.4 표) 및 line 223 (§3.2 표)
- **상세**: 두 곳 모두 Database 카테고리 에러 코드로 `DB_QUERY_FAILED` · `DB_CONNECTION_ERROR` · `DB_CONSTRAINT_VIOLATION` · `DB_PERMISSION_DENIED` 만 열거하고 `DB_HOST_BLOCKED` 가 없다. `ErrorCode` enum 에 새 코드가 추가됐으므로 이 두 표에도 등재가 필요하다. line 88 의 "본 enum 확장 시 분류 표 행 추가 검토 의무" note 의 대상이다. 코드가 옳고 spec 이 낡은 케이스.
- **제안**: 코드 유지 + spec 반영. line 80 Database 행에 `· DB_HOST_BLOCKED (SSRF 가드 차단 — DB host 가 사설/loopback, 기본 ON·ALLOW_PRIVATE_HOST_TARGETS opt-out)` 추가. line 223 Database 행에 `DB_HOST_BLOCKED` 추가.

### [WARNING] [SPEC-DRIFT] `spec/4-nodes/4-integration/2-database-query.md` §5.3 / §6.2 에 `DB_HOST_BLOCKED` 출력 케이스 및 에러 코드 행 누락
- **위치**: `/Volumes/project/private/clemvion/spec/4-nodes/4-integration/2-database-query.md` line 301 (§5.3 필드표), line 337–345 (§6.2 런타임 에러 코드표), line 308–313 (Expression 접근 예)
- **상세**: §5.3 필드표의 `output.error.code` 설명은 `DB_QUERY_FAILED / DB_CONNECTION_ERROR / DB_CONSTRAINT_VIOLATION / DB_PERMISSION_DENIED` 만 열거하고 `DB_HOST_BLOCKED` 가 없다. §6.2 에러 코드표에도 없어 워크플로우 저자가 `$node["X"].output.error.code === "DB_HOST_BLOCKED"` 분기 방법을 알 수 없다. §5.8 D4 라우팅 목록에도 미등재. 코드가 옳고 spec 이 낡은 케이스.
- **제안**: 코드 유지 + spec 반영. §6.2 에 `DB_HOST_BLOCKED` 행 추가(SSRF 가드 차단, 메시지 host/IP 미노출 고정 문구, details 없음). §5.3 필드표 `output.error.code` 설명에 추가. §5.8 D4 라우팅 목록에 추가.

### [INFO] [SPEC-DRIFT] `spec/conventions/chat-channel-adapter.md` §3.1 분류표는 `DB_*` 와일드카드로 이미 커버됨
- **위치**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` line 388
- **상세**: 분류표는 `DB_*` 와일드카드 패턴으로 `executionFailedInternal` 매핑을 명시한다. `DB_HOST_BLOCKED` 는 이 패턴에 포함되므로 classifier 코드 및 테스트의 `executionFailedInternal` 분류는 spec 과 이미 일치한다. 별도 행 추가는 필수가 아니나 `HTTP_BLOCKED` 처럼 SSRF 코드를 명시 표기하면 문서 명확성이 높아진다.
- **제안**: 필수 아님. 원한다면 `DB_*` 와일드카드 항목에 `(포함: DB_HOST_BLOCKED — SSRF 차단)` 주석 추가 또는 별도 행 신설.

### [INFO] MySQL 드라이버의 SSRF 차단 테스트 없음
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` SSRF 테스트 블록
- **상세**: 추가된 SSRF 차단 테스트는 postgres 픽스처만 사용한다. MySQL 드라이버도 `if (creds.host)` 블록(driver 분기 전)에서 동일하게 차단되나 명시 검증이 없다. 기능적으로는 완전하나 커버리지 관점의 갭이다.
- **제안**: 필수 아님. 원한다면 MySQL credentials 픽스처로 동일한 차단 케이스 1건 추가.

### [INFO] `DB_HOST_BLOCKED` 메시지가 `sanitizeMessage` 를 통과하지만 고정 문자열이므로 실질 영향 없음
- **위치**: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` line 229, 280
- **상세**: IntegrationError 경로의 메시지는 `sanitizeMessage(err.message)` 를 통과한다. `DB_HOST_BLOCKED` 의 메시지는 `'Database host resolves to a private/loopback address blocked by SSRF policy.'` 고정 문자열로 host/IP 를 포함하지 않으므로 sanitize 결과가 동일하다. 테스트도 `not.toContain(host)` + `toMatch(/SSRF policy/i)` 로 명시 검증한다. 정보성 확인.

## 요약

`DB_HOST_BLOCKED` 에러 코드 추가는 기능적으로 완전하다. `ErrorCode` enum 등재 → `IntegrationError` throw → `INTERNAL_CODES` Set 등재 → `executionFailedInternal` 분류까지 일관된 파이프라인이 구성됐으며, SSRF 차단 시 host/IP 비노출 메시지 정책, `ALLOW_PRIVATE_HOST_TARGETS` opt-out, `connectMock` 미호출 검증, `logUsage` 기록이 모두 테스트로 커버된다. 코드 버그는 없으며, 발견사항은 모두 spec 갱신 누락(SPEC-DRIFT)이다: `spec/4-nodes/4-integration/2-database-query.md` §4 callout 이 구버전("INTEGRATION_CALL_FAILED fallback, 향후 통일 후보")을 기술 중이고, `spec/5-system/3-error-handling.md` §1.4·§3.2 및 `2-database-query.md` §6.2 에 `DB_HOST_BLOCKED` 가 미등재 상태다. 세 spec 파일의 갱신이 필요하며 코드 수정은 불필요하다.

## 위험도

LOW
