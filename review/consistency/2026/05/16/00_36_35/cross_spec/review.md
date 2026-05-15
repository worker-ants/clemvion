# Cross-Spec 일관성 검토

검토 모드: `--impl-prep`
대상 스펙: `spec/2-navigation/4-integration.md`
구현 범위: Cafe24 Private `request-scopes` UI 안내 누락 수정 (frontend-only)

---

## 발견사항

### [INFO] `request-scopes` 응답 shape 의 i18n 키 정의가 plan 과 spec 사이 미세 불일치

- **target 위치**: `plan/in-progress/cafe24-request-scopes-ui.md` 변경 범위 → i18n 키 `requestScopesCafe24PrivatePendingDesc`
- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` `[Request scopes]` 셀 — 안내 문구 "Cafe24 Developers 의 앱 권한 설정에서 추가 scope 를 활성화한 뒤 '테스트 실행' 을 다시 누르면 새 token 으로 갱신됩니다."
- **상세**: spec §4.4 는 안내 문구 원문을 한국어로만 명시하고 있으며, plan 은 동일 i18n 키를 ko/en 양쪽에 추가한다고 명시한다. spec 에 영문 대응 안내 문구가 없어 영어 번역본이 spec 과 일치하는지 검증 기준이 없다. spec 의 해당 셀이 영문 안내를 포함하지 않으므로 번역자(또는 LLM)가 임의 번역을 사용할 위험이 있다.
- **제안**: spec §4.4 의 `[Request scopes]` 셀 안에 영문 안내 문구 예시를 추가하거나, i18n 키 값 확정 후 spec 에 동기화. 구현 완료 후 ko.ts/en.ts 번역본을 spec 에 역반영하는 것으로도 충분하다. CRITICAL 수준이 아닌 명명·동기화 권장 사항이다.

---

### [INFO] `scopesAdded` 필드의 UI 표현 기준 미정의

- **target 위치**: `spec/2-navigation/4-integration.md §4.4` — `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl, scopesAdded: [...] }` 응답 shape 정의
- **충돌 대상**: `plan/in-progress/cafe24-request-scopes-ui.md` — i18n 키 `requestScopesCafe24PrivatePendingScopesAdded` 추가 명시
- **상세**: spec §4.4 는 `scopesAdded` 의 존재를 응답 shape 에서 언급하지만 이 필드를 UI 에서 어떻게 표시해야 하는지(목록 나열 여부, 축약 표현 여부 등)를 구체화하지 않는다. plan 이 별도 i18n 키를 만든다는 사실은 표시가 존재한다는 것을 암시하지만 spec 의 UI 설명에는 공백이 있다. 다른 영역 spec 과의 충돌은 아니고 단순 표현 미정의다.
- **제안**: spec §4.4 에 `scopesAdded` 표시 방식 (예: "추가 요청된 scope: `mall.read_product`, `mall.write_order`" 형식으로 inline alert 본문에 나열)을 한 줄 추가하면 구현자가 해석 차이 없이 일관된 UI 를 만들 수 있다. 구현 후 실제 UI 형태가 결정되면 spec 에 역반영 권장.

---

### [INFO] `POST /api/integrations/:id/request-scopes` 의 Cafe24 Public 와 Private 분기 — spec 과 API 계약 일치 확인 (이상 없음, 동기화 권장)

- **target 위치**: `spec/2-navigation/4-integration.md §9.2` — `POST /api/integrations/:id/request-scopes` 설명
- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` 동일 문서 내 교차 참조
- **상세**: §9.2 는 "응답 분기: 일반 provider — `{ authUrl }` (팝업 OAuth). **Cafe24 Private** — `{ mode: 'cafe24_private_pending', ... }`" 로 분기를 일관되게 기술하고, §4.4 UI 설명도 동일 분기를 반영한다. 두 섹션 간 충돌은 없다. 다만 backend 의 해당 handler 가 spec 대로 Cafe24 Public 에 대해서도 begin 을 호출하지 않고 `authUrl` 을 반환하는지 — 즉 Public 과 Private 분기가 backend 에서도 spec §9.2 와 동일하게 처리되는지 — 는 frontend 구현과 무관하게 별도 검증 대상이다. 이번 변경(frontend-only)과 직접 충돌은 없다.
- **제안**: 구현 PR 의 backend 변경이 없다는 plan 서술(§"영향 범위: backend 변경 없음")이 spec §9.2 와 일치함을 확인. INFO 수준으로 기록하되 CRITICAL/WARNING 없음.

---

### [INFO] `inline alert` 구현 결정이 spec 에 반영되지 않음

- **target 위치**: `plan/in-progress/cafe24-request-scopes-ui.md §결정` — "inline alert 로 scope panel 안에 안내문 표시"
- **충돌 대상**: `spec/2-navigation/4-integration.md §4.4` — UI 표시 방식을 "사용자 안내" 텍스트로만 서술, modal/toast/alert 구분 없음
- **상세**: plan 이 "modal 보다 영구 표시" 를 이유로 inline alert 를 채택했는데, spec §4.4 는 이 결정을 반영하지 않는다. spec 은 응답 후 "안내 문구 표시"만 서술하고 구체적인 컴포넌트 선택(inline alert vs modal vs toast)을 열어두고 있다. plan 의 결정이 나중에 다른 개발자가 다른 방식으로 구현할 때 혼란의 여지가 있다.
- **제안**: 구현 완료 후 spec §4.4 에 "inline alert(고정 안내문) + toast 알림 병행" 방식을 한 줄 추가해 구현 결정을 spec 에 흡수. 구현 착수 전에 차단이 필요한 수준은 아니다.

---

## 요약

Cross-Spec 일관성 관점에서 이번 구현(Cafe24 Private `request-scopes` UI 안내 누락 수정)은 기존 spec 과의 **직접적인 모순이 없다**. `spec/2-navigation/4-integration.md §4.4` 는 Cafe24 Private 분기에서 `{ mode: 'cafe24_private_pending', ... }` 응답을 받았을 때 안내 문구를 표시해야 한다고 명시하고 있으며, 이번 구현은 해당 명세를 그대로 이행한다. 데이터 모델(Integration 엔티티, `request-scopes` API 계약, 상태 전이)은 변경되지 않으며, RBAC 규칙·계층 책임·요구사항 ID 에도 새로운 충돌이 발생하지 않는다. 발견된 4건은 모두 INFO 등급으로, spec ↔ i18n 영문 안내 문구 동기화, `scopesAdded` UI 표현 미정의, inline alert 결정의 spec 미흡수에 관한 **구현 후 동기화 권장** 사항이다. 구현 진행을 차단할 CRITICAL 또는 WARNING 수준 항목은 없다.

---

## 위험도

NONE
