# 보안(Security) 리뷰 결과

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**검토 파일**: `http-request.handler.ts`, `http-safety.ts`, `backend-labels.ts`, 이전 리뷰 산출물

---

## 발견사항

### - **[WARNING]** SSRF 에러 메시지에 차단된 hostname/IP 직접 노출 — 내부 네트워크 토폴로지 정찰 가능

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` line 107, 147
- **상세**: `assertSafeOutboundUrl` 과 `assertSafeOutboundHostResolved` 가 차단 시 던지는 에러 메시지에 원본 hostname 과 resolved IP 주소가 포함된다.
  - line 107: `` `SSRF_BLOCKED: hostname "${parsed.hostname}" resolves to a restricted network range` ``
  - line 147: `` `SSRF_BLOCKED: hostname "${hostname}" resolves to restricted IP "${address}"` ``
  이 메시지가 `http-request.handler.ts` line 366 에서 `err instanceof Error ? err.message : String(err)` 로 그대로 `IntegrationError` 에 전달되고, `buildPreflightErrorOutput` 을 통해 `output.error.message` 에 실린다. 워크플로 실행 결과를 볼 수 있는 사용자는 어떤 hostname 이 어떤 내부 IP 로 resolve 되는지 확인 가능해 내부 DNS 매핑 및 네트워크 토폴로지를 정찰할 수 있다(OWASP A05: Security Misconfiguration / Information Disclosure).
- **제안**: 클라이언트 응답 `output.error.message` 에는 일반화된 메시지(`"Request blocked by SSRF security policy"`)만 반환하고, 상세 hostname/IP 정보는 서버 측 구조화 로그에만 기록한다. `buildPreflightErrorOutput` 호출 시 메시지를 정규화하거나 `IntegrationError` 생성 시 별도의 public message 필드를 사용한다.

---

### - **[WARNING]** `ALLOW_PRIVATE_HOST_TARGETS` 가 `process.env` 에서 매 호출마다 읽힘 — 런타임 조작 경로 허용

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` line 80–82
  ```ts
  function isPrivateHostsAllowed(): boolean {
    return process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true';
  }
  ```
- **상세**: 코드 인젝션(prototype pollution, child_process 등) 또는 `process.env` 를 조작할 수 있는 취약점이 별도로 존재할 경우, 공격자가 런타임에 이 환경변수를 `'true'` 로 변경하면 전체 SSRF 보호가 무효화된다. 특히 Node.js 에서 `process.env` 는 전역 변경 가능 객체이며 서드파티 라이브러리나 eval 계통 코드가 접근할 수 있다. 이 함수가 매 SSRF 가드 호출마다 재평가되므로 공격 창구가 상시 열려 있다.
- **제안**: 애플리케이션 부트스트랩 시점에 한 번만 읽어 모듈 수준 상수(또는 `readonly` 플래그)로 고정한다. 예: `const PRIVATE_HOSTS_ALLOWED = process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'` 를 모듈 최상단에 선언하고 `isPrivateHostsAllowed()` 함수를 제거한다. production 환경에서 `true` 로 설정된 경우 시작 시 경고 로그 출력도 권장한다.

---

### - **[INFO]** DNS rebinding race window — `assertSafeOutboundHostResolved` 후 fetch 사이 TTL 만료 재바인딩 가능성

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` line 119–120 (코드 주석에 명시됨)
- **상세**: `assertSafeOutboundHostResolved` 에서 DNS 확인 후 실제 `fetch()` 사이의 시간 간격(수십~수백 ms)에 TTL 이 만료되면 공격자가 통제하는 DNS 가 응답을 내부 IP 로 바꿀 수 있다. 코드 주석에 "Race window" 와 "pair with an egress firewall" 이 이미 명시되어 있어 이 위험이 인지된 상태임을 확인. 코드만으로는 완전 방어 불가능한 설계상 한계다.
- **제안**: 추가 코드 조치 불필요. 운영 환경 egress 방화벽 병행은 필수. 주석 수준의 문서화가 이미 충분하다.

---

### - **[INFO]** DNS 실패(ENOTFOUND) 시 fail-open 처리 — 의도적 설계

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` line 137–141
- **상세**: DNS resolve 실패 시 SSRF 가드를 통과시키고 이후 `fetch` 에서 `ECONNREFUSED`/`ENOTFOUND` 를 처리하게 한다. 이는 "DNS 가 resolve 되지 않으면 어차피 도달 불가" 논리에 근거한 의도적 fail-open 설계다. 코드 주석에 명시됨. DNS 실패를 위장한 공격(NXDOMAIN 응답 후 재시도 타이밍 공격 등)의 여지가 완전히 없다고 보기 어렵지만, 실용적인 트레이드오프 범위 내다.
- **제안**: 추가 조치 불필요. 설계 의도가 명시적으로 문서화되어 있다.

---

