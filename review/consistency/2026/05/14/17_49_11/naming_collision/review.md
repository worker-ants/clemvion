## 발견사항

---

### [WARNING] `resource_not_found` — status_reason 목록 등재와 §10.4 "변경 불가" 사이의 의미 모순

- **target 신규 식별자**: `status_reason = 'resource_not_found'` (DRAFT 1C `pending_install` 분기, DRAFT 3B §3.2 매핑 표)
- **기존/충돌 사용처**: DRAFT 2G §10.4 갱신 표 — "토큰 발급 후 row 조회 실패 (resource not found)" 케이스: **"변경 불가 (row 가 사라진 케이스. integrationId 만 식별, row 가 없으니 갱신 대상 없음)"**
- **상세**: DRAFT 1C / DRAFT 3B 는 `pending_install` 상태의 `status_reason` 가능 값으로 `resource_not_found` 를 열거한다. 그러나 DRAFT 2G §10.4 는 이 케이스에서 integration row 자체가 소거되어 DB 갱신이 **물리적으로 불가능**하다고 명시한다. row 가 없으면 `status_reason` 필드도 쓸 수 없으므로, `resource_not_found` 는 spec 상 정의되었으나 실제로는 DB 에 절대 기록될 수 없는 dead identifier 가 된다.
- **제안**:
  - (a) DRAFT 1C 와 DRAFT 3B 에서 `resource_not_found` 를 `pending_install` status_reason 목록에서 **제거**하고, §10.4 에서 "row 소거로 갱신 불가" 임을 유일한 정의로 유지
  - (b) 또는 "row 가 사라진 케이스" 가 아닌 "row 는 있지만 참조하는 다른 resource 를 찾을 수 없는 케이스" 라는 별도 시나리오가 실제로 존재한다면, §10.4 설명과 1C/3B 의 의미를 명확히 분리하여 기술

---

### [INFO] `카테고리` 용어 — `Node.category` enum 과 한국어 표기 중복

- **target 신규 식별자**: UI grouping 단위 **"카테고리"** (DRAFT 2H `spec/2-navigation/4-integration.md §14.2` + `spec/4-nodes/4-integration/4-cafe24.md §337` + `spec/conventions/cafe24-api-metadata.md §6` inline note)
- **기존 사용처**: `spec/1-data-model.md §2.6 Node.category` — `logic / flow / ai / integration / data / presentation` enum. 한국어 문맥에서 이 enum 도 "카테고리"로 지칭될 수 있음
- **상세**: 동일한 한국어 단어 "카테고리"가 (a) Cafe24 API Resource 단위 UI grouping (product, order, customer …), (b) Node 시스템의 카테고리 (logic, ai, integration …) 양쪽에 사용된다. DRAFT 2H 의 disambiguation note(`"UI grouping 단위 = 카테고리" vs 백엔드 메타데이터의 "Resource"`)는 Cafe24-내부 혼용만 해소하며, Node.category 와의 구분은 별도 언급이 없다. spec 독자가 맥락 없이 "카테고리" 를 읽을 경우 두 개념 사이에서 혼선이 생길 수 있다.
- **제안**: `cafe24-api-metadata.md §6` disambiguation note 에 "여기서 '카테고리'는 Cafe24 API Resource grouping 을 뜻하며, `Node.category` (logic/ai/integration/…) 와 무관" 한 줄을 추가. 영향 범위가 제한적이므로 기존 DRAFT 방향 유지 가능.

---

### [INFO] `install_timeout` / `token_expiring` / `pending_install_timeout` — 큐 메시지 reason 식별자 신규 도입

- **target 신규 식별자**: DRAFT 3C-bis 큐 메시지 `{ integrationId, reason: 'token_expiring' | 'pending_install_timeout' }` + `status_reason='install_timeout'`
- **기존 사용처**: 없음 (코퍼스 내 미등장)
- **상세**: `install_timeout` (DB status_reason) 과 `pending_install_timeout` (큐 메시지 reason) 이 동일 개념을 서로 다른 식별자로 표기한다. 의도적 분리(DB 저장값 vs 내부 큐 메시지 필드)이지만, 타 개발자가 두 값이 같은 TTL 이벤트를 가리킨다는 것을 별도 추적 없이 알기 어렵다.
- **제안**: DRAFT 3C-bis 큐 메시지 서술에 "reason='pending_install_timeout' 처리 결과가 DB 의 status_reason='install_timeout' 으로 기록된다" 라는 명시적 매핑 주석 추가.

---

### [INFO] `CAFE24_INSTALL_INVALID_TOKEN` vs `CAFE24_INSTALL_INVALID_HMAC` — 명명 일관성 확인

- **target 신규 식별자**: `CAFE24_INSTALL_INVALID_TOKEN` (404, DRAFT 2E / 2F)
- **기존 사용처**: `CAFE24_INSTALL_INVALID_HMAC` (403), `CAFE24_INSTALL_REPLAY` (400)
- **상세**: `CAFE24_INSTALL_` prefix 를 일관되게 사용하며 suffix 가 개별 검증 단계를 명확히 구분한다. 충돌 없음.
- **제안**: 현행 네이밍 유지. 추가 보완 불필요.

---

## 요약

대부분의 신규 식별자는 기존 사용처와 충돌하지 않으며 명명 컨벤션을 준수한다. 가장 주의할 사항은 `resource_not_found` 의 spec-내 자기모순으로, DRAFT 1C/3B 에서 valid status_reason 으로 열거되지만 DRAFT 2G §10.4 에서 해당 케이스에 row 갱신이 불가능하다고 명시하여 이 값이 DB 에 실제로 기록될 수 없는 dead identifier 가 된다. 스펙 적용 전 이 항목의 의미를 단일 정의로 수렴시켜야 한다.

## 위험도

**LOW** (CRITICAL 0 · WARNING 1 · INFO 3)