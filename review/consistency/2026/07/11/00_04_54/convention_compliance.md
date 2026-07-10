# 정식 규약 준수 검토 — `plan/in-progress/spec-fix-webchat-eia-drift.md`

검토 모드: spec draft 검토 (`--spec`)

## 발견사항

- **[WARNING]** D-2 상태 배지 승격이 같은 파일 내 미러(sidebar 요약)와 동기화되지 않음
  - target 위치: target 문서 `### D-2. \`2-navigation/_product-overview.md\` NAV-WC-06 상태 stale` 절 (변경 범위 서술)
  - 위반 규약: `CLAUDE.md` "정보 저장 위치 (단일 진실 원칙)" + 본 target 문서 자신의 `R-D1`("중복 서술이 drift 재발의 원인")이 표방하는 원칙
  - 상세: `spec/2-navigation/_product-overview.md` 는 NAV-WC-06 상태를 **두 곳**에 적고 있다 — ① §3.14 표의 `NAV-WC-06` 행(`🚧 (증분 2 — 위젯 co-deploy 후)`, target 이 지목한 곳), ② 상단 §2 사이드바 요약의 `Web Chat` 행(`🚧 (partial: 설치·스니펫 ✅ / 미리보기 증분2)`, line 23). target 은 "①을 `✅` 로 승격" 만 명시하고 ②를 언급하지 않는다. ①만 고치면 같은 문서 안에서 사이드바 요약(🚧)과 상세 표(✅)가 서로 모순되는 새로운 drift 가 즉시 생긴다 — 정확히 R-D1 이 D-1 에 대해 경계한 "복제본이 뒤처지는" 패턴을 D-2 가 재현하는 셈이다.
  - 제안: D-2 변경 범위에 `spec/2-navigation/_product-overview.md:23` 사이드바 요약 갱신(`🚧 (partial: ...)` → `✅`, 필요 시 괄호 설명 제거)을 명시적으로 추가한다. 실제 spec 반영 시 두 위치를 함께 grep(`NAV-WC-06|Web Chat.*증분`)으로 확인.

- **[WARNING]** 체크리스트 `/ai-review` 항목이 기존 동종 plan 전례·project-planner 워크플로와 불일치 (스코프 경계 참고)
  - target 위치: target 문서 `## 체크리스트` 마지막 항목 `- [ ] /ai-review`
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "작업 워크플로"(1-7단계, `/consistency-check --spec` 만 의무, `/ai-review` 없음) — 단, 이 항목 자체는 `spec/conventions/**` 파일이 아니라 skill 워크플로 문서이므로 엄밀히는 본 checker 의 1차 스코프(`spec/conventions/**`) 밖일 수 있음(참고용으로 보고)
  - 상세: 본 target 은 명시적으로 "코드 변경 없음"(서두), D-1/D-2/D-3 전부 `spec/**` 문서만 건드리는 순수 spec-only 작업이다. 그런데 체크리스트에 `/ai-review`(코드 리뷰 도구, `code-review-agents` SKILL — codebase diff 대상)가 포함돼 있다. 동일 성격의 기존 완료 plan 6건(`plan/complete/spec-fix-eia-token-error-codes.md`, `spec-fix-error-code-routing.md`, `spec-fix-impl-marker-flips.md`, `spec-fix-node-summary-fallback-filter.md`, `spec-fix-prod-guards-prose.md`, `spec-fix-statistics-planned-markers.md`)는 모두 `/consistency-check --spec` 만 완료 조건으로 삼았고 `/ai-review` 를 체크리스트에 넣은 전례가 없다. `codebase/**` diff 가 0인 상태에서 `/ai-review` 를 걸면 router 가 전원 skip 하거나(거짓 PASS), 무관한 이전 코드 변경을 changeset 으로 잘못 흡수할 위험이 있다.
  - 제안: 코드 변경이 실제로 발생하지 않는 한 체크리스트에서 `/ai-review` 항목을 제거하거나, "코드 변경이 동반될 경우에만" 조건부로 명시. spec-only 로 끝난다면 `/consistency-check --spec` 하나로 충분(기존 6건 전례와 정합).

