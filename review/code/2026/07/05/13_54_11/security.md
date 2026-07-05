# 보안(Security) Code Review — SSRF 에러 메시지 일반화 (HTTP Request 노드) — 재검토

본 리뷰는 직전 리뷰(`review/code/2026/07/05/13_32_17/security.md`)의 WARNING#1(preflight `logUsage`
error.message 에 원본 host/IP 가 실려 `GET /integrations/:id/activity` 로 workspace 사용자에게 노출)에
대한 조치(`RESOLUTION.md`) 반영 후 상태를 실제 소스(`http-request.handler.ts`,
`http-request.handler.spec.ts`)를 직접 확인해 재검증한다.

## 발견사항

- **[INFO]** 직전 WARNING(logUsage → Activity API 원본 노출)은 코드 상 해소 확인
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:371-384`(preflight `logUsage`), `:537-546`(redirect-hop 승격 후 outer catch `logUsage`)
  - 상세: preflight 경로는 `logUsage` 호출의 `error.message` 를 `SSRF_BLOCKED_CLIENT_MESSAGE`(`'Request blocked by SSRF policy.'`) 고정 문자열로 채운다(L380). redirect-hop 경로는 SSRF 재검증 실패 시 `IntegrationError(ErrorCode.HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)` 를 던지고(L443-446, L458-461), outer catch(L537)의 `err instanceof IntegrationError` 분기가 `err.message`(이미 일반화된 값)를 그대로 `logUsage` 에 전달한다(L543). 즉 두 경로 모두 `integration_usage_log` 테이블(및 그 위 `GET /integrations/:id/activity`)에 원본 hostname/IP 가 실릴 여지가 없다. 원본은 `logger.warn`(L367, L440-442, L457) 세 곳에만 남아 서버 프로세스 로그로 격리된다. 실제로 fetch/네트워크 호출 없이 소스를 grep 하여 `SSRF_BLOCKED_CLIENT_MESSAGE` 참조가 모든 클라이언트/usage 노출 지점에서 일관되게 쓰이고 있음을 확인했다.
  - 제안: 조치 불필요 — 재확인 완료.

- **[INFO]** 신규 테스트가 usage 로그 일반화와 서버 로그 원본 보존을 모두 검증
  - 위치: `http-request.handler.spec.ts:39-77`(기존 4곳 단언 갱신 + `not.toContain('169.254')`), `:88-139`(신규 redirect SSRF 테스트 — `logUsage` 호출 인자 단언 + `Logger.prototype.warn` spy 로 원본 hostname/IP 서버 로그 보존 단언), `:141-171`(5-hop 초과 → `HTTP_BLOCKED` 신규 테스트)
  - 상세: 직전 리뷰(testing.md)가 지적한 3개 커버리지 갭(redirect-hop logUsage 미검증, logger.warn 원본 보존 미검증, 5-hop 초과 경로 미검증)이 이번 diff 의 신규 테스트로 해소되었다. 특히 L126-128 의 `expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('169.254.169.254'))` 는 "원본은 서버 로그에만 남는다"는 보안 설계 의도 자체를 회귀로부터 보호한다. L130-137 은 redirect-hop `logUsage` 도 일반화 문구만 기록됨을 명시적으로 단언한다.
  - 제안: 조치 불필요.

- **[INFO]** `output.error.details.url` 은 redirect 차단 대상을 노출하지 않음 — 확인
  - 위치: `http-request.handler.ts:448-465`(redirect 루프), `:547-555`/`:579`(`buildPreflightErrorOutput` 호출 시 `url` 인자)
  - 상세: `url = next;`(L463)는 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 재검증을 **통과한 이후**에만 실행된다(L452-462 catch 에서 실패 시 그 지점에서 즉시 throw, `url` 변수는 갱신되지 않음). 따라서 redirect 차단이 발생한 경우 `buildPreflightErrorOutput`/outer-catch 경로에 전달되는 `url` 은 여전히 마지막으로 안전성 검증을 통과한 이전 hop 의 URL이며, 차단된 내부 대상(`169.254.169.254` 등)이 `output.error.details.url` 로 새어나가지 않는다. 신규 테스트(`spec.ts:124`)의 `expect(output.error.message).not.toContain('169.254')` 로 message 레벨에서도 확인된다.
  - 제안: 조치 불필요. (참고: `details.url` 필드가 검증-통과 URL 만 담는다는 이 불변조건에 의존하는 로직이므로, 향후 redirect 처리 로직을 리팩터링할 때 이 순서(검증 성공 후에만 `url` 갱신)를 깨지 않도록 유의할 가치는 있다 — 코드 주석에 이미 이 의도가 명시돼 있어 낮은 리스크.)

- **[INFO]** JSDoc·인라인 주석이 실제 동작(Usage 로그도 일반화)과 정합 — 직전 documentation/side_effect 리뷰가 지적한 문서 불일치는 이번 diff 범위(코드) 자체에서는 처음부터 재현되지 않음
  - 위치: `http-request.handler.ts:27-35`(`SSRF_BLOCKED_CLIENT_MESSAGE` JSDoc), `:363-365`, `:376-378`
  - 상세: 코드 내 JSDoc·인라인 주석은 "usage 로그도 Activity API 노출 경로이므로 일반화한다"고 정확히 서술하며 실제 구현과 일치한다. 직전 documentation/side_effect 리뷰가 지적한 "spec 문서(`1-http-request.md` §6/§8.3) 문구가 실제와 다르다"는 지적은 `spec/**` 문서 파일에 대한 것이고, 코드 자체의 JSDoc은 이미 정확하다. spec 문서 정합화는 documentation/requirement 리뷰어의 스코프이며 보안 취약점은 아니다.
  - 제안: 조치 불필요(문서 정합은 documentation/requirement 트랙에서 처리 중).

- **[INFO]** 인젝션·시크릿 하드코딩·인증/인가·암호화 관점 — 신규 이슈 없음
  - 상세: 이번 diff는 에러 메시지 문자열 치환과 예외 분류(코드) 로직에 한정되며, SQL/커맨드/LDAP 인젝션 표면, 하드코딩된 자격증명, 인증 가드, 해시/암호화 알고리즘 어느 것도 변경하지 않는다. `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`(SSRF 방어 핵심 로직)는 이번 diff의 변경 대상이 아니며 그대로 유지된다. 새로 도입된 `Logger` 인스턴스(L25)는 상태 없는 로거 핸들로 그 자체가 공격 표면을 넓히지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `review/**` 산출물 파일(RESOLUTION.md, SUMMARY.md, 이전 리뷰 md, `_retry_state.json`, `meta.json`) — 보안 관점 해당 없음
  - 상세: 이 파일들은 리뷰 프로세스 산출물(문서)이며 실행 코드가 아니다. 시크릿·인증정보·민감정보 포함 여부를 확인했으나 해당 없음(로그/에러 메시지 내용에 대한 *논의*만 있을 뿐 실제 값 노출 없음).
  - 제안: 조치 불필요.

## 요약

이번 diff 는 직전 ai-review 사이클(`13_32_17`)에서 발견된 보안 WARNING — SSRF 차단 시 preflight `logUsage` 가 원본 hostname/IP 를 `error.message` 에 실어 `integration_usage_log` 테이블에 저장하고, 이것이 `GET /integrations/:id/activity` 를 통해 workspace 사용자(viewer 포함)에게 노출되어 CWE-209 완화 목적을 부분 무력화하던 문제 — 를 정확히 해소한다. preflight·redirect-hop 두 SSRF 차단 경로 모두 `logUsage` 에는 `SSRF_BLOCKED_CLIENT_MESSAGE` 일반화 문구만 기록하고, 원본 상세는 `logger.warn` 서버 로그에만 남도록 실제 소스에서 확인했다. 함께 지적됐던 테스트 커버리지 갭(redirect-hop `logUsage` 미검증, `logger.warn` 원본 보존 미검증, 5-hop 초과 경로 미검증) 세 가지도 신규 테스트로 해소됐다. `output.error.details.url` 은 검증 통과 URL만 담아 redirect 차단 대상이 별도 경로로 새지 않음도 재확인했다. 남은 것은 `spec/**` 문서 문구(Usage 로그에 원본이 남는다는 서술)의 정정 필요성뿐이며, 이는 documentation/requirement 리뷰 트랙의 몫으로 실제 보안 취약점이 아니다. 인젝션·하드코딩 시크릿·인증/인가·암호화·에러 메시지 민감정보 노출 관점에서 신규 발견된 Critical/Warning 은 없다.

## 위험도

NONE
