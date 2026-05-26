# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-update-user-guide-mobile.md`
**검토 모드**: spec draft 검토 (`--spec`)
**검토일**: 2026-05-26

---

## 발견사항

### [INFO] Rationale 항목의 번호 자리표시자 `R-x` 미확정

- **target 위치**: `## 정정 후보 > spec/2-navigation/13-user-guide.md 신규 ## Rationale 항목` 블록
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` 및 CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 정정안으로 제안된 Rationale 항목 제목이 `R-x` 로 자리표시자 상태다. plan 문서 자체가 "정정 후보" 를 담는 초안 성격이므로 직접 위반은 아니지만, spec 에 실제로 적용될 때는 기존 Rationale 번호 순서와의 연속성을 확인해야 한다. 현재 `spec/2-navigation/13-user-guide.md` 를 열어 보면 해당 spec 에는 아직 `## Rationale` 섹션 자체가 없다. 따라서 번호는 `R-1` 로 시작해야 하며, plan 이 `R-x` 를 그대로 두면 적용 시 혼동이 생길 수 있다.
- **제안**: 체크리스트 "Rationale R-x 추가" 항목 옆에 "(R-1 로 시작 — 현 spec 에 Rationale 섹션 없음)" 주석을 달아 적용자가 번호를 `R-1` 로 확정하도록 안내한다.

---

### [INFO] `spec/2-navigation/13-user-guide.md` frontmatter 현황과 정정안 간 `status` 전이 명시 누락

- **target 위치**: `## 정정 후보 > spec/2-navigation/13-user-guide.md frontmatter` 항목
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3 status 라이프사이클` — 모바일 진입/검색이 이번 PR 에서 구현 완료되면 `spec-only → partial` 또는 `spec-only → implemented` 전이 의무가 발생한다.
- **상세**: 현재 `spec/2-navigation/13-user-guide.md` 의 frontmatter 는 `status: spec-only`, `code: []` 다. plan 의 정정 후보는 `pending_plans: [spec-update-user-guide-mobile]` 등록만 언급한다. 그런데 `pending_plans:` 는 `status: partial` 일 때 의무 필드(`spec-impl-evidence.md §3`)이다. `spec-only` + `pending_plans:` 조합은 규약에서 정의되지 않은 상태며, `spec-status-lifecycle.test.ts` 가드가 `partial` 의 `pending_plans:` 미작성을 검출하지만 `spec-only` 에 `pending_plans:` 를 추가하는 케이스는 가드 범위 밖이므로 조용히 통과한다. 의미상으로는 `partial` 로 격상한 뒤 `pending_plans:` 를 추가하는 것이 규약 의도에 맞는다. 만약 모바일 UI 구현은 이미 완료됐고 spec 만 미갱신이라면 `code:` 에 구현 경로를 채우고 `partial` 전이가 맞다.
- **제안**: 정정 후보 frontmatter 항목에 `status: spec-only → partial` 전이 및 `code:` 에 관련 컴포넌트 경로 추가를 포함시키거나, 현재 `spec-only` 유지가 의도라면 `pending_plans:` 를 plan 에서 제거하고 spec 수정 완료 시 `partial` 전이 체크리스트를 추가한다.

---

## 요약

`plan/in-progress/spec-update-user-guide-mobile.md` 는 plan 라이프사이클 규약(frontmatter 스키마, `in-progress/` 위치, `worktree`·`started`·`owner` 필드, 체크리스트 미완 상태 유지)을 올바르게 준수하고 있다. 문서 구조(배경·정정 후보·체크리스트·의존성)도 plan 성격에 맞게 구성되어 있다. 단 정정 대상 spec(`spec/2-navigation/13-user-guide.md`)에 적용될 내용 중, Rationale 번호가 `R-x` 자리표시자 상태이며 frontmatter `pending_plans:` 추가 시 `status: spec-only` 와의 조합이 `spec-impl-evidence.md` 규약 상 미정의 상태라는 두 가지 경미한 불일치가 발견됐다. CRITICAL 위반은 없다.

---

## 위험도

LOW
