# Cross-Spec 일관성 검토 결과

**대상 문서**: `plan/in-progress/spec-harness-impl-coverage.md`
**검토 일시**: 2026-05-23

---

## 발견사항

### [WARNING] 결정 C-2 `review/coverage/` 경로가 CLAUDE.md 정의 `review/` 하위 구조와 미정합

- **target 위치**: 결정 C (`/spec-coverage` standing audit), 산출물 위치 절 — `review/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md`
- **충돌 대상**: `CLAUDE.md §정보 저장 위치` 표 — `review/` 하위 경로로 `review/code/`, `review/consistency/`, `review/merge/` 세 가지만 정의. 각 경로는 역할별 write 권한과도 매핑됨 (consistency-checker → `review/consistency/**`, code-reviewer → `review/code/**`, merge-coordinator → `review/merge/**`).
- **상세**: target 이 신설하는 `review/coverage/` 는 기존 CLAUDE.md 의 "정보 저장 위치 (단일 진실 원칙)" 표에 없는 신규 subdirectory. 어떤 역할(skill)이 write 권한을 갖는지, `review/` 규칙(nested ISO 날짜 구조)을 따르는 것인지, main 워크트리에서 차단되는지 미정의. consistency-checker SKILL.md 의 `CONSISTENCY_OUTPUT_DIR` 환경변수가 `./review/consistency` 로 고정 설정되어 있어, spec-coverage 출력이 비슷한 구조이지만 다른 경로를 갖는 것이 명시적 근거 없이 분기됨.
- **제안**: (a) CLAUDE.md `§정보 저장 위치` 표에 `coverage 감사 산출물 → review/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`를 추가하고, write 권한 역할(예: project-planner 또는 신규 spec-coverage-auditor skill)을 명시. (b) 또는 `review/consistency/` 하위에 coverage 리포트를 산출하도록 경로를 통일. 결정 A-E 를 반영하는 spec 에서 함께 정의할 것.

---

### [WARNING] 결정 B `<ImplAnchor>` 신규 공용 MDX 컴포넌트가 `spec/2-navigation/13-user-guide.md §공용 MDX 컴포넌트` 목록과 동기 필요

- **target 위치**: 결정 B `<ImplAnchor>` 정의 절 (`spec/conventions/user-guide-evidence.md` 신설 예고)
- **충돌 대상**: `spec/2-navigation/13-user-guide.md` — user-guide 작성 규약의 SoT 진입 문서. PROJECT.md `§유저 가이드 파일 컨벤션 > SoT 문서 인덱스` 에서 `user-guide-writer` sub-agent 가 필수 적재하는 5문서 중 하나로 지목됨. 또한 `spec/conventions/i18n-userguide.md §Principle 3-B` 도 `user-guide-writer` 가 적재하는 컨벤션.
- **상세**: target 은 `<ImplAnchor>` 컴포넌트를 신규 도입하고 그 규약을 `spec/conventions/user-guide-evidence.md` 에 두기로 한다. 그러나 `user-guide-writer` sub-agent 의 컨텍스트 적재 경로(PROJECT.md 의 SoT 인덱스 5문서)에 해당 컨벤션 문서가 자동 포함되지 않는다. 결과적으로 `user-guide-writer` 가 GUI 흐름 절 작성 시 `<ImplAnchor>` 동반 의무(결정 B)를 인식하지 못할 수 있다. 또한 `spec/2-navigation/13-user-guide.md` 의 공용 MDX 컴포넌트 카탈로그에 `<ImplAnchor>` 가 등재되지 않으면 writer 가 참조 불가.
- **제안**: (a) `spec/2-navigation/13-user-guide.md §공용 MDX 컴포넌트` 절에 `<ImplAnchor>` 항목 추가. (b) PROJECT.md `§유저 가이드 파일 컨벤션 > SoT 문서 인덱스` 5문서 목록에 `spec/conventions/user-guide-evidence.md` 추가(또는 `i18n-userguide.md §Principle 7` 에 링크 추가). (c) `user-guide-writer` 의 자가 검증 체크리스트(PROJECT.md §198)에 `<ImplAnchor>` 동반 항목 추가(결정 B가 이를 요구하지만 SoT 연결이 없음).

---

### [WARNING] 결정 A `spec-only` 30일 build-time 만료 가드가 기존 `spec/0-overview.md §6.3 로드맵/미구현` 패턴과 충돌 가능

