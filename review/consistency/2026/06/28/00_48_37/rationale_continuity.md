# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
대상 영역: `spec/7-channel-web-chat/`

---

### 발견사항

- **[WARNING]** `2-sdk.md` 의 `localStorage` 명시 — `sessionStorage` 전환의 번복 흔적
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` §3 `resetSession` 명령 설명 (구 버전 → 신 버전 diff 기준)
  - 과거 결정 출처: 구 `spec/7-channel-web-chat/2-sdk.md` §3 에서 "저장 세션(localStorage)" 으로 명시. 단, 이 명시에 대응하는 `## Rationale` 항목은 존재하지 않았다.
  - 상세: 이전 `2-sdk.md` 는 `resetSession` 명령에서 세션 저장소를 `localStorage` 로 명시했고, `session-store.ts` 구현도 `localStorage` 를 사용했다. 이번 변경에서 `sessionStorage` 로 전환했다. `3-auth-session.md` 에는 신규 `R6` Rationale 이 추가되어 결정 근거(defense-in-depth, 탭 단위 소거, N1 복원 보존)를 명문화했다. 따라서 "Rationale 없이 결정을 번복"하는 완전한 무근거 번복은 아니나, 과거 `localStorage` 명시가 Rationale 없이 존재했던 점과, 변경이 spec 여러 파일에 걸쳐 이루어진 점에서 추적 가능성 확보가 필요하다.
  - 제안: 현재 추가된 `3-auth-session.md §R6` 은 충분한 내용을 담고 있다. 다만 `3-auth-session.md §R6` 첫 줄에 "구 구현이 localStorage 를 사용했으나 이번에 sessionStorage 로 전환한다"는 단 한 줄의 이행 경위 문장을 추가하면 검색·추적성이 완전해진다. 예: "*기존 구현(`session-store.ts`)은 `localStorage` 를 사용했으나 defense-in-depth 원칙에 따라 `sessionStorage` 로 전환한다.*"

- **[INFO]** `1-widget-app.md` §3.1 표 — 저장소 참조가 구체화됨 (정합 확인)
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §3.1 "페이지 새로고침/이동" 행
  - 과거 결정 출처: 구 동일 문서의 "iframe-origin storage 저장" (추상적)
  - 상세: 구 문서는 "iframe-origin storage" 로 저장소 종류를 추상화했고, 이제 "sessionStorage" 로 구체화됐다. 이는 구체화이지 번복이 아니므로 Rationale 충돌 없음. `[3-auth-session §R6]` 크로스 레퍼런스가 정합한다.
  - 제안: 현행 유지. 정합 완료.

- **[INFO]** `4-security.md` §1 보안 정책 표 — 토큰 노출 항목에 sessionStorage 추가 (정합 확인)
  - target 위치: `spec/7-channel-web-chat/4-security.md` §1 "토큰 노출" 행
  - 과거 결정 출처: 구 동일 행 "per_execution 단일 → 클라이언트에 장기 비밀 없음" (sessionStorage 언급 없음)
  - 상세: 신규로 "단명 토큰은 sessionStorage 저장 → 탭 종료 시 자동 소거(defense-in-depth)" 내용이 추가됐다. 이는 기존 "클라이언트에 장기 비밀 없음" 원칙을 강화한 것이지 위반이 아니다. `4-security.md §R3`(rate-limit fail-open), `§R4`(deny-by-default sanitize), `§R5`(allow-same-origin sandbox 근거) 등 기존 Rationale 항목과 충돌 없음.
  - 제안: 현행 유지. 정합 완료.

---

### 요약

검토 대상 변경(`spec/7-channel-web-chat/` 4개 파일)은 `session-store.ts` 의 `localStorage` → `sessionStorage` 전환에 따른 spec 동기화다. 핵심 Rationale 연속성 위험은 구 `2-sdk.md` 에 `localStorage` 가 Rationale 없이 명시되어 있었고 이번에 `sessionStorage` 로 교체된 점인데, 신규 `3-auth-session.md §R6` 이 decision 근거를 충분히 명문화하므로 "무근거 번복" 수준에는 해당하지 않는다. iframe 격리(R1), per_execution 토큰 단일(R3), eager-start 전략(R6), 단일 iframe(R4), CSR-only(R4 1-widget-app), SDK 두 경로(R2 2-sdk), CORS 분리(R1 4-security) 등 기존 합의 원칙은 전부 온전히 보존된다. 기각된 대안(Shadow DOM, srcdoc, 동적 서버 렌더링, per_trigger, lazy-start 등)을 재도입한 항목은 없다. `R6` 에 localStorage 에서의 이행 경위 한 줄을 보완하면 추적성이 완전해진다.

### 위험도

LOW
