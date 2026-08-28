# Rationale 연속성 검토 — `plan/in-progress/spec-draft-error-cause-criterion.md`

## 발견사항

- **[WARNING]** `§6.3.1` 배치가 문서 자신의 scope 선언·인용 선례의 실제 위치와 어긋난다
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` "## 제안" 및 "## 왜 `spec/conventions/` 가 아니라 여기인가" 절
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Overview`("로깅 레벨·민감정보 마스킹(§6)")와 `§6.3`("로그에 다음 정보가 포함되지 않도록 자동 마스킹") 본문, 그리고 같은 문서 Rationale "4xx http-error `message` 고정 문구 — CWE-209 방지" 항목
  - 상세: target 은 §6.3(민감 정보 마스킹) 을 "이미 '무엇을 노출하지 않는가' 를 다루므로 같은 자리" 라고 근거를 대며 `#### 6.3.1` 로 신설을 제안한다. 그러나 실측하면 §6.3 이 다루는 노출 채널은 **로그**(운영자·로그 집계 시스템에 무엇이 쓰이는가)이고, target 이 다루는 `cause` 부착 문제는 **클라이언트/Activity API 로 무엇이 나가는가** — 정반대 채널이다. target 이 자신의 근거로 인용한 CWE-209 고정 문구 결정 자체도, 그 Rationale 서술("운영 가시성은 원문을 `logger.warn` 으로만 남겨 확보한다 — **클라이언트 응답과 분리**")이 바로 이 두 채널을 명시적으로 분리하고 있으며, 그 결정의 **본문 반영 위치**는 §6 이 아니라 `§1.3`(`PAYLOAD_TOO_LARGE` 행)과 `GlobalExceptionFilter`(실측: `codebase/backend/src/common/filters/http-exception.filter.ts` — `exception.stack`/원본 `message` 는 `logger.warn`/`logger.error` 로만 가고 클라이언트 `errorResponse` 에는 안 실린다)이다. 즉 target 이 "같은 원칙의 다른 적용이니 옆에 둔다" 고 정당화한 위치(§6.3) 는, 정작 그 원칙이 실제로 적용된 본문 위치(§1.3/§2 인접)와 다르다. 같은 문서가 `§2.2` 주석에서 "노드 핸들러가 반환하는 표준 `output.error` shape 은 [`conventions/node-output.md §3.2`](../conventions/node-output.md#32-outputerror-표준-형태) 가 정본" 이라고 이미 위임하고 있는데, target 의 "왜 `spec/conventions/` 가 아니라 여기인가" 비교 대상에는 `secret-store.md`·`error-codes.md` 만 있고 이 기존 위임처(`node-output.md`)는 검토되지 않았다.
  - 제안: §6.3.1 대신 §2(에러 응답 형식)/§3(노드 에러 처리 정책) 인접 위치, 또는 `output.error` 의 기존 정본인 `conventions/node-output.md §3.2`(공통 표준 필드 옆)에 배치하는 안을 함께 검토하고, 부득이 §6.3 에 두려면 "이 절은 로그가 아니라 **클라이언트에 노출되는 객체의 구성**을 다룬다" 는 문장으로 채널을 명확히 구분해 로깅 정책과 섞이지 않게 한다.

