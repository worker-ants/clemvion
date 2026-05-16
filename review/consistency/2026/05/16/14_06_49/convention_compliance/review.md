# 정식 규약 준수 Review

대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-16

---

## 발견사항

- **[INFO]** plan 문서가 spec 문서가 아닌 plan/in-progress/ 에 위치하는 것은 적합하나, 문서 제목이 "Spec Draft" 로 혼재
  - target 위치: 문서 제목 `# Spec Draft — Cafe24 HMAC 알고리즘 재정정 (Critical 운영 결함)`
  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — `plan/in-progress/<name>.md` 는 "처리할 항목이 남은 plan" 이며, spec 문서는 `spec/<영역>/*.md` 에 위치해야 한다. plan 파일이 spec draft 내용을 담는 형식은 허용되지만 제목에 "Spec Draft" 를 사용하면 문서 성격이 모호해진다.
  - 상세: 파일이 `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 에 있고 frontmatter 의 `spec_files` 키로 수정 대상 spec 파일을 명시하는 구조는 이 프로젝트에서 통용되는 패턴이다. 그러나 `# Spec Draft` 라는 제목은 본 문서 자체가 spec 초안인 것처럼 읽혀 `plan/` vs `spec/` 의 경계를 흐릴 수 있다.
  - 제안: 제목을 `# Plan — Cafe24 HMAC 알고리즘 재정정 (spec 변경 내역 포함)` 과 같이 plan 성격임을 명시하거나, 현재 관행이 프로젝트 표준이라면 명명 컨벤션 테이블에 `spec-draft-<name>.md` 패턴을 명시적으로 추가하는 것을 권장한다.

- **[INFO]** frontmatter 에 `spec_files` 키 사용 — CLAUDE.md 의 공식 frontmatter 스키마 외 확장 키
  - target 위치: frontmatter `spec_files:` 블록 (lines 8-10 of target)
  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — 공식 frontmatter 스키마는 `worktree`, `started`, `owner` 세 키만 명시한다.
  - 상세: `spec_files` 키는 정식 스키마에 없다. 현재 구조에서는 일관성 검토 시 `plan_coherence` checker 가 이 키를 파싱하지 않을 가능성이 있다.
  - 제안: (a) `spec_files` 를 정식 frontmatter 스키마에 추가하도록 CLAUDE.md 또는 `spec/conventions/` 내 plan 규약 문서를 갱신하거나, (b) spec 파일 목록을 본문 내 별도 섹션(`## 수정 대상 spec 파일`)으로 옮겨 frontmatter 를 공식 3키로 유지한다.

- **[INFO]** Rationale 항 cross-link 가 상대 경로로 작성됨 — 가독성은 양호하나 worktree 외부에서 렌더링 시 경로 불일치 위험
  - target 위치: 변경 1 새 텍스트의 링크 `[Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale)`, 변경 2 CHANGELOG 행의 같은 링크
  - 위반 규약: 직접적인 규약 위반은 아니나, 이 plan 문서는 `plan/in-progress/` 에 위치하고 링크 대상은 `spec/2-navigation/4-integration.md` 이다. 상대 경로 `../../` 를 기준으로 하면 `plan/in-progress/` 에서 두 단계 상위인 루트로 올라가 `spec/2-navigation/4-integration.md` 가 맞으므로 경로 자체는 유효하다.
  - 상세: 렌더러(GitHub, IDE)마다 worktree 최상위가 다를 수 있고, plan 파일이 `plan/complete/` 로 이동 후에도 동일 상대 경로가 유효해야 한다. `plan/complete/` 에서는 동일하게 두 단계 상위가 루트이므로 이동 후에도 경로는 유지된다. 실질적 위험은 낮다.
  - 제안: 명시적으로 루트 기준 경로(`/spec/2-navigation/4-integration.md#rationale`)를 사용하거나, 현재 방식을 유지해도 무방하다. INFO 수준으로만 기록한다.

---

## 요약

`plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 는 CLAUDE.md 의 정식 규약을 전반적으로 잘 준수하고 있다. frontmatter 의 필수 3키(`worktree`, `started`, `owner`)가 모두 존재하고, 옛 `prd/`·`memory/` 경로 사용, 금지된 외부 LLM 호출 패턴 등 명시적 금지 항목은 발견되지 않았다. spec 파일 수정 내용은 `spec/4-nodes/4-integration/4-cafe24.md` 와 `spec/2-navigation/4-integration.md` 를 대상으로 적절히 기술되어 있으며, 변경 3의 Rationale 섹션 추가 방식은 CLAUDE.md 의 권장 3섹션 구성(Overview/본문/Rationale)을 정확히 따른다. 발견된 세 건은 모두 INFO 수준으로, 규약 직접 위반이나 다른 시스템의 invariant 를 깨는 항목은 없다. 다만 `spec_files` 키가 공식 frontmatter 스키마에 포함되지 않은 점은 plan 관련 규약 문서에 보완을 권장한다.

---

## 위험도

LOW
