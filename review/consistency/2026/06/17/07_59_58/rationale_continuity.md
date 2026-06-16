# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/7-channel-web-chat, diff-base=origin/main)
검토 일시: 2026-06-17

---

## 발견사항

특기할 CRITICAL/WARNING 발견 없음.

### [INFO] channel-web-chat node engine >=20 → >=24 변경
- target 위치: `codebase/channel-web-chat/package-lock.json` engines.node
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §R4` (Next.js CSR 전용, Vite SPA 기각)
- 상세: node 런타임 요구사항이 `>=20`에서 `>=24`로 상향됐다. `§R4`는 "SSR 이익 무의미 → CSR 강제 + 정적 export" 근거를 다루며 런타임 버전 제약에 대한 별도 결정을 기록하지 않는다. 이번 변경은 `jsdom ^29`·`@vitejs/plugin-react ^6` 등 테스트 devDependency의 Node 24 요건을 따른 것이라 Rationale 결정 번복이 아니다.
- 제안: 특별 조치 불필요. 런타임 버전 요건이 확정되면 `spec/7-channel-web-chat/0-architecture.md §4` 배포 설정 플레이스홀더 블록에 "Node engine >=24 전제" 한 줄을 추가하면 배포 문서가 완결된다.

### [INFO] @vitejs/plugin-react devDependency v4 → v6
- target 위치: `codebase/channel-web-chat/package-lock.json`
- 과거 결정 출처: `spec/7-channel-web-chat/1-widget-app.md §R4` ("Vite SPA 기각, Next.js CSR 채택")
- 상세: `§R4`에서 기각된 것은 "Vite 를 SPA 프레임워크"로 사용하는 것이다. `@vitejs/plugin-react`는 Vitest 테스트 러너의 devDependency로 사용되고 있으며 프레임워크 선택과 무관하다. Rationale 위반 아님.
- 제안: 없음.

### [INFO] otplib v12 → v13 (totp.service.ts API 변경) — spec/7 영역 외
- target 위치: `codebase/backend/src/modules/auth/totp.service.ts`, `package.json`
- 과거 결정 출처: scope=spec/7-channel-web-chat 영역 외 (auth 모듈)
- 상세: `authenticator` 객체 API → 함수형 `generateSecret`/`verifySync` API로 전환. `totp.service.ts`는 `spec/7-channel-web-chat` 영역의 어떤 Rationale 결정과도 무관하다. 본 검토 scope 밖이므로 서술만 한다.
- 제안: 없음 (auth 영역 별도 검토 대상).

---

## 요약

이번 변경(deps-backlog-residual)의 실질 내용은 `otplib v12→v13`, `@types/node v22→v24`, `node engine >=24`, `jsdom`, `@vitejs/plugin-react` 등 의존성 버전 업그레이드로 국한된다. `spec/7-channel-web-chat` Rationale에 기록된 핵심 결정들 — iframe 격리 채택(R1)·Shadow DOM 기각, Next.js CSR 전용(R4)·Vite SPA 기각, 패널 open 시 eager 시작(R6)·lazy+firstMessage 폐기, 정적 cross-origin CDN(R8)·srcdoc 기각, per_execution 단일 토큰(R3)·per_trigger 기각, deny-by-default allowlist(R4 security)·blacklist 기각 — 중 어느 것도 이번 구현 변경에서 재도입되거나 번복된 사항이 없다. 구현 변경이 `spec/7-channel-web-chat` 코드 표면(`codebase/channel-web-chat/**`)에도 일부 포함되어 있으나 해당 변경은 테스트 devDependency 버전 업으로 기능·설계 결정을 건드리지 않는다.

---

## 위험도

NONE