- **[WARNING]** `cause` 판별 기준이 "message 겹침"만 검사해 `#814` 가 확립한 "필드명 무관, raw content 전체가 판단축" 원칙을 완전히 승계하지 못한다
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` "## 제안" 첫 bullet ("감싼 `message` 가 원본 `message` 를 이미 포함하면 … 부착한다")
  - 과거 결정 출처: `spec/4-nodes/4-integration/1-http-request.md` `§8.3` Rationale "SSRF 차단 메시지 일반화 — 정찰 면 축소" 의 "**기각된 대안**: (B) 원본을 `output.error.details` 로 옮겨 노출 — details 도 클라이언트 wire 라 정찰 면 동일"
  - 상세: `#814` 의 확립된 원칙은 "노출 여부는 어느 **필드**에 담기는가가 아니라, 그 필드가 클라이언트에 도달 가능한가 + 그 안에 **새로운 raw 내용**이 실리는가로 판단한다" 이다(그래서 message → details 로 자리만 옮기는 안이 기각됐다). target 이 세우는 새 기준은 "감싼 **message** 텍스트가 원본 message 를 이미 포함하는가" 만 검사하는데, `{ cause: err }` 로 부착되는 것은 message 문자열이 아니라 **`err` 객체 전체**다. 현재 3개 실측 사이트(`expression-resolver.service.ts`/`code.handler.ts`/`secret-resolver.service.ts`)는 우연히 감싼 message 가 `${err.message}` 를 그대로 보간하므로 이 기준이 trivial 하게 성립하지만, target 은 이를 **미래의 모든 wrap 지점에 적용할 일반 원칙**으로 승격한다. `err` 가 `message` 외에 부가 속성(예: DB 드라이버 에러의 `detail`/`hint`/`where`/`internalQuery`, HTTP 클라이언트 에러의 헤더 등 — 실제로 `conventions/node-output.md §3.2.2` 는 DB Query 노드가 `pgErrorCode`/`query` 를 `details` 에 노출하는 것을 이미 별도로 통제된 필드로만 허용한다)를 가진 경우, message 텍스트만 겹쳐도 `cause` 전체 부착은 message 에 없던 새 정보를 노출할 수 있다 — `#814` 원칙("소비처가 바뀌어도 안전해야 한다")을 target 스스로 근거로 드는데, 그 원칙을 message 축 하나로만 근사하는 것은 불완전하다.
  - 참고: 이 갭은 target 이 새로 만든 것이 아니라 이미 `#1226`(머지됨, `expression-resolver.service.spec.ts`/`code.handler.spec.ts`/`secret-resolver.service.spec.ts` 의 런타임 단언)에 내재해 있던 기존 결정이다. 다만 이번이 그 결정을 spec 정본으로 승격하는 시점이므로, 승격 시 이 gap 을 Rationale 에 명시하고 스코프를 좁히는 것이 적절하다.
  - 제안: 원칙 문장에 "이 기준은 `err` 가 `message` 외에 새로운 민감 정보(스택·DB/HTTP 부가 필드 등)를 own-property 로 갖지 않는다고 가정한다" 는 caveat 를 추가하거나, `details` 화이트리스트처럼 "cause 부착 시에도 `err` 의 own enumerable 속성이 `message`/`name` 뿐임을 확인" 하는 조건을 판별 기준에 포함시켜 `#814` 의 "필드가 아니라 content" 축과 정합시킨다.

- **[INFO]** "`.cause` 를 직렬화하는 곳이 0곳" 측정 문구의 스코프 정밀화
  - target 위치: `plan/in-progress/spec-draft-error-cause-criterion.md` "### 왜 이 기준이 필요한가" 절, "실측 근거: … `.cause` 를 직렬화하는 곳이 **0곳**임을 확인했다"
  - 상세: 실측하면 `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts` 의 `describeFetchError()` 가 `err.cause` 를 읽어 문자열로 풀어내는 기존 코드가 있다 (`const cause = (err as { cause?: unknown }).cause; …`). 다만 그 결과는 `this.logger.warn(...)` 에만 전달되고 클라이언트 반환값(`{ ok, description: lastError.message }`)에는 `.message` 만 실려 client-facing 경로에는 닿지 않는다 — 즉 target 의 "0곳" 주장은 **클라이언트 노출 경로 기준**으로는 유효하지만, 문구 자체는 그 스코프를 명시하지 않아 "cause 를 읽는 코드가 전혀 없다" 로 오독될 수 있다. 이 저장소는 "실측했다" 문구의 정밀도에 특히 민감한 이력이 있다(과거 여러 PR 에서 프록시·시점 오류로 재차 지적됨).
  - 제안: "`.cause` 를 **클라이언트 응답 경로로** 직렬화하는 곳이 0곳" 처럼 스코프를 한정하는 문구로 정정하거나, `describeFetchError` 사례(로그 전용 unwrap)를 각주로 명시해 "cause 를 다루는 기존 패턴 = 로그 전용 unwrap" 이 이번 기준과 일관됨을 보여준다.

## 요약

target 이 명시적으로 기각된 대안을 이유 없이 재도입하거나 spec 에 문서화된 결정을 무근거로 번복하는 사례는 발견되지 않았다 — `cause` 판별 기준 자체는 이미 `#1226`(머지)에서 코드/테스트로 확립된 결정을 정본화하는 것이고, 그 사실관계(3개 사이트의 실제 코드·주석)도 실측과 일치했다. 다만 두 지점에서 기존 Rationale 과의 정합이 느슨하다: (1) 새 절의 배치(§6.3 로그 마스킹)가 실제로 다루는 노출 채널(클라이언트 응답)과 어긋나고, 그 배치를 정당화하며 인용한 CWE-209 선례의 실제 본문 위치도 §6 이 아니다. (2) 새 기준이 인용하는 `#814` 의 핵심 원칙("필드가 아니라 raw content 노출 여부가 판단축")을 message-텍스트 겹침이라는 좁은 프록시로만 구현해, 일반 원칙으로 승격 시 `err` 의 message 이외 속성이 여전히 새로운 정보를 노출할 여지를 닫지 못한다. 둘 다 CRITICAL 급 위반(명시적으로 기각된 대안의 직접 재도입, 또는 현재 관측 가능한 invariant 위반)은 아니며, spec 정본화 단계에서 문구를 보강하면 해소 가능한 WARNING 이다.

## 위험도

MEDIUM
