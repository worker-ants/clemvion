# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### INFO: sanitize 정책 "deny-by-default" 원칙 명시 — Rationale 항목 부재
- **target 위치**: `spec/7-channel-web-chat/4-security.md` §1 보안 정책 요약 테이블, "입력 sanitize" 행
- **과거 결정 출처**: `spec/7-channel-web-chat/4-security.md ## Rationale` — R1·R2·R3 모두 CORS·임베드·rate-limit 관련이며, sanitize 방법론(blacklist vs allowlist)에 대한 기록이 없다.
- **상세**: 변경 전 행은 "마크다운 sanitize, 링크 rel=noopener" 수준이었다. 변경 후는 "deny-by-default 화이트리스트 권장(DOMPurify ALLOWED_TAGS/ALLOWED_ATTR …), 블랙리스트가 아닌 deny-by-default 가 합당"으로 구체화했다. 이는 기존 §1.1 구현 매트릭스의 DOMPurify allowlist 내용과 정합하며, 실제로 `codebase/channel-web-chat/src/lib/safe-html.ts`가 이미 구현하고 있는 방식이다. 기존 Rationale에서 blacklist 방식을 채택했다가 번복한 것이 아니라 미기술 상태에서 처음으로 명시한 것으로 보인다. 그러나 "블랙리스트 아님"을 규범적으로 명시하면서 왜 blacklist를 택하지 않는가에 대한 Rationale 항목이 없다. §1.1 매트릭스에 구현 근거가 있지만 Rationale 절에 원칙 항목이 없어 연속성 기록으로서 불완전하다.
- **제안**: `spec/7-channel-web-chat/4-security.md ## Rationale`에 "R4. sanitize — deny-by-default allowlist (blacklist 기각)" 항목을 추가한다. 내용: 임베드 위젯이 호스트 사이트 DOM에 직접 노출되므로 알려진 위험 태그만 제거하는 blacklist는 미지의 mXSS 벡터(svg/math 등)를 통과시킬 수 있어 기각; deny-by-default ALLOWED_TAGS/ALLOWED_ATTR + ALLOWED_URI_REGEXP로 허용 표면을 최소화하는 allowlist가 임베드 맥락에서 적절. 이는 기존 결정 번복이 아니라 신규 원칙 명시이므로 CRITICAL은 아니나, 이후 동일 정책을 재검토할 때 근거가 필요하다.

---

### INFO: otplib v12→v13 메이저 업그레이드 — spec Rationale에 라이브러리 버전 결정 기록 없음
- **target 위치**: `codebase/backend/package.json`, `codebase/backend/src/modules/auth/totp.service.ts` (구현 변경)
- **과거 결정 출처**: `spec/5-system/1-auth.md ## Rationale` — TOTP 라이브러리 선택에 관한 항목 없음. §1.4.A는 WebAuthn 라이브러리(`@simplewebauthn/server`)만 기록. otplib 버전/API 선택 근거 항목 미존재.
- **상세**: v12의 `authenticator` singleton API(뮤터블 `options` 주입)를 v13의 named exports(`generateSecret`, `generateURI`, `verifySync`)로 교체했다. spec에서 기각된 대안이 없으므로 기각된 결정의 재도입은 아니다. RFC 6238 호환(6자리/30초/Google Authenticator 호환) invariant는 테스트의 RFC 6238 Appendix B 벡터 검증으로 유지가 확인된다. `window:1` → `epochTolerance:30`(±1 step 등가) 명시도 코드 주석에 근거가 있다. 그러나 spec에 "otplib을 사용한다"는 결정 자체가 기록되지 않아, 메이저 업그레이드가 spec Rationale과 무관하게 이루어졌다. 이는 spec-impl 정합성이 아니라 Rationale 완전성 문제다.
- **제안**: `spec/5-system/1-auth.md ## Rationale`에 "TOTP 라이브러리: otplib" 항목(§1.4.A의 WebAuthn과 대칭)을 추가하고, v13 업그레이드 근거(ESM-only 전환, `authenticator` singleton deprecation, RFC 6238 호환 유지 확인)를 기록한다. 구현 변경의 올바름은 이미 테스트로 검증되므로 긴급하지 않으나 향후 버전 재검토 시 근거로 필요하다.

---

## 요약

`spec/7-channel-web-chat/4-security.md`의 단일 행 변경(sanitize 정책의 deny-by-default 명시)은 기존 Rationale에서 명시적으로 기각한 대안을 재도입하거나 합의된 invariant를 위반하지 않는다. §1.1 구현 매트릭스와 일관되며, 이미 구현된 DOMPurify allowlist 방식을 요약 테이블에 반영한 것이다. 다만 "블랙리스트 아님"을 규범적으로 선언하면서 해당 원칙의 Rationale 항목이 없는 점, 그리고 implementation 영역의 otplib 메이저 업그레이드도 spec Rationale에 라이브러리 선택 근거가 미기록인 점이 완전성 보완 사항으로 남는다. 기각된 대안의 재도입, 합의 원칙 위반, invariant 우회에 해당하는 사항은 발견되지 않았다.

## 위험도

LOW
