# Convention Compliance Review — spec/7-channel-web-chat/

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

### [WARNING] `id` 필드가 basename 기반 권장 규약에서 벗어남 (영역 전체 일관)

- **target 위치**: `spec/7-channel-web-chat/` 내 모든 spec 파일 frontmatter
  - `0-architecture.md` → `id: web-chat-architecture` (basename: `0-architecture`)
  - `1-widget-app.md` → `id: web-chat-widget-app` (basename: `1-widget-app`)
  - `2-sdk.md` → `id: web-chat-sdk` (basename: `2-sdk`)
  - `3-auth-session.md` → `id: web-chat-auth-session` (basename: `3-auth-session`)
  - `4-security.md` → `id: web-chat-security` (basename: `4-security`)
  - `5-admin-console.md` → `id: web-chat-admin-console` (basename: `5-admin-console`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장. 같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다"
- **상세**: 예외 조건("같은 basename 이 영역을 달리해 중복될 때")이 실제로는 해당하지 않는다. 현재 레포 전체에서 `architecture`, `widget-app`, `sdk`, `auth-session`, `admin-console`을 id로 점유한 다른 spec이 존재하지 않는다. `4-security.md`는 주석에 "타 영역의 `4-security` 슬러그와 충돌 방지"라고 명시하나, 다른 영역에 `4-security.md` 파일이 없다. 즉 모든 prefix는 실제 충돌 없이 예방적으로 적용됐다.
- **제안**: 실제 충돌이 발생할 때까지 basename 그대로 사용하는 것이 규약에 부합한다. 단, `web-chat-X` prefix 패턴이 영역 내 일관성을 가지고 있고 빌드 가드(spec-frontmatter.test.ts)가 id 유일성만 검증하므로 현행 유지를 선택할 경우 규약 주석으로 의도를 명시하거나, 규약 예외 사례로 등록할 것을 권장한다. 빌드 차단 위험은 없다.

---

### [INFO] `0-architecture.md` 파일명이 SKILL.md 권장명과 다름

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §명명 컨벤션` — "`spec/<영역>/0-overview.md` — 기술 아키텍처 개요"
- **상세**: SKILL.md 의 권장 이름은 `0-overview.md` 이나 실제 파일명은 `0-architecture.md`. 그러나 같은 패턴이 다른 영역(`spec/3-workflow-editor/0-canvas.md`, `spec/2-navigation/0-dashboard.md`)에도 적용돼 있고, `spec-area-index.test.ts` 의 INDEX_RE 패턴(`0-*.md`)을 충족해 area-index guard가 정상 통과된다. 기능적 문제는 없음.
- **제안**: INFO 수준. SKILL.md의 예시(`0-overview.md`)를 사실을 반영해 `0-<semanticName>.md` 형식으로 완화하거나, 현행 유지.

---

### [INFO] 기술 명세 파일 4개에 `## Overview` 섹션 없음

- **target 위치**: `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — "Overview / 본문 / Rationale"
- **상세**: 위 4개 파일에 `## Overview` 섹션이 없다. 그러나 SKILL.md는 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일"로 Overview 역할을 분리하도록 안내하며, `spec/7-channel-web-chat/_product-overview.md` 가 이 역할을 담당한다. `4-security.md`와 `5-admin-console.md`는 `## Overview` 섹션을 포함하고 있다. 규약은 "권장(recommended)"이지 강제 아님.
- **제안**: `4-security.md`와 `5-admin-console.md`만 Overview 섹션을 가진 비일관성이 있다. 일관성 향상을 위해 나머지 4개 파일에도 간단한 `## Overview` 도입 블록(한 문단)을 추가하거나, 현행 유지.

---

### [INFO] EIA SSE wire 필드명 drift가 "별도 backlog"로만 처리됨

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md §3` 끝 주석
- **위반 규약**: 직접 규약 위반이 아닌, 문서 간 불일치 인식 상태
- **상세**: `0-architecture.md §3`의 주석에 "EIA §6.2 / WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift — 별도 backlog"로 명시돼 있다. 이는 규약 위반이 아니라 알려진 drift를 문서화한 것으로 적절한 처리다. 다만 이 backlog 항목이 plan에 등록되지 않은 채 spec 주석에만 존재한다.
- **제안**: drift 항목이 장기간 backlog에 머무를 경우 EIA 측 spec(`spec/5-system/14-external-interaction-api.md`)을 실제 wire 필드명으로 정정하거나 `plan/in-progress/` 에 등록해 추적성을 확보할 것을 권장.

---

## 요약

`spec/7-channel-web-chat/` 영역의 정식 규약 준수 수준은 전반적으로 양호하다. 모든 spec 파일이 필수 frontmatter(`id`, `status`, `code:`)를 보유하고, `code:` 글로브가 실존 파일에 매치되며, `_product-overview.md`가 모든 형제 spec을 링크해 area-index guard를 통과한다. 모든 파일에 `## Rationale` 섹션이 있고, EIA 요구사항 ID(EIA-IN-02, EIA-NF-03, EIA-AU-04) 참조가 EIA 원본 spec과 정합한다. 구현 변경(widget-state.ts의 `isTextInputSurface` 함수 추출, panel.tsx 리팩토링)은 `1-widget-app.md §2 입력창 행`의 버튼/폼 비활성 규칙을 그대로 구현한 spec-aligned 리팩토링이다. 주요 우려 사항은 `id` 필드가 실제 충돌 없이 예방적으로 `web-chat-X` prefix를 사용한다는 점(WARNING)으로, 규약의 예외 발동 조건을 충족하지 않으나 빌드 차단 위험은 없다.

## 위험도

LOW
