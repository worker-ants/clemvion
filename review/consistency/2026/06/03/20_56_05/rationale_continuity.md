# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
대상 경로: `spec/4-nodes/4-integration/`
검토 문서: 0-common.md / 1-http-request.md / 2-database-query.md / 3-send-email.md / 4-cafe24.md

---

## 발견사항

### [WARNING] database-query §5.8 에서 `INTEGRATION_NOT_FOUND` 를 surface 코드로 열거

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §5.8 (D4) 절, execute() 실패 목록 두 번째 항목
  ```
  - `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / `INTEGRATION_NOT_CONNECTED` / `INTEGRATION_INCOMPLETE`
  ```
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md` §4.2 공통 에러 코드 하단 주석
  > `IntegrationsService.getForExecution → requireEntity` 는 integrationId 가 존재하지 않거나 현재 워크스페이스에 속하지 않을 때 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 throw 한다. 이는 `IntegrationError` 가 아니므로 핸들러 catch 에서 전용 코드로 보존되지 않고 `INTEGRATION_CALL_FAILED` … 로 surface 된다. 즉 별도의 `INTEGRATION_NOT_FOUND` 코드는 현재 코드에 존재하지 않는다.
- **상세**: 0-common.md 는 `INTEGRATION_NOT_FOUND` 가 실제 코드에 없음(NotFoundException → `INTEGRATION_CALL_FAILED` 흡수)을 명시적으로 기록했다. 그런데 database-query §5.8 은 이 코드를 `output.error.code` 로 surface 되는 D4 목록에 포함시켰다. 이는 동일한 이유(NotFoundException ≠ IntegrationError)로 database-query 핸들러에서도 동일하게 `DB_QUERY_FAILED` 또는 그 fallback 으로 흡수될 것이다. 이미 §6.2 Runtime 에러 코드 표에도 `INTEGRATION_*` 범주에 이를 나열하고 있으나, 0-common.md 의 "코드가 존재하지 않는다" 사실과 충돌한다.
  - send-email §5.3 은 이 점을 정확히 캡처해 `INTEGRATION_NOT_FOUND` 를 "현재 error 포트로 노출되지 않는다 (Planned)" 로 구분한다. database-query 는 동일한 처리를 하지 않는다.
- **제안**: database-query §5.8 의 D4 목록에서 `INTEGRATION_NOT_FOUND` 를 제거하거나, send-email §5.3 비고 형식을 차용해 "현재 `INTEGRATION_CALL_FAILED`(또는 DB_QUERY_FAILED)로 흡수 — Planned" 로 구분 명기. 또는 0-common.md 의 해당 주석을 database-query 에서도 각주로 참조.

---

### [WARNING] cafe24 §1 `cursor` 폐기가 "B-3-7, Rationale 참조" 로 참조하나 §9 Rationale 에 해당 항목 없음

- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §1 설정 (config) 테이블, `pagination` 필드 설명
  ```
  `cursor` 는 Cafe24 Admin API 가 일관 지원하지 않아 폐기됨 (B-3-7, Rationale 참조)
  ```
- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` §9 Rationale 섹션 (없음)
- **상세**: §1 본문은 `cursor` 페이지네이션 방식의 폐기를 "B-3-7" 레퍼런스와 "(Rationale 참조)" 로 위임했으나, §9 Rationale 전체(§9.1~§9.11)에 `B-3-7` 항목이 존재하지 않는다. 전체 spec 폴더(`spec/`) 를 검색해도 `B-3-7` 문자열은 해당 §1 단 한 곳에만 나타난다. 따라서 Rationale 를 읽는 독자는 cursor 폐기 이유를 찾을 수 없다 — "결정의 무근거 번복" 패턴에 해당한다. cursor 지원은 이전 pagination 설계에 포함됐다가 폐기된 것으로 추정되나, 근거 기록이 없다.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` §9 에 Rationale 항목 추가:
  ```
  ### B-3-7. cursor 페이지네이션 폐기
  Cafe24 Admin API 는 대부분의 리소스에서 offset/limit 기반 페이지네이션만 지원하며
  cursor 방식을 일관되게 지원하지 않는다. cursor 를 pagination 필드에 두면 실제로
  동작하지 않는 필드가 노출되어 혼란을 야기한다. offset/limit 만으로 통일.
  ```
  또는 §1 의 참조를 구체 Rationale 절로 대체.

---

### [INFO] http-request §5.8 에서 `INTEGRATION_NOT_FOUND` 를 D4 목록에 열거 (0-common 주석과 동일 충돌)

