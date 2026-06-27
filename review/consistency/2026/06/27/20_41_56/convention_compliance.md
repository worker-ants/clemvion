# 정식 규약 준수 검토 — spec/7-channel-web-chat/4-security.md

검토 모드: spec draft (--spec)
검토 시각: 2026-06-27

---

## 발견사항

### [WARNING] `code:` 프론트엔드 렌더러 경로 누락

- **target 위치**: frontmatter `code:` 목록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 "본 spec 이 약속한 surface 의 구현 경로" 의무 열거 (`status: partial` 시 ≥1 매치 강제)
- **상세**: §1.1 마크다운/HTML sanitize 정책 매트릭스는 위젯(`safe-html.ts`)과 메인 앱(`markdown-renderer.tsx`) 두 렌더 표면에 대해 명시적으로 보안 동등성을 보장한다고 약속한다. 위젯 SoT(`codebase/channel-web-chat/src/lib/safe-html.ts`)는 `code:` 에 등재돼 있으나, 메인 앱 SoT(`codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx`)는 누락돼 있다. spec 이 해당 경로에 대해 "보안 동등성" + "unit 검증" 을 약속하므로 owned surface 로 간주해야 한다. 이 상태로 `status: implemented` 로 승격되면 `spec-code-paths.test.ts` 가 이 경로 실존을 검증하지 못한다.
- **제안**: `code:` 에 `codebase/frontend/src/components/editor/assistant-panel/markdown-renderer.tsx` 추가. 또는, 해당 경로의 보안 책임을 다른 spec 이 소유한다면 §1.1 에 "메인 앱 sanitize 정책의 spec 소유는 `<영역>/<파일>` 에 위임" 을 명시하고 본 spec 의 `code:` 에서 제외하는 방안 중 하나를 선택.

---

### [INFO] `id` 가 basename 과 불일치

- **target 위치**: frontmatter `id: web-chat-security`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- **상세**: 파일 basename 은 `4-security` 이나 `id` 는 `web-chat-security` 를 사용한다. 동일 규약은 다른 영역에 동명 basename 이 존재할 때 영역 prefix 로 충돌을 회피하는 패턴을 허용하므로, 이 자체는 규약 위반이 아니다. 다만 basename 과 id 의 불일치가 명시적 disambiguation comment 없이 이루어져 검토자가 의도인지 오기인지 판별하기 어렵다.
- **제안**: 문서에 짧은 인라인 주석(`<!-- id: web-chat-security (basename 4-security 와 의도적으로 다름 — 타 영역 4-security 와 id 충돌 방지) -->`)을 추가하거나, 규약이 허용하는 패턴임을 frontmatter 상단 주석으로 명시. 아니면 단순히 현 상태 유지(INFO 수준이므로 차단 아님).

---

### [INFO] `## Overview (제품 정의)` 섹션 부재

- **target 위치**: 문서 전체 구조 — `## 1. 보안 정책 요약` 으로 바로 시작
- **위반 규약**: `.claude/skills/project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션 권장
- **상세**: 문서가 `## Rationale` (§R1~R4) 을 포함하고 있어 3섹션 중 2개(본문·Rationale)를 갖추고 있다. `## Overview (제품 정의)` 섹션이 없고 바로 §1 본문으로 진입한다. 영역 레벨에 `_product-overview.md` 가 별도 존재하므로 제품 가치·목표 커버리지는 영역 차원에서 충족된다. SKILL.md 는 "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 로 Product Overview 를 분리할 수 있다고 명시하므로, 개별 서브 spec 에 `## Overview` 가 없는 것은 이 패턴에 부합한다. 엄밀히 위반은 아니나, 해당 문서가 다루는 보안 표면의 범위와 목적을 한 단락으로 선언하면 가독성이 개선된다.
- **제안**: 최소한 `## Overview` 를 한 문단 추가해 "본 spec 이 다루는 보안 영역 (CORS·임베드 검증·남용 방어·sanitize·프라이버시)" 범위를 선언. 또는 현 상태 유지(INFO, 권장사항).

---

## 요약

`spec/7-channel-web-chat/4-security.md` 는 frontmatter 필수 필드(id/status/code/pending_plans)를 올바르게 보유하고, `status: partial` 에 따른 `pending_plans` 의무를 충족하며(두 plan 파일 모두 `plan/in-progress/` 에 실존), Rationale 섹션을 갖춘다. 핵심 위반은 §1.1 이 메인 앱 렌더러(`markdown-renderer.tsx`)에 대한 보안 동등성을 약속하면서도 해당 경로를 `code:` 에 열거하지 않은 것(WARNING)으로, `status` 승격 시 `spec-code-paths` 가드가 이 경로를 검증하지 못하게 된다. 나머지는 basename 불일치(INFO)와 Overview 섹션 부재(INFO, `_product-overview.md` 패턴으로 부분 완화)다. 금지 항목(레거시 패턴·명시적 금지 구조)에 해당하는 위반은 발견되지 않았다.

## 위험도

LOW
