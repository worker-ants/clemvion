# Rationale 연속성 검토 결과

검토 범위: `spec/5-system` (구현 착수 전 검토, --impl-prep)
검토 일시: 2026-06-12

---

## 발견사항

### [WARNING] Rationale 1.4.D 와 spec body §1.4.2 간 TOTP 전환 경로 서술 불일치

- **target 위치**: `spec/5-system/1-auth.md` §1.4.2 규칙 항목 (line 108)
- **과거 결정 출처**: `spec/5-system/1-auth.md` `## Rationale` §1.4.D (line 495)
- **상세**:
  - spec body §1.4.2 (line 108): "사용자가 TOTP 로 우회하길 원하면 보안 설정에서 WebAuthn credential 을 먼저 **모두 삭제**해야 한다"고 기술 — credential 삭제가 유일한 경로로 서술됨.
  - Rationale 1.4.D (line 495): "보안 설정에서 WebAuthn credential 을 모두 삭제 **(혹은 webauthn 복구 코드 사용)** 한 뒤 재로그인 가능"이라며 복구 코드 사용을 대안 경로로 병기.
  - 그러나 WebAuthn 복구 코드 사용(`POST /api/auth/2fa/webauthn/recovery`)은 해당 로그인 세션만 통과시킬 뿐, WebAuthn credential row 는 삭제되지 않는다. 다음 로그인 시 여전히 `methods=['webauthn']` 분기가 적용되므로, 복구 코드 사용은 실질적으로 "TOTP 로 전환"하는 경로가 되지 않는다.
  - 결론: Rationale 1.4.D 의 "(혹은 webauthn 복구 코드 사용)" 문구는 의도가 불명확하다. spec body §1.4.2 의 "credential 모두 삭제" 서술이 합의 원칙(WebAuthn 우선, TOTP fallback 금지)에 더 정확히 부합하지만, Rationale 이 이와 다른 뉘앙스를 남겨 향후 구현자 혼란을 야기할 수 있다.
- **제안**: Rationale 1.4.D 의 "(혹은 webauthn 복구 코드 사용)" 문구를 "복구 코드는 해당 세션 로그인만 허용하며, TOTP 로 영구 전환하려면 credential 삭제 후 재설정이 필요"로 명확화하거나, 복구 코드 언급을 삭제해 spec body §1.4.2 와 일치시킨다.

---

### [INFO] `spec/5-system/10-graph-rag.md` KB-GR-UI-07 — react-flow 대신 3D 렌더러 채택, Rationale 부재

- **target 위치**: `spec/5-system/10-graph-rag.md` §3.6 KB-GR-UI-07 (line 136)
- **과거 결정 출처**: 동일 문서 `## Rationale` §사용자 결정 #4 (line 605) 및 비-목표 §2.2
- **상세**:
  - 요구사항 KB-GR-UI-07 원문은 "그래프 시각화 (react-flow 또는 동등)"으로 정의했다.
  - 구현 상태 주석에 "react-flow 대신 3D / 2D 렌더러 채택"이라고 명기하며 원래 라이브러리 선택에서 이탈했음을 인정하고 있다.
  - 그러나 Rationale 섹션에서 react-flow 를 "기각된 대안"으로 기록하거나, 3D 렌더러 채택 이유(예: 성능, UX 선호, 의존성 절약 등)를 설명하는 별도 Rationale 항목이 없다.
  - 라이브러리 선택 자체가 핵심 설계 결정은 아니지만(요구사항은 "또는 동등"을 명시), 비교적 중요한 기술 선택을 코드 상태 주석에만 남기고 Rationale 에 누적하지 않으면 이후 유지보수 시 역추적이 어렵다.
- **제안**: `## Rationale` 에 KB-GR-UI-07 시각화 라이브러리 결정 항목을 짧게 추가. 예: "react-flow 는 'or equivalent'로 열려 있었으며, 3D/2D 렌더러(`graph-3d-renderer.tsx`)를 채택한 이유(예: Three.js 기반 풍부한 3D UX, react-flow 의 2D-only 제약 대비 차별화)를 한 줄 기재." 단, 현재 spec 자체가 "또는 동등"을 허용했으므로 이는 위반이 아닌 보완 제안이다.

