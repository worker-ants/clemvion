## 보안 리뷰 결과

대상 파일은 모두 spec/review 문서(Markdown)이므로, **설계 결정의 보안 함의**를 중심으로 분석합니다.

---

### 발견사항

---

**[WARNING] `CAFE24_INSTALL_INVALID_TOKEN (404)` 분리 — 의도적 정보 노출 역전**

- 위치: `spec/2-navigation/4-integration.md §9.2`, `rationale_continuity/review.md` (17-58-37, 18-15-41)
- 상세: 기존 설계는 "pending row 미발견"과 "HMAC 불일치"를 동일 403으로 합산해 공격자가 유효한 `install_token`의 존재 여부를 판단하지 못하게 막았다. 새 설계는 404(token 없음) / 403(HMAC 불일치)으로 분리하여 응답 코드만으로 token 존재 여부를 확인하는 **오라클**이 생긴다. Rationale은 "32바이트 256비트 brute-force 불가"를 근거로 드나, 이 분리는 아래 조건이 깨질 경우 token 열거를 가능하게 한다:
  - install 엔드포인트에 **rate limiting이 없을 때**
  - 향후 token 길이 단축 또는 PRNG 변경 시
  - SSRF/log injection 등으로 token이 유출됐을 때 확인 수단으로 악용
- 제안: (a) `GET /api/integrations/oauth/install/cafe24/:installToken` 엔드포인트에 **IP 기반 rate limiting** 구현을 구현 spec에 명시한다. (b) Rationale에 "이 endpoint에 rate limiting 이 있는 것을 전제로 분리한다" 한 줄을 추가해 구현 의존성을 명확히 한다. (c) 분리가 부담스러우면 기존처럼 token 미존재도 403으로 통합하는 것이 방어적으로 더 안전하다.

---

**[WARNING] `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 중복 검사 — TOCTOU Race Condition**

- 위치: `spec/2-navigation/4-integration.md §9.2`, `rationale_continuity/review.md` (17-58-37)
- 상세: `mall_id`가 암호화 JSONB에 있어 DB UNIQUE 인덱스 불가 → 앱 레벨 중복 검사 채택. 이는 전형적인 **TOCTOU(Time-of-Check Time-of-Use)** 취약점으로, 동일 사용자의 동시 요청 두 건이 모두 검사를 통과해 중복 Integration을 생성할 수 있다. 특히 FE에서 버튼 연타 방지가 없거나 네트워크 재전송이 발생하면 현실적으로 발생 가능하다.
- 제안: (a) DB 트랜잭션 내에서 SELECT + INSERT를 원자적으로 처리(`INSERT ... WHERE NOT EXISTS` 또는 advisory lock)하거나, (b) `(workspaceId, mall_id, app_type='private', status='connected')` 조합에 DB 수준 partial unique index를 생성하는 방안을 구현 spec에 명시한다. `mall_id`가 암호화 JSONB 내부에 있다면 별도 plain 컬럼으로 추출해 인덱스를 걸거나, 앱 레벨 잠금(Redis distributed lock)으로 보완한다.

---

**[WARNING] `install_token` URL path 노출 — Server/Proxy Log 유출 가능성**

- 위치: `spec/4-nodes/4-integration/4-cafe24.md §9.4`, `spec/2-navigation/4-integration.md §9.2`
- 상세: `GET /api/integrations/oauth/install/cafe24/:installToken` 경로에 install_token이 URL path에 포함된다. 이는 아래 위치에 token이 평문으로 기록됨을 의미한다:
  - Nginx/Apache access log
  - CDN/로드밸런서 액세스 로그
  - `Referer` 헤더 (이 페이지에서 다른 서비스로 리다이렉트 시)
  - 브라우저 히스토리
  Token은 인증 자격으로 기능하므로 log 유출 = token 탈취와 같다.
- 제안: (a) token을 path가 아닌 **query parameter**로 이동(`?t=...`)하면 log에서 redact 설정이 용이하다. (b) 또는 nginx의 `log_format`에서 `installToken` 세그먼트를 마스킹하도록 구현 노트를 spec에 추가한다. (c) token의 단일 사용 처리(callback 성공 즉시 NULL)는 이미 spec에 있어 재사용 위험은 낮지만, TTL 24h 동안은 log 유출이 유효하다.

---

**[INFO] PRNG 품질 미명시**

- 위치: `spec/1-data-model.md §2.10 install_token 컬럼 정의`
- 상세: 명세는 "32바이트 hex"를 명시하지만 생성 방식(`crypto.randomBytes` vs `Math.random()`)을 지정하지 않는다. 구현자가 비암호학적 PRNG를 사용하면 256비트 전제가 무너진다.
- 제안: spec에 "Node.js `crypto.randomBytes(32).toString('hex')` 또는 동등한 CSPRNG 사용"을 명시한다.

---

**[INFO] Timestamp replay 검사 순서 미명시**

- 위치: `spec/4-nodes/4-integration/4-cafe24.md §9.8`
- 상세: HMAC 검증 알고리즘 설명에서 timestamp ±5분 검사와 HMAC 검증의 **순서**가 명시되지 않았다. HMAC 검증은 CPU 비용이 있으므로 timestamp 검사를 먼저 수행해야 DoS 방어가 효과적이다.
- 제안: §9.8 의사코드에 "① timestamp 윈도우 검사 → ② install_token 조회 → ③ HMAC 검증" 순서를 명시한다.

---

**[INFO] `credentials_unreadable` 처리 — 타이밍 공격 위험**

- 위치: `plan_coherence/review.md` (17-49-11), `cross_spec/review.md` (18-23-55)
- 상세: AES-256-GCM 복호화 실패 시 `status_reason='credentials_unreadable'`을 기록하는 경로가 존재한다. 복호화 실패를 나타내는 에러 응답이 정상 경로보다 **일관되게 빠르거나 느리면** 타이밍 사이드채널로 암호화 키 존재 여부나 IV 정합성을 유추할 수 있다.
- 제안: 복호화 실패와 성공 케이스의 응답 시간을 균등하게 처리(constant-time response)하거나, 에러 응답에 일정한 지연을 추가하도록 구현 가이드에 명시한다.

---

### 요약

대상 변경은 코드가 아닌 **spec/review 문서**이며, 보안 설계 결정을 명문화하는 작업이다. 전반적으로 HMAC 검증·replay 방어·암호화 저장 등 핵심 보안 메커니즘의 설계는 합리적이다. 가장 실질적인 위험은 두 가지다: ① `CAFE24_INSTALL_INVALID_TOKEN (404)` 분리로 인한 token 존재 오라클(rate limiting이 구현 보장되지 않으면 열거 가능), ② 앱 레벨 중복 검사의 TOCTOU 경쟁 조건. `install_token`의 URL path 노출은 log 관리 정책에 따라 실제 위협이 달라진다. 이 세 항목을 구현 spec에 명시적으로 대응하면 보안 위험이 낮은 수준으로 수렴된다.

### 위험도

**LOW** (CRITICAL 0 · WARNING 3 · INFO 3)

> 발견된 WARNING은 구현 시점의 결정사항이므로 현재 spec 단계에서 위험이 현실화되지는 않는다. 단, 구현 spec 착수 전에 rate limiting과 TOCTOU 대응 방안을 명시할 것을 권장한다.