# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-nonce-key-design.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-28

---

## 발견사항

발견된 CRITICAL / WARNING 이슈 없음.

### [INFO] 충돌 허용 명문화 — 보안 invariant 참조 누락

- **target 위치**: 변경안 A (Nonce cache 보호 note 보강), Rationale 두 번째 항
- **과거 결정 출처**: `spec/2-navigation/4-integration.md ## Rationale` — "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제 (2026-05-14)" 항
- **상세**: 기존 Rationale 에는 install_token 의 보안 전제로 "**이 전제가 깨지면** (예: 96-bit(12바이트) 미만으로의 토큰 길이 단축, PRNG 변경, install_token 노출 사고) 다시 403 으로 통합해야 한다" 라는 invariant 가 명시되어 있다. 이 항목은 install_token 자체의 capability-token 가정에 대한 것이고, target 의 nonce 키 `hmac[:8]` prefix 설계는 install_token 의 bit 수와 무관한 별도 설계다. 그러나 target 의 변경안 A 는 "충돌해도 보안 영향 없이 (드물게) 정상 재시도가 replay 로 거절될 뿐이다" 라고 충돌 시 부작용을 기술하면서, 이 부작용이 위 보안 invariant 에서 다루는 capability-token 가정 또는 HMAC 검증의 cryptographic strength 와 아무 관계가 없다는 점을 명시하지 않는다. 독자가 "hmac prefix 를 8자로 줄이면 96-bit 미만 토큰 길이 단축과 유사한 보안 약화 아닌가?" 라는 혼동을 할 여지가 남는다.
- **제안**: 변경안 A 의 충돌 설명 뒤에 "(이 충돌은 nonce Redis 키의 고유성에 관한 것이며, install_token 의 capability-token 가정 및 HMAC cryptographic strength 와 독립적이다)" 같은 한 문장을 추가하거나, target 의 Rationale 에 "기존 보안 invariant (`CAFE24_INSTALL_INVALID_TOKEN(404)` 보안 전제) 와 독립" 임을 명시하면 독자 혼동을 원천 차단할 수 있다.

---

## 요약

target 문서는 기존 spec 의 어떤 Rationale 에서도 명시적으로 기각된 대안을 재도입하거나 합의된 원칙을 위반하지 않는다. 변경 내용은 코드 inline 주석에 이미 존재하는 설계(`hmac[:8]` prefix, 48bit, 충돌 무시 근거)를 spec 으로 승격하는 순수 additive 명문화이며, spec §9.8 의 Nonce cache 보호 note 와 "관련 코드 상수" 표 확장에 그친다. 기존 HMAC 검증 알고리즘·install_token capability-token invariant·DB Enum 비확장 원칙 등 어떤 합의 원칙도 번복하지 않는다. 다만 충돌 발생 시 부작용("정상 재시도가 replay 로 거절")이 기존 보안 invariant(install_token 96-bit 이상 전제)와 독립임을 spec 본문에 명시하지 않아, 이 두 가지를 혼동할 여지가 소폭 남는다. 이는 명확성 보완 수준의 INFO 사항이며 차단 요인이 아니다.

---

## 위험도

LOW
