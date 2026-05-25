# 정식 규약 준수 검토 — `plan/in-progress/spec-fix-presentation-common-frontmatter.md`

검토 모드: spec draft (--spec)
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] `spec-only → implemented` 직접 전이 — 중간 상태 `partial` 생략

- **target 위치**: `## 제안 변경 > W6 — frontmatter 갱신` 섹션. 제안 YAML `status: implemented`.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3.1 전이 규칙`
  - `spec-only → partial`: 최초 코드 머지 시점에 승격
  - `partial → implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격
- **상세**: §3.1 은 `spec-only → partial → implemented` 의 순서를 기술한다. 현재 `0-common.md` 는 `status: spec-only`, `code: []` 이며, 제안은 `partial` 을 거치지 않고 바로 `implemented` 로 승격한다. 규약 §3.1 은 단계 우회를 명시적으로 허용하지 않는다. 단, §6 Rollout 정책에서 "기존 머지된 PR 로 구현 완료된 spec → `implemented` + `code:` 채움" 이라고 기술해 이미 완성된 spec 에 대한 직접 `implemented` 설정 선례가 존재하므로 CRITICAL 이 아닌 WARNING 으로 분류.
- **제안**: target 문서 또는 규약 중 하나에 명확성을 추가한다.
  - (A) target 수정: `status: partial` → `pending_plans:` 없이 `implemented` 로 승격하는 두 단계 커밋으로 분리. 또는
  - (B) spec-impl-evidence.md §3.1 에 "이미 구현이 완료된 기존 spec-only 는 `implemented` 로 직접 승격 허용" 단서 추가 (Rollout §6 에 이미 있는 정책을 일반화). 규약 갱신이 더 적절한 경로.

---

### [INFO] `id: presentation-common` — basename 기반 권장과 불일치

- **target 위치**: `## 제안 변경 > W6 — frontmatter 갱신` 섹션. 제안 YAML `id: presentation-common`.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1 필드 정의`
  - `id`: "파일 basename(확장자 제외) 기반 권장"
- **상세**: 대상 파일은 `spec/4-nodes/6-presentation/0-common.md` 이므로 basename 은 `0-common`. 권장 패턴은 `id: 0-common` 이나 제안은 `id: presentation-common`. 규약이 "권장(recommend)" 이지 "의무(must)" 가 아니므로 CRITICAL 이 아닌 INFO. target 문서 자체도 `id: common` 이 5개 카테고리 공통 문서 사이에서 중복이라는 발견사항(INFO #I2)을 근거로 변경을 정당화하고 있으며, 이 근거는 타당하다. 다만 basename-based 규칙과의 불일치는 명시적으로 기록할 필요가 있다.
- **제안**: target 문서의 Rationale 또는 본문에 "basename 권장 규칙에서 의도적으로 이탈 — 카테고리 내 다른 `id: common` 들과의 충돌 회피" 한 줄 명시. 또는 규약(spec-impl-evidence §2.1) 에 "같은 `id` 가 여러 파일에 존재할 경우 카테고리 prefix 를 추가해 고유성 확보" 가이드 추가.

---

### [INFO] plan `owner` 필드 값 — 역할 식별자 일관성

- **target 위치**: frontmatter `owner: project-planner`.
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  - 예시 값: `planner / developer / 사용자 본인 등`
- **상세**: plan-lifecycle 예시는 `planner` (단축형)을 제시하지만 target 은 `project-planner` (SKILL 체계 공식 역할명)를 사용한다. 규약이 예시를 나열할 뿐 enum 으로 강제하지 않으므로 위반은 아니다. 단, 프로젝트 내 plan 파일들이 `project-planner` 와 `planner` 를 혼용할 경우 자동화 도구(plan-stale-audit.sh 등) 의 파싱에 영향이 생길 수 있다.
- **제안**: 어느 쪽이든 프로젝트 내에서 단일 표기를 선택해 plan-lifecycle §4 에 명시. 현재 SKILL 체계 공식 명칭(`project-planner`)을 쓰는 것이 CLAUDE.md 역할 표와 정합하므로 규약 예시를 `project-planner / developer` 로 갱신하는 것이 자연스럽다.

---

### [INFO] CHANGELOG 항목 — 단일 셀 길이 과다

- **target 위치**: `## 제안 변경 > W7 — §9 CHANGELOG 항목 추가` 섹션. 제안 표 행.
- **위반 규약**: 명시적 금지 항목 없음. 기존 `0-common.md §9 CHANGELOG` 의 사실상 관행 참고.
- **상세**: 기존 CHANGELOG 행도 동일하게 긴 셀을 사용하므로 이 자체는 기존 패턴과 일관적이다. 위반은 아니며 단순 관찰.
- **제안**: 해당 없음 (기존 패턴과 일치).

---

## 준수 항목 (문제 없음)

- **plan frontmatter 스키마** (`worktree` / `started` / `owner` 3필드 모두 존재): plan-lifecycle.md §4 준수 ✓
- **파일 위치** (`plan/in-progress/`): 미완료 체크박스 `[ ]` 존재 → in-progress 유지. plan-lifecycle §2 준수 ✓
- **CHANGELOG 표 포맷** (`| 일자 | 변경 |`): 기존 `0-common.md §9` 표 형식과 일치 ✓
- **`code:` glob 4개** 제안: spec-impl-evidence §3 의 `implemented` 시 `code: ≥1 매치 의무` 충족 요건을 계획 내에서 사전 검증 (4개 glob 실존 매치 확인 완료 명시) ✓
- **`pending_plans:` 부재**: `status: implemented` 제안 시 `pending_plans:` 없음 — spec-impl-evidence §3 의 `implemented` 행 조건 부합 ✓
- **Side-effect 점검** 섹션 존재: 다른 spec cross-link 영향 분석 포함 ✓
- **절차 체크리스트** 존재: `/consistency-check --spec` 호출 단계 포함 — CLAUDE.md 의 `project-planner` 의무 사전 검증 스텝 준수 ✓
- **문서 내 규약 인용**: `spec/conventions/spec-impl-evidence.md §3`, `§4` 를 명시 인용 ✓

---

## 요약

target 문서(`plan/in-progress/spec-fix-presentation-common-frontmatter.md`)는 전반적으로 정식 규약과 잘 정합한다. plan frontmatter 스키마(plan-lifecycle §4), CHANGELOG 표 포맷(기존 spec 관행), `implemented` 시 `code:` ≥1 매치 의무(spec-impl-evidence §3) 모두 충족한다. 주요 우려 사항은 두 가지다. 첫째, `spec-only → implemented` 직접 전이가 §3.1 에 명시된 `partial` 경유 규칙과 어긋나며, 규약에 명시적 허용 단서가 없다(단, §6 Rollout 정책에 유사 선례가 존재해 CRITICAL 이 아닌 WARNING). 둘째, `id: presentation-common` 이 "파일 basename 기반 권장" 원칙(`0-common` 이 권장 값)과 다르나, 규약이 강제가 아닌 권장이고 이탈 사유가 명확하므로 INFO. 전체적으로 BLOCK 사유는 없으나 WARNING(1건)에 대해 규약 갱신 또는 target 수정 중 하나를 진행하는 것이 권장된다.

---

## 위험도

MEDIUM
