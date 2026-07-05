# 부작용(Side Effect) Review — SSRF 에러 메시지 일반화 (HTTP Request, 재검토)

## 리뷰 대상

- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
- (참고, 리뷰 산출물/문서 신규 파일 — 코드 부작용과 무관) `review/code/2026/07/05/13_32_17/**`,
  `review/consistency/2026/07/05/12_55_17/**`, `spec/2-navigation/4-integration.md`,
  `spec/4-nodes/4-integration/{1-http-request,2-database-query}.md`,
  `spec/5-system/2-api-convention.md`

본 세션(13_54_11)의 diff는 이전 side-effect 리뷰(`review/code/2026/07/05/13_32_17/side_effect.md`)가 대상으로 삼았던 것과 **동일한 두 소스 파일**(핸들러 + 스펙)에 대한 것이며, `git log`로 확인한 결과 커밋 `ea09f1d7f`(최초 fix) 위에 `d12ef7594`(ai-review WARNING#1 remediation: usage 로그 message 일반화 + redirect 커버리지 테스트 보강)가 얹힌 누적 상태다. 즉 이전 리뷰에서 지적된 항목 중 실제로 코드가 바뀐 부분(usage 로그 message)과, 코드는 그대로이고 테스트만 보강된 부분(redirect-hop logUsage 일반화 단언, `logger.warn` 원본 보존 단언, hop5 초과 테스트)이 섞여 있다. 아래 발견사항은 그 누적 diff 전체를 대상으로 재검증한 결과다.

## 발견사항

- **[INFO] 모듈 스코프 `Logger` 인스턴스 신규 도입 — 부작용 없음, 기존 컨벤션과 일치**
  - 위치: `http-request.handler.ts:25` `const logger = new Logger('HttpRequestHandler');`
  - 상세: 새 모듈 레벨 `Logger` 인스턴스가 추가되지만 `@nestjs/common`의 `Logger`는 상태를 갖지 않는 wrapper이고 동일 패턴이 인접 핸들러(`integration-handler-base.ts` 등)에서도 쓰인다. 전역 mutable 상태 도입이 아니다.
  - 제안: 조치 불필요.

- **[INFO] `SSRF_BLOCKED_CLIENT_MESSAGE` — 새 전역 변수·환경 변수 읽기/쓰기 없음**
  - 위치: `http-request.handler.ts:36`
  - 상세: 모듈 스코프 `const` 문자열 상수이며 mutable 전역 상태가 아니다. `process.env` 읽기/쓰기는 이번 diff에 없다(`ALLOW_PRIVATE_HOST_TARGETS`는 `http-safety.ts` 내부에 있으며 변경 범위 밖).
  - 제안: 조치 불필요.

- **[WARNING] Redirect-hop SSRF 차단 경로의 `output.error.code` 값이 `HTTP_TRANSPORT_FAILED` → `HTTP_BLOCKED`로 재분류 — 호출자 관측 가능한 반환값 의미 변경(breaking)**
  - 위치: `http-request.handler.ts:432-465`(redirect follow 루프의 신규 `try/catch`), `537-556`(바깥 catch의 `err instanceof IntegrationError` 신규 분기)
  - 상세: 종전에는 redirect hop의 SSRF 예외(raw `Error`, 예: `'SSRF_BLOCKED: redirect chain exceeded 5 hops'`)가 바깥의 단일 `catch (err: unknown)`으로 흘러 `code: 'HTTP_TRANSPORT_FAILED'`로 분류됐다. 이번 변경은 redirect loop 안에 별도 `try/catch`를 추가해 그 자리에서 `IntegrationError(HTTP_BLOCKED, ...)`로 승격하고, 바깥 catch도 `err instanceof IntegrationError` 분기를 신설해 `HTTP_TRANSPORT_FAILED`로 오분류되지 않도록 우회한다. 의도된 spec §4.2/§6 정합화이지만, **동일 조건(redirect 중 사설망 차단)에 대해 `output.error.code` 값이 과거와 달라진다**. 이 코드 값으로 분기하는 기존 워크플로우(예: `HTTP_TRANSPORT_FAILED`를 재시도 트리거로 쓰는 케이스)가 있다면 동작이 바뀐다. `spec/4-nodes/4-integration/1-http-request.md` §8.3에 "⚠️ 운영 영향(breaking)"으로 이미 명시돼 있어 문서화 자체는 되어 있다.
  - 제안: 이미 spec Rationale에 breaking 영향이 명시돼 있으므로 추가 조치는 필수는 아니나, PR 설명/체인지로그에도 "redirect 경유 SSRF 차단의 `output.error.code`가 `HTTP_TRANSPORT_FAILED`에서 `HTTP_BLOCKED`로 바뀐다"는 사실을 명확히 남길 것을 권장.

- **[INFO] (13_32_17 WARNING#2 — 이번 diff로 해소됨) usage 로그(`logUsage`) message가 이제 전 경로(preflight/redirect-hop/redirect-limit)에서 일관되게 일반화됨**
  - 위치: `http-request.handler.ts:376-382`(preflight `logUsage`), `537-546`(바깥 catch `IntegrationError` 분기의 `logUsage`, `message: err.message` — `err`가 이미 `SSRF_BLOCKED_CLIENT_MESSAGE`로 생성된 `IntegrationError`이므로 실질적으로 일반화 문구)
  - 상세: 이전 세션(13_32_17)의 side_effect 리뷰는 "spec 문구(Usage 로그에도 원본이 남는다)와 실제 코드(일반화만 기록)가 어긋난다"를 WARNING으로 지적했었다. `RESOLUTION.md`에 따르면 이 갭은 (a) preflight `logUsage` 자체는 이전부터 이미 일반화였고, (b) **redirect-hop 경로에 신설된 바깥 catch의 `IntegrationError` 분기가 `err.message`(=`SSRF_BLOCKED_CLIENT_MESSAGE`)를 그대로 `logUsage`에 전달**하도록 완결되면서, preflight·redirect-hop·redirect-limit 세 경로 모두 usage 로그 message가 일반화 문구로 통일됐다. `RESOLUTION.md`가 명시하듯 spec 문서 세 곳(§8.3·§6 에러표·핸들러 JSDoc)도 함께 정정되어 "Usage 로그도 일반화"로 서술이 코드와 일치하게 됐다. side effect 관점에서는 **정보 노출 축소 방향의 의도된 동작 통일**이며 회귀 아님.
  - 제안: 조치 불필요 — 재확인 목적의 기록.

- **[INFO] `authentication !== 'integration'` 경로(`none`/`custom`)는 SSRF 차단 시 `logUsage` 호출 자체가 없음 — 기존 동작 유지, 회귀 아님**
  - 위치: `http-request.handler.ts:370-384`
  - 상세: `if (authentication === 'integration' && integrationId)` 가드는 이번 diff가 신설한 게 아니라 기존 로직(spec §4.2)이다. 부작용 없음.
  - 제안: 조치 불필요.

- **[INFO] `IntegrationError`가 이제 redirect 루프 내부에서 throw되어 바깥 `try` 블록을 통해 흐름 — 제어 흐름 재구성이나 리소스 해제 누락 없음**
  - 위치: `http-request.handler.ts:432-465`, `532-556`
  - 상세: nested `try/catch`가 추가되어 예외를 잡아 `IntegrationError`로 재포장 후 다시 throw한다. 바깥 catch(533행)에서 `clearTimeout(timeoutId)`가 모든 경로(성공/`IntegrationError`/기타 Error)에서 여전히 최우선 호출됨을 확인 — 타이머 누수·리소스 해제 누락 없음. `AbortController`/upstream abort listener 정리 로직도 이번 diff로 변경되지 않았다.
  - 제안: 조치 불필요.

- **[NONE] 함수 시그니처/공개 API 변경 없음**
  - 상세: `HttpRequestHandler.execute()`/`validate()` 등 공개 메서드 시그니처 불변. `NodeHandlerOutput`(`config/output/meta/port`) 필드 구조도 그대로. 변경은 `output.error.message`의 문자열 값과 (redirect 한정) `output.error.code`의 값뿐이며 이는 함수 시그니처 변경이 아니라 런타임 반환 콘텐츠 변경이다(위 WARNING 항목에서 다룸).

- **[NONE] 네트워크 호출 패턴 변경 없음**
  - 상세: `fetch` 호출 횟수·redirect 추적(최대 5홉) 로직 자체는 그대로다. 변경은 SSRF 차단 시의 예외 분류·메시지 내용에 한정되며 실제 아웃바운드 요청 여부/횟수는 달라지지 않는다.

- **[NONE] 테스트 파일 — 신규 `Logger.prototype.warn` spy 는 격리되어 있고 전역 오염 없음**
  - 위치: `http-request.handler.spec.ts` (신규 `blocks redirect to internal host...` 테스트)
  - 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation(...)`은 해당 `it` 블록 안에서 생성되고 블록 끝에서 `warnSpy.mockRestore()`로 명시적으로 복원된다. `Logger.prototype`은 클래스 전체가 공유하는 프로토타입이므로 스파이가 복원되지 않으면 이후 테스트에 잔류할 수 있는 구조이나, 이번 테스트는 `mockRestore()`를 빠뜨리지 않았다. 다만 이 복원이 `try/finally`가 아니라 단순 코드 순서에 의존하므로, 만약 `warnSpy` 설정 이후 assertion에서 예외가 던져지면(예: `expect` 실패) `mockRestore()`가 스킵되어 spy가 다음 테스트로 누수될 위험이 이론적으로 있다. Jest는 테스트 실패 시 즉시 다음 `it`으로 넘어가므로 실제로는 해당 테스트가 실패하는 경우에 한해 영향이 국한되고(그 자체가 실패로 드러남), CI에서 통과 상태라면 부작용 없음.
  - 제안: 엄격히 하려면 `afterEach`에서 `jest.restoreAllMocks()`(파일에 이미 있는지 확인 필요) 또는 이 블록을 `try { ... } finally { warnSpy.mockRestore(); }`로 감싸는 것을 고려할 수 있으나, 현재 리스크는 낮아 CRITICAL/WARNING 대상은 아니다.

- **[NONE] `global.fetch` mock 대입 — 기존 스위트 공통 패턴, 신규 위험 없음**
  - 위치: `http-request.handler.spec.ts` 신규 두 테스트(`blocks redirect to internal host...`, `blocks redirect chain exceeding 5 hops...`)
  - 상세: `global.fetch = jest.fn()...`는 파일 전역 스코프의 `global.fetch`를 mutate하지만, 이는 기존 테스트 스위트 전반에서 이미 쓰이던 표준 패턴(다른 다수 테스트에서도 동일)이며 이번 diff가 새로 도입한 패턴이 아니다.
  - 제안: 조치 불필요.

- **[NONE] `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json` 등 review 산출물 신규 파일 — 코드 부작용과 무관**
  - 상세: `review/code/2026/07/05/13_32_17/**` 신규 파일은 이전 리뷰 세션의 산출물이며 런타임 코드에 영향 없음. 스코프상 side-effect reviewer 관점에서는 기록 대상 아님(scope/documentation reviewer 소관).

## 요약

이번 diff(누적: 최초 fix + WARNING remediation)는 HTTP Request 노드의 SSRF 차단 시 `output.error.message`를 host/IP 미노출 일반화 문구로 통일하고, redirect-hop SSRF 차단을 `HTTP_TRANSPORT_FAILED`가 아닌 `HTTP_BLOCKED`로 재분류하며, usage 로그(Activity API 노출 경로)의 message도 전 경로에서 일관되게 일반화하는 보안 강화 작업이다. 새 전역 mutable 상태·환경 변수·의도치 않은 파일시스템/네트워크 부작용은 없고, 공개 함수 시그니처도 변하지 않았다. 유일하게 실질적인 "관측 가능한 부작용"은 redirect 경유 SSRF 차단의 `output.error.code` 값이 `HTTP_TRANSPORT_FAILED`→`HTTP_BLOCKED`로 바뀌는 것으로, 이는 그 코드 값으로 분기하던 하류 워크플로우 입장에서 breaking change이나 spec §8.3에 이미 명시적으로 문서화되어 있다. 이전 세션(13_32_17) side-effect 리뷰가 지적했던 "usage 로그 message가 spec 문구와 달리 원본을 남기지 않는다"는 문서-코드 불일치 WARNING은 이번 remediation 커밋에서 코드(redirect 경로 logUsage 통일)와 문서(spec 3곳 정정) 양쪽이 함께 손질되어 해소된 것으로 확인된다. 신규 `Logger.prototype.warn` spy는 명시적으로 복원되어 테스트 격리 리스크는 낮다.

## 위험도

LOW
