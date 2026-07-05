# 보안(Security) Code Review — SSRF 에러 메시지 일반화 (HTTP Request 노드)

## 발견사항

- **[WARNING]** 일반화 목표가 `logUsage`(Activity 로그, 워크스페이스 사용자 조회 가능) 경로에서는 무효화됨
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:364-379` (`logUsage(... error: { code: ErrorCode.HTTP_BLOCKED, message: detail } ...)`), redirect-hop 경로에서는 IntegrationError 로 승격되어 line 532-541 catch 에서 `logUsage(... error: { code: err.code, message: err.message } ...)` (이때 `err.message` 는 이미 일반화된 `SSRF_BLOCKED_CLIENT_MESSAGE` 라 안전)
  - 상세: preflight SSRF 차단 경로(line 357-393)에서 원본 `detail`(차단된 hostname/IP 원문, 예: `SSRF_BLOCKED: hostname "169.254.169.254" resolves to a restricted network range`)이 `logger.warn`(서버 로그, 안전) 뿐 아니라 **`logUsage` 호출의 `error.message` 에도 그대로 실려** DB 테이블 `integration_usage_log.error`(JSON, as-is 저장 — `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts:40`)에 영구 저장된다. 이 테이블은 `IntegrationsController.activity()`(`GET /integrations/:id/activity`, `codebase/backend/src/modules/integrations/integrations.controller.ts:331-354`)를 통해 워크스페이스 스코프로 그대로(raw) 반환되며, 이 엔드포인트는 다른 mutating 엔드포인트(`@Roles('editor')`)와 달리 role 제약이 보이지 않아 viewer 등 해당 워크스페이스의 모든 인증 사용자가 조회 가능한 것으로 보인다(`integrations.service.ts:862-`의 `getActivity` 가 `items`(raw `IntegrationUsageLog[]`)를 가공 없이 반환).
  - 즉 이번 diff 는 `output.error.message`(노드 실행 결과, 워크플로 에디터에 직접 노출)의 정찰 면은 성공적으로 축소했지만, **동일한 원본 상세가 "Recent activity" 탭(Activity 로그 API)을 통해 여전히 워크스페이스 사용자에게 노출**된다. PR 코드 주석("원본 상세는 서버 로그·usage 로그에만 남긴다")은 `logUsage` 를 "서버 전용"으로 전제하고 있으나 실제로는 사용자 대면 API 라서 이 전제가 틀렸다. CWE-209(Information Exposure Through an Error Message)/정찰 면 축소라는 이번 작업의 목적 자체를 부분적으로 무력화한다.
  - 제안: `logUsage` 에 실어보내는 `error.message` 도 `SSRF_BLOCKED_CLIENT_MESSAGE`(또는 별도 일반화 문구)로 대체하고, 원본 hostname/IP 상세는 `logger.warn`(서버 stdout/구조화 로그, 사용자 API 미노출 경로)에만 남긴다. 이는 DB Query 핸들러의 기존 주석 의도("원본 상세는 logUsage 의 toLogError 로 서버 로그에만 남는다")와도 재정합이 필요 — 다만 DB 쪽은 아래 INFO 항목대로 그 주석 자체가 이미 사실과 다르다.

- **[INFO]** DB Query 노드의 선행 주석이 실제 동작과 불일치 (기존 코드, 이번 diff 범위 밖이나 대칭성 관련)
  - 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts:219-231`
  - 상세: 주석은 "원본 상세는 logUsage 의 toLogError 로 서버 로그에만 남는다"고 서술하지만, 실제 코드는 `catch { throw new IntegrationError('DB_HOST_BLOCKED', <일반화 문구>) }` 로 **원본 에러 객체를 바인딩 없이 버리고** 새 일반화된 `IntegrationError` 를 던진다. 이후 바깥 catch 의 `toLogError(err)` 는 이 새 IntegrationError 만 보게 되어 원본 hostname/IP 는 어디에도(서버 로그에도) 남지 않는다. consistency-check(`review/consistency/2026/07/05/12_55_17/convention_compliance.md`, `cross_spec.md`)가 이미 이 갭을 지적했고 SUMMARY §4 에서 "검토 항목"으로 남겨둔 상태. 이번 HTTP diff 는 (위 WARNING 을 제외하면) DB 보다 오히려 진전된 패턴(`logger.warn` 원본 보존)을 도입했다 — 3-node 대칭을 맞추려면 DB 도 동일하게 `logger.warn` 추가가 필요(관측성 저하이지 이번 SSRF 노출 리스크는 아님).
  - 제안: 별도 후속으로 DB/Email 핸들러에도 `logger.warn` 원본 보존을 추가해 3-node 완전 대칭화 (SUMMARY §4 에 이미 계획됨 — 이번 리뷰가 재확인).

- **[INFO]** Redirect-hop 경로의 `details.url` 은 안전 — 확인 완료
  - 위치: `http-request.handler.ts:441-461` (redirect 검증 실패 시 `url` 변수는 아직 `next` 로 갱신되지 않은 상태에서 throw) 및 `buildPreflightErrorOutput`(line 611-637)의 `details: { url: sanitizeUrlCredentials(url), method }`
  - 상세: `url = next;`(line 458) 는 안전성 검증(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`) 통과 **후**에만 실행되므로, 차단된 redirect 대상(예: `169.254.169.254`)이 `output.error.details.url` 에 노출되지 않는다. 테스트(`http-request.handler.spec.ts` 신규 케이스, line 106)의 `not.toContain('169.254')` 단언과 부합. 이 부분은 취약점 아님 — 검증 결과만 기록.

- **[INFO]** 테스트 커버리지는 적절
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (4곳 메시지 단언 갱신 + redirect SSRF 신규 케이스)
  - 상세: 일반화 메시지 단언 + `not.toContain('169.254')` 네거티브 단언까지 포함해 정찰 면 축소 요구사항을 직접 검증한다. 다만 위 WARNING 대상인 `logUsage` 호출 인자(activity 로그로 넘어가는 `error.message`)에 대한 단언은 없다 — 이 갭이 위 WARNING 을 테스트가 조기에 잡지 못한 이유다.
  - 제안: `logUsage` mock 호출 인자에 대해서도 `error.message` 가 일반화 문구인지(또는 최소한 raw IP/hostname 을 포함하지 않는지) 단언하는 테스트 추가.

## 요약

이번 변경은 HTTP Request 노드의 SSRF 차단 시 `output.error.message`(워크플로 에디터에 직접 노출되는 필드)에서 차단된 hostname/IP 원문을 제거하고 고정 일반화 문구로 치환해, DB Query/Send Email 노드와 동일한 정찰 면 축소(CWE-209 완화) posture 를 달성한다는 목표를 코드·테스트 양면에서 정확히 구현했다. Redirect-hop 검증 실패도 `HTTP_BLOCKED` 로 올바르게 라우팅되고, `details.url` 에도 차단 대상이 새지 않음을 확인했다. 다만 원본 상세를 "서버 로그 전용"으로 의도한 `logUsage` 호출이 실제로는 워크스페이스 사용자가 조회 가능한 Activity API(`GET /integrations/:id/activity`)로 이어지는 DB 테이블에 그대로 저장되어, preflight SSRF 차단 시점에는 정찰 면 축소가 완전하지 않다(redirect-hop 차단은 이미 일반화된 메시지만 `logUsage` 에 실리므로 안전). 이 외 인젝션·시크릿 하드코딩·인증/인가 우회·암호화 관련 새로운 이슈는 발견되지 않았다.

## 위험도
MEDIUM
