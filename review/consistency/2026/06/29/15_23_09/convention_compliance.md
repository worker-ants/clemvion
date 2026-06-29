# Convention Compliance Review — `spec/conventions/user-guide-evidence.md`

검토 모드: spec draft (--spec)  
검토 대상: `/Volumes/project/private/clemvion/.claude/worktrees/spec-userguide-evidence-sync-cc513c/spec/conventions/user-guide-evidence.md`  
기준 규약: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/i18n-userguide.md`  
차분 요약: main 대비 §2.1 에 `spec frontmatter user_guide:` 가드 관계 bullet 1건 추가됨.

---

## 발견사항

### [CRITICAL] §2.1 신규 bullet 이 `spec-impl-evidence.md Rationale R-10` 을 SoT 로 지목하나 R-10 은 존재하지 않음

- **target 위치**: `spec/conventions/user-guide-evidence.md` §2.1 다른 가드와의 관계, 마지막 bullet (line 86)
  > `그 로케일 쌍(…) 등재 기준과 가드 미적용 근거는 [spec-impl-evidence.md §2.1](./spec-impl-evidence.md) + 동 문서 Rationale R-10 가 SoT.`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` — Rationale 섹션은 R-1 ~ R-9 까지만 존재. R-10 은 정의되어 있지 않음. 또한 `spec/conventions/spec-impl-evidence.md §2.1` 의 `user_guide` 필드 정의에는 로케일 쌍 등재 기준·가드 미적용 근거에 대한 설명이 없음.
- **상세**: 본 bullet 은 `user_guide:` 필드의 로케일 쌍(`<name>.mdx` + `<name>.en.mdx`) 등재 기준과 build-time 가드 미적용 근거를 `spec-impl-evidence.md Rationale R-10` 이 SoT 라고 단언한다. 그러나 `spec-impl-evidence.md` 에는 R-10 이 존재하지 않는다(R-9 까지). `spec-impl-evidence.md §2.1` 도 `user_guide` 를 "선택 / 가이드 페이지 cross-link" 한 줄만 기술하며 로케일 쌍 기준·가드 미적용 근거는 없다. 이 상태에서 SoT 참조가 깨진 채 문서가 채택되면, 독자가 R-10 을 찾으러 가도 찾을 수 없어 invariant 가 깨진다.
- **제안**: 두 가지 중 하나를 선택해야 함.
  1. `spec-impl-evidence.md` 에 R-10 을 실제로 추가하고(`user_guide:` 필드의 로케일 쌍 기준 + 가드 미적용 근거), `spec-impl-evidence.md §2.1` 본문에도 해당 내용을 보강한 뒤 본 bullet 의 링크를 유지.
  2. R-10 참조를 삭제하고, `spec-impl-evidence.md §2.1` 링크만 남기되 그 절이 충분한 근거를 담도록 갱신. 또는 근거를 본 문서 Rationale 에 새 항목(R-6)으로 직접 기술.

---

### [WARNING] §5 "후속으로 i18n-userguide.md §Principle 7 본문에 … 명시한다" — 이미 완료된 작업이 미래형으로 기술됨

- **target 위치**: `spec/conventions/user-guide-evidence.md` §5 마지막 줄 (line 161)
  > `후속으로 i18n-userguide.md §Principle 7 본문에 본 가드의 부분 커버 범위를 명시한다.`
- **위반 규약**: `spec/conventions/i18n-userguide.md §Principle 7` 은 이미 `<ImplAnchor kind="ui-entry">` 동반 의무 + 3개 가드 + SoT 링크를 포함하는 "자동 검출 — 부분 커버" 절을 보유(line 170-174). 즉 "후속으로 명시한다" 는 액션은 이미 완료되어 있다. CLAUDE.md 정보 저장 위치 원칙 — 문서는 현재 사실을 반영해야 하며 완료된 사항을 미래 액션으로 기술하면 stale 상태가 됨.
- **상세**: 이 문장이 그대로 남으면 독자가 §Principle 7 업데이트가 아직 안 됐다고 오해해 중복 작업을 시도하거나, 이미 완료된 사실을 후속 plan 으로 추적하는 오탐이 발생할 수 있다. conventions 문서의 "현행 상태 기술" 원칙(CLAUDE.md 상 실제 동작 상태만 서술) 과 충돌.
- **제안**: 해당 줄을 삭제하거나, 완료 사실을 반영하는 서술로 교체한다. 예: `spec/conventions/i18n-userguide.md §Principle 7 "자동 검출 — 부분 커버" 절에 본 가드의 커버 범위가 이미 명시되어 있다.`

---

### [INFO] frontmatter `user_guide:` 필드 없음 — 선택 필드이나 다른 conventions 문서와 일관성 고려

- **target 위치**: `spec/conventions/user-guide-evidence.md` frontmatter (line 1-10)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `user_guide:` 는 선택 필드. 의무 아님.
- **상세**: 본 문서는 유저 가이드 컨벤션 자체를 정의하는 spec 임. `spec/2-navigation/13-user-guide.md §공용 MDX 컴포넌트` 가 관련 가이드 페이지이나 frontmatter `user_guide:` 에 등재되어 있지 않다. 필수 사항이 아니므로 CRITICAL/WARNING 은 아니지만, 자기가 정의하는 가이드 컴포넌트와 연결된 가이드 페이지가 있다면 cross-link 등재 일관성 측면에서 고려할 만하다.
- **제안**: 선택 사항. `user_guide: - codebase/frontend/src/content/docs/...` 경로가 실존한다면 추가 검토.

---

## 요약

target 문서(`spec/conventions/user-guide-evidence.md`)의 전체 구조(frontmatter, Overview / 본문 1~5절 / Rationale R-1~R-5)는 CLAUDE.md 가 규정하는 3섹션 권장 구조, `spec/conventions/` 명명 패턴, `spec-impl-evidence.md` 의 frontmatter 스키마(`id`, `status: implemented`, `code:`)를 올바르게 준수한다. 이번 diff 에서 추가된 §2.1 의 신규 bullet 은 방향·내용 모두 적절하나, `spec-impl-evidence.md Rationale R-10` 을 SoT 로 참조하면서 해당 R-10 이 실제로 존재하지 않는다는 결정적 문제(CRITICAL 1건)가 있다. 또한 §5 의 "후속으로 … 명시한다" 문장이 이미 완료된 사실을 미래형으로 기술하는 stale 표현(WARNING 1건)도 정리가 필요하다.

---

## 위험도

**HIGH** — CRITICAL 1건(R-10 dangling reference): 채택 시 독자가 SoT 를 찾을 수 없어 `user_guide:` 필드의 로케일 쌍 기준·가드 미적용 근거가 문서화 공백으로 남는다.
