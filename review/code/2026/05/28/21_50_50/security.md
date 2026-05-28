# Security Review

## 발견사항

### 파일 1: spec/5-system/1-auth.md

- **[INFO]** Auth Config Reveal 권한 분리 설계는 보안적으로 적절하다.
  - 위치: diff 추가 라인 — 권한 매트릭스 `Auth Config Reveal (평문 노출)` 행
  - 상세: 평문 자격증명 노출(`POST /api/auth-configs/:id/reveal`)을 Admin+ 전용으로 제한하고, Editor/Viewer 에는 마스킹 응답만 허용하며, reveal 액션에 현재 로그인 비밀번호 재확인 및 audit 기록을 요구하는 설계는 최소 권한 원칙(Principle of Least Privilege)과 OWASP ASVS의 민감 데이터 노출 제어 요구를 만족한다.
  - 제안: reveal 엔드포인트의 rate limiting 정책(단기간 다수 reveal 시도 제한)을 spec에 명시할 것을 권장한다. 현재 spec에는 언급이 없다.

- **[INFO]** auth_config.reveal 감사 로그 항목 추가
  - 위치: diff 수정 라인 — 감사 로그 표의 `설정` 행
  - 상세: `auth_config.reveal` 을 별도 audit 이벤트로 명시한 것은 보안 추적성(auditability) 측면에서 긍정적이다. 평문 노출 이벤트가 감사 로그에 남도록 설계되어 있으므로 insider threat 탐지 기반이 마련된다.
  - 제안: reveal 감사 로그에 requester IP와 User-Agent도 포함하도록 schema에 명시 권장.

---

### 파일 2: spec/5-system/12-webhook.md

- **[INFO]** Inline 인증 키 JSONB 잔존 위험 제거 (positive finding)
  - 위치: diff 전반 — `config` 필드 정의 변경, V065 cleanup migration 언급
  - 상세: 기존에 `trigger.config` JSONB에 평문으로 남아 있던 `bearerToken`, `secret` 필드를 cleanup migration(`V065__trigger_config_strip_inline_auth.sql`)으로 제거하고 AuthConfig 도메인의 AES-256-GCM 암호화 저장으로 이관하는 것은 중요한 보안 개선이다. JSONB 컬럼은 DB 백업, 쿼리 로그, ORM 직렬화 과정에서 평문이 유출될 수 있어 이전 설계는 명백한 위험이었다.
  - 제안: 없음. V065 migration이 실제 구현 시 `UPDATE trigger SET config = config - 'authType' - 'secret' - 'bearerToken' - 'hmacHeader' - 'hmacAlgorithm' WHERE type='webhook'` 형태로 완전히 제거하는지 구현 리뷰 시 확인 필요.

- **[WARNING]** `auth_config_id IS NULL` 트리거의 보안 수준 — UUID 단독 의존
  - 위치: WH-SC-01, §4.1 None (공개)
  - 상세: `auth_config_id IS NULL` 인 트리거는 `endpointPath` UUID 하나가 사실상 유일한 비밀 키 역할을 한다. UUID v4의 랜덤성(122 bit)은 brute force에 현실적으로 안전하지만, (1) URL이 HTTP access log / reverse proxy log / referrer header 등에 평문 노출될 수 있고, (2) 한 번 노출된 UUID를 교체하는 수단이 spec에 정의되지 않았다. 이전 inline path에도 동일한 문제가 있었으며 이 변경에서 해소되지 않았다.
  - 제안: 공개 webhook의 `endpointPath` 재발급(regenerate) 기능을 spec에 명시하거나, 공개 webhook 사용에 대한 운영 위험을 경고 문구로 spec에 추가할 것을 권장한다.

- **[INFO]** 타이밍 공격 방지 명시 (positive finding)
  - 위치: §4 인증 방식 서두
  - 상세: `crypto.timingSafeEqual` 기반 상수 시간 비교를 명시한 것은 bearer token / API key / HMAC 비교에서 타이밍 공격(timing attack)을 방어하기 위한 올바른 접근이다.
  - 제안: 없음.

- **[INFO]** 인증 실패 응답 단일화 (positive finding)
  - 위치: WH-SC-04, §4 서두 enumeration 방지 문구
  - 상세: 인증 실패 시 type·이유 무관 단일 `401 AUTH_FAILED` 메시지만 반환하고 세부 정보는 서버 로그에만 남기는 설계는 OWASP A01(접근 제어 실패) / information leakage 방어에 적합하다.
  - 제안: 없음.

- **[INFO]** Basic Auth 검증 명세의 구현 주의 사항
  - 위치: §4.5 Basic Auth — AuthConfig.type=`basic_auth`
  - 상세: `Authorization: Basic base64(username:password)` 디코드 후 비교는 `crypto.timingSafeEqual` 로 처리해야 하며, 디코드 실패(잘못된 base64, `:` 구분자 없음 등) 시 예외가 인증 실패(`AUTH_FAILED`)와 동일하게 처리되어야 한다. Spec에 타이밍 안전 비교 원칙이 명시되어 있으므로 구현이 이를 따르면 문제없지만, Basic Auth의 디코드 오류 경로가 별도로 언급되지 않아 구현 시 누락 가능성이 있다.
  - 제안: §4.5에 "디코드 실패 포함 모든 예외는 `AUTH_FAILED` 로 처리" 를 명시할 것을 권장한다.

