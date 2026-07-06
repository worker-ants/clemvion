### 발견사항

- **[WARNING]** DB SSRF 차단 "서버 활동 로그에 원본 host 보존" 서술이 실제 코드와 불일치 (알려진 갭이나 spec 텍스트 미정정)
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 문단("차단 상세는 활동 로그(`logUsage`)에만 남는다") 및 §Rationale "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설" 절("차단 상세(원본 host)는 `logUsage` 서버 활동 로그에만 남긴다")
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md` 첫 checkbox 항목 — "완료(2026-07-05, 본 PR)" 각주 끝의 "**후속(별도)**: DB catch 원본 폐기 갭(서버 로그 미보존, HTTP 와 비대칭)"
  - 상세: `database-query.handler.ts` (`codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:223-231`)는 `assertSafeOutboundHostResolved` catch 에서 곧바로 host/IP 를 담지 않는 일반화 메시지로 `IntegrationError('DB_HOST_BLOCKED', ...)` 를 throw 하며, 그 이전에 원본 host 를 `logger.warn` 등으로 남기는 코드가 없다. 따라서 `logUsage`(`toLogError(err)`)가 기록하는 것도 이미 일반화된 메시지뿐이라 원본 host 는 어디에도 보존되지 않는다. 반면 HTTP Request 경로(`http-request.handler.ts:367,440,457` 의 `logger.warn`)는 원본 상세를 서버 로그에 보존한 뒤 클라이언트/usage 로그만 일반화한다 — target 문서 자신도 이 비대칭을 인지하고 있다(`1-http-request.md §8.3`: "HTTP 는 원본 상세를 `logger.warn`(전 인증 공통)으로도 보존한다"). 이는 정확히 `http-ssrf-all-auth-followups.md` 가 같은 PR 완료 각주에 명시한 미해소 후속("DB catch 원본 폐기 갭")과 일치한다 — 즉 코드 갭 자체는 **plan 에 이미 추적**되어 있으나, `2-database-query.md` 의 두 곳(§4 본문·Rationale)이 "차단 상세는 `logUsage` 서버 활동 로그에만 남긴다" 고 단정해 실제로는 서버 어디에도 원본이 남지 않는다는 사실과 모순된 채로 이번 PR 에 함께 커밋됐다.
  - 제안: target(`2-database-query.md`) 의 두 문장을 정정하거나("DB 경로는 현재 원본 host 를 서버 로그에도 보존하지 않는다 — HTTP 와 비대칭, 후속 필요" 식) 최소한 `http-ssrf-all-auth-followups.md` 로 링크해 갭이 아직 열려 있음을 명시할 것. 또는 이번 PR 범위에서 DB catch 에도 `logger.warn` 원본 보존을 추가해 텍스트와 코드를 동시에 맞출 것.

### 요약
이번 target 변경(HTTP Request SSRF 차단 메시지 일반화, §8.3)은 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 "SSRF 에러 메시지 클라이언트 일반화" 항목을 정확히 이행한 것으로, plan 이 이미 "완료(2026-07-05, 본 PR)" 로 갱신돼 있어 미해결 결정과의 충돌이나 선행 조건 미해소는 발견되지 않았다. 다만 같은 diff 로 함께 갱신된 `2-database-query.md` 의 서술 하나가, 그 plan 자신이 별도 후속으로 명시한 "DB catch 원본 폐기 갭(서버 로그 미보존)" 을 반영하지 못한 채 "원본이 활동 로그에 남는다" 고 단정해 실제 코드·plan 의 인지 상태와 어긋난다. 이 외 `ai-agent-tool-connection-rewrite` 등 다른 in-progress plan 들은 이번 target 영역과 무관하며, `spec-sync-integration-common-gaps.md`(target frontmatter `pending_plans`) 는 "Missing integration" 배지 티어3 논의로 이번 변경과 충돌 없음.

### 위험도
LOW
