# Convention Compliance Review
검토 모드: `--impl-prep` · 범위: `spec/7-channel-web-chat`  
검토일: 2026-06-03

---

## 발견사항

### [WARNING] `spec/7-channel-web-chat` 영역이 `spec-impl-evidence` 빌드타임 가드 적용 범위 밖
- **target 위치**: 전 파일 (`0-architecture.md` ~ `4-security.md`) frontmatter
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — 적용 대상 inclusive list: `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/conventions/`
- **상세**: `spec/7-channel-web-chat/` 는 위 목록에 없어 `spec-frontmatter.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts` 4개 가드 모두 본 영역 파일을 검증하지 않는다. 5개 파일 모두 `status: partial` + `code:` + `pending_plans:` 를 올바른 형식으로 갖추고 있으나, 가드 부재로 stale/누락이 생겨도 build 가 통과한다. 구현 PR 이 머지된 뒤 `status` 를 `implemented` 로 승격하지 않아도 아무 경고 없이 지나갈 수 있다.
- **제안**: `spec/conventions/spec-impl-evidence.md §1` 의 `INCLUDE_PREFIXES` 에 `spec/7-channel-web-chat/` 를 추가하고, `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열에도 동일하게 반영한다. 반영 전까지는 본 영역의 frontmatter 라이프사이클이 수동 관리에 의존함을 인식해야 한다. (규약 자체 갱신이 적절한 케이스.)

---

### [WARNING] `4-security.md` 에 `## Rationale` 섹션 없음
- **target 위치**: `spec/7-channel-web-chat/4-security.md` 전체
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` 외 `.claude/skills/project-planner/SKILL.md §Spec 문서 구조` — "결정 배경·근거·폐기된 대안"을 `## Rationale` 섹션에 명시 권장. 같은 영역의 다른 4개 파일은 모두 `## Rationale` 보유.
- **상세**: `4-security.md` 는 CORS 이중 헤더 충돌 방지, iframe sandbox 설정, soft vs hard frame-ancestors 선택, rate-limit fixed-window 선택 등 여러 설계 결정을 담고 있으나, 이를 뒷받침하는 `## Rationale` 섹션이 없다. 인라인으로 §R1·§R8 을 `0-architecture.md` 에 위임 참조하는 형태이지만 `4-security.md` 고유 결정(예: fixed-window vs sliding-window, soft vs hard 임베드 검증 기본값)의 근거가 본 파일 안에 없다.
- **제안**: `4-security.md` 끝에 `## Rationale` 섹션을 추가하고 CORS 분리 구조 채택·soft 검증 기본값·rate-limit fixed-window 선택 근거를 기록한다. 영역 선진 문서(`0-architecture.md §R8`)를 cross-ref 하되 보안 전용 결정은 본 파일이 소유한다.

---

### [INFO] `0-architecture.md` 파일명이 권장 명명 패턴(`0-overview.md`)과 다름
- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` 파일명
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §명명 컨벤션` — `spec/<영역>/0-overview.md` 를 기술 아키텍처 개요 파일로 예시
- **상세**: 같은 프로젝트 내 `spec/5-system/0-overview.md` 는 규약 예시와 일치하나, `spec/2-navigation/0-dashboard.md`, `spec/3-workflow-editor/0-canvas.md` 처럼 내용 반영 이름을 쓰는 기존 사례도 있어 엄격한 강제 규약이 아님이 확인된다. `0-architecture.md` 는 내용(아키텍처 레이어 분리)을 명시적으로 표현하므로 가독성 측면 이점이 있다.
- **제안**: 수정 불필요. 단, 향후 `spec-impl-evidence §1` 갱신 시 INCLUDE_PREFIXES 예시 파일명도 일관성 있게 조정하는 것이 바람직하다.

---

### [INFO] `spec/7-channel-web-chat` 내 개별 기술명세 파일에 `## Overview` 섹션 없음
- **target 위치**: `0-architecture.md`, `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`, `4-security.md`
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조` — "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 허용
- **상세**: `_product-overview.md` 가 영역 전체 Overview 를 담당하므로 개별 기술 명세 파일이 `## Overview` 를 생략하는 것은 규약이 명시적으로 허용하는 패턴이다. 실제로 각 파일 상단에 인트로 단락 + 관련 문서 링크가 있어 내용 파악에 지장이 없다.
- **제안**: 현행 유지. 이미 규약 허용 패턴 사용 중.

---

## 요약

`spec/7-channel-web-chat` 영역은 `_product-overview.md` + 5개 기술 명세 파일로 구성되어 있으며, 파일명 prefix(`0-`, `1-` 등), `_product-overview.md` 명명, frontmatter 스키마(`id`, `status`, `code`, `pending_plans`) 형식 모두 정식 규약과 부합한다. `pending_plans` 실존 파일도 확인됐다. 주요 우려 사항은 두 가지다. 첫째, 본 영역이 `spec-impl-evidence §1` 의 빌드타임 가드 적용 범위에서 누락돼 있어 frontmatter 라이프사이클(특히 `partial → implemented` 승격)이 자동 감시되지 않는다 — 구현 작업이 완료되어도 `status` 가 갱신되지 않을 위험이 있다. 둘째, `4-security.md` 에 `## Rationale` 섹션이 없어 문서 내 주요 설계 결정의 근거가 본 파일 안에 자기 완결적으로 기록되지 않는다. 두 항목 모두 구현 착수를 차단하는 CRITICAL 수준은 아니나, 빌드타임 가드 누락은 impl-prep 이후 규약 갱신이 적절한 WARNING 이다.

---

## 위험도

LOW
