# 의존성(Dependency) 리뷰 결과

**리뷰 대상**: `codebase/backend/package.json`, `codebase/channel-web-chat/package.json` (및 관련 spec·review 산출물)
**리뷰 일시**: 2026-06-17

---

## 발견사항

### [WARNING] otplib v12 → v13 메이저 업그레이드 — 버전 범위가 `^13.4.1` (caret), 완전 고정 아님
- **위치**: `codebase/backend/package.json` `"otplib": "^13.4.1"`
- **상세**: `^13.4.1` 은 `>=13.4.1 <14.0.0` 범위를 허용한다. otplib v13 은 ESM-only complete rewrite 이며 향후 13.x 패치에서 `epochTolerance` 등 옵션 시맨틱이 변경될 경우 TOTP 허용 오차 동작이 조용히 달라질 수 있다. TOTP 는 보안 크리티컬 경로(사용자 2FA 잠금/개방)이므로 caret 대신 정확한 버전 고정(`"13.4.1"`) 또는 lockfile(package-lock.json) 엄격 운용이 권장된다.
- **제안**: `"otplib": "13.4.1"` 로 정확 고정하거나, CI 에서 `npm ci` (lockfile strict) 를 강제해 transitive drift 를 차단한다. 최소한 v13 내 패치 업그레이드를 수동 검토 게이트로 처리할 것.

---

### [WARNING] otplib v13 transitive 의존성 — `@noble/hashes`, `@scure/base` 가 신규 추가됨 (감사 필요)
- **위치**: `codebase/backend/package-lock.json` (transitive) — `@otplib/plugin-crypto-noble` → `@noble/hashes`, `@otplib/plugin-base32-scure` → `@scure/base`
- **상세**: `@noble/hashes` 와 `@scure/base` 는 Paul Miller 의 audited crypto 라이브러리로 MIT 라이선스이며 보안 감사 이력이 있어 품질 자체는 양호하다. 그러나 v12 대비 새로 추가된 `@noble/*` 계열이 Node.js 내장 `crypto` 모듈 대신 순수 JS crypto 를 구현하므로, 향후 서버사이드 crypto 성능 프로파일이 달라질 수 있다(단위 테스트 기준 통과 여부 외 실운영 부하 미검증). 또한 기존 `thirty-two`, `@otplib/preset-v11`, `@otplib/plugin-crypto` 등 구 패키지가 제거된 점은 의존성 표면 축소 측면에서 긍정적이다.
- **제안**: `npm audit` 출력에서 `@noble/hashes`, `@scure/base` 취약점 클린 여부를 CI 파이프라인에서 명시적으로 확인한다. 신규 transitive dep 도입이므로 최초 머지 후 `npm audit --production` 결과를 plan/complete 에 기록하는 것을 권장.

---

### [INFO] `engines.node >= 24` 추가 — Node 런타임 최소 요건 상향
- **위치**: `codebase/backend/package.json` `"engines": { "node": ">=24" }`
- **상세**: 이번 변경이 `@noble/hashes` 의 `node >= 20.19.0` 요건을 포함한 모든 transitive dep 엔진 요건을 충족하므로 기술적으로 정합하다. 다만 consistency review 가 이미 지적한 대로 `spec/4-nodes/5-data/2-code.md` §Rationale 의 `isolated-vm 6.x (node>=22)` 문구와 표기 불일치가 발생한다. 의존성 관점에서는 추가적인 문제 없음.
- **제안**: 별도 조치 불필요 (consistency review WARNING W-1 에서 이미 처리 대상으로 추적 중).

---

### [INFO] `@types/node` v22 → v24 업그레이드 — devDependency, 런타임 영향 없음
- **위치**: `codebase/backend/package.json`, `codebase/channel-web-chat/package.json` `"@types/node": "^24"`
- **상세**: `@types/node` 는 devDependency 로 번들에 포함되지 않는다. v24 타입 정의는 `engines.node >= 24` 와 정합하며 런타임 동작 변경이 없다. 라이선스(MIT)·취약점 우려 없음.
- **제안**: 없음.

---

### [INFO] `@vitejs/plugin-react` 및 `jsdom` 버전 업 (channel-web-chat)
- **위치**: `codebase/channel-web-chat/package-lock.json` (`@vitejs/plugin-react ^6`, `jsdom ^29`)
- **상세**: 이 변경이 diff 에 명시적으로 포함되지 않았으나 naming_collision 리뷰에서 언급됨. `@vitejs/plugin-react ^6` 은 devDependency, `jsdom ^29` 는 test 환경 의존성으로 번들 크기에 영향 없다. `jsdom 29` 는 MIT 라이선스이며 알려진 고위험 CVE 없음. caret 고정 특성상 patch 드리프트 가능성은 존재하나 test-only 이므로 위험도 낮음.
- **제안**: 없음. 단, `jsdom` 과 `@vitejs/plugin-react` 도 CI `npm audit` 범위에 포함돼 있는지 확인.

---

### [INFO] 내부 의존성 — `codebase/channel-web-chat/src/lib/safe-html.ts` 신규 도입
- **위치**: `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 추가
- **상세**: 이 파일은 `DOMPurify` 와 `marked` 를 래핑하는 내부 유틸리티다. `DOMPurify` 와 `marked` 는 이미 기존 의존성으로 등록돼 있으며 신규 추가가 아니다. 내부 모듈 의존 관계 측면에서 `channel-web-chat` 의 렌더링 레이어가 `safe-html.ts` 를 통해 sanitize 를 집중화한 것은 단일 책임 원칙 측면에서 적절하다.
- **제안**: 없음.

---

### [INFO] 제거된 의존성 — otplib v12 번들 (의존성 표면 감소)
- **위치**: `codebase/backend/package.json` / `package-lock.json`
- **상세**: `@otplib/plugin-crypto`, `@otplib/plugin-thirty-two`, `@otplib/preset-default`, `@otplib/preset-v11`, `thirty-two` 가 제거됐다. 이는 의존성 공격 표면 축소 측면에서 긍정적이다. 이들의 제거가 다른 모듈에서 사용되지 않는지는 `package.json` `dependencies` 에서 직접 선언된 것이므로 안전하다.
- **제안**: 없음.

---

## 요약

이번 변경의 핵심 의존성 변경은 `otplib` v12 → v13 메이저 업그레이드로, TOTP 보안 크리티컬 경로에서 2021년 이후 stale 상태였던 v12 를 활성 유지보수 라인인 v13 (ESM-only, `@noble/hashes`·`@scure/base` 플러그인 기반)으로 전환한 것이다. `@noble/hashes` 는 독립 보안 감사를 받은 MIT 라이브러리이고, cross-version 호환성이 RFC 6238 Appendix B 벡터 단위 테스트로 검증되어 기존 사용자 secret 호환성이 보장된다. 주요 우려는 `"otplib": "^13.4.1"` 의 caret 버전 표기로, 보안 크리티컬 경로에서 패치 버전 드리프트를 방지하기 위해 정확 고정 또는 lockfile strict 운용이 권장된다. 나머지 변경(`@types/node` v24, `engines.node >= 24`, devDependency 버전 업)은 의존성 관점에서 별도 우려가 없다.

---

## 위험도

LOW
