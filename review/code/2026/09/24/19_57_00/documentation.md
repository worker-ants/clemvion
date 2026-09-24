# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 새 술어 `isPendingPlanPath` 의 SoT 인용이 실제 정의 위치와 다른 절(section)을 가리킨다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:86` (`// ... SoT: spec-impl-evidence.md §3`), `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts:79` (`// SoT: spec/conventions/spec-impl-evidence.md §3 (\`pending_plans\` row — a plan`), `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts:15` (`// SoT: spec/conventions/spec-impl-evidence.md §3 (\`pending_plans\` row) · §4.`), `plan/in-progress/pending-plan-is-plan.md:19`(`§3 표 \`pending_plans\` 행 · §4 가드`)·`:88`(`SoT §3 행이 허용 위치를 둘로 열거하므로`)
  - 상세: 4개 파일 5곳 모두 `pending_plans` 의 경로 제약("`plan/in-progress/` 또는 `plan/complete/` 에 실존 의무")을 **§3 (`pending_plans` row)** 라고 인용한다. 그러나 `spec/conventions/spec-impl-evidence.md` 를 직접 확인하면, 그 문장은 **§2.1 필드 정의**의 `pending_plans` 행에 있다(`| \`pending_plans\` | string[] (path) | ... | ... \`plan/in-progress/\` 또는 \`plan/complete/\`(in-progress 경로를 complete 로 치환) 에 실존 의무 — §4 가드 참조 |`). `## 3. \`status\` 라이프사이클` 절에는 `pending_plans:` 라는 **열(column)** 만 있고(값은 "선택"/"의무"/"없음"), 경로 형태를 정의하는 행은 없다. 같은 diff 에 포함된 consistency-check 산출물(`review/consistency/2026/09/24/19_35_41/rationale_continuity.md`, `plan_coherence.md`, `SUMMARY.md`)은 정확히 같은 조항을 **§2.1** 로 인용해, 이번에 추가된 코드 주석의 §3 인용과 서로 어긋난다. 이 주석은 다음에 규약을 확인하러 오는 사람을 §3(상태 라이프사이클 표)으로 보내는데, 거기엔 경로 제약이 없다.
  - 제안: 4개 파일 5곳의 `§3 (\`pending_plans\` row)` → `§2.1 (\`pending_plans\` 필드 정의)` 로 정정. `§4` 인용(가드 목록)은 정확하므로 그대로 둔다.

- **[WARNING]** 실제 CI 동작을 바꾸는 가드 강화 수정인데 `CHANGELOG.md` 항목이 없다
  - 위치: 커밋 `c288c7aaf fix(docs-guard): pending_plans 가드가 「그게 plan 인가」를 묻는다` (변경 파일 목록에 `CHANGELOG.md` 없음 — `git diff --stat origin/main...HEAD` 확인)
  - 상세: 이 PR 은 `spec-pending-plan-existence` 가드가 몇 주간 `spec/5-system/10-graph-rag.md` 의 비-plan 파일(`.sql` 마이그레이션 3개)을 통과시켰던 실제 사고(plan 문서 §A 가 명시)를 고치는 **동작 변경**이다 — 종전에는 "디스크에 존재하기만 하면" 통과했고, 지금은 `plan/in-progress/**.md` 또는 `plan/complete/**.md` 여야 통과한다. 같은 저장소 `CHANGELOG.md` 에는 같은 디렉터리(`codebase/frontend/src/lib/docs/__tests__/`)에 새 가드를 추가한 선례들(예: `## Unreleased — 가이드가 «코드» 로 부르던 두 이름이 코드가 아니었다 (+ 식별자 가드에 발행 축)`, `## Unreleased — 유저 가이드가 적던 에러 코드 5종의 진위를 맞추고, 가드로 고정한다`)이 "무엇이 왜 뚫려 있었고 가드가 무엇을 새로 강제하는가" 를 기록하는 관행이 이미 확립돼 있다. 이번 변경은 그 관행과 같은 클래스(문서화된 계약보다 구현이 넓었던 사고)인데도 항목이 빠졌다.
  - 제안: `CHANGELOG.md` 에 `## Unreleased` 항목을 추가 — 사고 요약(`.sql` 경로가 `pending_plans:` 를 몇 주간 통과), 처방(`isPendingPlanPath` — `plan/in-progress/`·`plan/complete/` 의 `.md` 만 허용, `plan/research/` 는 의도적 배제), 회귀 위험(기존 27개 spec 항목 전수 0건 위반 확인됨)을 간단히 기록.

- **[INFO]** `pending-plan-is-plan.md` §E 에 이미 자체 기록된 절차 위반(구현 후 `--impl-prep` 실행)은 투명하게 공개돼 있어 별도 지적 불필요
  - 위치: `plan/in-progress/pending-plan-is-plan.md:91-92` ("착수 순서를 어겼다…")
  - 상세: 참고용으로만 남긴다 — plan 문서 스스로 사후 실행 사실과 그 함의(BLOCK 이었으면 되돌렸어야 함)를 명시하고 있어 추가 조치는 불필요.

## 요약

새 술어 `isPendingPlanPath` 자체는 목적·정규화 이유·경계 사례(`..` 이스케이프, `plan/research/` 의도적 배제)를 인라인 주석으로 잘 설명하고 있고, 관련 단위 테스트도 판별 뮤테이션까지 거쳐 근거가 두텁다. 다만 새로 붙은 SoT 인용이 4개 파일 5곳에서 일관되게 `spec-impl-evidence.md` 의 실제 정의 위치(§2.1)가 아닌 §3 을 가리켜, 같은 diff 에 포함된 consistency-check 산출물의 인용(§2.1)과 어긋나는 잘못된 문서 포인터를 남긴다. 또한 이 변경이 고치는 사고(문서화된 계약보다 넓게 구현돼 CI 가 몇 주간 놓친 것)는 같은 저장소가 반복적으로 CHANGELOG 에 기록해 온 클래스인데 이번엔 빠졌다. 두 항목 모두 기능적 결함은 아니며 다음 사람의 탐색·이력 추적을 어렵게 하는 수준이다.

## 위험도

LOW
