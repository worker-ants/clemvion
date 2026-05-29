# 보안(Security) 리뷰 결과

리뷰 대상: fix-mail-send-status PR (5개 파일)
리뷰 일시: 2026-05-29

---

## 발견사항

### 1. SMTP 에러 메시지 노출 가능성

- **[WARNING]** `testEmailTransport` 의 catch 블록이 `nodemailer` 의 원본 에러 메시지를 `clampMessage` 로 길이만 자른 뒤 API 응답에 직접 노출한다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `testEmailTransport` catch 블록 (라인 ~1458–1463)
  - 상세: SMTP 서버는 인증 실패 시 서버 주소, 포트, 배너, EHLO 협상 결과 등 서버 내부 정보를 담은 메시지를 반환할 수 있다. `err.message` 전체를 그대로 `IntegrationTestResult.message` 로 내보내면 공격자가 연결 테스트 엔드포인트를 호출하여 인프라 정보를 수집하는 정보 수집 벡터로 쓸 수 있다.  
    예: `"Invalid login: 535 5.7.3 Authentication unsuccessful [smtp.internal.corp 192.168.1.10]"` 처럼 내부 IP/호스트명이 노출될 수 있다.
  - 제안: 에러 메시지를 그대로 전달하는 대신, 인증 실패(`535`, `authentication`, `login`) / 연결 실패(`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`) / TLS 오류(`certificate`) 등으로 패턴 분류하여 미리 정의된 사용자 친화 메시지를 반환하도록 수정한다. 원본 메시지는 서버 로그에만 기록한다.

### 2. `_selectedPort` 필드 신뢰 경계 문제

- **[WARNING]** `isErrorPortRouted` 메서드가 `finalOutput._selectedPort === 'error'` 를 신뢰 기준으로 사용한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `isErrorPortRouted` 메서드 (라인 ~1812–1819)
  - 상세: `_selectedPort` 는 `toEngineFlatShape` + `applyPortSelection` 을 거쳐 엔진 내부에서 주입되는 값이다. 외부 핸들러가 반환하는 임의의 JS 객체에서도 이 필드를 읽기 때문에, 악의적이거나 버그 있는 핸들러가 정상 출력에 `_selectedPort: 'error'` 를 포함시키면 실제로 오류가 없는 노드가 FAILED 로 마킹된다(반대로 `_selectedPort: 'ok'` 를 출력하여 실패를 숨길 수도 있다). 핸들러가 신뢰 경계 내부에 있다면 위험도가 낮으나, 외부 코드가 핸들러를 주입할 수 있는 구조라면 중간 위험이 된다.
  - 제안: 엔진이 핸들러 return 값에 직접 `_selectedPort` 를 붙이지 않고, `adaptHandlerReturn` / `toEngineFlatShape` 단계에서 내부 전용 불변 래퍼(예: `Symbol` 키 사용 또는 별도 `EngineOutput` 타입 분리)로 변환하여 외부 핸들러 payload 와 엔진 내부 메타데이터를 명확히 구분한다.

### 3. `errorCode` / `errorMessage` 전파 시 임의 데이터 그대로 저장

- **[WARNING]** error-port 라우팅 시 핸들러 출력의 `error.code` 와 `error.message` 를 검증 없이 `NodeExecution.error` 및 `Execution.error` 에 그대로 저장하고 WebSocket 이벤트로 방송한다.
  - 위치: `execution-engine.service.ts` — error-port 처리 블록 (라인 ~1736–1749) 및 `savedExecution.error` 할당 (라인 ~1664–1670, ~1695–1701)
  - 상세: 핸들러가 반환하는 `errorEnvelope.message` 는 외부 SMTP 서버 / LLM API / 외부 HTTP 서버 등에서 비롯된 메시지를 담을 수 있다. 이 값이 길이 제한 없이 DB 에 저장되고 WebSocket 클라이언트에 전송된다. 악의적 외부 서버가 매우 큰 문자열이나 HTML/스크립트를 포함한 메시지를 반환하면 DB JSONB 컬럼을 膨脹시키거나 WebSocket 수신 프런트엔드에서 XSS 위험이 생긴다.
  - 제안: `errorMessage` 를 저장하기 전 `clampMessage` 또는 동등한 최대 길이 제한을 적용한다. 프런트엔드 렌더링 시에도 에러 메시지를 HTML로 파싱하지 않도록 텍스트 렌더링을 강제한다. 이미 `clampMessage` 유틸이 존재하므로 `NodeExecution.error.message` 저장 경로에도 일관되게 적용할 것을 권장한다.

