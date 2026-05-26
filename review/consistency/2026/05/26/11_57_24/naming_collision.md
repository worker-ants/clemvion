# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-update-user-guide-mobile.md`
검토 일시: 2026-05-26

---

## 발견사항

### 발견사항 없음 (전 항목 클린)

아래는 각 점검 관점별 확인 결과를 서술한 것이며, 충돌은 발견되지 않았다.

---

### [INFO] Rationale ID `R-x` — 미확정 플레이스홀더 (충돌 없음, 번호 배정 필요)

- target 신규 식별자: `R-x` (plan 본문에서 실제 번호를 나중에 채울 플레이스홀더로 사용됨)
- 기존 사용처: `spec/2-navigation/13-user-guide.md` 에는 현재 `## Rationale` 섹션 및 기존 `R-N` 항목이 존재하지 않는다. 동일 파일에 기존 R 번호가 없으므로 같은 파일 내 충돌은 없다.
- 상세: plan 이 실제 spec 에 적용될 때 번호를 `R-1` 로 확정해야 한다. `_layout.md` 의 R-1/R-2, `2-trigger-list.md` 의 R-1~R-13 등은 각자 다른 파일 내 로컬 번호 체계이므로 교차 충돌 없음 — Rationale ID 는 문서별 로컬 네임스페이스로 운영된다.
- 제안: spec 적용 시 `R-x` 를 `R-1` 로 교체한다.

---

### [INFO] 컴포넌트명 `DocsMobileSidebar` — spec 에 도입되는 신규 표기, 기존 spec과 충돌 없음

- target 신규 식별자: plan §10 정정안의 "모바일 진입" 행에서 `SlideDrawer`, `DocsSidebar`, `DocsSearch` 컴포넌트명을 spec 본문에 새로 등재
- 기존 사용처: 세 컴포넌트 모두 `spec/2-navigation/2-trigger-list.md`, `spec/5-system/_product-overview.md` 에서 `SlideDrawer` 가 이미 컴포넌트명으로 등장한다. `DocsSidebar` / `DocsSearch` 는 spec 내 아직 미등재(코드에만 존재). 의미적으로 동일한 컴포넌트를 가리키므로 충돌 없음.
- 상세: spec 내 `SlideDrawer` 는 우측 슬라이드 drawer (trigger detail) 로 이미 사용되고 있으나, `/docs` 모바일용 SlideDrawer 는 동일 UI 컴포넌트를 `side="left"` 로 재사용하는 것임을 코드(`docs-mobile-sidebar.tsx:127`)가 확인해 준다. 의미 충돌 없음.
- 제안: spec 본문에 컴포넌트명 등재 시 `side="left"` 방향을 명시해 trigger detail drawer (우측) 와의 방향 차이를 독자가 구분할 수 있게 하면 좋다 — 현재 plan 안의 표현("좌측 SlideDrawer")이 이미 이를 충족한다.

---

### [INFO] frontmatter 키 `pending_plans` — 기존 컨벤션과 일치, 충돌 없음

- target 신규 식별자: `pending_plans: [spec-update-user-guide-mobile]` — `spec/2-navigation/13-user-guide.md` frontmatter 에 신규 등재
- 기존 사용처: `spec/conventions/spec-impl-evidence.md` 에 정의된 frontmatter 스키마 키. `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md` 등이 이미 동일 키를 사용 중.
- 상세: 슬러그 값 `spec-update-user-guide-mobile` 은 `plan/in-progress/spec-update-user-guide-mobile.md` 로 실존하며 path 가 일치한다. `spec-pending-plan-existence.test.ts` 가드가 실존을 검증하므로 누락 방지.
- 제안: 없음.

---

### [INFO] plan 파일명 `spec-update-user-guide-mobile.md` — 기존 plan 파일명과 충돌 없음

- target 신규 식별자: `plan/in-progress/spec-update-user-guide-mobile.md`
- 기존 사용처: `plan/in-progress/` 에 동명 파일이 이미 존재한다 — 이것은 target plan 자체이므로 별도 파일과의 충돌이 아니다. 유사 접두사 파일(`spec-drift-*`, `spec-fix-*`, `spec-followup-*`, `spec-harness-*`, `spec-overview-*`)은 모두 다른 slug 를 갖는다.
- 상세: 충돌 없음.
- 제안: 없음.

---

### (요구사항 ID, API endpoint, 이벤트/메시지명, 환경변수/설정키 충돌)

target plan 은 새 요구사항 ID, API endpoint, webhook/SSE 이벤트명, 환경변수, 설정키를 도입하지 않는다. 해당 점검 관점 모두 해당 없음(N/A).

---

## 요약

target 문서(`plan/in-progress/spec-update-user-guide-mobile.md`)는 `spec/2-navigation/13-user-guide.md §10` 표 갱신과 신규 Rationale 항목 추가만을 제안한다. 도입하는 식별자는 플레이스홀더 `R-x`(적용 시 `R-1` 로 확정 필요), 기존에 코드 레벨에서 사용 중인 컴포넌트명(`SlideDrawer`, `DocsSidebar`, `DocsSearch`)의 spec 등재, 기존 frontmatter 컨벤션 키 `pending_plans` 활용 세 가지이며, 어떤 것도 기존 사용처와 의미가 다른 동일 식별자 충돌을 일으키지 않는다.

### 위험도
NONE