- **target 위치**: 결정 A, `status` 라이프사이클 — "`spec-only`: 작성됐으나 아직 구현 plan 없음. 30일 이상 지속 시 build fail"
- **충돌 대상**: `spec/0-overview.md §6.3 로드맵 / 미구현 (❌)` — 마켓플레이스, 배포 자동화 확장, 확장 SDK 등 다수의 장기 backlog spec 이 이미 존재. 이들 항목은 해당 spec 파일이 있다면 `status: spec-only` 로 분류될 것이나 구현 plan 이 30일 이상 없는 상태가 정상 의도.
- **상세**: target 은 "backlog spec" 의 강제 폐기 vs 검토 시간 trade-off 를 의식적 결정 포인트 (2)로 명시하고 있으나, spec 적용 대상 범위 절(결정 A, 대상 spec 파일)이 `spec/{2,3,4,5}-**.md`, `spec/conventions/**.md` 를 포함한다. `spec/0-overview.md §6.3` 은 제외 대상으로 명시된 `spec/0-overview.md` 내부에 위치하여 직접 충돌은 없지만, 동일 내용을 별도 spec 파일에 두는 로드맵 항목(예: 마켓플레이스 spec 파일이 `spec/2-navigation/8-marketplace.md` 로 이미 존재)은 `spec-only` + 30일 가드에 걸릴 수 있다. 기존 spec 60여 개에 일괄 frontmatter 추가 시 장기 backlog 항목들이 즉시 30일 카운터를 받게 됨.
- **제안**: (a) 결정 A 에 `status: backlog` 추가 또는 30일 임계 완화(90일, 또는 의식적 결정 포인트 (2) 채택)를 현 plan 에서 확정. (b) 일괄 frontmatter 롤아웃 시(후속 plan 2) 기존 로드맵 spec 에 `status: backlog` 또는 `deprecated` 를 적용하는 일괄 정책을 함께 명시. (c) `spec/0-overview.md §6.3` 의 각 항목과 대응 spec 파일의 관계를 롤아웃 plan 에서 명시.

---

### [WARNING] 결정 E PROJECT.md 매트릭스 2행 신설 시 기존 `§자주 누락되는 항목` 및 `§자동 가드` 절 동시 갱신 필요

- **target 위치**: 결정 E `§변경 유형 → 갱신 위치 매핑` 표 신규 2행 추가, `§자동 가드` 4개 row 추가
- **충돌 대상**: `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` (line 156-165) 및 `§자주 누락되는 항목` (line 139-153) — 현재 11개 항목. 새 변경 유형(spec frontmatter, ImplAnchor) 도 동일 맥락의 "자주 누락되는 항목" 후보이므로 이 절도 함께 갱신하지 않으면 developer 가 spec frontmatter 갱신을 자가 점검 체크리스트에서 인식 못함.
- **상세**: target 은 `§변경 유형 → 갱신 위치 매핑` 표와 `§자동 가드 표` 에 신규 행 추가를 명시했으나, `§자주 누락되는 항목` 절과 `§DOCUMENTATION 단계 종료 사전 체크리스트` 절의 갱신은 명시하지 않음. 기존 패턴(cross-cutting enum / backend ui.label / handler output field 등)이 양쪽 절에 동시 등재된 것과 비일관.
- **제안**: 결정 E 설명에 "§자주 누락되는 항목 절에 `spec frontmatter 갱신 누락` 항목 추가" 와 "§DOCUMENTATION 단계 종료 사전 체크리스트 체크박스 추가" 를 명시.

---

### [INFO] 결정 D `developer/SKILL.md §4` 참조가 실제 섹션 헤딩과 불일치

- **target 위치**: 결정 D — "`.claude/skills/developer/SKILL.md` 의 §4 DOCUMENTATION 사전 체크리스트에 한 줄 추가"
- **충돌 대상**: `.claude/skills/developer/SKILL.md` 실제 본문 — 해당 파일에는 명시적 §4 heading 이 없으며, "4. DOCUMENTATION 업데이트" 는 `## 작업 워크플로` 섹션의 번호 매겨진 항목으로 존재. 체크리스트는 별도 절(`#### DOCUMENTATION 단계 종료 사전 체크리스트`)로 PROJECT.md 에 위치함.
- **상세**: target 이 "SKILL.md §4" 라고 지칭하는 체크리스트는 실제로 PROJECT.md 에 위치한다(line 156-165). SKILL.md 자체에는 별도 체크리스트 절이 없고, PROJECT.md 를 참조하는 구조. 추가 위치를 SKILL.md 로 특정하면 구현자가 잘못된 파일을 수정할 수 있음.
- **제안**: 결정 D 를 "`.claude/skills/developer/SKILL.md` 의 단계 4 설명에 참고 노트 추가 + `PROJECT.md §DOCUMENTATION 단계 종료 사전 체크리스트` 에 체크박스 항목 추가" 로 명확화.

