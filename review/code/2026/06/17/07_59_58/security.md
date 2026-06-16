# 보안(Security) 리뷰 결과

**리뷰 대상**: deps-backlog-residual 브랜치 변경사항
**주요 변경 파일**: `codebase/backend/src/modules/auth/totp.service.ts` (otplib v12→v13 마이그레이션), `codebase/channel-web-chat/src/lib/safe-html.ts` (DOMPurify deny-by-default), `spec/5-system/1-auth.md` (Rationale §1.4.J, §1.4.K 추가), `spec/1-data-model.md` (two_factor_secret 표기 갱신), `spec/7-channel-web-chat/4-security.md` (§1.1 sanitize 매트릭스 추가), `review/consistency/**` (일관성 검토 산출물)

---

## 발견사항

### [INFO] 복구 코드 SHA-256 단순 해시 — KDF 미채택 (설계 결정 확인)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/backend/src/modules/auth/totp.service.ts` line 27-29, `spec/5-system/1-auth.md §1.4.K`
- **상세**: 복구 코드를 SHA-256 단순 해시(`createHash('sha256').update(code).digest('hex')`)로 저장한다. spec §1.4.K 가 `randomBytes(9)`(72비트 엔트로피) 고엔트로피 일회성 시크릿에는 KDF 의 느린-해시·솔트가 실익이 없고 2^50+ 탐색 공간은 GPU 로도 비현실적이라는 엔트로피 분석을 명문화했다. OWASP 복구 코드 가이드 정합. 해당 결정이 spec Rationale 에 기록됐으므로 의도된 설계임이 명확하다.
- **제안**: 조치 불필요. 단, 코드 포맷을 `xxxx-xxxx-xxxx` 12문자(소문자 영숫자)로 고정할 경우 실제 엔트로피는 `randomBytes(9)` 72비트보다 낮다 — `base64url(9 bytes)` 에서 `.slice(0,12)` 한 결과는 약 71비트(base64url charset log₂(64)×12 = 72비트에 근접하나 slicing bias 미미). 현 수준은 OWASP 권고(약 64비트 이상) 대비 충분하며 보완 불필요.

### [INFO] TOTP verifyCode 에러 로깅 — 타입명만 기록 (보안 긍정 확인)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/backend/src/modules/auth/totp.service.ts` line 53-58
- **상세**: otplib 내부 에러 발생 시 `(err as Error).name`(예: `SecretTooShortError`)만 로깅하고 메시지·스택·secret 값은 기록하지 않는다. OWASP A09(보안 로깅 및 모니터링 실패) 관점에서 민감 정보 로그 노출이 없는 올바른 구현이다.
- **제안**: 조치 불필요.

### [INFO] DOMPurify ALLOWED_URI_REGEXP — scheme 허용 표면 점검
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/channel-web-chat/src/lib/safe-html.ts` line 34-35
- **상세**: `ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i` 는 `javascript:`, `data:`, `vbscript:` 등 위험 scheme 을 차단하면서 `https:`/`http:`/`mailto:` 와 relative URL(앵커 포함)을 허용한다. 정규식 두 번째·세 번째 대안(`[^a-z]`·`[a-z+.-]+(?:[^a-z+.:-]|$)`)은 scheme 문자 규칙상 숫자/슬래시로 시작하는 relative URL(`/path`, `#anchor`, `./rel`) 및 프로토콜 없는 일부 URL 을 허용하는 의도이다. DOMPurify 공식 예시 패턴과 유사한 형태로 잘 알려진 패턴이며, 고위험 scheme 차단 효과가 확인된다.
- **제안**: 조치 불필요. `tel:` 및 `sms:` scheme 이 제외된 것은 주석에 명시됐으며 의도적이다.

### [INFO] DOMPurify afterSanitizeAttributes 훅 — 전역 상태 모듈 레벨 누적 방어
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/channel-web-chat/src/lib/safe-html.ts` line 37-51
- **상세**: `hookInstalled` Boolean 가드로 `DOMPurify.addHook` 중복 호출을 방지한다. 중복 훅이 누적되면 동일 속성을 여러 번 덮어쓰는 부작용이 발생할 수 있으나 보안 저하는 아니다. `_resetHookForTest()` 를 `@internal` 로 명시해 프로덕션 코드에서의 오용을 주석으로 차단했다.
- **제안**: 조치 불필요.

### [INFO] marked.parse async:false 가드 — 미래 API 변경 대비
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/codebase/channel-web-chat/src/lib/safe-html.ts` line 80-84
- **상세**: `marked.parse` 가 Promise 를 반환할 경우를 방어해 `null` 폴백으로 처리한다. Promise 가 DOMPurify 에 전달되면 `[object Promise]` 문자열이 그대로 렌더될 수 있었는데, 이를 명시적으로 차단했다. 안전한 방어 코드다.
- **제안**: 조치 불필요.

### [INFO] spec/5-system/1-auth.md §1.4.K — ai-review 의 KDF 제안 언급
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/deps-backlog-residual/spec/5-system/1-auth.md §1.4.K`
- **상세**: "(참고) ai-review 가 KDF 전환을 제안했으나(LOW/즉각 수정 불필요), 위 엔트로피 분석으로 **현행 SHA-256 유지**가 정설" 이라는 문구가 spec 에 포함됐다. 결정 근거가 명확하고 엔트로피 분석이 타당하다. 보안 리뷰 관점에서도 KDF 미채택이 취약점으로 간주되지 않음을 확인한다.
- **제안**: 조치 불필요. 단, spec 에 "ai-review 가 제안했으나" 라는 내부 추적 표현은 장기적으로 "(고엔트로피 일회성 코드에 KDF 의 느린-해시가 실익이 없다는 분석으로 기각)" 형태의 의사결정 언어로 정리하면 가독성이 높아지나 보안 이슈는 아니다.

---

## 요약

이번 변경은 TOTP 라이브러리를 otplib v12(2021년 이후 stale)에서 v13(현행 활성·`@noble/hashes`·`@scure/base` 기반)으로 마이그레이션하고, 웹챗 위젯에 DOMPurify deny-by-default allowlist XSS 방어를 명문화·구현한 것이다. 보안 관점에서 긍정적으로 평가되는 항목은 다음과 같다: (1) RFC 6238 cross-version 호환성이 단위 테스트로 보장되어 기존 사용자 2FA 락아웃 위험이 없다, (2) TOTP 에러 핸들러가 민감 정보(secret·에러 메시지)를 로그에 노출하지 않는다, (3) DOMPurify ALLOWED_TAGS/ALLOWED_ATTR/ALLOWED_URI_REGEXP 의 deny-by-default 패턴이 임베드 위젯의 XSS 호스트 전파 위협을 강건하게 차단한다, (4) 복구 코드 SHA-256 단순 해시가 OWASP 고엔트로피 코드 가이드와 정합하며 spec Rationale 에 근거가 기록됐다. CRITICAL(즉시 차단) 또는 WARNING(조치 권장) 수준의 보안 취약점은 발견되지 않았다.

---

## 위험도

NONE
