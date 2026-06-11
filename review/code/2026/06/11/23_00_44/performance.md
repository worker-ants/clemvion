# 성능(Performance) 리뷰

**대상 변경**: HTTP Request 핸들러 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**리뷰 대상 파일**:
- `codebase/backend/src/nodes/core/error-codes.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`
- `plan/**`, `review/**` (문서 파일 — 성능 분석 대상 제외)

---

## 발견사항

### - **[INFO]** SSRF 가드 게이트 제거 — 추가 비용 없음
- 위치: `http-request.handler.ts` diff `+263~+294` (구 `if (authentication === 'integration')` 블록 → 무조건 실행)
- 상세: 변경 전에는 `authentication === 'integration'` 조건 분기가 존재해 `none`/`custom` 경로에서 `assertSafeOutboundUrl` + `assertSafeOutboundHostResolved` 두 함수 호출이 생략됐다. 변경 후에는 모든 경로에서 이 두 함수가 실행된다. `assertSafeOutboundUrl`은 URL 파싱 + 정규식 매칭 O(1) 동기 연산이다. `assertSafeOutboundHostResolved`는 DNS 리졸브를 포함하는 비동기 I/O 이며, 이 비용이 순수하게 추가된다.
- 제안: 추가 DNS 리졸브 비용은 이미 HTTP 요청 자체(fetch)가 동일 DNS 리졸브를 수행하기 때문에 전체 요청 레이턴시 대비 무시 가능하다. 단, `none`/`custom` 경로에서 블로킹 I/O가 하나 더 생긴다는 점은 인지하고 있으면 충분하다. 별도 최적화는 불필요하다.

### - **[INFO]** config echo 명시 열거 — 메모리 할당 미미하게 증가
- 위치: `http-request.handler.ts` diff `+198~+211` (`configEcho` 객체 리터럴 명시 열거)
- 상세: 구 코드(`{ ...rawConfig, url: rawUrl }`)는 `rawConfig` 전체를 shallow copy 했다. 신 코드는 11개 필드를 개별 참조하는 리터럴을 생성한다. 두 방식 모두 O(스키마 필드 수) 메모리 할당이며, 신 코드는 비민감 필드만 열거하므로 오히려 `rawConfig`에 credential 필드가 추가로 있을 경우 그 필드를 제외해 메모리 공간이 같거나 더 적다. 성능상 부정적 영향은 없다.
- 제안: 없음.

### - **[INFO]** `logUsage` 조건 분기 — 불필요한 중첩 조건 제거
- 위치: `http-request.handler.ts` diff `+269~+280` (catch 블록 내 `if (authentication === 'integration' && integrationId)`)
- 상세: 구 코드는 외부 `if (authentication === 'integration')` 블록 안에서 다시 `if (integrationId)` 를 체크했다. 신 코드는 두 조건을 `&&` 로 합쳐 단일 if 로 처리한다. 논리적으로 동일하며 조건 평가 횟수도 동일하다. 성능 차이는 없다.
- 제안: 없음.

---

## 요약

이번 변경에서 성능 관점의 실질적 위험 사항은 없다. 핵심 변경인 SSRF 가드 게이트 제거는 `none`/`custom` 인증 경로에 DNS 리졸브 비동기 I/O를 1회 추가하지만, HTTP 요청 자체의 fetch 단계에서도 DNS 리졸브가 발생하므로 전체 레이턴시 관점에서 실질 부담은 미미하다. config echo 방식 변경(spread → 명시 열거)은 메모리 측면에서 동등하거나 오히려 더 작은 객체를 생성한다. 알고리즘 복잡도 변화, N+1 쿼리, 캐싱 필요성, 블로킹 I/O 신규 도입, 불필요한 연산, 데이터 구조 부적합, 지연 로딩 위반 어느 항목에서도 문제가 발견되지 않았다.

## 위험도

NONE

STATUS: OK