- **[INFO]** D-3 SoT 인용을 `swagger.md` 단독보다 `api-convention §5.1` 병기 권장
  - target 위치: target 문서 D-3 마지막 줄 `SoT: spec/conventions/swagger.md 전역 wrap 규칙.`
  - 위반 규약: 없음(정확한 인용) — `spec/conventions/swagger.md` §2-5 는 실제로 `TransformInterceptor` 전역 wrap 메커니즘의 원 서술처다. 다만 제품 레벨 API 응답 포맷의 정식 SoT 는 `spec/5-system/2-api-convention.md §5.1`(단일 리소스 `{ data: <obj> }`)이며, 그 문서 자체가 "메커니즘 상세는 swagger §2-5" 로 역참조하는 상호 구조다.
  - 상세: 사소한 정밀도 문제 — 실제 spec 반영 시(`3-auth-session.md:44` 등) 참조 각주를 `swagger.md §2-5` 하나만 달면 "왜 그 규칙이 존재하는가"(제품 계약)보다 "무엇으로 구현되는가"(interceptor)만 보이게 된다. 인접 spec (`5-admin-console.md` 의 202 응답 예시 등)이 `api-convention §5.x` + `swagger §2-5` 를 병기하는 기존 패턴과 맞추면 일관적이다.
  - 제안: 실제 spec 문구에 `[api-convention §5.1](../5-system/2-api-convention.md#51-단일-리소스)` 도 함께 인용하거나, 최소한 target 문서의 "SoT" 표기를 "`swagger.md §2-5`(메커니즘) / `api-convention.md §5.1`(계약)" 로 분리 표기.

- **[INFO]** 명명 규약 — plan 파일명 `spec-fix-webchat-eia-drift.md` 은 기존 전례와 정합 (문제 없음, 확인 차원 기재)
  - target 위치: 파일 경로 `plan/in-progress/spec-fix-webchat-eia-drift.md`
  - 위반 규약: 해당 없음 — `.claude/skills/project-planner/SKILL.md` §3 이 예시로 든 `spec-draft-<name>.md` 와 문자 그대로는 다르지만, 저장소에는 순수 drift-교정용 plan 에 한해 `spec-fix-*` 접두를 쓰는 확립된 로컬 관례가 이미 존재한다(`plan/complete/spec-fix-eia-token-error-codes.md` 등 6건 완료 전례). `spec-draft-*` (신규 설계) 와 `spec-fix-*` (기존 spec 오기재 정정) 의 구분은 의도된 특수화로 판단되며 규약 위반이 아니다.
  - 상세: (해당 없음)
  - 제안: (해당 없음, 현행 유지 권장)

## 요약

target `spec-fix-webchat-eia-drift.md` 은 plan frontmatter(`worktree`/`started`/`owner`) 스키마를 정확히 충족하고, D-1(중복 서술 제거)·D-3(봉투 표기 정정)의 근거는 각각 `spec/5-system/14-external-interaction-api.md`, `spec/conventions/swagger.md`/`spec/5-system/2-api-convention.md` 의 실제 정식 규약과 대조해 검증한 결과 정확했다. `spec/conventions/**` 자체를 직접 위반하는 CRITICAL 항목은 발견되지 않았다. 다만 D-2 의 변경 범위가 같은 파일 안의 또 다른 상태 미러(사이드바 요약)를 빠뜨려 target 자신이 R-D1 에서 표방한 "복제 서술 제거" 원칙을 D-2 에는 적용하지 못했고, 체크리스트의 `/ai-review` 항목은 순수 spec-only 성격 및 동종 전례 6건과 어긋난다 — 두 WARNING 모두 실제 spec 반영 전에 target 문서 자체를 보정하면 해소되는 낮은 비용의 문제다.

## 위험도

LOW
