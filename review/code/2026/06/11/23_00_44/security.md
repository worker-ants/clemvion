# 보안(Security) 코드 리뷰

**대상**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**검토일**: 2026-06-11
**핵심 변경 파일**:
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
- `codebase/backend/src/nodes/integration/http-request/http-safety.ts`
- `codebase/backend/src/nodes/core/error-codes.ts`

---

## 발견사항

### **[INFO]** SSRF 가드 전 인증 방식 확장 — 핵심 보안 개선

- 위치: `http-request.handler.ts` line 346 (diff 기준 263 번째 변경 라인)
- 상세: 기존 `if (authentication === 'integration')` 게이트를 제거해 SSRF 가드가 `none`/`custom`/`integration` 전 인증 방식에 공통 적용된다. 이전에는 `authentication=none` 으로 `169.254.169.254`(AWS IMDS), `10.x.x.x`, `192.168.x.x` 등 클라우드 메타데이터 엔드포인트·내부망을 직접 호출할 수 있었다. 이번 변경이 해당 취약점(OWASP A10: SSRF)을 수정한다.
- 제안: 없음. 변경 방향이 올바르다.

---

### **[INFO]** 두 계층 SSRF 방어 — DNS rebinding 대응 확인

- 위치: `http-safety.ts` 전체 (`assertSafeOutboundUrl` + `assertSafeOutboundHostResolved`)
- 상세: (1) 리터럴 hostname 검사(동기) → (2) DNS resolve 후 IP 재검사(비동기) 2단계 방어가 구현되어 있다. RFC 1918, loopback(127/8), link-local(169.254/16), CGNAT(100.64/10), IPv6 loopback/link-local/unique-local 을 모두 커버한다. `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 도 두 계층 모두에서 일관되게 적용(`isPrivateHostsAllowed()` 공통 호출)된다.
- 주의: `assertSafeOutboundHostResolved` 는 DNS lookup 실패(ENOTFOUND) 시 **fail-open** 처리한다(line 141 `return`). 이는 "DNS 가 resolve 되지 않으면 호스트에 도달 불가" 논리로 정당화되어 있으나, 향후 변경 시 이 fail-open 이 의도적임을 인지해야 한다. 현재 구현에서 공격자가 이를 우회하려면 DNS lookup 을 실패시키는 동시에 fetch 는 성공시켜야 하는데, 이는 일반적으로 불가능해 수용 가능한 tradeoff 다.
- 제안: 없음. 현재 설계가 합리적이다. 단, 코드 주석에 fail-open 이 의도적임이 이미 명시되어 있어 미래 기여자의 오인 가능성은 낮다.

---

### **[INFO]** DNS rebinding race window — 잔존 위험 인지

- 위치: `http-safety.ts` line 119–120 주석
- 상세: `assertSafeOutboundHostResolved` 체크 이후 실제 `fetch` 사이에 DNS TTL 만료 + 재바인딩 공격이 가능한 race window 가 존재한다. 코드 주석이 이를 "egress firewall 병행 권장" 으로 명시하고 있다. 애플리케이션 레이어 단독으로 DNS rebinding 을 완전히 차단하기는 어려우며, 운영 환경에서 egress 방화벽을 병행해야 완전한 방어가 된다.
- 제안: 이미 코드 주석에 적시되어 있으므로 현재 코드 관점에서 추가 조치 불필요. 운영 배포 문서·PR 본문에 "egress 방화벽 병행 권장" 을 명시하면 운영자 인지율을 높일 수 있다.

---

### **[INFO]** config echo — credential 누출 방지 (Principle 7 D1 적용)

- 위치: `http-request.handler.ts` line 164–177 (diff 기준)
- 상세: `{ ...rawConfig }` spread 에서 명시 필드 열거 방식으로 전환했다. 미래에 credential-shaped 필드(`apiKey`, `secret`, `password` 등)가 rawConfig 에 추가되더라도 config echo 에 자동 포함되지 않는다. 테스트(`http-request.handler.spec.ts` line 63–88)에서 `apiKey`/`authToken` 필드가 echo 에 나타나지 않음을 검증한다. 이는 정보 노출(OWASP A02) 위험을 구조적으로 차단하는 올바른 설계다.
- 제안: 없음.

---

### **[WARNING]** `ALLOW_PRIVATE_HOST_TARGETS` — process.env 직접 참조, 런타임 조작 가능

- 위치: `http-safety.ts` line 81 (`process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'`)
- 상세: `isPrivateHostsAllowed()` 는 매 호출마다 `process.env` 를 직접 읽는다. Node.js 환경에서 `process.env` 는 런타임에 코드로 변경 가능(`process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true'`)하다. 테스트 코드(`http-request.handler.spec.ts` line 141)에서도 이 패턴을 사용한다. 이는 **프로덕션 코드에서 보안 바이패스가 코드 주입 경로를 통해 런타임에 활성화될 수 있음**을 의미한다. 실제 위험은 코드 주입이 선행해야 하지만, 한번 활성화되면 모든 SSRF 보호가 무효화된다.
- 제안: (A) 애플리케이션 시작 시 한 번만 읽어 상수화(`const ALLOW_PRIVATE_HOSTS = process.env.ALLOW_PRIVATE_HOST_TARGETS === 'true'`)하거나, (B) `assertProductionConfig` 에서 production 환경에서 이 플래그가 `true` 일 때 경고 로그를 남기는 동작(spec §5-system/1-auth.md 기술)이 이미 존재한다면 충분할 수 있다. production warn 동작이 이미 구현되어 있다면 현재 수준으로 수용 가능하다.

---

### **[WARNING]** SSRF 에러 메시지에 hostname 노출

