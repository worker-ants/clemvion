# Security Review — PR-B2a (exec-park-durable-resume)

## 발견사항

### **[WARNING]** 테스트 코드에 JWT 시크릿 하드코딩 (리포지토리 공개)

- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` line 679, 1306; `docker-compose.e2e.yml` line 1827
- 상세: `JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 값이 테스트 코드와 docker-compose.e2e.yml 양쪽에 하드코딩되어 리포지토리에 커밋된다. 이 값은 "do-not-use-in-prod" 경고 문구를 포함하고 있으며 코드 주석에도 "테스트 전용 시크릿, repo에 공개됨"이라고 명시하고 있다. 테스트 환경 전용이고 의도된 설계임이 문서화되어 있으나, 운영 환경이 동일 시크릿을 우발적으로 사용하거나 복붙(copy-paste) 오류가 발생할 경우 HS256 JWT 위조가 가능해진다.
- 제안: 현재 구조는 e2e 격리 환경 내에서 허용 가능한 패턴이나, `docker-compose.e2e.yml`의 `JWT_SECRET` 값을 `.env.e2e.example` 파일로 분리하고 `docker-compose.e2e.yml`에서 `${JWT_SECRET}` 참조 형태로 바꾸는 것을 중장기적으로 고려할 것. 당장은 주석에 명시된 "운영 절대 사용 금지" 경고를 CI 게이트(시크릿 스캐너 제외 목록) 또는 `.gitattributes`로 보강하는 방법도 있다.

---

### **[WARNING]** e2e 테스트가 JWT 토큰을 직접 mint — 인증 우회 패턴 검증 필요

- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` `mintInteractionToken()` 함수 (line 700–707, 1327–1333)
- 상세: e2e 테스트가 `InteractionTokenService.issuePerExecution`과 동일한 payload (`sub`, `aud`, `jti`, `expiresIn`) 로 HS256 JWT를 직접 mint 하여 EIA(`/api/external/executions/:id/interact`) 엔드포인트를 인증한다. 이 방식은 백엔드가 실제로 발급한 토큰이 아닌 외부에서 forge 한 토큰을 수락하는지를 확인하는 것이다. 즉, 서버측 토큰 검증이 payload 구조와 서명만을 검사하고 토큰을 실제 발급 기록(DB 등)과 대조하지 않는다면, 동일 `JWT_SECRET`을 아는 공격자가 임의의 `executionId`를 `sub`로 하는 interaction 토큰을 위조할 수 있다.
- 제안: `InteractionTokenService`의 토큰 검증 로직이 발급 기록(예: DB 레코드, Redis 화이트리스트)과 대조하는지 확인할 것. 단순 서명 검증만 하는 경우 `jti` 기반 단회성(one-use) 또는 만료 전 revoke 메커니즘을 추가하는 것이 권장된다. 테스트 자체는 이 설계를 exercise 하는 것이므로 리뷰 범위 외지만, 운영 코드에서 토큰 위조 가능성을 차단해야 한다.

---

### **[WARNING]** docker-compose.e2e.yml에 다수의 시크릿 평문 하드코딩

- 위치: `docker-compose.e2e.yml` lines 1730–1831
- 상세: PostgreSQL 비밀번호(`clemvion-e2e`), MinIO 비밀번호(`clemvion-e2e`), S3 시크릿 키(`clemvion-e2e`), `ENCRYPTION_KEY`(`0123456789abcdef0123456789abcdef`), `INTEGRATION_ENCRYPTION_KEY`(동일값), `JWT_SECRET`이 모두 파일에 평문으로 기록되어 있다. `ENCRYPTION_KEY`는 AES 키로 추정되며 순차 문자열(`0123456789abcdef...`)로 엔트로피가 매우 낮다.
- 제안: 이들은 모두 e2e 격리 환경 전용이며 파일 자체에 "운영 절대 사용 금지" 주석이 있다. 단, `ENCRYPTION_KEY` 값이 낮은 엔트로피를 가지므로 e2e 환경에서도 실제 고객 데이터가 처리되는 경우 위험하다. e2e는 ephemeral 환경이므로 현재 수준에서 허용 가능하나, CI 파이프라인에서 시크릿 스캐너(예: truffleHog, gitleaks)를 실행 중이라면 이 파일을 예외 목록으로 명시적으로 관리할 것.

---

### **[INFO]** LLM_STUB_MODE 환경변수 검사가 `=== 'true'` 문자열 비교에 의존

- 위치: `codebase/backend/src/modules/llm/llm.service.ts` line 265
- 상세: `process.env.LLM_STUB_MODE === 'true'` 비교는 env 값이 정확히 소문자 `'true'`일 때만 활성화된다. `'True'`, `'TRUE'`, `'1'` 등의 값은 stub을 활성화하지 못해 의도치 않게 실제 LLM 호출 경로로 분기될 수 있다. 반대로 타 env 변수와의 일관성 측면에서는 현재 패턴이 `OAUTH_STUB_MODE`와 동일하므로 기존 관행과 맞는다.
- 제안: 동작에 문제는 없으나 `process.env.LLM_STUB_MODE?.toLowerCase() === 'true'` 또는 헬퍼 함수로 정규화하면 오설정 위험이 줄어든다. 낮은 우선순위.

---

### **[INFO]** StubLlmClient의 echo 응답에 사용자 입력이 200자 truncation 후 포함

- 위치: `codebase/backend/src/modules/llm/clients/stub.client.ts` line 61
- 상세: `chat()` 메서드가 마지막 user 메시지를 최대 200자로 잘라 `` `[stub] received: ${echo}` `` 형태로 응답한다. 이 stub은 테스트 전용이며 프로덕션 경로에서는 활성화되지 않는다. `.slice(0, 200)` 제한이 있으므로 대용량 입력에 의한 메모리 폭주 위험은 없다. 다만 stub 응답이 WebSocket 등을 통해 클라이언트로 emit 되는 경우, `[stub]` 접두어가 프론트엔드에서 그대로 렌더링되어 XSS 위험이 있는지 확인이 필요하다. 사용자 메시지 내용이 포함되므로 렌더링 경로에서 HTML 이스케이프가 보장되어야 한다.
- 제안: 테스트 전용이지만 emit 경로에서의 출력 인코딩이 프로덕션 LLM 응답과 동일하게 처리되는지 확인할 것. 구조상 테스트 환경 전용이므로 현재 위험도는 낮다.

---

### **[INFO]** 에러 메시지 sanitize 유틸(`sanitizeLlmErrorMessage`) 적용 일관성 — 변경 범위 내 확인

- 위치: `codebase/backend/src/modules/llm/llm.service.ts` `testConnection()`, `listModels()`
- 상세: 에러 메시지를 외부로 반환하는 두 메서드(`testConnection`, `listModels`)에서 `sanitizeLlmErrorMessage`를 적용하고 있다. 새로 추가된 stub 분기는 `createClient`에서만 발생하고 에러를 외부로 노출하지 않으므로 sanitize 누락 위험 없음.
- 제안: 특별한 조치 불필요. 현재 패턴 유지.

---

## 요약

이번 변경에서 실질적인 신규 보안 취약점은 도입되지 않았다. 주요 변경 사항인 `StubLlmClient`와 `LLM_STUB_MODE` 환경변수 게이트는 `OAUTH_STUB_MODE`와 동일한 선례를 따르는 테스트 전용 패턴으로, 프로덕션 경로에서 활성화되지 않도록 적절히 격리되어 있다. 단, e2e 테스트가 JWT 시크릿을 직접 알고 interaction 토큰을 mint 하는 설계는 운영 코드의 토큰 검증 강도(발급 기록 대조 여부)에 따라 잠재적 위조 위험으로 이어질 수 있어 운영 코드 측 검토를 권고한다. docker-compose.e2e.yml에 평문 하드코딩된 시크릿들은 명시적으로 "테스트 전용"임이 문서화되어 있으나, 낮은 엔트로피의 ENCRYPTION_KEY와 JWT_SECRET이 리포지토리에 공개되어 있으므로 시크릿 스캐너 예외 관리가 필요하다.

## 위험도

LOW
