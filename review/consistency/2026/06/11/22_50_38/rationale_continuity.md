# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/4-integration/1-http-request.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-11

---

## 발견사항

### INFO: `§8.2` 기각 대안 (C) 표기가 현행 코드 주석과 연결되지 않음
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §8.2` — "기각된 대안 (C) 현상 유지 + 'none 은 의도적 무가드' 명문화"
- **과거 결정 출처**: 동일 문서 §8.2 Rationale 자체가 신규 결정이므로 기각 이력은 없음 — 다만 기각 대안 (C) 설명이 "spec 에 근거가 없었다" 고 전제하는데, 이 주장을 뒷받침하는 출처(코드 주석 내용·키워드 검색 증거)가 spec 내부 어디에도 교차 참조되지 않는다.
- **상세**: §8.2 는 "코드 주석은 'none 은 내부 서비스를 정당하게 호출할 수 있다' 고 정당화했으나 어느 spec 에도 근거가 없었고"라고 기재한다. 키워드 검색 0건이라는 사실 주장은 spec 에서 검증이 불가하며, 코드 주석에 근거가 있었는지·없었는지는 구현 파일(`http-request.handler.ts`)의 실제 주석 내용에 달려 있다. spec 단독으로 기각 대안 (C) 의 전제가 자기충족적으로 서술되어 있다.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md §8.2` 에 구현 파일의 해당 주석이 제거됐음을 brief note 로 추가하거나, "코드 SoT 는 `http-request.handler.ts`" 를 cross-ref 로 명시하면 후속 리뷰어가 기각 근거를 독립 검증할 수 있다. 현재로는 spec 내 자기주장에 그친다.

---

### INFO: Usage 로그 분리 처리가 §4.2 표에만 있고 §8.2 에서 중복 기술됨
- **target 위치**: `§4 실행 로직 step 8` 및 `§8.2 Rationale`
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md §4.1` — "Usage 로깅: `integration` 인증일 때만 발생"
- **상세**: §4 step 8 에서 "Usage 로그 `failed` 기록은 `integration` 인증에 한정(§4.2)" 이라고 올바르게 기재하고, §8.2 Rationale 에서도 "Usage 로깅은 종전대로 `integration` 인증에 한정" 이라고 재설명한다. 이 자체는 일관성 위반이 아니나, Rationale 에서 Usage 로그 정책을 재정의하는 인상을 주어 혼란 소지가 있다. 공통 §4.1 의 원칙이 그대로 적용된다는 점을 명시("공통 §4.1 에 따라 — SSRF 차단 라우팅만 전 인증 공통이며 Usage 로그 정책은 변경 없음")하면 중복 설명이 아닌 범위 명확화가 된다.
- **제안**: §8.2 의 해당 문장을 "Usage 로깅은 기존 공통 정책([공통 §4.1])을 그대로 유지한다 — `none`/`custom` 은 활동 로그를 생성하지 않으므로 SSRF 차단의 `error` 포트(`HTTP_BLOCKED`) 라우팅만 전 인증 공통이다."로 표현하면 공통 §4.1 과의 계층 관계가 명확해진다.

---

### INFO: `§8.1 Location 헤더 redaction` Rationale 가 §4 실행 로직 본문에 직접 대응하는 단계 없음
- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md §8.1`
- **과거 결정 출처**: 동일 문서 §5.1 `output.responseHeaders` 필드 설명 — "`Location` (3xx redirect 대상 URL — §8.1) 은 `[REDACTED]`"
- **상세**: §8.1 Rationale 은 `Location` 헤더를 redaction 하는 이유를 `sanitizeUrlCredentials` 와의 대칭으로 설명한다. 이 결정 자체는 §5.1 표와 일관하며 Rationale 기록도 적절하다. 다만 §4 실행 로직에는 응답 헤더 sanitize 단계가 별도 번호로 명시되지 않아(step 10 "응답 파싱" 에 흡수되어 있음), `Location` redaction 이 어느 실행 단계에서 일어나는지를 파악하려면 §5.1 표 → §8.1 → `_base/sanitize-response-headers.util.ts` 경로를 따라야 한다.
- **제안**: §4 step 10 또는 별도 step 에 "응답 헤더 sanitize: `sanitizeResponseHeaders` 적용 — `Authorization`·`Cookie`·`Set-Cookie`·자격증명-shape 헤더·`Location` 은 `[REDACTED]` (§8.1 Rationale, SoT: `_base/sanitize-response-headers.util.ts`)" 를 단 한 줄 추가하면 실행 로직 흐름에서 빠진 단계가 채워진다.

---

## 요약

target 문서 `spec/4-nodes/4-integration/1-http-request.md` 는 핵심 결정인 §8.2 SSRF 가드 전 인증 방식 공통 적용에 대해 명확한 Rationale 을 새로 작성하고, 기각 대안 (B)(C) 를 명시적으로 열거해 Rationale 연속성 원칙을 충실히 따르고 있다. 과거 Rationale 에서 확립된 원칙들 — secure-by-default, `ALLOW_PRIVATE_HOST_TARGETS` 단일 플래그, D4 error-port 라우팅, Integration 노드 전반 posture 통일 — 을 번복하지 않으며 오히려 기존 spec 내 모순(§4 SSRF opt-out callout 과 실 구현 간 불일치)을 해소하는 방향으로 결정이 이루어졌다. 발견된 사항 3건은 모두 INFO 수준으로, 기각된 대안의 재도입이나 합의된 invariant 위반은 없다.

---

## 위험도

NONE
