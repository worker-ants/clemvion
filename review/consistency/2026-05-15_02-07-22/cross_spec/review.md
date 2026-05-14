제공된 spec 본문을 바탕으로 cross-spec 일관성 검토를 수행합니다.

---

## 발견사항

### [INFO] `spec/1-data-model.md` 인덱스 표의 경로 표기 — 변경 대상 정확히 식별됨

- **target 위치**: draft §1 "Line 645 — partial index 주석"
- **충돌 대상**: `spec/1-data-model.md` 인덱스 전략 표 내 `install_token` 인덱스 행
- **상세**: 현행 spec 본문(제공된 `spec/1-data-model.md` 인덱스 표)은 `/oauth/install/cafe24/:installToken` 를 명시하고 있음. draft 가 이를 `/3rd-party/cafe24/install/:installToken` 로 갱신 대상으로 정확히 식별하고 있어 누락 없음.
- **제안**: 현행대로 진행 가능. 수정 범위 완결.

---

### [INFO] `spec/2-navigation/10-auth-flow.md` — 사용자 인증 OAuth 콜백과 통합 OAuth 콜백의 경로 네임스페이스 분리 명시 필요

- **target 위치**: draft §결정 사항 — Callbacks 행, §Rationale "google/github callback 도 동시 이동"
- **충돌 대상**: `spec/2-navigation/10-auth-flow.md` §8 API 표 `GET /api/auth/oauth/:provider/callback`
- **상세**: 현행 spec 에는 두 종류의 OAuth 콜백이 공존한다.
  - **사용자 인증용**: `GET /api/auth/oauth/:provider/callback` — Clemvion 로그인용 (Google/GitHub 소셜 로그인)
  - **통합 연동용**: `GET /api/integrations/oauth/callback/:provider` → draft 에서 `GET /api/3rd-party/:provider/callback` 로 변경 예정
  
  두 경로는 서로 다른 OAuth 앱 자격증명(Client ID/Secret)을 사용하더라도, OAuth 공급자 콘솔에서 `redirect_uri` 를 등록할 때 운영자가 혼동할 여지가 있다. 현재 spec 어디에도 "auth OAuth 콜백 ≠ integration OAuth 콜백" 임을 명시하는 문장이 없다.
- **제안**: `spec/2-navigation/4-integration.md` §10.1 callback 섹션에 "이 엔드포인트는 통합 연동용 OAuth 콜백이며, 사용자 소셜 로그인 콜백(`/api/auth/oauth/:provider/callback`)과 별개다" 한 줄 주석 추가를 권장. 스펙 충돌은 아니나 구현·운영 혼선 방지를 위한 명시.

---

### [INFO] `spec/data-flow/integration.md` line 49 — "일반 OAuth 추상 표현" 미수정 근거 명시

- **target 위치**: draft §미수정 항목 "spec/data-flow/integration.md line 49"
- **충돌 대상**: `spec/data-flow/integration.md`
- **상세**: draft 는 해당 라인이 Cafe24 와 무관하다고 판단해 미수정으로 분류했다. `GET /api/integrations/oauth/:service/start` 는 사용자가 호출하는 begin 흐름의 추상 표현이고, `/api/integrations/oauth/begin` 자체가 namespace 변경 대상에서 제외된다는 draft 의 논리와 일관성이 있다. 그러나 해당 파일의 완전한 내용이 제공되지 않아 다른 diagram 부분에 `/api/integrations/oauth/callback/` 이 별도로 남아있는지 grep 으로 확인하는 것을 권장한다.
- **제안**: spec 반영 전 `grep -r "integrations/oauth" spec/data-flow/` 로 잔여 참조 여부 최종 확인.

---

### [INFO] `spec/0-overview.md` — Cafe24 통합 §6.3 항목에 URL 표기 없음, 갱신 불필요

- **target 위치**: draft §미수정 항목 (overview 미언급)
- **충돌 대상**: `spec/0-overview.md` §6.3 "Cafe24 통합"
- **상세**: 현행 `spec/0-overview.md` §6.3의 Cafe24 항목은 spec 문서 링크만 포함하고 구체적인 URL 경로를 포함하지 않는다. 갱신 불필요하며 draft 의 "미수정" 분류가 정확하다.
- **제안**: 확인 완료. 변경 범위 밖.

---

## 요약

제공된 spec 본문 범위 내에서 CRITICAL·WARNING 수준의 cross-spec 충돌은 발견되지 않았다. draft 는 `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/data-flow/integration.md` 4개 파일의 변경 대상을 정확하게 식별하고 있으며, 데이터 모델 스키마 무변경 결정과 인덱스 표 갱신도 일관성이 있다. 주의할 점은 사용자 인증 OAuth 콜백(`/api/auth/oauth/...`)과 통합 연동 OAuth 콜백(`/api/3rd-party/.../callback`)이 각각 별개의 경로·자격증명임을 spec 본문에서 명시하지 않는다는 점이다. 이는 구현·운영 혼선 방지를 위해 `spec/2-navigation/4-integration.md` §10.1 에 한 줄 주석으로 보완하는 것을 권장한다.

## 위험도

**LOW**