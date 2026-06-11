# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`, scope: `spec/5-system/`
검토 일시: 2026-06-10

---

## 발견사항

### 1. 충돌 없음 — `userId` (QueryAuditLogDto 신규 필드)

- **[INFO]** `QueryAuditLogDto.userId` 필드명 — spec 에 명시 이름 없음, 기존 필드와 일치
  - target 신규 식별자: `userId?: string` (query param, `QueryAuditLogDto` 에 추가 예정 — V-03 구현)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts` line 25: `userId: string` (entity 컬럼)
    - `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` line 23: `userId: string` (response DTO)
  - 상세: 기존 entity·response DTO 의 `userId` 는 레코드 소유자를 나타내는 UUID 필드. 신규 query param `userId` 도 "해당 사용자의 감사 로그 필터" 의미로 동일 개념을 가리킨다. 의미가 일치하므로 충돌 없음. 단, `spec/5-system/1-auth.md §4.2` 는 "기간, **사용자**, 액션 유형으로 필터링" 으로만 기술하며 query param 이름을 `userId` 로 명시하지 않는다 — 구현 시 Swagger description 에서 명시적으로 "필터 대상 사용자 UUID" 임을 문서화 권장.
  - 제안: 현행 `userId` 명칭 유지 (entity·response 와 일관). spec 에 파라미터명을 명시 보완하면 이상적이나 기능 구현을 블로킹하는 사안 아님.

### 2. 충돌 없음 — `@Roles('admin')` 가드 (AuditLogsController)

- **[INFO]** `@Roles('admin')` 데코레이터 적용 — 신규 추가이나 패턴 충돌 없음
  - target 신규 식별자: `@Roles('admin')` on `AuditLogsController.findAll`
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/alerts/alerts.controller.ts` lines 56, 77, 99; `auth-configs.controller.ts` lines 86, 105, 144, 166, 200 — 모두 동일 `@Roles('admin')` 패턴 사용
  - 상세: `@Roles('admin')` 은 프로젝트 공통 가드 패턴이며 의미(`Admin+` 이상만 접근)가 동일하다. `AuditLogsController` 에 새로 추가해도 기존 코드와 의미·구현이 충돌하지 않는다.
  - 제안: 없음.

### 3. 충돌 없음 — `notification-signing` secret ref 이름 (promoteRotatedNotificationSecrets 수정)

- **[INFO]** `buildSecretRef({ scope: 'triggers', resourceId, name: 'notification-signing' })` — C3 수정 경로와 기존 경로 간 ref 이름 일치
  - target 신규 식별자: C3 fix 는 `promoteRotatedNotificationSecrets` 에서 `buildSecretRef({ ..., name: 'notification-signing' })` + `secrets.rotate(ref, wsId, v2)` + `signing.secretRef = ref` 패턴을 사용 (현재 `signing.secret = secretV2` 로 잘못 구현된 부분을 수정)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/security-fixes-0f9165/codebase/backend/src/modules/triggers/triggers.service.ts` line 462–465: `normalizeNotificationSecretRef` 함수가 동일하게 `buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'notification-signing' })` 사용
  - 상세: C3 fix 는 `promoteRotatedNotificationSecrets` 가 `normalizeNotificationSecretRef` 와 동일한 canonical ref 구성 방식을 따르도록 수정하는 것이다. ref 이름(`notification-signing`)과 scope(`triggers`)가 이미 `normalizeNotificationSecretRef` 에서 정의된 패턴과 일치하므로, 같은 trigger row 에 대해 두 경로가 동일 secret store key 로 수렴한다 — 의도된 동작. 충돌 없음.
  - 제안: 없음. `data-flow/15-external-interaction.md §1.5` 갭 기술 플립 시 "v2 → config.signing.secret" 서술을 "v2 → secret store rotate + config.signing.secretRef" 로 갱신하면 spec 정합 완료.

### 4. 확인 — spec/5-system/ 전체 식별자 (이미 구현된 영역)

spec/5-system/ 의 나머지 문서 (1-auth.md WebAuthn 섹션, 10-graph-rag.md, 11-mcp-client.md) 에서 정의된 식별자 전체를 코드베이스와 대조한 결과:

- 오류 코드: `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `CHALLENGE_INVALID`, `INVALID_OPTIONS_TOKEN`, `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`, `RECOVERY_CODE_INVALID`, `KB_REEXTRACT_IN_PROGRESS` — 모두 기존 코드에서 동일 이름으로 사용 중이며 충돌 없음.
- 환경변수: `WEBAUTHN_ALLOW_FALLBACK`, `MCP_ALLOW_INSECURE_URL`, `MCP_MAX_CONCURRENT_CONNECTIONS` — `.env.example` 및 구현 코드에 이미 동일 이름으로 존재. 충돌 없음.
- API endpoint: spec §5 표의 모든 엔드포인트 — 기존 controller 에 동일 경로·메서드로 구현 완료. 중복 정의 없음.
- 이벤트명: `document:graph_started`, `document:graph_progress`, `document:graph_completed`, `document:graph_retry`, `document:graph_failed` — spec §6 과 코드베이스가 일치. `document:graph_error` 는 spec 에 dead-declared 로 명시됨. 충돌 없음.

---

## 요약

`spec/5-system/` 전체를 `--impl-prep` 관점으로 검토한 결과, 신규로 도입되는 식별자(V-03: `QueryAuditLogDto.userId` 필터 파라미터, C3: `promoteRotatedNotificationSecrets` 내 `notification-signing` secret ref 경로)는 기존 코드베이스의 동일 개념 식별자(`audit-log.entity.ts userId`, `normalizeNotificationSecretRef` 의 `notification-signing` ref)와 의미가 일치하며 충돌하지 않는다. WebAuthn·Graph RAG·MCP Client 관련 이미 구현된 식별자(오류코드·env var·endpoint·이벤트명) 또한 spec 과 코드가 1:1로 대응하여 중복·충돌이 없다. INFO 수준의 보완 사항(spec에 `userId` 파라미터명 명시)만 존재하며, 구현을 차단하는 CRITICAL/WARNING 충돌은 발견되지 않았다.

---

## 위험도

NONE
