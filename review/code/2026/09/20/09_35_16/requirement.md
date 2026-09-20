# 요구사항(Requirement) 충족 검토 — SSRF 가드 소비자 넷의 catch를 `instanceof SsrfBlockedError`로

## 검토 범위

`plan/in-progress/ssrf-catch-instanceof.md`가 선언한 목표(가드가 던지는 것이 **판정**(`SsrfBlockedError`)인지 **가드 자체의 고장**(그 밖의 오류)인지를 네 호출부 + 동반 1건에서 갈라, 판정이 아니면 각 호출부의 "분류되지 않은 실패" 경로로 보내기)가 실제 구현에 그대로 반영됐는지를 코드 레벨로 검증했다. 대상: `database-connection-tester.ts`/`.spec.ts`, `http-connection-tester.ts`/`.spec.ts`, `database-query.handler.ts`/`.spec.ts`, `http-redirect.ts`/`.spec.ts`(신규), `http-request.handler.ts`/`.spec.ts`. 트렁케이트된 4개 파일(`database-query.handler.{ts,spec.ts}`, `http-request.handler.{ts,spec.ts}`)은 `Read`로 원본을 직접 열어 확인했다.

## 발견사항

- **[INFO]** `http-connection-tester.ts`에서 preflight를 `try` 안으로 옮기면서 `AbortSignal.timeout(HTTP_TEST_TIMEOUT_MS)` 생성 시점보다 이전이 아니라 이후에 preflight(SSRF 리터럴 검사 + DNS 조회)가 실행되도록 순서가 바뀌었다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts` — 함수 `testHttpConnection`, 게이트 122~128행(`init` 객체의 `signal: AbortSignal.timeout(...)` 생성 뒤 `try` 블록 안 `const preflight = await outboundBlockReason(url);`)
  - 상세: 변경 전에는 `outboundBlockReason`이 `init`(과 그 안의 `AbortSignal.timeout`) 생성보다 **먼저** 호출됐다 — 즉 preflight에 걸리는 시간(주로 `assertSafeOutboundHostResolved`의 `dns.lookup`, 상한 없음)은 10초 타임아웃 예산에 들어가지 않았고, `fetch`는 preflight 종료 후 새로 10초를 받았다. 변경 후에는 타임아웃 시그널이 먼저 만들어지고 그 다음 preflight가 실행되므로, preflight가 오래 걸리면 그만큼 `fetch`에 남는 시간이 줄어들고 극단적으로는 preflight 도중 이미 시그널이 발화해 `fetch`가 즉시 abort(→ `HTTP_CONNECT_FAILED`, "timed out")로 귀결될 수 있다. plan은 "동반 1건" 항목에서 "판정 경로의 동작은 그대로: `blocked(reason)` 반환"이라고만 명시했고, 이 타임아웃 예산 변화는 언급·테스트되지 않았다. 결과적으로 전체 지연 시간이 무한대에서 10초로 **줄어드는(더 엄격해지는)** 방향이라 회귀라기보다는 부수적 개선에 가깝지만, 느린 DNS 환경에서 이전엔 통과하던 연결 테스트가 이제 timeout으로 실패할 수 있는 관측 가능한 동작 변화다.
  - 제안: 의도된 부수효과라면 plan/JSDoc에 "preflight 포함 전체 10초"로 명시하고, 아니라면 preflight 전용 타임아웃을 분리하거나 `fetch`용 시그널을 preflight 통과 후 생성하도록 되돌릴 것. 블로킹 사안은 아님.

- **[INFO]** `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query}.md`의 에러 코드 표가 "SSRF 가드가 판정 아닌 오류를 던진 경우 → `INTEGRATION_CALL_FAILED`"라는 새 트리거 사례를 예시로 열거하지 않음
  - 위치: `spec/4-nodes/4-integration/0-common.md` §4.2 표(`INTEGRATION_CALL_FAILED` 행), `spec/4-nodes/4-integration/1-http-request.md` §4.2 Usage 로깅 매트릭스, `spec/4-nodes/4-integration/2-database-query.md` §6.2 표
  - 상세: `0-common.md` §4.2는 `INTEGRATION_CALL_FAILED`를 "기타 일반 예외(분류되지 않은 실패). `IntegrationError`가 아닌 throw의 기본 코드"로 이미 일반적으로 정의하고 있고, 이번 구현(가드가 `SsrfBlockedError`가 아닌 오류를 던지면 `IntegrationError('INTEGRATION_CALL_FAILED', …)`로 승격)은 그 일반 정의를 그대로 만족한다 — 모순이 아니다. 다만 개별 문서의 예시 표는 이 트리거 사례를 아직 나열하지 않아 완전성 갭이 있다. 이는 코드가 틀린 것이 아니라 spec의 예시 목록이 아직 새 트리거를 반영하지 않은 것이므로, spec 오류나 spec-drift(코드가 spec을 앞서가며 명시 규약을 어긴 경우)로 보기 어렵고 그레이존(INFO)에 해당한다. 이미 `review/consistency/2026/09/20/09_06_34/cross_spec.md`·`SUMMARY.md`가 같은 항목을 INFO로 기록해 두었다(중복 확인).
  - 제안: `--impl-done` 이후 project-planner 턴에서 두 표에 한 줄 추가하는 것을 권장(코드 fix 아님, spec 보강).

- **[INFO]** `1-http-request.md` frontmatter `code:` 증거 목록에 이번 변경이 직접 수정하는 `http-redirect.ts`가 여전히 누락돼 있음(기존 갭, 이번 PR이 새로 만든 것은 아님)
  - 위치: `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:`
  - 상세: `--impl-prep` consistency-check(`review/consistency/2026/09/20/09_06_34/convention_compliance.md`)가 이미 WARNING으로 기록했고, `spec/` 쓰기는 developer 권한 밖(자기-반증형 소정정 5조건 미충족 — 예고 문장의 정정이 아니라 증거 목록 누락)이라는 판단도 이미 적혀 있다. 본 리뷰는 이 판단에 동의하며 재-flag만 한다.
  - 제안: project-planner 턴에서 `code:`에 `http-redirect.ts` 추가.

## 검증한 항목 (문제 없음 확인)

- **판정/비판정 분기 네 곳 + 동반 1건 전부 구현됨**: `database-connection-tester.ts`(결과 `DB_CONNECT_FAILED` + `clampMessage`, 던지지 않음), `http-connection-tester.ts`(결과 `HTTP_CONNECT_FAILED` + `clampMessage(describeFailure(err))`, 던지지 않음), `database-query.handler.ts`(`IntegrationError('INTEGRATION_CALL_FAILED', …)`로 승격 후 바깥 catch가 `err instanceof IntegrationError` 분기로 code 보존), `http-request.handler.ts`(`buildPreflightErrorOutput`가 non-`IntegrationError`에 `INTEGRATION_CALL_FAILED` fallback을 이미 갖고 있어 그대로 재사용), `http-redirect.ts`의 `outboundBlockReason`(판정만 사유 문자열로 변환, 그 외는 그대로 rethrow) 전부 plan의 "호출부마다 정한 기대 동작" 표와 line-level로 일치.
- **`SsrfBlockedError` 클래스 정의**(`http-safety.ts`)가 차단 판정 하나만을 표현하고, 네 호출부 모두 메시지 접두어(`SSRF_BLOCKED:`) 문자열 매칭이 아니라 `instanceof`로 분기 — plan이 지적한 취약점(가드가 판정 아닌 실패를 던지는 순간 오분류)이 실제로 해소됨.
- **usage 로그 코드 일치**: `database-query.handler.ts`의 승격 경로가 `logUsage`(`toLogError` 경유)와 `output.error.code`를 모두 `INTEGRATION_CALL_FAILED`로 일치시킴(승격 없이 그냥 던졌다면 `mapDbError`가 `DB_QUERY_FAILED`로 오분류했을 것). `http-request.handler.ts`도 동일 코드로 `logUsage`와 `output.error.code`가 일치.
- **cause 미부착 근거**(`database-query.handler.ts` 주석)가 `spec/5-system/3-error-handling.md` §6.3.1 C2(가드가 앞으로 어떤 속성을 던질지 모름 — Activity API로 나가는 노드 에러)를 정확히 인용하고 실제로 `cause`를 붙이지 않음 — 근거와 구현이 일치.
- **테스트 판별력**: 5개 신규/변경 테스트(각 호출부 1개 + `http-redirect.spec.ts` 신설 3개) 모두 `jest.requireActual`로 `SsrfBlockedError` 실물을 보존하면서 가드 함수만 mock — 클래스를 가리는 실수(판정 자체가 무력화되는 흔한 실수)가 없음을 직접 확인. `database-query.handler.spec.ts`/`http-request.handler.spec.ts`는 `jest.fn(actual.xxx)`로 실물 가드를 감싸 판정 경로 기존 테스트가 그대로 실물로 동작하고, 비판정 케이스만 `mockRejectedValueOnce`/`mockImplementationOnce`로 국소 오버라이드 — 테스트 격리가 올바름.
- **TODO/FIXME/HACK/XXX**: 10개 대상 파일 전체에서 미완성 표시 주석 없음(grep 확인).
- **엣지 케이스**: `creds.host`가 falsy(빈 문자열 등)면 SSRF 가드 자체를 안 타는 기존 분기는 이번 변경으로 건드리지 않음. `err instanceof Error`가 아닌 원시값(문자열 throw 등)을 가드가 던지는 경우도 `String(err)`로 안전하게 처리되어 크래시하지 않음.

## 요약

plan이 명시한 "판정만 차단으로, 판정이 아니면 호출부의 기존 분류되지 않은 실패 경로로"라는 목표가 네 호출부(`http-request.handler.ts`, `http-redirect.ts`, `database-query.handler.ts`, `database-connection-tester.ts`) + 동반 1건(`http-connection-tester.ts`)에 정확히 line-level로 구현됐고, 각 파일의 신규 테스트가 뮤턴트(분기 삭제 시 RED)로 판별력을 확인했다는 plan 체크리스트 서술과 실제 코드가 일치한다. spec(`0-common.md` §4.2, `2-database-query.md` §4/§6.2, `spec/2-navigation/4-integration.md` §5.3/§5.4)과의 line-level 대조에서도 모순은 발견되지 않았다 — `INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`로의 fallback은 각 문서가 이미 정의한 "기타/그 밖" 일반 규정의 사각지대를 메우는 것이지 그 규정을 어기는 것이 아니다. CRITICAL/WARNING 급 결함은 발견되지 않았으며, 남은 항목은 (1) `http-connection-tester.ts`의 preflight 재배치가 낳은 타임아웃 예산의 미세한 의미 변화(문서화·테스트 안 됨, 그러나 방향은 개선), (2) spec 예시 표의 완전성 갭 2건(이미 consistency-check가 INFO로 기록) 뿐이다.

## 위험도

LOW