- **target 위치**: `spec/4-nodes/4-integration/1-http-request.md` §5.8, execute() 실패 코드 목록
  ```
  - `INTEGRATION_NOT_FOUND` / `INTEGRATION_TYPE_MISMATCH` / ...
  ```
- **과거 결정 출처**: `spec/4-nodes/4-integration/0-common.md` §4.2 주석 (INTEGRATION_NOT_FOUND 코드 미존재)
- **상세**: database-query 와 동일한 패턴. send-email 은 이를 "현재 미surface (구현 갭)" 로 분리해 표기했으나, http-request §5.8 은 이 분리 없이 surface 코드처럼 열거한다. 0-common 의 invariant(NotFoundException → INTEGRATION_CALL_FAILED 흡수)와 충돌.
- **제안**: http-request §5.8 에도 send-email 비고 패턴을 적용하거나, 0-common §4.2 주석을 cross-reference 로 명시.

---

### [INFO] 0-common.md §6.1 `meta.durationMs` 통일이 "Breaking change" 경고를 포함하나 Rationale 섹션이 없음

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` §6.1 `meta.duration` vs `meta.durationMs` 명명 통일
- **과거 결정 출처**: 없음 (Rationale 섹션 자체가 0-common.md 에 없음)
- **상세**: 0-common.md 에는 `## Rationale` 섹션이 존재하지 않는다. §6.1 의 `meta.durationMs` 통일은 `http_request` 에 대해 Breaking change 를 유발하는 결정임에도 이유·대안 기각 기록이 본문 인라인 한 줄 ("ms 단위가 명시적이다") 외에 없다. 다른 노드 spec (send-email §8, cafe24 §9) 은 Rationale 섹션을 갖는다.
- **제안**: 0-common.md 에 `## Rationale` 섹션을 추가하고, `meta.durationMs` 통일 결정(why not `meta.duration`, why not `meta.elapsedMs` 등 다른 명칭 후보 기각 이유)을 기록. Breaking change 영향 범위(http_request 기존 expression 사용자)도 함께 명시.

---

### [INFO] database-query §4 의 SSRF 차단 에러 코드가 DB 전용 코드 없이 `INTEGRATION_CALL_FAILED` fallback 임을 언급하나 Rationale 부재

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 주석
  > 차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보).
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"
- **상세**: SSRF 차단 코드가 HTTP (`HTTP_BLOCKED`) / Email (`EMAIL_HOST_BLOCKED`) / Database (`INTEGRATION_CALL_FAILED` fallback) 세 노드 간에 비대칭임을 "향후 통일 후보" 로만 언급한다. integration.md Rationale 는 SMTP 에 대한 결정 근거를 설명하나, database query 의 미정의 상태에 대한 명시적 Rationale 는 없다. 구현에서 이 코드를 surface 하려는 개발자가 "의도된 미정의" 와 "구현 미완성" 을 구분하기 어렵다.
- **제안**: database-query 에 Rationale 섹션을 추가하거나, §4 의 해당 주석에 "의도적 미정의 — DB 도메인 전용 SSRF 코드 미신설 이유(예: mapDbError 의 분류 로직 재설계 비용 vs. fallback 허용)" 를 간략히 명기.

---

## 요약

`spec/4-nodes/4-integration/` target 문서들은 전반적으로 합의된 설계 원칙(D4 결정, 5필드 invariant, SSRF 가드 공유 플래그, `meta.durationMs` 통일)을 일관되게 따르고 있어 Rationale 연속성 위반의 CRITICAL 수준 문제는 없다. 주요 문제는 두 가지다. 첫째, 0-common.md §4.2 가 `INTEGRATION_NOT_FOUND` 코드가 현재 코드에 존재하지 않음을 명시적으로 기록했음에도, database-query §5.8 과 http-request §5.8 이 이를 surface 코드처럼 D4 목록에 열거하고 있어 합의된 invariant 와 충돌한다(send-email 은 올바르게 "Planned — 현재 미surface" 로 분리). 둘째, cafe24 §1 의 `cursor` 폐기가 "B-3-7, Rationale 참조" 를 인용하나 §9 Rationale 에 해당 항목이 없어 결정 근거가 추적 불가 상태다. 0-common.md 에 Rationale 섹션이 없는 점도 Breaking change(`meta.durationMs` 통일)를 포함하는 문서로서 보완이 필요하다.

---

## 위험도

LOW

---

STATUS: SUCCESS
