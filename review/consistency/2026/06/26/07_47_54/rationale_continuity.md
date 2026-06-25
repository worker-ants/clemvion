# Rationale 연속성 검토 — 03 M-1 OAuth Install Dedup

검토 모드: 구현 착수 전 (--impl-prep)
대상 scope: `integration-oauth.service.ts` `handleInstall`(cafe24) · `handleMakeshopInstall` 의 identical 보일러플레이트 4종(timestamp ±5min 가드·nonce replay 가드·post-install navigation redirect·reauthorize state 생성/save)을 private helper 로 추출(behavior-preserving)

---

## 발견사항

### 발견사항 없음 (INFO 2건)

- **[INFO]** HMAC 빌더 격리 — spec 이미 주입 분리 패턴을 요구
  - target 위치: scope 기술의 "HMAC 검증(빌더 buildHmacMessage/buildMakeshopHmacMessage 이미 분리)…각 메서드에 유지"
  - 과거 결정 출처: `spec/4-nodes/4-integration/5-makeshop.md §9.7` "HMAC 메시지 구성은 makeshop 공식 문서 미확정분으로 코드에 `VERIFY` 마킹"; `plan/in-progress/refactor/03-maintainability.md M-1 Option A` "makeshop HMAC 빌더는 `VERIFY` 미확정이므로 반드시 주입 함수로 격리 — cafe24 식 메시지 구성(raw-encoded 보존)을 makeshop 에 강제하지 말 것"
  - 상세: scope 는 `buildHmacMessage`/`buildMakeshopHmacMessage` 빌더가 이미 분리돼 있고 각 메서드에 유지한다고 명시한다. 이는 plan M-1 Option A 의 "빌더를 주입 함수로 격리" 요건과 일치한다. 두 빌더가 공통 helper 내부에서 합쳐지지 않는 한 invariant 충돌 없음.
  - 제안: 구현 시 공통 helper 시그니처가 `hmacMessageBuilder: (rawQuery: string) => string` 형태의 파라미터를 받도록 하고, cafe24/makeshop 측에서 각 빌더를 그대로 주입하는지 코드 리뷰에서 확인. helper 가 내부에서 빌더를 직접 import 해 선택하면 이 invariant 가 깨진다.

- **[INFO]** `OAuthState.mode='reauthorize'` 재사용 — 기존 Rationale 의 "동일 처리 분기" 판단과 정합
  - target 위치: scope 기술의 "reauthorize state 생성/save"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md ## Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유"` — "callback 의 처리 분기가 동일(integration row UPDATE)이고 §10.2 step 4 가 이미 reauthorize 를 '기존 integrationId 의 credentials 갱신'으로 정의하고 있어 enum 확장으로 얻는 이득이 없다"
  - 상세: helper 로 추출하는 4종 중 "reauthorize state 생성/save" 는 현재 양쪽 메서드가 모두 `mode: 'reauthorize'` 로 state 를 저장한다. 공통 helper 가 이 패턴을 그대로 흡수해도 기존 Rationale 결정을 번복하지 않는다.
  - 제안: 보완 불요. 단 helper 추출 후 makeshop 의 PKCE verifier(`code_verifier`) 저장이 `providerMeta` 로만 전달되는 경로가 공통 helper 에서 누락되지 않도록 주의.

---

## 요약

Rationale 연속성 관점에서 본 scope(03 M-1)는 기존 spec Rationale 과 충돌하는 결정을 도입하지 않는다. 핵심 Rationale 결정 4개 — (1) error-codes.md §2 "rename = breaking, prefix 유지"; (2) `cafe24.md §9.8` HMAC raw-encoded 보존; (3) `makeshop.md §9.7` HMAC 빌더 `VERIFY` 미확정·격리 의무; (4) `integration.md Rationale` OAuthState.mode='reauthorize' 재사용 — 을 scope 기술이 명시적으로 준수("에러코드 prefix 유지", "빌더 이미 분리·각 메서드에 유지", "reauthorize state 생성/save")한다. plan M-1 Option A 가 명시한 "HMAC 빌더를 주입 함수로 격리" 원칙은 helper 시그니처 설계 시 byte-매칭 회귀를 막는 invariant 로 구현 단계에서 재확인해야 하나, scope 자체가 이를 위반하지는 않는다. 중대 충돌 없음.

---

## 위험도

NONE
