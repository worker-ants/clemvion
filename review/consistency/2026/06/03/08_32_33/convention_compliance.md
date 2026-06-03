# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-system-status-recent-failed.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-03

---

## 발견사항

### [INFO] plan frontmatter — `owner` 값 표기 이상 없음, `worktree` 필드 정상
- target 위치: plan 파일 frontmatter (1–5행)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4`
- 상세: `worktree: system-status-recent-failed-86831b`, `started: 2026-06-03`, `owner: planner` 세 필드 모두 정상 작성됨. 규약 준수.
- 제안: 해당 없음 (이상 없음 확인).

---

### [INFO] DTO 명세 블록에 언어 지정자 없는 코드 펜스 사용
- target 위치: `## A. 16-system-status-api.md 변경안 > §2 API — DTO 변경` 코드 블록
- 위반 규약: `spec/conventions/swagger.md` — 직접 금지 조항은 없으나 해당 규약이 TypeScript 예시를 코드 언어 지정자(`ts`, `typescript`)와 함께 제시함
- 상세: DTO 스키마 정의 블록이 `\`\`\`` (언어 지정자 없음) 로 열려 있어 syntax highlighting 이 적용되지 않음. spec 내 DTO 서술 형식이므로 순수 구조체(pseudo-code)임을 명시하거나, 실제 TypeScript 클래스 형태로 제시하는 것이 swagger 규약과 일관됨.
- 제안: DTO 예시 블록을 `\`\`\`ts` 로 변경하거나, pseudo-code 임을 주석으로 명기. 규약 강제 사항은 아니므로 INFO.

---

### [WARNING] `pending_plans` 경로가 실제 plan 파일명과 불일치
- target 위치: `## 0. spec frontmatter status 전이 체크리스트` — `pending_plans: [plan/in-progress/system-status-recent-failed.md]`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans` 값은 `plan/in-progress/` 에 실존하는 파일 경로 의무; `spec-pending-plan-existence.test.ts` 가드가 경로 실존 검증
- 상세: 초안에서 지정한 `pending_plans` 값은 `plan/in-progress/system-status-recent-failed.md` 이다. 그런데 워크트리에는 `plan/in-progress/spec-draft-system-status-recent-failed.md` (현재 초안 파일 자체)와 `plan/in-progress/system-status-recent-failed.md` 두 파일이 모두 존재함을 확인했다. 구현 plan 파일(`system-status-recent-failed.md`)이 실존한다면 경로가 맞지만, 만약 해당 구현 plan 이 아직 없거나 파일명이 다르면 가드(`spec-pending-plan-existence.test.ts`)가 빌드 실패를 유발한다. 실존이 확인되었으나 spec 적용 시 경로 타이핑 오류 가능성 주의 필요.
- 제안: spec 에 frontmatter 를 실제로 적용하는 시점에 `plan/in-progress/system-status-recent-failed.md` 가 존재하는지 재확인하고 경로를 정확히 기재. 현재 파일은 존재하므로 실제 적용 시 이상 없을 것으로 보임.

---

### [WARNING] `§3 health 파생 규칙` 변경안에서 규칙 번호 표기만 "3" 으로 시작해 규칙 1·2 맥락이 본문에 없음
- target 위치: `## A. §3 health 파생 규칙 변경` — "규칙 3만 교체" 서술
- 위반 규약: CLAUDE.md 문서 구조 규약 — spec 문서 본문은 self-contained 해야 하며, 변경안이 spec 파일에 적용될 때 완결된 규칙 세트를 제공해야 함. `spec/conventions/spec-impl-evidence.md` 의 단일 진실 원칙 참조.
- 상세: plan 초안이 "규칙 3만 교체(규칙 1·2 불변)"로 서술하면서 규칙 1과 2의 내용을 생략했다. spec 자체(`16-system-status-api.md`)를 편집하는 개발자가 이 초안만 보고 spec §3 전체를 재구성할 때, 규칙 1·2 가 원문에서 어떻게 정의돼 있는지 초안에 없어 원문을 반드시 참조해야 한다. 이는 plan 초안이 단독 지시서로 동작하기 어렵게 한다는 점에서 주의가 필요하다.
- 제안: 규칙 3 교체안 기술 시 완성된 §3 전체 목록(규칙 1·2 원문 + 변경된 규칙 3)을 초안에 포함하는 것이 권장됨. 또는 명시적으로 `spec §3 원문을 선행 참조할 것` 안내 추가.

