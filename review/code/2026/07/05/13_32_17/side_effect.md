# 부작용(Side Effect) Review — SSRF 에러 메시지 일반화 (HTTP Request)

## 리뷰 대상

- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
- (참고, spec 문서 변경 — 코드 부작용과 무관) `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/{1-http-request,2-database-query}.md`, `spec/5-system/2-api-convention.md`
- (참고, 리뷰 산출물 신규 파일 — 부작용 관점 무관) `review/consistency/2026/07/05/12_55_17/**`

## 발견사항

- **[INFO] 모듈 스코프 `Logger` 인스턴스 신규 도입**
  - 위치: `http-request.handler.ts:25` `const logger = new Logger('HttpRequestHandler');`
  - 상세: 파일 최상단에 새 모듈 레벨 `Logger` 인스턴스가 추가된다. `@nestjs/common`의 `Logger`는 프로세스 전역 로그 버퍼/컨텍스트를 공유하지만 인스턴스 자체는 상태를 갖지 않는 단순 wrapper이고, 동일 패턴(`new Logger('ClassName')` 모듈 스코프 상수)이 `integration-handler-base.ts` 등 인접 파일에서도 이미 쓰이고 있어 컨벤션과 일치한다. 전역 변수라기보다 로거 핸들일 뿐이며 실질적 부작용은 없다.
  - 제안: 조치 불필요. 다만 리뷰 관점 상 "새 모듈 스코프 상수 도입" 사실은 기록해 둔다.

