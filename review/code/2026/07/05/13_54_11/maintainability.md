# 유지보수성(Maintainability) Review

리뷰 대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
(나머지 diff 파일 — `review/code/2026/07/05/13_32_17/**`, `review/consistency/2026/07/05/12_55_17/**`,
`spec/**` — 는 이전 ai-review 세션 산출물·문서이며 유지보수성 코드 리뷰 범위 밖으로 판단하여 제외)

본 diff 는 직전 세션(`review/code/2026/07/05/13_32_17`)의 RESOLUTION 후속으로, redirect 관련
SSRF 차단 경로(redirect-limit 초과, redirect-hop 재검증)를 `HTTP_BLOCKED` + 일반화
메시지로 정합화하고, 바깥 catch 에 `IntegrationError` 승격 분기를 추가한 것이다. 직전
세션의 maintainability 리뷰(LOW)에서 이미 지적된 패턴(로그 후 일반화 예외 반복, 로그
태그 불일치)이 이번 diff 로 그대로 반영/확장되었는지 관점에서 점검했다.

### 발견사항

- **[INFO]** "로그 후 일반화 예외로 승격" 패턴이 이제 3곳(+승격 소비 지점 1곳)으로 확장, 여전히 헬퍼 미추출
  - 위치: `http-request.handler.ts` L362-397(preflight), L438-446(redirect-limit), L452-462(redirect-hop 재검증), L537-556(outer catch 의 `IntegrationError` 소비)
  - 상세: 직전 세션에서 이미 지적된 "detail 추출 → logger.warn → HTTP_BLOCKED 로 승격" 뼈대가 이번 diff 로 redirect-limit 케이스(L438-446, detail 없이 고정 문자열)까지 3회 반복 확정됐고, 승격된 예외를 다시 풀어 `logUsage` + `buildPreflightErrorOutput` 으로 변환하는 로직(L537-556)이 outer catch 에 추가되어 사실상 "SSRF 차단 처리"가 4개 지점에 걸쳐 있다. 각 지점의 역할이 다르므로(면 검증 vs 예외 변환 vs 최종 소비) 완전한 통합은 어렵지만, 최소한 "log + throw IntegrationError(HTTP_BLOCKED, SSRF_BLOCKED_CLIENT_MESSAGE)" 부분(L438-446, L455-461)은 `logger.warn(tag); throw new IntegrationError(...)` 2줄이 그대로 중복된다.
  - 제안: CRITICAL/WARNING 대상은 아니나, 소형 헬퍼(예: `throwHttpBlocked(tag: string, detail?: string): never`)로 뽑으면 향후 SSRF 차단 지점 추가 시 drift(메시지 상수 갱신 누락 등)를 방지할 수 있다. 직전 리뷰에서 이미 제안된 사항이 이번에도 반영되지 않은 채 지점만 늘어난 점은 인지 필요.

- **[INFO]** `logger.warn` 태그 문자열이 3곳에서 여전히 하드코딩·불일치
  - 위치: L367 `` `SSRF block (http-request): ${detail}` ``(preflight), L440-441 `'SSRF block (http-request): redirect chain exceeded 5 hops'`(redirect-limit, preflight 와 동일 접두어), L457 `` `SSRF block (http-request redirect): ${detail}` ``(redirect-hop, 다른 접두어)
  - 상세: redirect-limit 초과 로그(L440-441)는 preflight 케이스와 동일한 `SSRF block (http-request)` 접두어를 쓰고 있어, 실제로는 redirect 홉 재검증 실패(L457, `... redirect)` 접두어)와도 다른 별개의 원인(홉 수 초과 vs 대상 host 차단)임에도 preflight 와 로그상 구분이 안 된다. 직전 세션 maintainability 리뷰에서 이미 지적된 사항이 이번 diff 에서도 그대로 남아 있다(수정되지 않음).
  - 제안: redirect-limit 케이스는 `SSRF block (http-request redirect-limit)` 등 별도 접두어로 분리해 서버 로그만으로 세 가지 차단 원인(preflight/redirect-limit/redirect-hop)을 구분 가능하게 하는 것을 권장.

