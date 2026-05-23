# 정식 규약 준수 검토 — `plan/in-progress/spec-harness-impl-coverage.md`

검토 모드: spec draft (--spec)
검토 대상: `plan/in-progress/spec-harness-impl-coverage.md`

---

## 발견사항

### [WARNING] plan frontmatter `owner` 필드 값이 규약 예시와 다름
- **target 위치**: 파일 frontmatter, 3번째 줄 (`owner: project-planner`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — 예시 값은 `planner / developer / 사용자 본인 등`
- **상세**: `plan-lifecycle.md` 의 `owner:` 필드 용도 설명에서 예시는 `planner`, `developer`, `사용자 본인` 형태를 제시한다. `project-planner` 는 Skill 체계의 역할 명칭이고 `planner` 와 의미상 동일하나 규약 예시와 미묘하게 다르다. 기계 파싱(`plan_coherence` checker) 이 `owner` 값을 정규화하지 않는다면 노이즈가 생길 수 있다.
- **제안**: `owner: project-planner` → `owner: planner` 로 정규화하거나, `plan-lifecycle.md §4` 의 예시에 `project-planner` 를 명시적으로 추가해 양쪽을 일치시킨다.

---

### [WARNING] 신설 `spec/conventions/` 파일 2종이 본 plan draft 시점에 아직 존재하지 않음
- **target 위치**: 결정 A (`spec/conventions/spec-impl-evidence.md`), 결정 B (`spec/conventions/user-guide-evidence.md`), §산출물 위치
- **위반 규약**: `CLAUDE.md §정보 저장 위치 (단일 진실 원칙)` — "정식 규약 → `spec/conventions/<name>.md`". `project-planner` 는 spec draft 검토 직후 spec 본문 반영 의무가 있음 (`CLAUDE.md §Skill 체계` — "spec/ 쓰기 직전 `consistency-check --spec` 의무")
- **상세**: 본 plan 은 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 를 신설할 것을 선언하면서, 해당 파일 내용의 상당 부분(frontmatter 스키마, status enum, `<ImplAnchor>` 정의)을 plan 본문 안에 인라인으로 기술하고 있다. consistency-check 시점에서 실제 `spec/conventions/` 경로에 해당 파일이 존재하지 않으므로, 다른 checker 가 spec/conventions 를 참조할 때 "정식 규약이 없는 상태" 로 오인할 수 있다. plan 은 변경 의도를 기술하는 문서이므로 spec 파일 미존재 자체가 plan draft 단계의 위반은 아니나, plan 본문이 사실상 spec 초안을 담고 있어 "단일 진실 원칙" 위반 경계선에 위치한다.
- **제안**: plan 이 머지되기 전에 실제 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 를 draft 상태로라도 생성하거나, plan 본문의 인라인 스키마는 "예정 내용 요약" 임을 명시해 실제 SoT 는 신설 파일임을 분명히 한다. 산출물 위치 절에는 두 파일이 "본 plan 이행 결과 신설" 됨을 명기하면 충분하다.

---

### [WARNING] 결정 C-2 `/spec-coverage` 산출물 경로가 CLAUDE.md 정보 저장 위치 표에 없는 신규 하위 경로를 사용함
- **target 위치**: 결정 C — "산출물 위치: `review/consistency/coverage/<YYYY>/...`"
- **위반 규약**: `CLAUDE.md §정보 저장 위치 (단일 진실 원칙)` — "일관성 검토 산출물: `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`"
- **상세**: 결정 C 는 `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 경로를 산출 위치로 제안하면서 "(신규 최상위 경로 신설 회피)" 라고 자가 주석을 달고 있다. 그러나 `review/consistency/` 아래 `coverage/` 를 추가하면 기존 `review/consistency/<YYYY>/` 패턴과 구조가 달라진다 — 기존 checker 가 `review/consistency/` 의 직계 하위를 연도 디렉토리로 가정한다면 `coverage/` 폴더가 오인될 수 있다. 또한 CLAUDE.md 의 저장 위치 표에는 `coverage/` 하위 경로가 아직 반영되지 않았다 (결정 E-6 에서 반영할 예정이라고 언급하나 현 plan draft 시점에는 규약과 어긋남).
- **제안**: 결정 E-6 에서 CLAUDE.md 정보 저장 위치 표를 갱신할 예정임을 plan 에서 명시했으므로 해당 범위는 수용 가능하나, `/spec-coverage` slash command 의 실제 구현 (후속 plan 5) 이 착수되기 전에 CLAUDE.md 가 먼저 갱신되어야 함을 "의존 순서" 로 명시해야 한다. 혹은 경로를 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 기존 패턴으로 통일하고 SUMMARY.md 파일명으로 구분하는 방안도 고려한다.

---

### [INFO] 결정 A `backlog` status 의 로드맵 매핑 의무가 `spec/0-overview.md §6.3` 에 하드코딩 되어 있음
- **target 위치**: 결정 A, `backlog` enum 정의 — "`spec/0-overview.md §6.3 로드맵` 항목 매칭 의무 (가드)"
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — `spec/0-overview.md` 는 "제품 전체 개요·시스템 아키텍처·cross-cutting 진입" 문서. `spec/conventions/<name>.md` 는 "정식 규약".
- **상세**: `backlog` status 가드가 `spec/0-overview.md §6.3` 을 SoT 로 고정하는 것은 개요 문서가 가드 로직의 입력 데이터 소스가 되는 결합을 만든다. `spec/0-overview.md` 의 §6.3 구조가 변경될 때(섹션 번호 변경, 로드맵 재편 등) 가드가 묵시적으로 깨진다. 이 결합이 신설 `spec/conventions/spec-impl-evidence.md §Rationale` 에 명시될 예정이라면 정보 손실 없이 OK 이지만, 현재 plan 본문에는 해당 trade-off 가 명시되지 않았다.
- **제안**: 신설 `spec-impl-evidence.md §Rationale` 에 "backlog 가드가 `spec/0-overview.md §6.3` 를 참조하는 이유와 §6.3 구조 변경 시 가드 갱신 의무" 를 포함시킨다.

---

### [INFO] plan 본문 내 "의식적 결정 포인트" 절이 실질적 spec Rationale 내용을 이중으로 기술함
- **target 위치**: §의식적 결정 포인트 (7개 항목)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". plan 은 변경 의도·작업 추적 문서이지 Rationale SoT 가 아님.
- **상세**: plan 이 "신설 spec 의 `## Rationale` 로 이전" 한다고 명시하고 있어 자가인식은 정확하다. 그러나 현재 spec 파일이 존재하지 않는 상태에서 plan 이 사실상 유일한 Rationale 기록 위치가 되고 있다. spec 파일이 생성되기 전까지 이 내용이 규약 문서 없이 plan 에만 존재하는 상태가 발생한다.
- **제안**: plan draft 단계의 임시 기술임을 "(임시 — 신설 spec 파일 생성 즉시 이전)" 이라는 주석으로 명시하면 단일 진실 원칙 위반 의심을 해소할 수 있다. 현재 rationale_continuity I-3/I-4/I-5/I-6 로 self-reference 하고 있는 것은 적절하다.

---

### [INFO] 결정 B `<ImplAnchor>` 컴포넌트 파일 경로가 `codebase/` 하위이나 spec 문서 내에서 선언됨
- **target 위치**: 결정 B — `codebase/frontend/src/components/docs/impl-anchor.tsx`
- **위반 규약**: `CLAUDE.md §Skill 체계` — "`codebase/` 변경 → `developer`". spec 은 "구현 경로를 결정"할 수 있으나 실제 파일 생성은 developer 역할.
- **상세**: spec 이 `codebase/` 안의 컴포넌트 위치를 선언하는 것은 SDD 패턴상 정상이며 규약 위반이 아니다. 다만 해당 경로가 `spec/conventions/user-guide-evidence.md` 의 정식 내용이 될 것이므로 plan 이 아닌 spec 파일에 위치해야 한다는 점(W-2 항목과 동일 맥락)을 참고로 기록한다.
- **제안**: 조치 불필요. plan 에서 구현 경로를 예시로 기술하는 것은 SDD 표준 패턴이다.

---

### [INFO] 후속 plan stub 5건의 `plan/in-progress/` 내 파일 존재 여부가 검증되지 않음
- **target 위치**: §후속 구현 plan (별 PR 5건), §산출물 위치 — "후속 plan: `plan/in-progress/{developer-partial-impl-discipline, spec-frontmatter-rollout, ...}.md` stub"
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "진행 중 작업 → `plan/in-progress/<name>.md` (frontmatter 에 `worktree` 명시)". `plan-lifecycle.md §4` — frontmatter 스키마 필수.
- **상세**: 본 plan 이 "후속 plan 5건을 `plan/in-progress/` 에 등록" 함을 산출물로 명시하고 있으나, 현재 시점에서 해당 stub 파일들은 아직 생성되지 않았다. 또한 stub 파일은 worktree 가 결정되지 않은 상태이므로 `worktree:` frontmatter 를 어떻게 채울지 불명확하다.
- **제안**: stub 파일 생성 시 `worktree: TBD` 또는 빈 값을 허용하는지 `plan-lifecycle.md` 에 명시하거나, stub 에는 frontmatter 를 `worktree: (미정)` 으로 채우고 실제 착수 시 갱신함을 plan 에 명기한다.

---

## 요약

`plan/in-progress/spec-harness-impl-coverage.md` 는 전반적으로 `CLAUDE.md`, `plan-lifecycle.md` 의 규약 구조를 잘 따르고 있다. frontmatter 3개 필드(`worktree`, `started`, `owner`)가 모두 존재하며, 배경·목표·변경안·검증 단계·산출물 위치의 섹션 구성도 SSOT 원칙에 부합한다. 주요 위험 요소는 두 가지다: (1) 신설 예정인 `spec/conventions/` 파일 2종이 plan draft 시점에 부재하여 plan 본문이 임시적으로 Rationale SoT 역할을 겸하고 있다는 점, (2) `/spec-coverage` 산출물 경로(`review/consistency/coverage/...`)가 CLAUDE.md 기존 저장 위치 패턴과 구조적으로 다르며 해당 갱신이 결정 E-6 에 후속 처리로 위임되어 있다는 점. 두 항목 모두 plan 이 자가 인식하고 있으나 실행 순서가 명확히 고정되지 않아 중간 상태에서 규약 불일치가 발생할 수 있다. CRITICAL 위반은 없다.

---

## 위험도

MEDIUM