- **[WARNING] Redirect-hop SSRF 차단 경로에 신규 `logger.warn` 호출 추가 — 로그 볼륨/부작용 관점에서는 무해하나, catch 흐름이 재구성되어 기존 `HTTP_TRANSPORT_FAILED` 분류를 소비하던 하류 로직에 영향**
  - 위치: `http-request.handler.ts:427-464`(redirect follow 루프의 신규 `try/catch`), `530-554`(바깥 catch 의 `err instanceof IntegrationError` 신규 분기)
  - 상세: 종전에는 redirect hop 의 SSRF 예외(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`가 던지는 raw `Error`)가 바깥의 단일 `catch (err: unknown)`으로 흘러 무조건 `code: 'HTTP_TRANSPORT_FAILED'`로 분류됐다. 이번 변경은 redirect loop 안에 별도 `try/catch`를 추가해 그 자리에서 `IntegrationError(HTTP_BLOCKED, ...)`로 승격하고, 바깥 catch 도 `err instanceof IntegrationError` 분기를 신설해 `HTTP_TRANSPORT_FAILED`로 오분류되지 않도록 우회시킨다. 이는 의도된 동작 변경(spec §4.2/§6 정합)이지만, **`output.error.code`가 이제 동일 조건(redirect 중 사설망 차단)에 대해 과거와 다른 값(`HTTP_TRANSPORT_FAILED` → `HTTP_BLOCKED`)을 반환**한다. 이 코드 값으로 분기하는 기존 워크플로우(예: `output.error.code === 'HTTP_TRANSPORT_FAILED'`를 재시도 트리거로 쓰는 워크플로우)가 있다면 동작이 달라질 수 있다. 코드 리뷰 관점에서는 **호출자 관측 가능한 출력 값의 의미 변경**이므로 breaking-change 성격이 있고, 실제로 spec §8.3에 "⚠️ 운영 영향(breaking)"으로 명시되어 있다 — 문서화는 되어 있으나 side-effect reviewer 관점에서 재확인 가치가 있다.
  - 제안: 이미 spec Rationale(§8.3)에 breaking 영향이 명시돼 있으므로 추가 조치는 불필요. 다만 PR 설명/체인지로그에도 "redirect 경유 SSRF 차단의 `output.error.code`가 `HTTP_TRANSPORT_FAILED`에서 `HTTP_BLOCKED`로 바뀐다"는 사실을 명확히 남길 것을 권장(관측 가능한 API 응답 값 변경이므로 CONVENTIONS §5 관점에서 API 계약 변경에 해당).

- **[WARNING] `logUsage`(Activity 로그)에 기록되는 SSRF 에러 메시지가 spec §8.3 문구("원본 상세는 서버 로그·Usage 로그에만")와 실제 다르게, 두 catch 경로 모두 이미 일반화된 메시지만 기록 — 문서-코드 불일치이나 보안상 더 안전한 방향**
  - 위치: `http-request.handler.ts:368-382`(preflight SSRF `logUsage` 호출, `message: SSRF_BLOCKED_CLIENT_MESSAGE`), `535-544`(redirect-hop SSRF가 승격된 `IntegrationError`를 그대로 `logUsage`에 전달 — 이 `err.message`도 이미 `SSRF_BLOCKED_CLIENT_MESSAGE`로 생성된 값)
  - 상세: 코드 주석(374-376행)은 "원본 host/IP는 Activity 로그 API(`GET /integrations/:id/activity`)로 workspace 사용자에게 노출되므로 usage 로그 message도 일반화한다"고 명시적으로 설계 의도를 밝히고 있다 — 즉 `logUsage`에도 일반화 문구만 기록하는 것은 **의도된 동작**이다. 그런데 새로 갱신된 spec 문서(`1-http-request.md` §6 표, §8.3)는 "원본 상세(hostname/IP)는 `logger.warn` + **Usage 로그**로 서버에만 남긴다"고 서술해, 마치 Usage 로그에는 원본이 남는 것처럼 읽힌다. 실제로는 `logger.warn`에만 원본이 남고 Usage 로그(`IntegrationUsageLog`, Activity API로 workspace 사용자에게 노출)에는 일반화 문구만 남는다. 즉 **spec 문서 문구와 실제 구현 동작이 어긋난다** — 코드 자체의 부작용은 아니지만, 이 문서를 근거로 "SSRF 차단 원인은 Activity 탭에서 확인 가능하다"고 오인한 운영자/지원팀이 실제로는 확인할 수 없는 정보를 찾게 되는 운영상 부작용으로 이어질 수 있다.
  - 제안: spec §8.3/§6 표 문구에서 "Usage 로그"를 제거하거나 "Usage 로그는 일반화 문구만 기록, 원본 상세는 `logger.warn`에만"으로 정정. (참고: 이 항목은 이미 `review/consistency/2026/07/05/12_55_17/cross_spec.md`가 유사한 관점의 WARNING을 기록했으나, 그 리뷰는 DB_HOST_BLOCKED의 pre-existing gap을 다뤘고 이번 HTTP 구현 자체가 spec 문구와 다시 어긋난 것은 아직 별도로 짚히지 않았다.)

- **[INFO] `authentication === 'integration'`이 아닌 경로(`none`/`custom`)는 SSRF 차단 시 `logUsage` 호출 자체가 없음 — 기존 동작 유지, 회귀 아님**
  - 위치: `http-request.handler.ts:368-382`
  - 상세: `if (authentication === 'integration' && integrationId)` 가드는 변경 전부터 존재하던 것으로 이번 diff가 신설한 게 아니다(주석 "Usage 로그는 integration 인증에 한정... spec §4.2"도 기존 로직 설명). 부작용 없음 — 회귀 아님을 확인차 기록.
  - 제안: 조치 불필요.

- **[INFO] `IntegrationError` 인스턴스가 이제 redirect 루프 내부에서 `throw`되어 바깥 `try` 블록을 통해 흐른다 — 기존 `try/catch` 제어 흐름 재구성**
  - 위치: `http-request.handler.ts:427-464`
  - 상세: 이전에는 redirect 루프 안에서 `assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`가 던지는 예외가 바로 바깥 catch로 전파됐다. 이제는 루프 내부에 nested `try/catch`가 추가되어 예외를 잡아 `IntegrationError`로 재포장 후 다시 throw한다 — 두 단계의 throw/catch가 새로 생겼다. 성능/부작용 관점에서는 무시할 수준(SSRF 차단은 예외적 경로)이며, 다른 `catch` 블록(`finally` 등)이 개입하지 않아 `clearTimeout(timeoutId)`이 바깥 catch에서 여전히 정상 호출됨을 확인했다(530-531행). 타이머 누수·리소스 해제 누락 없음.
  - 제안: 조치 불필요.

- **[NONE] 함수 시그니처/공개 API 변경 없음**
  - 상세: `HttpRequestHandler.execute()`, `validate()` 등 공개 메서드 시그니처는 변경되지 않았다. `NodeHandlerOutput`의 필드 구조(`config/output/meta/port`)도 그대로다. 오직 `output.error.message`의 **문자열 값**과 (redirect 한정) `output.error.code`의 **값**만 바뀐다 — 이는 함수 시그니처 변경이 아니라 런타임 반환값 콘텐츠 변경이며, 이미 spec breaking-change 절로 문서화돼 있다(위 두 번째 항목 참고).

- **[NONE] 새 전역 변수·환경 변수 읽기/쓰기 없음**
  - 상세: `SSRF_BLOCKED_CLIENT_MESSAGE`는 모듈 스코프 `const` 문자열 상수이며 mutable 전역 상태가 아니다. `process.env` 읽기/쓰기는 diff에 없다(`ALLOW_PRIVATE_HOST_TARGETS` 등은 `http-safety.ts` 내부에 있으며 이번 diff의 변경 범위 밖).

- **[NONE] 네트워크 호출 패턴 변경 없음**
  - 상세: `fetch` 호출 횟수·redirect 추적 로직(최대 5홉) 자체는 그대로다. 변경은 SSRF 차단 시의 예외 분류·메시지 내용에 한정되며 실제 아웃바운드 요청 여부/횟수는 달라지지 않는다.

- **[NONE] 테스트 파일(`http-request.handler.spec.ts`)은 순수 단언 갱신 + 신규 케이스 추가**
  - 상세: 기존 4곳의 `/SSRF_BLOCKED/` 정규식 단언을 고정 문자열 단언으로 교체하고, redirect-hop SSRF 케이스(1건)를 신규 추가했다. `global.fetch = jest.fn()...` mock 대입은 파일 전역 스코프의 `global.fetch`를 mutate하지만 이는 기존 테스트 스위트 전반의 표준 패턴(다른 테스트에서도 동일하게 사용)이며 `afterEach`에서 mock 복원 여부는 기존 스펙 파일의 공통 셋업에 의존 — 이번 diff가 새로 도입한 패턴이 아니므로 회귀 위험 없음.

## 요약

이번 변경은 HTTP Request 노드의 SSRF 차단 시 `output.error.message`를 host/IP 미노출 일반화 문구로 통일하고, redirect-hop SSRF 차단을 `HTTP_TRANSPORT_FAILED`가 아닌 `HTTP_BLOCKED`로 재분류하는 보안 강화 리팩터다. 새 전역 변수·환경 변수·의도치 않은 파일시스템/네트워크 부작용은 없으며, 함수 시그니처도 변하지 않았다. 다만 두 가지는 "관측 가능한 부작용"으로 실제 존재한다 — (1) redirect 경유 SSRF 차단의 `output.error.code` 값이 `HTTP_TRANSPORT_FAILED`에서 `HTTP_BLOCKED`로 바뀌는 것은 이 코드로 분기하던 하류 워크플로우 입장에서 breaking change이며(spec에 이미 명시됨), (2) spec §8.3/§6 표가 "Usage 로그에도 원본 상세가 남는다"고 서술하지만 실제 코드는 Usage 로그에도 이미 일반화된 메시지만 기록한다(코드 자체 의도는 옳지만 문서 문구가 실제 동작과 어긋남). 둘 다 코드가 예상 밖의 상태를 변경하는 결함이 아니라 문서화·커뮤니케이션 정합성 이슈에 가깝다.

## 위험도

LOW