- 위치: `http-safety.ts` line 107, 147
- 상세: SSRF 차단 시 에러 메시지에 차단된 hostname/IP 가 포함된다(`SSRF_BLOCKED: hostname "169.254.169.254" resolves to a restricted network range`). 이 메시지는 `buildPreflightErrorOutput` 을 통해 `output.error.message` 로 surfaced 된다. 공격자가 이를 이용해 내부 네트워크 토폴로지를 정찰(internal IP 확인)하는데 활용할 수 있다(정보 노출, OWASP A02).
- 제안: hostname 을 에러 메시지에서 제거하거나, 서버 측 로그에만 기록하고 클라이언트(output 포트)에는 "SSRF_BLOCKED: target host is not allowed" 와 같은 일반화된 메시지를 반환하는 방안을 검토한다. 다만 노드 기반 시스템에서 에러 메시지가 워크플로 작성자(내부 사용자)에게만 노출된다면 실질적 위험은 낮다. 외부 최종 사용자에게 노출될 경우 반드시 수정이 필요하다.

---

### **[INFO]** `HTTP_BLOCKED` 에러 코드 enum 등재 — inline string 에서 enum 전환 권장

- 위치: `error-codes.ts` diff (신규 `HTTP_BLOCKED` 추가됨)
- 상세: `error-codes.ts` diff 에 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 가 추가되어 있다. 이로써 inline string literal 사용이 type-safe 한 enum 참조로 교체될 수 있는 기반이 마련됐다. 핸들러 내부(`http-request.handler.ts`)에서 `'HTTP_BLOCKED'` inline string 을 `ErrorCode.HTTP_BLOCKED` 로 전환하면 오타로 인한 잘못된 에러 코드 surfacing 을 컴파일 타임에 차단할 수 있다.
- 제안: 핸들러 내 `new IntegrationError('HTTP_BLOCKED', ...)` 를 `new IntegrationError(ErrorCode.HTTP_BLOCKED, ...)` 로 교체한다. 보안 관점의 critical 사안은 아니나, 방어적 코딩 관점에서 권장한다.

---

### **[INFO]** 테스트에서 실제 credential 값 사용 (`SUPER_SECRET_KEY`, `LEAKED_TOKEN`)

- 위치: `http-request.handler.spec.ts` line 74–75
- 상세: 테스트 코드에서 `apiKey: 'SUPER_SECRET_KEY'`, `authToken: 'LEAKED_TOKEN'` 을 픽스처로 사용한다. 이 값들은 명백한 테스트용 더미 값이며 실제 시크릿이 아니므로 문제없다. 다만 CI 로그·코드 리뷰·스캐닝 도구가 이를 실제 credential 로 오탐할 가능성이 있다. 시크릿 스캐너가 이 패턴을 화이트리스트에 등록해두지 않으면 노이즈가 발생할 수 있다.
- 제안: 문제없는 수준이나 `SUPER_SECRET_KEY` 대신 `DUMMY_KEY_FOR_TESTING` 등 명시적으로 테스트용임을 나타내는 픽스처 값을 사용하면 오탐 가능성을 줄일 수 있다.

---

### **[INFO]** `ALLOW_PRIVATE_HOST_TARGETS` opt-out 테스트 — env 복원 로직

- 위치: `http-request.handler.spec.ts` line 141–167
- 상세: `try/finally` 블록으로 테스트 후 env 를 복원하는 패턴이 올바르게 구현되어 있다. `prev === undefined` 인 경우 `delete` 로 처리하고, 그렇지 않으면 원래 값으로 복원한다. 병렬 테스트 실행 환경에서는 동일 env 변수를 동시에 변경하면 race condition 이 발생할 수 있다. Jest 기본 설정(worker isolation)에서는 문제없으나, `--runInBand` 또는 다른 SSRF 테스트와 병렬 실행 시 주의가 필요하다.
- 제안: 현재 구현으로 수용 가능하다. 테스트 격리 문제가 발생하면 `jest.isolateModules` 또는 별도 describe scope 로 격리하는 것을 고려한다.

---

## 요약

이번 변경의 핵심은 SSRF 가드 적용 범위를 `authentication=integration` 에서 전 인증 방식으로 확장한 것으로, 보안 관점에서 명확한 개선이다. `authentication=none`/`custom` 으로 클라우드 IMDS(169.254.169.254), RFC 1918 사설망, loopback 에 직접 접근하던 취약점(OWASP A10: SSRF)이 차단된다. 두 계층 방어(리터럴 hostname 체크 + DNS resolve 후 IP 재검사)로 DNS rebinding 공격도 대응하며, config echo 의 spread 금지(Principle 7 D1)로 미래 credential 필드 자동 노출도 구조적으로 차단한다. 주요 주의 사항은 두 가지다: (1) SSRF 에러 메시지에 차단된 hostname/IP 가 포함되어 있어 내부 토폴로지 정찰에 활용될 수 있으므로, 에러 메시지를 일반화하거나 외부 사용자 노출 경로를 확인해야 한다. (2) `ALLOW_PRIVATE_HOST_TARGETS` 가 `process.env` 에서 매 호출마다 읽혀 런타임 조작 가능성이 있으나, 이미 production 환경에서 warn 처리가 있다면 수용 가능 수준이다. DNS rebinding race window 는 egress 방화벽 병행으로만 완전히 해소 가능하며, 코드 주석에 이미 명시되어 있다.

---

## 위험도

**LOW**

(핵심 변경이 보안 취약점 수정이며, 잔존 위험은 에러 메시지 정보 노출(WARNING 1건) 및 env 직접 참조(Warning 1건) 수준. CRITICAL 없음.)

STATUS: OK