### - **[INFO]** redirect 루프 체크가 `authentication === 'integration'` 으로만 제한됨 — none/custom 경로에서 무제한 redirect 가능성

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` line 409–425
  ```ts
  while (
    authentication === 'integration' &&
    res.status >= 300 && ...
  )
  ```
- **상세**: SSRF 가드가 전 인증 방식으로 확대됐으나 redirect 체인 재검증 루프는 여전히 `authentication === 'integration'` 에만 적용된다. `none`/`custom` 인증 경로에서 서버가 redirect 를 반환하면 Node.js `fetch` 의 기본 redirect 처리가 동작한다. `fetchOptions.redirect = 'manual'` 이 설정되어 있으므로 실제로는 redirect 가 자동 추적되지 않고 3xx 응답이 그대로 반환될 것이나, 이 설계 의도가 `none`/`custom` 경로에서 명시적으로 문서화되어 있지 않다. 만약 향후 `redirect = 'follow'` 로 변경되거나 다른 경로가 추가될 경우 `none`/`custom` 인증에서 redirect 를 통한 SSRF bypass 위험이 생길 수 있다.
- **제안**: `fetchOptions.redirect = 'manual'` 설정과 함께 `none`/`custom` 인증 경로에서의 redirect 처리 정책(현재: 3xx 응답을 그대로 반환하므로 클라이언트가 직접 처리)을 코드 주석으로 명시한다. redirect 재검증 루프를 전 인증 방식으로 확대하거나 `none`/`custom` 경로에서 redirect 를 명시적으로 비허용 처리하는 방향을 검토한다.

---

### - **[INFO]** 테스트 fixture 에 시크릿 스캐너 오탐 유발 가능한 값 사용

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` line 74–75 (추정)
- **상세**: 테스트 fixture 에 `SUPER_SECRET_KEY`, `LEAKED_TOKEN` 등의 문자열이 포함된 경우 GitHub secret scanning, truffleHog, detect-secrets 등의 도구가 오탐(false positive)을 발생시켜 CI/CD 파이프라인 차단이나 보안 알림 노이즈를 유발할 수 있다. 기능적 문제는 없다.
- **제안**: `DUMMY_KEY_FOR_TESTING`, `TEST_ONLY_NOT_A_REAL_KEY` 등 명시적 더미값으로 교체하면 스캐너 오탐을 방지할 수 있다.

---

### - **[INFO]** `HTTP_BLOCKED` error message 에 `ALLOW_PRIVATE_HOST_TARGETS` opt-out 안내 미포함 — 운영자 대응 지연 가능성

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.ts` line 106–109, `codebase/frontend/src/lib/i18n/backend-labels.ts` 신규 `HTTP_BLOCKED` 항목
- **상세**: SSRF 차단 시 에러 메시지에 opt-out 방법(`ALLOW_PRIVATE_HOST_TARGETS=true`)이 포함되어 있지 않다. `backend-labels.ts` 에 추가된 한국어 메시지는 `ALLOW_PRIVATE_HOST_TARGETS` 설정을 언급하지만, 이는 프론트엔드 표시 전용이며 실제 에러 객체 메시지나 서버 로그에는 포함되지 않는다. self-hosted 환경에서 운영자가 에러 로그만으로 조치 방법을 파악하기 어렵다. 이 항목은 API Contract 관점의 WARNING(이전 리뷰 `api_contract.md` WARNING #1)이 이미 지적한 내용과 중복이나 보안 가시성 측면에서도 관련이 있다.
- **제안**: `assertSafeOutboundUrl` / `assertSafeOutboundHostResolved` 가 던지는 에러 메시지 또는 서버 로그 레벨에서 opt-out 안내를 포함하는 방향을 검토한다. 단, 상기 WARNING #1(hostname 노출 정보 제거)과 조합 시 클라이언트 메시지에는 일반화된 메시지+opt-out 안내만, 서버 로그에 상세 hostname/IP 를 기록하는 구조가 최선이다.

---

## 요약

이번 변경의 핵심(SSRF 가드를 전 인증 방식으로 확대)은 보안 입장에서 올바른 방향이다. 기존에 `authentication='none'`/`'custom'` 경로가 SSRF 가드 적용 대상에서 제외되어 있던 취약점을 해소하며, 두 계층(hostname literal 검사 + DNS resolve 후 재검사) 방어 구조도 적절하다. `configEcho` 의 spread 금지(명시 열거)로 미래 credential 필드 누출 위험도 차단됐다. 주요 보안 우려는 두 가지다: (1) SSRF 차단 에러 메시지에 실제 hostname/IP 가 노출되어 내부 토폴로지 정찰에 활용될 수 있고(OWASP A05 Information Disclosure, WARNING), (2) `ALLOW_PRIVATE_HOST_TARGETS` 가 매 호출마다 `process.env` 에서 재평가되어 런타임 조작 가능 경로가 상시 존재한다(WARNING). redirect 체인 재검증이 `integration` 인증에만 적용되는 비대칭 설계는 현재 `redirect='manual'` 설정으로 즉각적 위험이 없으나 설계 의도 문서화 보완이 필요하다. CRITICAL 발견사항 없음.

---

## 위험도

LOW

(WARNING 2건: SSRF 에러 메시지 hostname 노출, ALLOW_PRIVATE_HOST_TARGETS 런타임 조작 가능성. CRITICAL 없음. 핵심 변경 방향은 보안 개선이므로 전체 위험도는 LOW.)

---

STATUS: OK