---

### [INFO] `spec/conventions/user-guide-evidence.md` 신설이 기존 `i18n-userguide.md §Principle 7` (page stale 방지) 과 책임 중복

- **target 위치**: 결정 B `spec/conventions/user-guide-evidence.md` 신설 내용 전반
- **충돌 대상**: `spec/conventions/i18n-userguide.md §Principle 7 — 사용자 가이드 페이지 stale 방지` — "코드 변경이 사용자 동선·UI 구조에 영향을 줄 때 user-guide 페이지를 같은 PR 안에서 갱신한다"는 원칙. 자동 결정 검출 불가로 manual 의존.
- **상세**: target 의 `<ImplAnchor>` + build-time 가드는 Principle 7 이 수동 점검에 의존하던 역할을 자동화하는 것으로 볼 수 있다. 이는 규약 확장이지 충돌이 아니나, `user-guide-evidence.md` 신설 후 `i18n-userguide.md §Principle 7` 의 "자동 결정 검출 불가" 주석을 갱신하지 않으면 두 문서 간 정보 불일치가 남음.
- **제안**: 후속 구현 plan 3(`user-guide-reverse-coverage.md`)에서 `i18n-userguide.md §Principle 7` 본문을 갱신하여 `<ImplAnchor>` + build-time 가드로 일부 자동화됐음을 기술. `§자동 가드 요약` 표에 신규 가드 행 추가.

---

### [INFO] `plan/in-progress/spec-harness-impl-coverage.md` frontmatter 가 기존 `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` 와 불일치

- **target 위치**: plan 문서 상단 frontmatter
- **충돌 대상**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — `worktree`, `started`, `owner` 세 필드 정의
- **상세**: 실제 plan 문서의 frontmatter 는 `name`, `worktree`, `status`, `owner`, `created` 5개 필드를 사용하는데, `plan-lifecycle.md §4` 가 정의한 스키마는 `worktree`, `started`, `owner` 3개이며 `name`, `status`, `created` 는 정의에 없음. `started` 대신 `created` 를 사용하고, `status: spec-only` 는 plan frontmatter 상태값이 아닌 spec frontmatter 상태값과 naming 충돌 가능성이 있음.
- **제안**: plan frontmatter 는 일관성보다 팀 관행 차이일 수 있으나, 결정 A 의 `spec frontmatter status: spec-only` 와 plan frontmatter 의 `status:` 필드가 같은 값(`spec-only`)을 사용하면 plan-coherence-checker 같은 자동화 도구가 혼동할 수 있음. plan frontmatter `status` 필드를 별도 네이밍(`plan_status` 등)으로 구분하거나 `plan-lifecycle.md §4` 에 정의를 확장.

---

## 요약

target plan(`spec-harness-impl-coverage.md`)은 spec-impl coverage gap 을 탐지하기 위한 5개 결정(A~E)을 도입하는 것으로, 기존 spec 의 데이터 모델·API·RBAC 에 직접 모순되는 내용은 없다. 다만 세 가지 WARNING 이 존재한다. 첫째, 결정 C-2 가 신설하는 `review/coverage/` 경로가 CLAUDE.md 와 역할별 write 권한 정의에 등재되지 않아 운영 공백이 생긴다. 둘째, 결정 B `<ImplAnchor>` 컴포넌트가 `user-guide-writer` sub-agent 의 의무 적재 SoT 경로와 연결되지 않아 실질 강제력이 없어질 수 있다. 셋째, 결정 A 의 `spec-only` 30일 build-fail 가드가 `spec/0-overview.md §6.3` 스타일의 장기 로드맵 spec 파일과 충돌할 수 있으며, 이를 위한 `status: backlog` 추가 여부를 plan 확정 전에 결정해야 한다. INFO 항목 두 건은 문서 위치 참조 명확화 및 기존 i18n-userguide.md 동기 갱신 필요성이다. CRITICAL 충돌은 없으나 WARNING 세 건은 실제 구현 착수(후속 plan 2·3·5) 전에 spec 에서 해소되어야 한다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
