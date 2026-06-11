# 보안(Security) 리뷰

리뷰 대상: `prod-fail-closed-guards` 브랜치 — production fail-closed 가드 응집 (`assertProductionConfig`) spec 반영

---

## 발견사항

### **[WARNING]** `ENCRYPTION_KEY` 단일 키 다도메인 재사용 — 키 격리 부재

- **위치**: `spec/conventions/secret-store.md §3.3`, 파일 19
- **상세**: `ENCRYPTION_KEY` 가 LLM API 키 암호화(`crypto.util.ts`)와 secret store 전체 암호화 두 용도에 **동일 마스터키**를 재사용한다. spec 본문에 "재사용 근거"로 명시돼 있으나, 키 노출 시 두 도메인이 동시에 손상된다는 위험은 여전히 존재한다. `auth-config-webhook-followups.md`에도 "ENCRYPTION_KEY 다도메인 재사용 위험. 중기 도메인별 키 분리 또는 HKDF 파생 검토 메모"가 미착수 후속으로 남아 있는 상태다. fail-closed 가드가 추가됐지만 근본적인 키 격리 문제는 해소되지 않았다.
- **제안**: 단기적으로 HKDF 파생(`HKDF(ENCRYPTION_KEY, 'llm-api-key-domain')` / `HKDF(ENCRYPTION_KEY, 'secret-store-domain')`)으로 도메인 분리를 구현하거나, `ENCRYPTION_KEY_SECRET_STORE` 별도 env를 도입해 도메인별 키 격리를 진행한다. `auth-config-webhook-followups.md` 후속 항목으로 연결돼 있음을 확인.

---

### **[WARNING]** `INTERACTION_JWT_SECRET` — production 가드가 `assertProductionConfig` 밖에 단독 존재

- **위치**: `spec/5-system/14-external-interaction-api.md §7.2`(파일 17), `spec/5-system/1-auth.md §Rationale`(파일 15)
- **상세**: `JWT_SECRET`·`ENCRYPTION_KEY`·`MCP_ALLOW_INSECURE_URL`·`OAUTH_STUB`·`LLM_STUB`는 `assertProductionConfig` 단일 블록으로 응집됐으나, `INTERACTION_JWT_SECRET`만 `InteractionTokenService` 생성자 throw로 별도 분리된다. 이 경우 `assertProductionConfig`를 유일한 진입점으로 신뢰하는 코드 리뷰어·새 기여자가 `INTERACTION_JWT_SECRET`의 production 가드 존재를 인지하지 못할 수 있다. 특히 `InteractionTokenService`가 조건부로 생성되지 않는 경로(예: lazy initialization, 테스트 mock DI 등)가 생길 경우 해당 가드가 조용히 우회될 위험이 있다.
- **제안**: `assertProductionConfig` 내부에서 `INTERACTION_JWT_SECRET`의 존재·길이를 추가로 검증하거나, 생성자 throw와 `assertProductionConfig` 양쪽에서 이중 검증한다. 최소한 `production-guards.ts` 파일 헤더 주석에 "INTERACTION_JWT_SECRET은 InteractionTokenService 생성자에서 별도 보증 — 이 파일의 목록만으로는 production 가드 전체가 아님"을 명시해야 한다.

---

### **[WARNING]** `ALLOW_PRIVATE_HOST_TARGETS` production warn-only — SSRF 완화 제거 위험

- **위치**: `spec/5-system/11-mcp-client.md §3.2`(파일 16), `spec/5-system/1-auth.md §Rationale`(파일 15)
- **상세**: `MCP_ALLOW_INSECURE_URL=true`는 production에서 throw(부팅 거부)하지만, 동일 SSRF 표면인 `ALLOW_PRIVATE_HOST_TARGETS=true`는 throw가 아닌 **warn-only**(경고 로그만 남기고 부팅 진행)로 분류된다. `ALLOW_PRIVATE_HOST_TARGETS`가 production에서 활성화된 채 배포되면 loopback·RFC 1918·cloud metadata 엔드포인트(169.254.169.254 AWS IMDSv1 등)로의 SSRF가 실제로 가능해진다. 경고 로그가 누락되거나 로그 모니터링이 미비하면 이 플래그가 production에서 조용히 켜진 상태를 탐지하지 못한다.
- **제안**: `ALLOW_PRIVATE_HOST_TARGETS`에 대해서도 production에서 throw로 격상하거나, 최소한 SSRF가 실제로 성공했음을 나타내는 **요청 레벨 경고**(단순 부팅 시 warn이 아닌 매 요청 warn)로 강화한다. 만약 정당한 self-host 사용 사례를 위해 warn-only를 유지해야 한다면 `spec/4-nodes/4-integration/1-http-request.md §4`에 production에서의 SSRF 위험과 warn-only 정책을 명시해 운영자가 인지할 수 있도록 해야 한다(현재 해당 spec에 미기술).

---

### **[INFO]** `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 목록 하드코딩 — 목록 완결성 유지 의무

