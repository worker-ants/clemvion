# 정식 규약 준수 검토 — `spec/7-channel-web-chat/3-auth-session.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `## Overview` 섹션 부재

- **target 위치**: 문서 전체 구조 (섹션 목록: `## 1.` / `## 2.` / `## 3.` / `## Rationale`)
- **위반 규약**: CLAUDE.md "단일 진실 원칙" 및 `.claude/skills/project-planner/SKILL.md §16` — "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)"
- **상세**: 권장 3섹션 구조(Overview / 본문 / Rationale) 중 `## Overview` 섹션이 없다. 동 영역 sibling인 `spec/7-channel-web-chat/4-security.md`는 `## Overview`를 명시적으로 포함하고 있어 같은 영역 내 일관성이 깨진다. 본 문서의 제목 바로 아래 인라인 인용문(`> 관련: ...`)이 개요 역할을 하고 있으나 정식 섹션 헤딩 없이 작성되어 있다.
- **제안**: `## Overview` 헤딩 아래 1~3문장으로 "본 spec이 다루는 범위 — 공개 위젯의 인증 없는 트리거 호출, per_execution 토큰 전략, 세션 시퀀스, 재로드 복원 절차"를 요약하여 추가. 단, 프로젝트 관례상 "권장(권고)"이지 빌드 차단 가드 대상은 아님. sibling 패턴 통일을 원하면 수정.

---

### [INFO] `§3.1` 본문에서 스토리지 종류 표기 불일치

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` line 49 vs line 54
- **위반 규약**: `spec/conventions/` 직접 위반은 아니나, 단일 진실 원칙(CLAUDE.md) — 동일 개념의 표기가 같은 문서 안에서 달라지면 독자가 의미를 달리 추론할 수 있음
- **상세**:
  - line 49: `iframe-origin **sessionStorage**` (스토리지 종류 명시)
  - line 54 (§3.1 본문): `iframe-origin storage` (종류 미명시 — 제네릭 표현)
  §3 bullet에서 `sessionStorage`로 명확히 했으나 §3.1 시퀀스 본문은 여전히 `storage`라는 제네릭 표현을 쓴다. R6 Rationale이 `sessionStorage`를 명시적으로 선택한 결정을 설명하고 있으므로 본문 표기도 통일하는 것이 명세의 일관성 측면에서 바람직하다.
- **제안**: `spec/7-channel-web-chat/3-auth-session.md` line 54를 `iframe-origin **sessionStorage**` 로 통일. (`storage` 잔존은 기술적 오류는 아니나 독자가 "어떤 storage인지" 다시 Rationale을 뒤져야 하는 인지 부담을 줌.)

---

### [INFO] Rationale 번호 R1·R2 공백 — 번호 체계 일관성

- **target 위치**: `## Rationale` 섹션 — R3, R4, R5, R6만 존재
- **위반 규약**: 직접 규약 위반 없음. 단, 번호 불연속성은 독자에게 "R1·R2가 삭제됐는가 또는 다른 문서에 있는가"를 혼동시킬 수 있음
- **상세**: 현재 Rationale에 R1·R2가 없고 R3부터 시작한다. 이는 spec 초기 draft 또는 이전 버전에서 R1·R2에 해당하는 내용이 삭제되었거나 처음부터 해당 번호를 건너뛰고 작성된 것으로 보인다. 관련 규약 문서(`spec-impl-evidence.md`, `audit-actions.md` 등)에는 Rationale 번호 연속성 의무가 없으므로 빌드 차단 대상은 아니다.
- **제안**: 번호를 R1부터 재번호화(R3→R1, R4→R2, R5→R3, R6→R4)하거나, 또는 R1·R2가 의도적으로 없는 경우 코멘트로 명시. 본문 §R3·§R6 cross-reference도 함께 갱신 필요.

---

### [INFO] `(N1)` 표기 — 비정식 annotation 기호

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` line 99 — `**§3.1 재로드 복원(N1)은 보존된다**`
- **위반 규약**: 직접 규약 위반 없음. `spec/conventions/` 어디에도 `(N1)` 스타일 in-doc annotation 표기 규약이 존재하지 않음
- **상세**: `(N1)`은 이 문서 내에서 단 한 번 등장하며 정의나 글로서리 없이 쓰인다. 다른 spec 문서에서 이 기호를 convention으로 쓰는 사례가 없다(cafe24 API 카탈로그의 `N1`은 Cafe24 자체 상태코드 값으로 완전히 다른 의미). 독자가 `(N1)`의 의미를 추론해야 한다.
- **제안**: `(N1)`을 제거하거나 `(§3.1 요구사항)`처럼 명시적 섹션 참조로 대체. 또는 `(재로드 복원 요건)`처럼 인라인 설명으로 풀어쓸 것.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md`는 정식 규약의 핵심 요건(frontmatter `id`/`status`/`code:` — `spec-impl-evidence.md` §2 준수, `status: implemented` + 3개 실존 코드 경로, kebab-case `id`, `_product-overview.md` 및 영역 index에서 링크됨)을 모두 충족하고 있다. 발견된 4건은 모두 INFO 등급으로 — 빌드 차단 가드 위반이나 invariant 파괴는 없다. 주요 개선 여지는 (1) 권장 3섹션 구조에서 `## Overview` 헤딩 부재, (2) `sessionStorage` vs `storage` 표기 불일치(본문 §3.1), (3) Rationale 번호 불연속(R3부터 시작), (4) 비정식 `(N1)` annotation 기호 사용이다. 규약 자체의 갱신이 필요한 사항은 없다.

## 위험도

NONE
