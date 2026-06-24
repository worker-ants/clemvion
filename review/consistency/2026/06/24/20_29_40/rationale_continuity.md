# Rationale 연속성 검토 결과

검토 대상: `03-maintainability M-2 — frontend API_BASE_URL 분산 정의 통합 + 3001→3011 fallback 정정`
검토 범위: `codebase/frontend/src/` diff (origin/main...HEAD)
검토 일시: 2026-06-24

---

## 발견사항

### [INFO] NEXT_PUBLIC_API_URL 우선순위 체계 — spec 명문화 없으나 구현은 기존 합의와 일치
- target 위치: `codebase/frontend/src/lib/api/constants.ts` 전체
- 과거 결정 출처: `spec/5-system/12-webhook.md` WH-EP-02 및 Rationale; `spec/2-navigation/2-trigger-list.md` §125; `spec/7-channel-web-chat/5-admin-console.md` §124
- 상세: spec 의 기존 결정들은 `NEXT_PUBLIC_API_URL` 이 프론트엔드의 API base 를 결정하는 단일 진실이라는 원칙을 다양한 위치에서 명시하고 있다. 새 `constants.ts` 의 우선순위 체계(`NEXT_PUBLIC_API_URL` → 로컬 fallback)는 이와 완전히 일치한다. `INTERNAL_API_URL` 은 Server Component 전용(`getServerApiBaseUrl()`)으로 분리돼 있어 클라이언트 번들에는 영향 없음 — 이 설계도 spec 의 기존 우선순위 정의(WH-EP-02: `NEXT_PUBLIC_WEBHOOK_BASE_URL` → `NEXT_PUBLIC_API_URL` → fallback 순서 패턴)와 동형이다.
- 제안: 현재 spec 어디에도 "frontend lib/api 내부의 URL 상수 중앙화 정책" 이 명시된 Rationale 항목이 없다. 이 리팩터링은 behavior-preserving 이라 실질적 Rationale 위반은 없지만, 향후 `INTERNAL_API_URL` 의 적용 범위(Server Component 전용)와 `constants.ts` 가 단일 SoT 임을 `spec/5-system/1-auth.md` 또는 `spec/0-overview.md` 의 Rationale 에 한 항목으로 명문화하면 일관성 검토자가 이 결정을 미래에 재확인할 수 있다. 필수는 아니나 권장.

### [INFO] WS_BASE_URL fallback 에서 /api suffix 부재 — spec 패턴과 일치 확인
- target 위치: `codebase/frontend/src/lib/api/constants.ts` L24 (`WS_BASE_URL = ... || "http://localhost:3011"`)
- 과거 결정 출처: `spec/5-system/6-websocket-protocol.md`; `codebase/frontend/.env.example` (`NEXT_PUBLIC_WS_URL="http://localhost:3011"`)
- 상세: `API_BASE_URL` fallback 은 `/api` suffix 를 포함하고 `WS_BASE_URL` fallback 은 포함하지 않는다. 이는 `.env.example` 의 canonical 정의와 정확히 일치한다 (`NEXT_PUBLIC_API_URL="http://localhost:3011/api"` / `NEXT_PUBLIC_WS_URL="http://localhost:3011"`). 기존 분산 정의에서도 동일 규칙을 따랐으므로 invariant 변경 없음.
- 제안: 위반 없음. 현행 유지.

---

## 요약

이번 변경(M-2)은 프론트엔드 `lib/api/` 내에 분산돼 있던 `API_BASE_URL` / `WS_BASE_URL` 인라인 정의를 `constants.ts` 단일 파일로 집약하고, `3001` 로 잘못 기재된 로컬 fallback 포트를 `.env.example` canonical 값인 `3011` 로 정정하는 behavior-preserving 리팩터링이다. 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나, 합의된 invariant 를 우회하거나, 새 Rationale 없이 과거 결정을 번복한 항목은 발견되지 않았다. spec 이 명문화한 `NEXT_PUBLIC_API_URL` 우선순위 체계, `.env.example` canonical 포트, Server Component 전용 URL 경로(`INTERNAL_API_URL` 우선)는 모두 구현에서 올바르게 계승됐다. 두 건의 INFO 항목은 추후 spec Rationale 보강을 제안하는 수준이며, Rationale 연속성 자체를 위반하지 않는다.

---

## 위험도

NONE
