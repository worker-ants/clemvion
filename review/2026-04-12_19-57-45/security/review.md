### 발견사항

---

**[WARNING] SSL 인증서 검증 비활성화**
- 위치: `database-query.handler.ts` — `buildPgConnection()`
- 상세: `ssl: 'require'`일 때 `{ rejectUnauthorized: false }`를 사용하여 서버 인증서를 검증하지 않음. MITM 공격에 취약.
- 제안: `'require'`도 `{ rejectUnauthorized: true }`로 설정하거나, `'require'`와 `'verify-full'`의 구분 의미를 명확히 재정의할 것. 프로덕션 DB 연결에서 인증서 검증 비활성화는 위험.

---

**[WARNING] 자격증명이 에러 메시지에 노출될 가능성**
- 위치: `integration-handler-base.ts` — `toLogError()`, 각 핸들러의 catch 블록
- 상세: `err.message`를 그대로 로그/에러 객체에 담아 전달. pg, nodemailer 등의 라이브러리는 에러 메시지에 연결 문자열(host, user, password 일부)을 포함하는 경우가 있음.
- 제안: catch 블록에서 외부 라이브러리 에러를 기록할 때 민감 필드(password, token 등)를 제거하는 sanitize 단계 추가.

---

**[WARNING] HTTP 핸들러 — SSRF(Server-Side Request Forgery) 방어 없음**
- 위치: `http-request.handler.ts` — `execute()`
- 상세: `url` 값을 사용자 제공 워크플로우 설정에서 직접 가져와 서버 측 fetch 수행. 내부 네트워크 주소(`http://169.254.169.254/`, `http://localhost:`, `http://10.x.x.x/` 등)를 차단하는 로직이 없어 내부 인프라 접근 가능.
- 제안: allowlist 기반 도메인 정책 또는 RFC1918/링크로컬 주소 차단 로직 추가.

---

**[WARNING] HTTP 핸들러 — 리다이렉트 제어 없음**
- 위치: `http-request.handler.ts` — fetch 호출
- 상세: `follow-redirects` 패키지가 axios 의존성으로 도입됨. Node fetch 기본값은 리다이렉트를 따라가며 SSRF의 우회 경로가 될 수 있음(예: 외부 URL → 내부 주소로 리다이렉트).
- 제안: `redirect: 'manual'` 또는 `redirect: 'error'` 옵션을 fetch에 추가하거나, 리다이렉트 허용 여부를 명시적으로 설정.

---

**[WARNING] 데이터베이스 핸들러 — SQL 파라미터 타입 강제 없음**
- 위치: `database-query.handler.ts` — `parseParameters()`
- 상세: JSON 파싱 후 배열 원소 타입 검증 없이 `pg.Client.query()`에 전달. pg 드라이버는 파라미터화 쿼리로 처리하므로 SQL 인젝션 자체는 막히지만, 의도치 않은 타입(객체, 중첩 배열)이 전달될 수 있음.
- 제안: 파라미터가 primitive 타입(string, number, boolean, null)인지 검증하는 단계 추가.

---

**[WARNING] Slack access_token 값 로그에 포함 가능**
- 위치: `slack.handler.ts` — catch 블록, `toLogError()`
- 상세: Slack SDK 에러 메시지에 token 정보가 포함되는 경우가 있음(예: `invalid_auth` 응답에 요청 헤더 정보 포함). `toLogError(err.message)` 경유 시 DB 로그에 기록될 수 있음.
- 제안: Slack API 에러는 `error.data?.error` 필드(Slack 에러 코드 문자열)만 추출하여 로그에 기록.

---

**[INFO] `getForExecution()` — workspace 범위 내 격리만 의존**
- 위치: `integrations.service.ts` — `getForExecution()`
- 상세: `requireEntity(id, workspaceId)` 호출로 workspace 범위 검증이 수행됨. 정상적이나, 호출 측(`integration-handler-base.ts`)에서 `workspaceId`를 `context.variables.__workspaceId`에서 가져오므로, 워크플로우 실행 컨텍스트에 이 값이 올바르게 주입되는지 신뢰 체인 확인 필요. 임의 워크스페이스 ID 삽입 가능한 경로가 있는지 확인 권장.
- 제안: `__workspaceId`가 실행 엔진 내부에서만 설정되고, 사용자가 워크플로우 노드 설정을 통해 변조할 수 없음을 확인.

---

**[INFO] `axios 1.15.0` — `@slack/web-api`의 간접 의존성**
- 위치: `package-lock.json`
- 상세: `@slack/web-api`가 `axios ^1.13.5`를 요구하지만 `1.15.0`이 설치됨. 프로젝트에 직접 axios 의존성이 없으므로 버전 관리가 `@slack/web-api`에 위임됨. 현재 알려진 CVE 없음.
- 제안: 주기적 `npm audit` 실행 권장.

---

**[INFO] SMTP 자격증명 plaintext body 전송 가능**
- 위치: `send-email.handler.ts` — `buildTransport()`
- 상세: `secure: 'none'`일 경우 TLS 없이 SMTP 연결이 설정됨. 내부망 SMTP 서버 용도로는 허용될 수 있으나, 자격증명이 평문 전송될 수 있음.
- 제안: `secure: 'none'` 선택 시 UI에 경고 표시 또는 프로덕션 환경에서 비활성화 옵션 고려.

---

### 요약

전반적으로 자격증명 관리(암호화 transformer 적용, workspace 범위 격리, parameterized query 사용)와 에러 코드 체계가 잘 설계되어 있습니다. 주요 보안 우려는 두 가지입니다: (1) HTTP Request 핸들러에서 내부 네트워크를 대상으로 하는 SSRF 공격 방어 로직이 없으며, (2) `ssl: 'require'` 옵션에서 PostgreSQL 인증서 검증이 비활성화되어 있어 MITM 위험이 존재합니다. 에러 메시지를 통한 자격증명 노출 가능성도 보완이 필요합니다.

### 위험도

**MEDIUM** — SSRF와 SSL 검증 우회가 조합될 경우 내부 인프라 노출로 이어질 수 있으나, 워크플로우 실행 권한이 인증된 사용자에게만 부여된다는 전제에서 직접 외부 공격 가능성은 제한적입니다.