- **[INFO]** IP allowlist 우회 시나리오 명확화 필요
  - 위치: WH-SC-09, §7 처리 흐름 step 6d
  - 상세: 클라이언트 IP 추출에 `CF-Connecting-IP` → `X-Forwarded-For` → `req.ip` 우선순위 정책이 인증(auth) spec(§2.3)에는 명시되어 있으나 webhook spec에는 명시되지 않았다. Webhook이 CF 없이 직접 노출될 경우 `X-Forwarded-For` 위조로 IP allowlist를 우회할 수 있다.
  - 제안: webhook spec에 IP 추출 정책을 auth spec §2.3과 동일하게 명시하거나 cross-reference를 추가할 것을 권장한다.

- **[WARNING]** `is_active=false` AuthConfig 처리 순서
  - 위치: §7 처리 흐름 step 6c
  - 상세: step 6c에서 `AuthConfig.is_active === false` 이면 `401 AUTH_FAILED`를 반환한다. 이 응답은 `auth_config_id IS NOT NULL`이지만 비활성 상태임을 유추할 수 있는 단서가 될 수 있으나, 어떤 type인지 / 왜 비활성인지는 노출되지 않으므로 허용 가능하다. 다만, ip_whitelist 검증(step 6d)이 `is_active` 확인(step 6c) 이후에 이루어지는 것이 맞는지 — 비활성 AuthConfig의 ip_whitelist는 평가하지 않아야 한다 — 흐름 순서가 spec과 일치하는지 구현 시 확인 필요.
  - 제안: 처리 흐름에서 `is_active` 확인이 ip_whitelist 및 credential 검증보다 먼저 수행됨을 명시적으로 주석화할 것을 권장한다.

---

### 파일 3: spec/conventions/secret-store.md

- **[INFO]** AuthConfig.config 비대상 명확화 (positive finding)
  - 위치: 신규 추가 blockquote `> 비대상 — AuthConfig.config`
  - 상세: AuthConfig 자격증명이 `secret://` URI scheme의 통합 대상이 아님을 명시함으로써 두 암호화 도메인이 혼동 없이 분리됨을 문서화하였다. 동일 `ENCRYPTION_KEY`를 사용하는 것의 보안 트레이드오프(§3.3 재사용 근거)는 이미 rationale에 설명되어 있다.
  - 제안: 없음.

- **[WARNING]** 동일 `ENCRYPTION_KEY` 재사용 범위 확대
  - 위치: §3.3 마스터키 설명 (기존 내용, 이번 변경으로 AuthConfig도 동일 키 사용 명확화)
  - 상세: `ENCRYPTION_KEY` 가 (1) LLM API key, (2) secret_store, (3) AuthConfig.config credentials 세 곳 모두에 재사용된다. 키 하나가 노출되면 세 도메인의 모든 평문이 노출된다. 이 위험은 기존 설계에서도 존재했으나 이번 변경으로 범위가 AuthConfig까지 명확히 확장되었음이 확인된다.
  - 제안: 단기적으로는 현재 설계가 ops 단순화 이유로 허용 가능하다(rationale R1에 근거). 중기적으로 도메인별 키 분리(`ENCRYPTION_KEY_AUTH_CONFIG`, `ENCRYPTION_KEY_SECRET_STORE` 등) 또는 키 파생(HKDF) 적용을 검토할 것을 권장한다.

---

### 파일 4: spec/data-flow/10-triggers.md

- **[INFO]** fire-and-forget UPDATE의 실패 무시 명시
  - 위치: §2.1 Postgres 표, `auth_config` 검증 성공(write) 행
  - 상세: `last_used_at` 갱신 실패 시 인증 성공 응답 자체는 유지되도록 설계되어 있다. 이는 가용성 우선 선택으로 보안 결정에 영향은 없으나, 갱신 실패가 silent하게 넘어갈 경우 운영 시 사용 추적이 불완전해질 수 있다.
  - 제안: fire-and-forget 실패 시 적어도 warn 레벨 로그를 남기도록 구현 spec에 명시할 것을 권장한다.

- **[INFO]** Mermaid 시퀀스 다이어그램의 응답 코드 정합성 개선
  - 위치: §1.2 Webhook 진입 diff — `200 → 202` 수정
  - 상세: `202 Accepted`로의 수정이 WH-RS-01 스펙과 정합되어 있다. 이전에 `200`으로 잘못 기술된 것은 외부 클라이언트 문서화 오류로 이어질 수 있었다.
  - 제안: 없음.

---

## 요약

이번 변경은 Webhook 인증을 inline JSONB 평문 키 방식에서 AuthConfig 도메인의 AES-256-GCM 암호화 저장으로 일원화하는 아키텍처 개선이며, 보안 관점에서 전반적으로 긍정적이다. 평문 자격증명의 JSONB 잔존 위험 제거(V065 cleanup migration), 상수 시간 비교 명시, 인증 실패 응답 단일화(enumeration 방지), Auth Config Reveal의 Admin+ 제한 및 감사 로그 추가 등 다수의 보안 강화 요소가 포함되어 있다. 주요 우려 사항은 두 가지다: (1) `auth_config_id IS NULL` 공개 webhook에서 UUID 단독 의존 시 URL 노출에 대한 재발급 경로가 spec에 없다는 점, (2) 동일 `ENCRYPTION_KEY`가 세 개의 자격증명 도메인에 재사용되어 키 노출 시 피해 범위가 넓다는 점. 두 사항 모두 기존 설계에서 유래한 것이며 이 PR에서 새로 도입된 것은 아니나, 중기적인 개선 검토가 필요하다. IP allowlist의 클라이언트 IP 추출 정책 cross-reference 누락도 구현 시 타 팀이 위조 IP를 허용하는 실수로 이어질 수 있어 spec 명시를 권장한다.

## 위험도

LOW
