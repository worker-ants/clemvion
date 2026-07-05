# 유지보수성(Maintainability) Review

리뷰 대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
(나머지 diff 파일은 `review/consistency/**` 산출물·`spec/**` 문서로 유지보수성 코드 리뷰 범위 밖)

### 발견사항

- **[INFO]** SSRF 차단 시 "로그 후 일반화 예외 throw" 패턴이 3곳에서 유사 반복
  - 위치: `http-request.handler.ts` L357-393(preflight), L433-441(redirect 한도 초과), L447-457(redirect hop 재검증)
  - 상세: 세 지점 모두 `detail = err instanceof Error ? err.message : String(err)` 추출(또는 고정 문자열) → `logger.warn(...)` → `IntegrationError(ErrorCode.HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)` throw/return 의 동일 뼈대를 반복한다. preflight 는 `buildPreflightErrorOutput` 을 직접 호출해 반환하고, redirect 두 곳은 throw 해서 바깥 catch(L532)의 `IntegrationError` 분기로 승격시키는 방식이라 완전히 통일하긴 어렵지만, "SSRF 예외를 감지해 로그 남기고 일반화 client 메시지로 승격"하는 로직 자체는 헬퍼(`logAndBuildSsrfBlockedError(context, detail, tag)` 형태)로 뽑아낼 여지가 있다.
  - 제안: 현재 규모(3회, 각 2~5줄)에서는 강행 추출이 과설계일 수 있어 CRITICAL/WARNING 은 아니나, 향후 SSRF 차단 지점이 늘어나면(예: body 내 URL 재검증 등) 중복이 커지므로 소형 헬퍼 함수로 추출하는 것을 고려할 만하다.

- **[INFO]** `logger.warn` 태그 문자열이 하드코딩되어 두 곳에서 미묘하게 다름
  - 위치: L365 `` `SSRF block (http-request): ${detail}` ``, L452 `` `SSRF block (http-request redirect): ${detail}` ``, L436 `'SSRF block (http-request): redirect chain exceeded 5 hops'`(태그는 preflight 와 동일한데 실제로는 redirect 한도 초과 로그)
  - 상세: L436 은 문맥상 "redirect 한도 초과"인데 로그 접두어가 `SSRF block (http-request)` 로 preflight 케이스(L365)와 동일하다 (redirect 케이스는 `SSRF block (http-request redirect)` 접두어를 쓰는 L452 와 불일치). 로그만으로 어느 차단 경로였는지 구분하기 어려워질 수 있다(사소하지만 디버깅 시 혼선 가능).
  - 제안: L436 의 로그 접두어를 `SSRF block (http-request redirect-limit)` 등으로 통일하거나, 세 경로 공통으로 컨텍스트 태그를 인자로 받는 작은 로깅 헬퍼를 만들어 문자열 중복·drift 를 방지.

- **[INFO]** `SSRF_BLOCKED_CLIENT_MESSAGE` 상수화와 JSDoc 설명은 가독성에 긍정적
  - 위치: L28-34 (`http-request.handler.ts`)
  - 상세: 왜 메시지를 일반화하는지(CWE-209, DB/Email 대칭), 원본이 어디로 가는지(logger.warn + usage 로그)를 주석에 명확히 남겨 의도가 잘 드러난다. 매직 스트링을 상수로 뽑아 3개 호출부에서 재사용하는 것도 중복 억제에 도움이 된다. 좋은 패턴으로 유지 권장.

- **[INFO]** redirect-hop 검증 블록의 중첩 depth 소폭 증가
  - 위치: L424-461 (`while` 루프 내부에 `try/catch` 추가)
  - 상세: 기존에는 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved` 를 루프 본문에서 바로 호출했으나, 이번 변경으로 `while → try/catch` 1단 중첩이 늘었다. 전체 함수가 이미 길고(대략 250줄대) `try(outer) → while → try(inner)` 형태라 중첩이 깊어 보일 수 있으나, 각 블록의 책임이 명확히 분리돼 있어(재검증 vs 예외 변환) 실질적으로 읽기 어려운 수준은 아니다. CRITICAL/WARNING 대상은 아님.

- **[INFO]** `execute` 함수 자체의 길이/책임 범위는 기존부터 큰 편이나 이번 diff 로 인한 신규 악화는 미미
  - 위치: `http-request.handler.ts` 전체 `execute` 메서드(대략 L300-580)
  - 상세: 이번 변경은 기존 함수에 SSRF 에러 처리 분기(로그 + 메시지 일반화 + IntegrationError 승격 캐치)를 추가하는 수준이라 함수 길이가 소폭 늘었을 뿐, 새로운 책임(관심사)을 추가한 것은 아니다(기존에도 SSRF/redirect/usage-log 책임이 혼재). 리팩터링은 이번 diff 스코프 밖으로 판단.

- **[INFO]** 테스트 파일 신규 케이스는 기존 스타일과 일관
  - 위치: `http-request.handler.spec.ts` L1061-1097 (redirect-to-internal-host 신규 `it` 블록)
  - 상세: 기존 mock 패턴(`makeService`, `contextWithWorkspace`, `global.fetch` mock)을 그대로 재사용했고, 테스트 이름·주석이 무엇을 검증하는지 명확하다(`generalized message`, `not.toContain('169.254')`). 기존 `toMatch(/SSRF_BLOCKED/)` → `toBe('Request blocked by SSRF policy.')` 치환도 일관되게 4곳 모두 동일 패턴으로 적용됨.

### 요약

이번 변경은 SSRF 차단 시 클라이언트에 노출되는 에러 메시지를 일반화하고(DB/Email 노드와 대칭), redirect 관련 SSRF 차단 오분류를 바로잡는 좁은 스코프의 보안 정합화 작업이다. `SSRF_BLOCKED_CLIENT_MESSAGE` 상수화, 상세한 근거 주석, 기존 로깅/에러 처리 패턴과의 일관성 등 유지보수성 측면에서 전반적으로 양호하다. 세 SSRF 차단 지점(preflight/redirect-hop/redirect-limit)에서 "로그 후 일반화 예외" 로직이 유사하게 반복되고 로그 태그 문자열 하나(L436)가 다른 지점과 접두어가 미묘하게 어긋나는 점은 있으나, 현재 규모에서는 리팩터링을 강제할 만큼 심각하지 않다. 함수 길이·중첩 깊이는 기존 코드베이스 대비 눈에 띄게 악화되지 않았다.

### 위험도
LOW
