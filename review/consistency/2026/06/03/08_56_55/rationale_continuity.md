# Rationale 연속성 검토 결과

검토 범위: `spec/7-channel-web-chat` (0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, _product-overview)
검토 모드: 구현 착수 전 (--impl-prep)
관련 plan: `plan/in-progress/channel-web-chat-demo.md`

---

## 발견사항

### 발견사항 없음 — Rationale 연속성 충돌 미확인

spec/7-channel-web-chat 의 각 문서와 관련 Rationale 발췌(0-overview, 1-data-model, 2-navigation 계열) 를 교차 검토한 결과, 아래 4가지 점검 관점 모두에서 명시적 충돌이 발견되지 않았다.

**점검 관점별 검토 요약**

#### 1. 기각된 대안의 재도입

- **Shadow DOM 인라인 마운트** — 0-architecture §R1 에서 명시적으로 기각(JS 전역·서드파티 보호 취약, Next.js host DOM 마운트의 스타일/polyfill/React 버전 충돌). 현 spec 및 plan 모두 iframe 격리를 그대로 유지한다. 재도입 없음.
- **`srcdoc`/`about:blank` 자가 생성** — 0-architecture §2.1·§R8 에서 기각(호스트 origin 상속 → cross-origin 격리 파괴). 현 spec 은 정적 CDN `src` 방식을 그대로 유지. 재도입 없음.
- **동적 서버 렌더링(per-workspace 문서 생성)** — §R8 에서 기각. `output:'export'` 정적 산출 + CDN 방식 유지. 재도입 없음.
- **이중 iframe(런처 별도)** — 0-architecture §R7 에서 v1 단일 iframe (A안) 선택, (B안) 기각. 현 spec 단일 iframe 유지. 재도입 없음.
- **per_trigger 영구 토큰** — 3-auth-session §R3 에서 명시 배제(공개 스니펫/번들에 영구 토큰 노출). 현 spec per_execution 단일 유지. 재도입 없음.
- **`/toggle` 별도 서브경로** — 2-trigger-list §R-4 에서 기각(단일 PATCH 경로 원칙). 이 결정은 4-security/auth-session 쪽과 무관하고 target 영역에 반영 없음. 연관 없음.
- **`off()` 없이 `on()` 만 두는 방식** — 2-sdk §R3 에서 "구현 단계 검토 보류"를 `data-global` + `off()` 추가로 명시 확정(번복이 아니라 미결정 해소). 번복 Rationale 이 §R3 에 함께 기록되어 있어 정합.

#### 2. 합의된 원칙 위반

- **EIA facade 계층 미신설 원칙** (0-architecture §R5, _product-overview §1) — 위젯은 순수 external HTTP consumer 로 한정한다는 원칙. 현 spec 전체가 이를 준수하며, plan(channel-web-chat-demo) 도 SDK/위젯 본체 변경 없이 `/demo` 라우트 추가만으로 범위를 제한함. 위반 없음.
- **single global name + `data-global` opt-in** 원칙 — §R3 에서 확정. §1·§2·§5 타입 블록 전반이 이를 따름. 위반 없음.
- **`ChatInstance` §5 타입 블록이 공개 메서드 계약의 SoT** — §R4 에서 명시. 산문/예시가 타입 블록과 일치함. 위반 없음.
- **`interactionAllowedOrigins` 단일 키 통합** (4-security §3) — CORS 와 임베드 allowlist 를 별도 키로 분리하지 않는다는 원칙. 현 spec 전체에서 단일 키 사용. 위반 없음.
- **`wc:` namespace prefix** (2-sdk §3) — postMessage 타입 식별자에 `wc:` prefix 사용 원칙. 현 spec 메시지 타입 표에서 일관 적용. 위반 없음.

#### 3. 결정의 무근거 번복

