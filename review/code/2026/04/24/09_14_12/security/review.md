리뷰 대상 파일이 코드 리뷰 산출물(`.md`)이므로, 각 라운드에서 식별된 보안 이슈의 정확성·완전성·해결 상태를 보안 전문가 관점에서 교차 검증합니다.

---

## 발견사항

### **[WARNING] SSRF 방어 분석의 `local` 프로바이더 위험 과소평가**
- **위치**: `2026-04-24_08-11-00/architecture/review.md`, `requirement/review.md`
- **상세**: 여러 리뷰어가 `local` 프로바이더의 SSRF 가드 전면 우회를 지적했으나, 위험도 표현이 "의도적 설계" 수준으로 완화되어 있음. `editor` 권한만 가진 사용자가 `provider: 'local'`, `baseUrl: 'http://169.254.169.254/latest/meta-data/'` 조합으로 클라우드 인스턴스 메타데이터를 자유롭게 조회할 수 있는 구조임. AWS/GCP 배포 환경에서는 이 경로가 IAM 자격증명 탈취로 이어질 수 있어 실제 위험도는 MEDIUM이 아닌 HIGH에 가까움.
- **제안**: `local` 프로바이더에 대해서도 `localhost`, `127.0.0.0/8`, `::1`만 허용하는 명시적 allowlist를 적용하고, 링크로컬(`169.254.x.x`) 접근을 별도 차단할 것. 현행 "의도적 허용" 판정을 재검토 필요.

---

### **[WARNING] `0.0.0.0` 차단 누락이 모든 라운드에서 조치 없이 잔존**
- **위치**: `2026-04-24_08-11-00/security/review.md` → `2026-04-24_08-16-06/security/review.md`
- **상세**: 1라운드에서 `0.0.0.0` 미차단을 명확히 식별(`a === 0` 조건 추가 권고)했으나, 2·3라운드 리뷰에서 이 항목의 조치 여부가 추적되지 않음. Linux 커널에서 `0.0.0.0`은 모든 인터페이스에 바인딩된 소켓으로 해석되어 실질적인 loopback 접근이 가능함. RESOLUTION.md에 W 항목으로 등록되었는지 확인 불가.
- **제안**: `isPrivateHost()` 함수에 `if (a === 0 && b === 0 && c === 0 && d === 0) return true;` 조건 추가 및 RESOLUTION.md 추적 항목 명시.

---

### **[WARNING] IPv6 사설 대역 차단 누락이 3개 라운드 모두에서 반복 지적됨에도 미해결**
- **위치**: `2026-04-24_08-11-00/security`, `2026-04-24_08-16-06/requirement/review.md`
- **상세**: `fc00::/7`(ULA), `fe80::/10`(link-local), `::ffff:10.0.0.1`(IPv4-mapped IPv6) 미차단이 매 라운드 지적되었으나 조치 여부가 확인되지 않음. `http://[fc00::1]/` 형태의 URL이 DTO `@IsUrl()` 검증을 통과하는지도 검증 케이스 부재.
- **제안**: `isPrivateHost()`에 IPv6 사설 prefix 검사 추가. DTO spec 파일에 `baseUrl: 'http://[fc00::1]/'` 거부 케이스 추가.

---

### **[WARNING] Google SDK 스트림 타입 캐스팅 — 보안 관련 런타임 실패 무음 처리**
- **위치**: `2026-04-24_08-11-00/dependency/review.md` CRITICAL 항목
- **상세**: `generateContentStream()` 반환값을 `as AsyncIterable<unknown>`으로 강제 캐스팅하고 청크를 다시 익명 인라인 타입으로 재캐스팅. 이 구조에서 실제 청크 형태가 예상과 다를 경우 에러 없이 `undefined`/`null`이 파이프라인을 통과함. 보안 관점에서 sanitize나 에러 처리 로직이 우회될 수 있음. dependency 리뷰에서 CRITICAL로 분류했으나 SUMMARY.md에서 위험도 집계 시 희석되었을 가능성 있음.
- **제안**: `@google/genai` SDK의 올바른 제네릭 타입 사용 또는 최소한 타입 가드(`hasProperty`, `isChunkShape`) 추가로 런타임 형태 검증 확보.

---

### **[INFO] Factory 에러 메시지 `sanitizeErrorMessage()` 우회 경로 — 추적 공백**
- **위치**: `2026-04-24_08-11-00/security/review.md` INFO 항목
- **상세**: `LLMClientFactory.create()` 에러가 sanitize를 거치지 않고 `LLM_CONFIG_INVALID` 코드와 함께 클라이언트에 반환됨. "apiKey를 포함하지 않는다"는 주석 보장이 팩토리 구현 변경 시 깨질 수 있음. 이후 라운드에서 이 경로가 테스트로 커버되는지 미확인.
- **제안**: 팩토리 에러도 `sanitizeErrorMessage()`를 통과시키거나, 팩토리 에러 메시지에 API 키·내부 경로가 포함되지 않음을 단위 테스트로 보장.

---

### **[INFO] Rate Limit 키 생성 방식 — IP vs. 사용자 ID**
- **위치**: `2026-04-24_08-11-00/security/review.md`
- **상세**: `@Throttle(10/60s)` 적용이 확인되나 NestJS throttler의 기본 키가 IP 기반인 경우 NAT 환경에서 다수 사용자가 버킷을 공유하고, 반대로 동일 IP에서 다계정 공격이 가능함. 이후 라운드에서 사용자 ID 기반 키 전환 여부 미확인.
- **제안**: JWT 사용자 ID 기반 throttler 키 설정 확인. `listModels`(`GET :id/models`)에도 동일 Rate Limit 적용 여부 검토.

---

### **[INFO] 테스트 파일 내 `sk-xxx` 패턴 — CI 시크릿 스캔 부재**
- **위치**: `2026-04-24_08-11-00/security/review.md`, `2026-04-24_08-16-06/security/review.md`
- **상세**: 두 라운드 모두 더미 값임을 확인했으나 gitleaks 등 CI 시크릿 스캔 추가를 권고. 3라운드에서도 동일 패턴이 신규 파일에 등장하며 조치 미확인.
- **제안**: CI 파이프라인에 `sk-[a-zA-Z0-9]{20,}` 패턴 스캔 룰 추가.

---

## 요약

3개 라운드에 걸친 리뷰에서 `POST /api/llm-configs/preview-models` 엔드포인트의 핵심 보안 요건(에러 sanitize, Rate Limit, 30초 타임아웃, AbortSignal, editor 권한 제한, API Key 미영속화)은 충실히 구현된 것으로 확인된다. 그러나 SSRF 방어의 세 가지 구체적 취약점 — `local` 프로바이더의 인프라 접근 허용(링크로컬 포함), `0.0.0.0` 미차단, IPv6 사설 대역 전면 미처리 — 이 매 라운드 지적되면서도 조치 완료가 검증되지 않고 있다. 특히 클라우드 배포 환경에서 `local` 프로바이더로 `169.254.169.254`를 조회하는 경로는 IAM 자격증명 탈취로 이어질 수 있어 현재 MEDIUM 판정보다 실제 위험이 높다. Google SDK 타입 캐스팅 공백은 보안 관련 에러 처리 로직이 무음 우회될 수 있는 경로를 남긴다.

## 위험도

**MEDIUM** — SSRF 방어의 `local` 프로바이더 예외와 IPv6·`0.0.0.0` 미차단이 조치 여부 미검증 상태로 잔존. 클라우드 환경 배포 시 링크로컬 메타데이터 엔드포인트 접근 가능성으로 HIGH 근접.