- **[INFO]** outer catch 의 `IntegrationError` 분기 추가로 해당 catch 블록의 분기 복잡도 소폭 증가
  - 위치: L532-570 (`catch (err: unknown)` 블록, `if (err instanceof IntegrationError) { ... return ...; }` 이후 fallthrough 로 기존 `HTTP_TRANSPORT_FAILED` 처리 유지)
  - 상세: 기존에 단일 경로였던 catch 블록이 이제 "IntegrationError(SSRF 승격) vs 그 외 transport 오류" 2-way 분기가 됐다. early-return 스타일(`if (...) { ...; return ...; }`)로 작성돼 있어 중첩은 늘지 않고 각 분기 책임도 명확히 분리돼 있다(주석 L535-536 도 왜 이 분기가 필요한지 설명). 순환 복잡도는 소폭 증가했으나 가독성 저하는 경미하다.
  - 제안: 조치 불필요. 다만 향후 이 catch 블록에 세 번째 이상의 특수 케이스가 추가된다면 switch/전략 패턴 등으로 리팩터링을 고려할 시점이다.

- **[INFO]** L363-365 주석("원본 상세는 서버 로그·usage 로그에만 남기고")이 실제 동작(usage 로그도 일반화)과 여전히 어긋남 — 직전 documentation 리뷰 WARNING 이 코드 주석 자체는 다루지 않아 잔존
  - 위치: `http-request.handler.ts` L363-365
  - 상세: 직전 세션 documentation 리뷰(`review/code/2026/07/05/13_32_17/documentation.md`)가 지적한 것은 `SSRF_BLOCKED_CLIENT_MESSAGE` 선언부 JSDoc(파일 상단)과 spec 문구였다. 그러나 preflight catch 블록 진입부의 인라인 주석(L363-365, "원본 상세(차단된 hostname/IP)는 서버 로그·usage 로그에만 남기고")도 동일한 stale 서술을 담고 있고, 정작 몇 줄 아래(L376-378)의 정확한 주석("usage 로그 message 도 일반화한다")과 한 블록 안에서 모순된다. 유지보수 관점에서 한 함수 내에 서로 모순되는 주석 두 개가 공존하면 다음 수정자가 어느 쪽을 신뢰해야 할지 혼란을 줄 수 있다.
  - 제안: L363-365 주석도 L376-378 과 동일하게 "원본은 logger.warn(서버 로그)에만, usage 로그(Activity API 노출)는 클라이언트와 동일하게 일반화" 로 정정 — documentation 리뷰가 다루는 JSDoc/spec 정정과 함께 처리하면 일관성 있게 해소 가능.

- **[INFO]** `SSRF_BLOCKED_CLIENT_MESSAGE` 상수 재사용은 4개 소비 지점(preflight/redirect-limit/redirect-hop/usage 로그) 모두에서 일관 — 매직 스트링 없음
  - 위치: L36, 소비처 L380, L389, L445, L460
  - 상세: 이번 diff 로 소비 지점이 하나(redirect-limit) 더 늘었지만 모두 동일 상수를 참조해 문자열 drift 위험이 없다. 신규 테스트(`http-request.handler.spec.ts` L1064-1171)도 하드코딩 리터럴 `'Request blocked by SSRF policy.'` 을 직접 비교해 상수 값 변경 시 테스트가 즉시 깨지도록 되어 있어 회귀 방지에 유효하다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 두 건(redirect-to-internal-host, redirect-limit-exceeded)은 기존 스타일과 일관되고 이름·주석이 의도를 명확히 드러냄
  - 위치: `http-request.handler.spec.ts` L88-171(신규 `it` 2건)
  - 상세: 기존 `makeService`/`contextWithWorkspace`/`global.fetch` mock 패턴을 그대로 재사용했고, `Logger.prototype.warn` spy 로 "원본은 서버 로그에만 남는다"는 계약을 직접 검증한다(L91-93, L126-128). 각 테스트가 정확히 하나의 시나리오(redirect 대상 SSRF 차단, redirect 홉 초과)만 다뤄 단일 책임을 지키고 있다.
  - 제안: 조치 불필요.

### 요약

이번 diff 는 직전 세션에서 이미 LOW 등급으로 평가된 SSRF 메시지 일반화 작업의 자연스러운 확장(redirect 경로 정합화)이며, 코드 구조·네이밍·상수화 패턴은 기존 것을 그대로 따르고 있어 새로운 심각한 유지보수성 문제를 도입하지 않는다. 다만 (1) "로그 후 일반화 예외로 승격" 반복 패턴과 (2) 로그 태그 접두어 불일치는 직전 리뷰에서 이미 지적됐음에도 이번 diff 에서 지점만 늘어난 채 반영되지 않았고, (3) preflight catch 진입부의 인라인 주석이 같은 블록 내 다른 주석과 모순되는 stale 서술을 담고 있어 문서-코드 정합성 관점에서 소소하지만 누적되는 개선 여지가 있다. 함수 길이·중첩 깊이·복잡도는 outer catch 의 2-way 분기 추가로 소폭 늘었으나 early-return 스타일 덕에 가독성 저하는 경미하다.

### 위험도
LOW
