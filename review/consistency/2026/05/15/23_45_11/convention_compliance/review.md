# 정식 규약 준수 Review

**검토 대상**: `plan/in-progress/spec-draft-brand-rollback.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-15

---

## 발견사항

### 1. **[INFO]** plan 문서 frontmatter `owner` 필드 표기 방식 — 규약 예시 값 범위

- **target 위치**: 파일 상단 frontmatter (`owner: project-planner`)
- **위반 규약**: `CLAUDE.md` §개발방법론 > PLAN 문서 라이프사이클 > frontmatter 메타데이터
- **상세**: 규약 예시는 `owner: planner / developer / 사용자 본인 등` 으로 자유 기재임. `project-planner` 는 skill 이름 그대로 사용한 것으로 허용 범위 내이나, 규약 예시에서 제시한 단어(예: `planner`)보다 구체적이어서 다른 문서와 미묘한 표기 불일치가 생길 수 있다.
- **제안**: `owner: planner` 로 단축하면 규약 예시 표기와 통일된다. 단, 현재 표기가 규약을 직접 위반하지는 않으므로 변경 여부는 선택 사항.

---

### 2. **[INFO]** R-12 내 rollback 세션 경로 플레이스홀더 미완성

- **target 위치**: `## Rationale (개정)` > R-12 갱신 > 4차 항목 — `review/consistency/2026/05/15/<rollback_session>/`
- **위반 규약**: `CLAUDE.md` §명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` (nested ISO 형식)
- **상세**: R-12 의 4차 세션 경로가 `<rollback_session>` 플레이스홀더로 남아있다. 실제 세션 경로(`23_45_11` 등)가 확정된 이후 spec 에 반영될 예정임을 명시하지 않으면, spec 에 그대로 들어갈 경우 규약을 따르지 않는 경로 표현이 문서에 고착된다.
- **제안**: spec 반영 시 `<rollback_session>` 을 실제 세션 타임스탬프 (예: `23_45_11`) 로 교체한다. plan draft 단계에서는 허용 가능한 플레이스홀더이나, Write 직전에 반드시 치환해야 함을 체크리스트 항목으로 명시하는 것을 권장.

---

### 3. **[INFO]** 동반 동기화 Rationale 내 rollback 세션 경로 동일 플레이스홀더

- **target 위치**: `## 동반 동기화 — spec/2-navigation/10-auth-flow.md §1` > R-2 갱신 마지막 행 — `<rollback 세션>`
- **위반 규약**: `CLAUDE.md` §명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`
- **상세**: 발견사항 2 와 동일한 문제. spec 에 반영될 때 실제 세션 경로로 치환이 필요하다.
- **제안**: spec Write 시 실제 타임스탬프로 교체. 현재 plan draft 단계에서의 플레이스홀더 자체는 허용.

---

### 4. **[INFO]** `spec/6-brand.md` 제목 변경 — `PRD:` prefix 제거 방향은 규약에 부합

- **target 위치**: `## Drop-in 대체 범위` 표 — `spec/6-brand.md` 제목 행
- **위반 규약**: `CLAUDE.md` §명명 컨벤션 — 옛 `prd/` 경로 컨벤션 금지
- **상세**: 기존 제목 `# PRD: 브랜드 가이드 — Clemvion` 에서 `PRD:` prefix 를 제거하는 방향이다. 규약상 `prd/` 경로 컨벤션 및 PRD 라는 명칭은 `spec/` 으로 흡수되었으므로, 이 변경은 규약에 정확히 부합한다. 위반 없음. 오히려 적극 권장되는 정정.
- **제안**: 해당 없음 (규약 준수).

---

### 5. **[INFO]** plan 문서에 spec 본문 drop-in 내용 직접 포함 — 이중 진실 원칙 관찰

- **target 위치**: `## 신 §8 본문 (drop-in)` 전 구간 (§8.2 ~ §8.6)
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 (단일 진실 원칙) — spec 본문은 `spec/<영역>/*.md` 가 책임
- **상세**: plan 문서에 spec 의 실제 본문(§8.2 ~ §8.4.6 등)을 draft 형태로 직접 포함하는 패턴이다. 이는 반영 전의 "초안 보관" 용도로, plan 이 완료되면 spec 으로 Write 되고 plan 은 `complete/` 로 이동하는 전형적인 SDD 워크플로이다. 따라서 단일 진실 원칙 위반이 아니며, 규약이 허용하는 draft-in-plan 패턴이다. 다만 반영 완료 후 plan 이 `complete/` 로 이동되지 않으면 spec 과 plan 두 곳에 동일 내용이 남아 이중 진실이 발생할 수 있다.
- **제안**: 이미 plan 정리 사항 섹션에서 `plan/complete/` 로 이동을 명시했으므로 적절히 계획되어 있다. 반영 완료 즉시 `git mv` 를 수행할 것.

---

## 요약

`plan/in-progress/spec-draft-brand-rollback.md` 는 CLAUDE.md 및 `spec/conventions/` 정식 규약의 요구 사항을 전반적으로 잘 준수하고 있다. frontmatter 의 필수 3개 필드(`worktree`, `started`, `owner`) 가 모두 존재하고, plan 은 `plan/in-progress/` 에 올바르게 위치하며, 검토 세션 경로는 nested ISO 형식(`review/consistency/2026/05/15/...`)을 따른다. 옛 `prd/` prefix 제거 방향도 규약에 정확히 부합한다. 발견된 사항 4건은 모두 INFO 등급으로, spec 에 반영될 때 플레이스홀더(`<rollback_session>`, `<rollback 세션>`)를 실제 타임스탬프로 치환하는 것이 유일한 후속 조치다. CRITICAL 또는 WARNING 위반은 없으며, 이 draft 의 spec 반영을 차단할 사유가 없다.

---

## 위험도

LOW