### 4. SMTP 호스트/포트 파라미터 미검증으로 SSRF 가능성

- **[WARNING]** `testEmailTransport` 가 `credentials.host` 와 `credentials.port` 를 구조 검증(`validateCredentials`) 후 바로 `nodemailer.createTransport` 에 전달한다.
  - 위치: `integrations.service.ts` — `testEmailTransport` (라인 ~1132–1144)
  - 상세: `validateCredentials` 가 필드 존재 여부·타입만 확인하고 호스트 값의 범위를 제한하지 않는다면, 사용자(워크스페이스 멤버)가 `host: "169.254.169.254"` (AWS IMDSv1), `host: "localhost"`, `host: "10.0.0.x"` 등 내부 주소를 입력하여 서버에서 내부망에 TCP 연결을 시도하게 만들 수 있다(SSRF). 연결 결과(성공/실패/타임아웃)가 API 응답으로 돌아오므로 포트 스캔에 사용될 수도 있다.
  - 제안: `validateCredentials` 에서 `host` 값이 private IP 범위(`10.`, `172.16–31.`, `192.168.`, `127.`, `169.254.`, `::1`, `fc00::/7`) 또는 `localhost` 에 해당하지 않도록 차단 로직을 추가한다. 또는 outbound SMTP 연결을 별도 격리된 worker 에서 실행하는 방안도 고려한다.

### 5. `ErrorPortFallbackError.code` 가 외부 입력 기반 `errorMessage` 를 사용

- **[INFO]** `ErrorPortFallbackError` 생성자에 전달되는 `errorPortFallbackMessage` 는 핸들러 출력에서 온 외부 문자열이다.
  - 위치: `execution-engine.service.ts` — `ErrorPortFallbackError` throw 직전 (라인 ~1797–1803)
  - 상세: 이 메시지가 `Execution.error.message` 로 기록될 때 길이 제한이나 새니타이징이 없다. 위 3번 항목과 연관되며, 에러 메시지 크기 제한이 적용되면 충분히 완화된다.
  - 제안: throw 전에 `clampMessage` 또는 고정된 내부 메시지(`'Node routed to error port with no connected edge'`)로 대체하고, 원본 외부 메시지는 로그에만 남긴다.

### 6. 테스트 코드에 평문 자격증명 포함

- **[INFO]** 테스트 픽스처에 SMTP 비밀번호 리터럴이 포함된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — `makeEmailIntegration` (라인 ~2005) 의 `password: 'app-password'`
  - 상세: 테스트용 더미 값으로 실제 자격증명이 아니므로 직접적인 위협은 없다. 그러나 git 히스토리에 `password` 키워드 패턴이 포함되면 시크릿 스캐너(TruffleHog, gitleaks 등)가 오탐을 생성하여 노이즈가 증가한다.
  - 제안: `password: 'test-password-placeholder'` 또는 `password: '<test>'` 처럼 명확히 더미임을 표현하는 값으로 변경하거나, 시크릿 스캐너 허용 목록(`.gitleaksignore` 등)에 등록한다.

---

## 요약

이번 변경은 SMTP 인증 실패가 성공으로 표시되던 버그와 엔진이 error-port 라우팅을 실패로 반영하지 않던 결함을 수정하는 보안 관련도 높은 개선이다. 전반적으로 코드 설계는 건전하며 중대한 인증 우회나 SQL 인젝션, 하드코딩된 시크릿은 발견되지 않았다. 그러나 SMTP 에러 메시지를 원본 그대로 API 응답으로 내보내는 정보 노출 위험, SMTP 호스트 파라미터를 내부 주소로 지정하여 서버를 SSRF 프록시로 사용할 수 있는 위험, 핸들러 출력의 에러 메시지를 길이 제한 없이 저장하는 문제가 존재한다. 이 중 SSRF 위험(항목 4)이 가장 우선 조치가 필요하며, SMTP 에러 메시지 세니타이징(항목 1·3)은 그 다음 순위다.

---

## 위험도

MEDIUM