- **위치**: `spec/conventions/secret-store.md §R5`(파일 19), `codebase/backend/src/common/config/production-guards.ts`(naming_collision.md 참조)
- **상세**: `assertProductionConfig`가 공개 예시 키("all-zero", "옛 0123…")를 블랙리스트(`KNOWN_EXAMPLE_ENCRYPTION_KEYS`)로 관리한다. 이 블랙리스트는 수동으로만 갱신된다. 과거에 `.env.example`에 등재됐다가 교체된 예시 키가 모두 목록에 있는지 보장할 수 없으며, 미래에 `.env.example`을 업데이트할 때 블랙리스트 갱신을 누락할 위험이 있다. CWE-798(하드코딩 자격증명) 범주와 유사한 구조적 취약점이다.
- **제안**: `.env.example`과 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 목록 간 일치를 CI에서 자동 검증한다(예: `.env.example`에서 `ENCRYPTION_KEY=` 값을 파싱해 블랙리스트에 존재하는지 단위 테스트로 확인). 또는 블랙리스트 방식 대신 `ENCRYPTION_KEY`가 all-zero 패턴(`/^0+$/`)이나 반복 바이트 패턴을 정규식으로 탐지하는 방식으로 전환해 새 placeholder 형식에 자동 대응한다.

---

### **[INFO]** `MIN_JWT_SECRET_LENGTH` 기준 — 32자 vs NIST 권고

- **위치**: `spec/5-system/1-auth.md §Rationale`(파일 15), `production-guards.ts`(naming_collision.md)
- **상세**: `JWT_SECRET`의 최소 길이 기준이 32자(256 bit)로 설정됐다. HMAC-SHA256 서명에서 256 bit 키는 수학적으로 충분하지만, 실제 비밀번호나 랜덤 문자열 형태로 입력될 경우 엔트로피가 훨씬 낮을 수 있다(특히 사람이 입력한 passphrase는 문자 집합에 따라 실제 엔트로피가 128 bit 미만일 수 있다). 현재 spec은 길이만 검사하고 엔트로피 요건을 명시하지 않는다.
- **제안**: spec에 `JWT_SECRET`이 `openssl rand -base64 32` 또는 동급 CSPRNG 출력이어야 함을 명시한다. 길이 외에 반복 패턴(예: `aaaa...`) 탐지도 `production-guards.ts`에 추가하거나, 생성 방법을 운영 가이드에 강제화한다.

---

### **[INFO]** `iext_*` 토큰 — query parameter 전달 경로 SSE 한정 명시

- **위치**: `spec/5-system/14-external-interaction-api.md §7.2`(파일 17)
- **상세**: "토큰을 query parameter로 받는 것은 SSE 한정(`?token=`; EventSource가 헤더 미지원)"이라고 명시돼 있다. SSE를 통한 토큰 전달 시 토큰이 서버 액세스 로그, 브라우저 히스토리, Referer 헤더에 노출될 수 있다. spec에서 이 위험을 인지하고 SSE 한정임을 제한하는 것은 적절하나, 로그 마스킹 정책이 명시적으로 기술되지 않았다.
- **제안**: `iext_*` SSE 토큰이 포함된 URL에 대해 서버 액세스 로그에서 `?token=` 파라미터를 마스킹하거나 제외하는 정책을 spec 또는 구현 주석에 명시한다.

---

### **[INFO]** 에러 메시지 문자열 폐기 — 테스트 의존 잠재 위험

- **위치**: `spec/5-system/7-llm-client.md §7.1`(파일 18)
- **상세**: 기존 throw 메시지 문자열 `"not allowed when NODE_ENV=production"`이 `assertProductionConfig`로 통합되면서 폐기됐다. 만약 기존 에러 메시지 문자열을 기반으로 작성된 통합 테스트, 운영 알람 패턴, 또는 클라이언트 에러 파싱 로직이 있다면 silent 실패가 발생한다. rationale_continuity 검토(파일 14, INFO-2)에서도 동일한 우려를 기록했다.
- **제안**: `production-guards.ts`의 실제 throw 메시지를 `production-guards.spec.ts`에서 명시적으로 assert하고, 에러 메시지 변경 시 테스트가 깨지도록 보장한다. 기존 메시지에 의존하는 코드·테스트를 전수 grep하여 확인한다.

---

## 요약

이번 변경은 production 부팅 시점에 핵심 시크릿·플래그를 검증하는 `assertProductionConfig` 함수로 가드를 응집하고 spec에 명문화한 것으로, **보안 방향성 자체는 올바르다**. 기존에 산재한 가드를 단일 함수로 응집해 누락 위험을 구조적으로 줄이고, 예시 키 복붙 운영 사고를 차단하는 이중 방어를 도입한 점은 긍정적이다. 다만 보안 관점에서 세 가지 주의 사항이 있다. 첫째, `INTERACTION_JWT_SECRET`이 `assertProductionConfig` 범위 밖에 분리돼 있어 향후 DI 경로 변경 시 가드가 우회될 가능성이 있다. 둘째, `ALLOW_PRIVATE_HOST_TARGETS`의 production warn-only 처리가 SSRF 위험을 남기며 관련 spec(`http-request.md`)에 이 사실이 미기술돼 운영자 인지가 불가하다. 셋째, `ENCRYPTION_KEY`의 다도메인 재사용은 키 노출 시 피해 범위를 확대하는 구조적 취약점으로 후속 작업이 필요하다. 하드코딩된 시크릿·SQL 인젝션·XSS·커맨드 인젝션 등 전통적 취약점은 이번 변경 범위에서 발견되지 않았다.

## 위험도

MEDIUM

STATUS: OK
