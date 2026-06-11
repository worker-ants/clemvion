# Convention Compliance Review

**Target**: `plan/in-progress/prod-fail-closed-guards.md`
**Mode**: spec draft 검토 (--spec)
**Date**: 2026-06-11

---

## 발견사항

### [INFO] 문서 구조 — Overview 섹션 부재
- **target 위치**: 문서 전체 구조 (`## 핵심 de-risk` / `## 변경` / `## Spec` / `## 체크리스트` / `## Rationale`)
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "Overview / 본문 / Rationale 3섹션 권장"
- **상세**: CLAUDE.md 는 spec 문서에 Overview / 본문 / Rationale 3섹션 구성을 권장한다. 본 문서는 plan 문서이므로 spec 에 대한 구조 규약의 직접 적용 대상은 아니다. 그러나 plan 문서의 도입부 (`## 핵심 de-risk`) 가 "Overview" 역할을 비슷하게 수행하고 있고 `## Rationale` 이 정상 포함돼 있어 의도적 구성으로 판단된다.
- **제안**: 현 구조(de-risk/변경/Spec/체크리스트/Rationale)는 plan 문서의 실용적 형식으로 허용 가능. 단 "3섹션 권장" 은 spec 문서를 주 대상으로 하므로 별도 조치 불요.

### [INFO] Spec 섹션 — 파일 경로 생략 (단축 참조)
- **target 위치**: `## Spec` 섹션 (`1-auth.md §2.1`, `secret-store.md §3.3`, `11-mcp-client.md §본문`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` — `spec-link-integrity.test.ts` 는 `spec/**.md` 본문 in-repo 링크의 타깃 존재를 강제. 단, 이 가드는 spec 파일에만 적용되며 `plan/**` 파일은 대상 외.
- **상세**: plan 문서의 `## Spec` 섹션이 전체 경로 없이 basename만으로 spec 파일을 참조한다 (`1-auth.md`, `secret-store.md`, `11-mcp-client.md`). 실제 파일은 `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/5-system/11-mcp-client.md` 로 모두 실존한다. plan 문서 링크는 `spec-link-integrity.test.ts` 의 검증 대상이 아니므로 build 차단은 없다.
- **제안**: 가독성·유지보수를 위해 전체 경로 참조로 교체하는 것을 권장하지만 규약 위반은 아니다.

---

## 준수 확인 사항 (pass)

- **Frontmatter 필수 3필드 준수**: `worktree: prod-fail-closed-guards`, `started: 2026-06-11`, `owner: developer` — `plan-lifecycle.md §4` + `plan-frontmatter.test.ts` 요건 충족.
- **`worktree` sentinel 정책 준수**: 실제 worktree 이름(`prod-fail-closed-guards`)이 명시돼 있고 placeholder/TBD 사용 없음. `plan-lifecycle.md §4` 의 sentinel 규칙 충족.
- **`started` 날짜 형식 준수**: `2026-06-11` — ISO YYYY-MM-DD 형식 준수.
- **`spec_impact` 미선언 — 정상**: `plan-lifecycle.md §4 Gate C` 에 따라 `spec_impact` 는 `plan/complete/` 이동 시에만 의무이며 `in-progress` 단계에는 의무 없음. `started: 2026-06-11 ≥ cutoff(2026-06-04)` 이므로 완료 시 반드시 선언 필요하나 현재 미선언은 정상.
- **금지 패턴 미사용**: `plan/complete/archive/from-*/` 신규 생성 없음. 불허 위치(`plan/*.md` 최상위) 에 문서 없음 — `plan/in-progress/` 에 정상 위치.
- **체크리스트 포함**: `[ ]` 미체크 항목 존재 — `plan-lifecycle.md §2` 기준 `in-progress/` 위치가 정확히 맞음.
- **Rationale 섹션 존재**: CLAUDE.md 권장 3섹션 중 Rationale 정상 포함.
- **referenced spec 파일 실존 확인**: `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md`, `spec/5-system/11-mcp-client.md` 모두 실존.

---

## 요약

`plan/in-progress/prod-fail-closed-guards.md` 는 정식 규약을 대체로 잘 준수하고 있다. Plan frontmatter 필수 3필드(`worktree`/`started`/`owner`) 가 모두 올바른 형식으로 존재하고, `worktree` sentinel 정책과 `spec_impact` 미선언(in-progress 단계 정상)도 규약에 부합한다. 발견된 항목 2건은 모두 INFO 등급으로 build 가드 차단이 없는 형식 제안 수준이다. 채택을 막을 규약 위반은 없다.

---

## 위험도

NONE
