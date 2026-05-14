관련 Rationale 발췌와 target 문서를 분석합니다.

---

## 발견사항

### [WARNING] `CAFE24_INSTALL_INVALID_TOKEN(404)` 보안 전제 — "토큰 길이 단축" 예시가 기존 Rationale 에 직접 명시되어 있음

- **target 위치**: spec-draft 하단 Rationale 신규 entry — `CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 재검토` 단락
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` Rationale — `CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)`

  > "**이 전제가 깨지면** (예: 토큰 길이 단축, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다."

- **상세**: 기존 Rationale 는 "토큰 길이 단축"을 **보안 전제 붕괴 예시**로 명시적으로 열거하고, 그 경우 404→403 재통합을 의무로 규정했다. Target 문서는 128-bit 는 여전히 추측 불가능하다는 논거(NIST SP 800-63B, OWASP 128-bit 권장)로 전제가 유지된다고 재해석하며 404 정책을 그대로 유지한다.

  논거 자체는 충분하고 번복 의도도 명확하나, **기존 spec 본문의 해당 Rationale 항목이 갱신되지 않으면** 이후 독자는 "길이 단축 = 403 재통합"이라는 오래된 문장과 새 결정 사이에서 충돌한다. Target spec-draft 의 Rationale 항목은 `plan` 문서 안에만 존재하며, 실제 spec 파일(`spec/2-navigation/4-integration.md`)의 기존 "이 전제가 깨지면 …" 문장을 직접 수정하는 내용이 영향받는 spec 파일 변경 목록에 포함되어 있지 않다.

- **제안**:
  - `spec/2-navigation/4-integration.md` 의 `CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제` Rationale 항목을 함께 갱신해야 한다.
  - 기존 "예: 토큰 길이 단축" 문구를 "예: 96-bit(12바이트) 미만으로의 단축, PRNG 변경, install_token 노출 사고"로 한정하고, 128-bit 감축은 전제 유지 근거와 함께 inline 설명으로 추가한다.
  - 이 갱신은 target 의 `spec/2-navigation/4-integration.md` 변경 섹션의 Rationale 신규 entry 에 해당 항목 업데이트를 명시적으로 포함시킴으로써 완결된다.

---

### [INFO] `spec/1-data-model.md` Rationale — "install_token 을 App URL path 식별 키로 승격" 항목의 32바이트 표현

- **target 위치**: spec-draft `spec/1-data-model.md` Line 253 변경 내역
- **과거 결정 출처**: `spec/2-navigation/4-integration.md` Rationale — `install_token 을 App URL path 식별 키로 승격 (2026-05-14)`

  > "토큰 자체가 **32바이트 random** 이므로 추측 불가능한 식별자 역할도 겸한다"

- **상세**: 해당 Rationale 항목도 "32바이트"를 명시한다. 이 항목의 값이 바뀌었으므로 해당 항목에 "(2026-05-15: 16바이트 base64url 22자로 변경 — 보안 동등성은 `CAFE24_INSTALL_INVALID_TOKEN` 항 참조)" 한 줄 각주를 추가하면 미래 독자의 혼란이 없다. 필수 차단 사항은 아니나 일관성 측면에서 보완을 권장한다.

- **제안**: `spec/2-navigation/4-integration.md` 의 해당 Rationale 항목 말미에 위 각주를 추가하거나, spec-draft 의 변경 내역 목록에 이 항목도 포함시킨다.

---

## 요약

Target 문서는 기존 Rationale 에서 명시적으로 거부되거나 합의된 설계 불변식을 **직접 위반하지 않는다**. 가장 중요한 보안 전제(`CAFE24_INSTALL_INVALID_TOKEN(404)`) 충돌도 target 내부에서 인지하고 논거를 제공하고 있다. 다만 기존 spec 본문의 Rationale 항목("예: 토큰 길이 단축 → 403 재통합")이 갱신 대상 파일 목록에 누락되어 있어, 실제 spec 에 반영되면 기존 문장과 새 결정 사이의 텍스트 충돌이 남는다. 이 항목을 spec 변경 범위에 포함시켜 기존 "이 전제가 깨지면" 조건을 96-bit 미만으로 한정하는 문구로 갱신하면 연속성 문제는 완전히 해소된다.

## 위험도

**LOW** — Critical 위배 없음. Warning 1건은 spec 본문 내 Rationale 텍스트 갱신 누락으로, 구현 블로커가 아닌 문서 일관성 문제다.