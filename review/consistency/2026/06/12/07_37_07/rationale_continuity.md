# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/4-integration/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-12

---

## 발견사항

- **[WARNING]** `DB_HOST_BLOCKED` 신설 결정에 신규 Rationale 항목 부재
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` — §4 SSRF 가드 callout, §5.3 `output.error.code` 표, §6.2 Runtime 에러코드 표
  - 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md` (origin/main) §4 SSRF 가드 callout
  - 상세: 구 spec은 Database Query SSRF 차단 시 "전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — **향후 통일 후보**)" 라고 명시했다. 이는 Rationale 섹션의 공식 기각 결정이 아니라 구현 현황 + 갭 인식 표기였으나, 해당 상태를 "현재 사실"로 문서화한 엔트리가 존재한다. 신규 spec은 이를 `DB_HOST_BLOCKED` 로 교체하면서 `2-database-query.md` 의 `## Rationale` 섹션에 이 결정을 기록하지 않았다. `HTTP_BLOCKED`(1-http-request §8.2), `EMAIL_HOST_BLOCKED`(3-send-email §8.0), Redis pub/sub 신설(`2-database-query.md ## Rationale`) 등 인접 결정들은 모두 Rationale 항목을 갖고 있어 일관성이 부족하다. 커밋 메시지("사용자 기획 결정=신설")는 결정 사실을 기록하지만 spec 문서 내 Rationale 에는 반영되지 않았다.
  - 제안: `2-database-query.md ## Rationale` 에 `DB_HOST_BLOCKED` 신설 근거 항목을 추가한다. 내용은: (a) 구 코드가 `INTEGRATION_CALL_FAILED` fallback 이었던 이유(전용 코드 미정의), (b) 신설 근거(HTTP·Email과 대칭 달성 + "향후 통일 후보" 해소), (c) 메시지 일반화(host/IP 미포함) 정책의 이유(정찰면 축소)를 포함한다.

- **[INFO]** `spec/2-navigation/4-integration.md` 에러코드 표에 `HTTP_BLOCKED` 추가 — Rationale 부재이나 기존 갭 보강
  - target 위치: `spec/2-navigation/4-integration.md` §4.7 에러코드 vocabulary 표
  - 과거 결정 출처: 해당 없음 (이전에 표에 없었던 항목의 보완 추가)
  - 상세: `HTTP_BLOCKED`는 `1-http-request.md §8.2 Rationale`에 이미 결정 근거가 있고, `4-integration.md` 표는 vocabulary 색인 역할만 한다. 신규 추가는 C-3 (PR #549)에서 이미 spec에 반영된 코드의 cross-spec 표 동기이므로 Rationale 연속성 위반이 아니다.
  - 제안: 특별 조치 불필요. INFO 수준 확인 사항.

- **[INFO]** `spec/5-system/3-error-handling.md` Database 에러코드 목록에 `DB_HOST_BLOCKED` 추가
  - target 위치: `spec/5-system/3-error-handling.md` §1.4 에러코드 카테고리 표 및 §3.2 표
  - 과거 결정 출처: 해당 없음 (기존 DB 카테고리 목록의 확장)
  - 상세: `DB_HOST_BLOCKED` 를 Database 카테고리에 추가하는 것은 `EMAIL_HOST_BLOCKED` 가 Email 카테고리에 이미 있는 패턴과 대칭이다. `3-error-handling.md`는 에러코드를 색인하는 역할이며, 원 결정의 Rationale 귀속은 `2-database-query.md`이다.
  - 제안: 특별 조치 불필요.

---

## 요약

이번 diff는 Database Query 노드의 SSRF 차단 에러코드를 기존 `INTEGRATION_CALL_FAILED` fallback에서 전용 코드 `DB_HOST_BLOCKED`로 교체하는 변경이다. 구 spec은 이를 "향후 통일 후보"로 명시적으로 예고했으므로 기각된 대안의 재도입이나 합의된 invariant 위반은 없다. 그러나 HTTP Request(`§8.2`), Send Email(`§8.0`), Database Query Redis pub/sub(`## Rationale`) 등 인접 결정들이 모두 해당 spec 문서의 Rationale 섹션에 근거를 남긴 패턴과 달리, `DB_HOST_BLOCKED` 신설 결정은 `2-database-query.md ## Rationale`에 항목이 없어 일관성이 결여된 상태다. 커밋 메시지가 결정 사실을 기록하지만 spec SoT에 반영되지 않아 WARNING 수준으로 판정한다. 나머지 변경(integration nav 표 + error-handling 목록 확장)은 INFO 수준의 cross-spec 동기화로 Rationale 연속성 이슈가 없다.

---

## 위험도

LOW