---

### [INFO] `spec/5-system/11-mcp-client.md` — `## Rationale` 섹션 자체 부재

- **target 위치**: `spec/5-system/11-mcp-client.md` 전체 (549줄)
- **과거 결정 출처**: N/A (타 spec 의 Rationale 과 충돌하는 내용 없음)
- **상세**:
  - 문서 전체에 `## Rationale` 섹션이 존재하지 않는다. 설계 결정(stdio 미지원, 풀링 비채용, stateless 세션 단위, auth_type 3종 한정, 단일 transport 고집 등)의 근거가 인라인 주석과 §2.2, §4.3, §12 확장포인트에 산재되어 있으나, `spec/` 관리 규약(CLAUDE.md: "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")에 어긋난다.
  - 특히 다음 결정들이 Rationale 에 집약되지 않았다:
    - stdio 미지원 → §2.2 에 inline 설명 존재, Rationale 미수록
    - 노드 실행 단위 세션(풀 공유 비채용) → §4.3 에 inline 설명, Rationale 미수록
    - 외부 MCP 에 한한 `error → connected` 자동 복구 금지 → §8.4 inline, Rationale 미수록
    - `integration` 기존 엔티티 재사용(신규 테이블 없음) → §3 inline 설명, Rationale 미수록
  - 현재 spec 이 다른 spec 의 기각된 결정을 재도입하거나 invariant 를 위반하지는 않는다. 이 항목은 규약 준수 보완 제안이다.
- **제안**: `spec/5-system/11-mcp-client.md` 끝에 `## Rationale` 섹션을 추가하고 주요 결정(stdio 미지원·세션 단위·자동 복구 금지·기존 Integration 엔티티 재사용)을 이관한다.

---

### [INFO] `spec/5-system/1-auth.md` — `requiresTotp` 필드 제거 Rationale(1.4.I)이 spec body 와 충돌 가능성 없으나 명확성 보완 가능

- **target 위치**: `spec/5-system/1-auth.md` §5 API 엔드포인트 테이블 및 §1.4.2
- **과거 결정 출처**: `spec/5-system/1-auth.md` `## Rationale` §1.4.I
- **상세**:
  - Rationale 1.4.I 는 `requiresTotp` deprecated 필드가 **존재하지 않음**을 명문화했다. spec body 에서도 `requires2fa` + `methods` 만 언급되므로 정합성은 유지된다.
  - 다만 §5 엔드포인트 표(`POST /api/auth/login`)의 설명에는 "`requires2fa`, `methods`, `challengeToken`" 이 열거되어 있어, `requiresTotp` 를 찾는 구현자가 혼동할 여지 없이 명확하다.
  - 이 항목은 충돌 없음 — 정합성 확인 완료.
- **제안**: 현상 유지. 별도 조치 불필요.

---

## 요약

`spec/5-system` 대상 Rationale 연속성 검토에서 명시적으로 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. 주요 발견은 두 가지다. 첫째, `spec/5-system/1-auth.md` Rationale 1.4.D 가 "WebAuthn credential 삭제 혹은 복구 코드 사용"을 TOTP 전환 경로 대안으로 병기하고 있으나, 복구 코드 사용은 실제로 TOTP 전환 경로가 되지 않아 spec body §1.4.2 와 뉘앙스 차이가 있다(WARNING). 둘째, `spec/5-system/10-graph-rag.md`의 react-flow 대신 3D 렌더러를 채택한 기술 결정과 `spec/5-system/11-mcp-client.md`의 핵심 설계 결정들이 `## Rationale` 섹션에 집약되지 않아 추적 가능성이 낮다(INFO). `spec/5-system/11-mcp-client.md`는 `## Rationale` 섹션 자체가 없어 관리 규약과 어긋난다.

## 위험도

LOW