---

### [INFO] `spec/2-navigation/_product-overview.md` `_` prefix 처리 근거 명시 — 규약 준수
- target 위치: `## 0. spec frontmatter status 전이 체크리스트` — `_product-overview.md` 항목
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 제외 조항
- 상세: `_product-overview.md` 가 `_` prefix 로 frontmatter 가드 제외 대상임을 명시적으로 기재하고 status 변경 불필요로 처리함. `spec-impl-evidence.md §1` 의 "밑줄 prefix — leaf 가 아닌 layout/index 성격" 제외 규칙을 올바르게 적용함.
- 제안: 해당 없음 (정상 준수 확인).

---

### [INFO] DTO 파일명 규약 참조 (`swagger §5-1`) 정확히 인용됨
- target 위치: `## A. §2 — 구현 노트(DTO 파일명)` 항목
- 위반 규약: `spec/conventions/swagger.md §5-1`
- 상세: "DTO 파일명은 swagger 규약 §5-1 에 따라 `*-response.dto.ts` 패턴 유지(`system-status-response.dto.ts`)" 로 규약 섹션을 정확히 인용. 신규 필드는 기존 클래스에 `@ApiProperty` 로 추가하는 방식도 swagger 규약 §1-1/1-2 와 일치함.
- 제안: 해당 없음 (정상 준수 확인).

---

### [INFO] Rationale 섹션 구성 — 권장 3섹션 구조에서 Rationale 가 존재하나 Overview 섹션 표기 없음
- target 위치: plan 파일 전체 구조 (`## A`, `## B`, `## C`, `## D`, `## 진행 체크리스트`)
- 위반 규약: CLAUDE.md 문서 구조 규약 — spec 문서는 Overview / 본문 / Rationale 3섹션 권장
- 상세: 이 파일은 plan 초안(spec draft plan)이지 spec 파일 자체가 아니므로, spec 의 3섹션 구조 요건이 plan 파일에 직접 적용되지는 않는다. spec 변경안(A·B)에는 각각 `Rationale R-5`, `Rationale R-3` 섹션이 포함되어 있어 spec 적용 후의 3섹션 구조를 갖추고 있음.
- 제안: 해당 없음 (plan 파일 형식은 `plan-lifecycle.md §4` 스키마를 따르며 spec 3섹션 구조 적용 대상이 아님).

---

### [WARNING] spec 적용 후 `spec/5-system/16-system-status-api.md` 의 `code:` glob 유효성 재검토 필요
- target 위치: `## 0. spec frontmatter status 전이 체크리스트` — "code: glob 은 기존 매치 유지 → 가드 통과" 설명
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `code:` ≥1 매치 의무(`spec-code-paths.test.ts` 가드)
- 상세: 초안은 "기존 매치 유지 → 가드 통과" 로 처리하는데, `status: implemented` → `partial` 전환 후에도 기존 `code: codebase/backend/src/modules/system-status/**` glob 이 여전히 ≥1 파일을 매칭하는지는 실제 파일시스템 상태에 따라 달라진다. 현재 spec 파일에는 구현 코드가 있으므로 통과 가능성이 높으나, 명시적 검증 단계가 없다.
- 제안: `진행 체크리스트` 에 "spec 파일 `partial` 전환 후 `spec-code-paths.test.ts` 통과 확인" 항목을 추가하는 것이 안전하다. 현재 체크리스트의 "재-consistency-check BLOCK: NO 확인" 항목이 어느 정도 커버하지만 명시성이 부족함.

---

## 요약

`plan/in-progress/spec-draft-system-status-recent-failed.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. plan frontmatter 스키마(`plan-lifecycle.md §4`)를 올바르게 작성했으며, `_product-overview.md` 의 `_` prefix 처리, DTO 파일명 규약(`swagger §5-1`), `pending_plans` 경로 지정 등 핵심 규약들을 정확히 인용하고 있다. 주요 주의사항은 두 가지다: (1) `pending_plans` 에 지정된 `plan/in-progress/system-status-recent-failed.md` 경로가 실제 spec 적용 시점에도 실존하는지 확인 의무(`spec-pending-plan-existence.test.ts` 가드), (2) `status: implemented` → `partial` 전환 후 `code:` glob 이 ≥1 매치를 유지하는지 명시적으로 검증하는 체크리스트 항목 보강 권장. CRITICAL 위반은 없다.

## 위험도

LOW