- `off()` / 구독 해제 패턴 추가 — 2-sdk §R3 에서 "기존 v1 spec 은 `off()` 없이 `on()` 만 두었으나 이는 미결정(단순화 보류) 상태였고, SPA 통합 피드백으로 cleanup 패턴 명시 요구가 확인돼 추가한다"고 명시. 번복 사유와 Rationale 이 동반 기록되어 있어 정합.
- `data-global` 전역명 재지정 확정 — §R3 에서 "기존 §1 의 '전역명 충돌 방지 패턴은 구현 단계 검토' 보류를 `data-global` 로 확정한다"고 명시. 보류 해소 근거 포함. 정합.
- 이 외 주요 구조 결정(iframe 격리, CDN 정적 배포, per_execution 토큰, M1/M2 모드 분리, Next.js CSR 전용)은 번복 없이 유지.

#### 4. 암묵적 가정 충돌

- **EIA §R10 단일 sink 정책** — 0-architecture §R5 에서 "EIA §R10 의 단일 sink·facade 계층에 새 listener 를 추가하지 않는다"고 명시. 현 spec 은 EIA 핵심 표면 변경 없이 external HTTP consumer 로만 동작. 충돌 없음.
- **`output:'export'` 정적 산출 invariant** — 1-widget-app §R4 에서 확정. Server Component / Route Handler / Server Action 미사용 원칙이 전체 spec 에 일관 적용. 충돌 없음.
- **plan(demo) 범위** — `channel-web-chat-demo.md` 의 "비목표: 위젯 본체 동작/상태기계 변경 없음" 은 spec 의 현 상태기계(1-widget-app §3) invariant 를 보존. `/demo` 라우트 추가는 `NODE_ENV` 게이팅으로 production 빌드(`output:'export'`)에 영향 없음. 충돌 없음.

---

## INFO 수준 관찰사항 (충돌 없음, 보완 제안)

- **[INFO]** plan `channel-web-chat-demo.md` 의 `wc:boot` 직접 전송(손수 구현) — 2-sdk §3 의 `wc:boot` 스펙(boot config 전체 전달)과 일치하나, `/demo` 라우트의 host bridge 구현이 `origin` 검증(양방향 `event.origin` 화이트리스트 — 2-sdk §3 note)을 빠뜨리면 §3 보안 요건 위반이 될 수 있다. 데모 전용 하니스이므로 dev-only 게이팅이 완화 근거가 되지만, 구현 시 명시적으로 `event.origin` 검증을 포함하거나, 데모 전용 relaxation 을 주석으로 문서화할 것을 권장.
  - target 위치: `plan/in-progress/channel-web-chat-demo.md` — demo-host.tsx 구현 항목
  - 과거 결정 출처: `spec/7-channel-web-chat/2-sdk.md §3` — "origin 검증 필수(양방향 `event.origin` 화이트리스트)"
  - 제안: `demo-host.tsx` 에서 `wc:*` 이벤트 수신 시 `event.origin` 을 `window.location.origin` 과 대조하는 검증을 포함하거나, 데모 전용 완화 사유를 인라인 주석으로 명시.

---

## 요약

`spec/7-channel-web-chat` 전 문서(0-architecture, 1-widget-app, 2-sdk, 3-auth-session, 4-security, _product-overview)와 관련 Rationale 발췌를 교차 검토한 결과, 명시적으로 기각된 대안의 재도입, 합의된 설계 원칙 위반, 무근거 결정 번복, 또는 시스템 invariant 충돌은 발견되지 않았다. `off()` 추가와 `data-global` 확정은 번복처럼 보이나 모두 같은 §R3 내에서 번복 근거가 명시되어 있어 Rationale 연속성이 유지된다. 구현 plan(`channel-web-chat-demo.md`)도 "위젯 본체 동작 변경 없음" + `NODE_ENV` 게이팅으로 기존 spec invariant 를 침범하지 않는다. 유일한 주의 사항은 INFO 수준으로, 데모 host bridge 구현 시 `event.origin` 검증 처리 방침을 명확히 해두는 것이 권장된다.

---

## 위험도

NONE
