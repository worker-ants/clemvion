# 요구사항(Requirement) 리뷰 — `pending-plan-is-plan`

## 검증 방법
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`(+`.test.ts`) ·
  `spec-pending-plan-existence.test.ts` 를 Read 로 전문 확인.
- `node -e` 로 `path.posix.normalize` 의 트래버설 케이스(`plan/in-progress/../../codebase/x.md` →
  `codebase/x.md`, `plan/in-progress/` 유지 등)를 독립 재현 — 테스트 주장과 일치.
- `npx vitest run` 으로 두 가드 파일을 직접 실행 — **68 tests passed (2 files)**. plan 이 주장한
  "단위 13 · 가드 55"(= 1 + 27×2)와 합이 일치 (13 + 55 = 68).
- `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행 · §3 · §4 원문을 Read 로 대조.
- 저장소 트리에 뮤테이션 없음 (`git status --short` 재확인, 리뷰 세션 산출물 외 diff 없음).

## 발견사항

- **[INFO]** `isPendingPlanPath` 도입이 닫는 결함과 **같은 클래스의 미해결 지점**이 인접 가드에 남아 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-status-lifecycle.test.ts:54-63` (guard (c), 이번 diff 밖 — 미변경 파일)
  - 상세: 이번 PR 이 고친 `spec-pending-plan-existence.test.ts` 는 "`pending_plans` 항목이 실제 plan 인가" 를 `isPendingPlanPath` 로 검사하도록 강화됐다. 그런데 `spec-status-lifecycle.test.ts` 의 (c) `partial` → `implemented` 승격 판정("`pending_plans` 가 전부 `complete/` 로 이동했는가")은 여전히 `fs.existsSync` 만으로 "완료됨" 을 판정하며, 그 경로가 실제로 `.md` plan 인지는 검사하지 않는다. 즉 `pending_plans` 에 비-plan 경로(예: 마이그레이션 `.sql`)가 실려 있고 그 경로가 마침 `.../complete/...` 로 이동 가능한 형태라면, guard (c) 는 "전부 완료" 로 오판해 `partial→implemented` 승격을 요구할 수 있다 — `#1386` 사고가 드러낸 "존재 검사 ≠ 정합 검사" 틈이 이 자리에는 아직 남아 있다.
  - 제안: 이번 PR 범위는 아니다(4/4 가드 중 3번째를 건드리지 않는 것은 plan §F 의 명시적 스코프 분리와 일관). 다만 다음에 guard (c) 를 열 때는 `isPendingPlanPath` 로 후보를 먼저 거르고 존재 검사를 하는 동일 패턴을 적용할 후속 항목으로 트래커에 등재할 가치가 있다.

- **[INFO]** `spec-pending-plan-existence.test.ts` 의 "resolves" 단언은 여전히 raw path 로 존재를 검사
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — `it(\`pending_plan path resolves — ${planRel}\`, ...)` 블록 (신규 `it(\`pending_plan is a work plan\`, ...)` 바로 다음)
  - 상세: 새 "is a work plan" 단언과 기존 "path resolves" 단언은 독립된 `it()` 블록이라 순서와 무관하게 둘 다 항상 실행된다. `#1386` 사고 형태(존재하되 plan 이 아닌 경로)가 다시 들어오면 "is a work plan" 은 정확히 RED 가 되어 CI 를 막지만, "path resolves" 는 여전히 raw `fs.existsSync` 로 통과한다 — 방어 자체는 새 단언이 전담하므로 기능적 결함은 아니지만, "path resolves" 단언이 이제 실질적으로 무엇을 판별하는지(존재하되 plan 형태는 아닌 케이스를 잡지 못함)가 헤더 주석에 명시되지 않아 다음 사람이 두 단언의 역할 분담을 오해할 소지가 있다.
  - 제안: 필수 수정 아님. 다음 편집 시 "path resolves" 단언 앞에 "이 단언은 존재만 보며, «plan 인가» 는 위 단언이 전담한다" 한 줄을 남기면 충분.

## 핵심 로직 검증 결과 (문제 없음, 기록용)

- `isPendingPlanPath` — `path.posix.normalize` 를 접두 검사 **이전에** 적용해 `plan/in-progress/../../codebase/x.md` 류 트래버설을 실측으로 차단함을 확인(위 `node -e` 검증).
- `.md` 확장자 검사 + `PENDING_PLAN_DIRS`(trailing slash 포함) prefix 매칭이 `plan/in-progress-extra/…` 같은 유사-접두 오탐을 방지.
- `plan/research/**` 배제, `plan/complete/archive/from-x/**` 포함이 CLAUDE.md 정보 저장 위치 표·`spec-impl-evidence.md §2.1` pending_plans 행과 line-level 로 일치.
- 반환값: 모든 경로에서 boolean 을 반환하며 예외를 던지는 분기 없음(빈 문자열 등 비정상 입력도 `.` 정규화 후 `.md` 실패로 안전하게 `false`).
- spec fidelity: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행("`plan/in-progress/` 또는 `plan/complete/`… 에 실존하는 **plan 경로**")·§4 가드 표 행과 신규 구현이 정확히 대응. 코드가 spec 보다 좁았던 기존 결함(#1386)을 spec 방향으로 정합시키는 변경이며 spec 자체의 수정은 없음 — SPEC-DRIFT 아님, 순수 버그 픽스.
- `plan/in-progress/pending-plan-is-plan.md` 의 뮤테이션 표(M2~M5, M1→M1b 재수행)는 실행 결과(68 tests passed)와 모순되지 않고, "M1 무효" 판단(실재하지 않는 파일을 추가해 두 검사 모두 RED 가 난 것을 잘못 해석했던 것)도 재현 가능한 설명.
- `review/consistency/2026/09/24/19_35_41/**` (SUMMARY·meta.json·5개 checker 산출물)은 `--impl-prep` 산출물 규약(meta.json 필수, BLOCK:NO)을 충족하며 본 diff 의 핵심 주장(spec 변경 0건·처방이 SoT 와 정합)과 내용이 일치.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 `id: common` 중복 트래커 항목은 이번 diff 와 무관한 선재 drift 를 planner 로 정확히 위임한 기록이며, 본 PR 의 코드 변경과 충돌하지 않음.

## 요약

핵심 변경(`isPendingPlanPath` 신설 + `spec-pending-plan-existence.test.ts` 가드 강화)은 `#1386` 사고의 근본 원인("존재하면 통과"가 "plan 이어야 통과"보다 넓었던 계약)을 정확히 겨냥하며, spec(`spec-impl-evidence.md` §2.1/§4) 문면과 line-level 로 일치한다. 경로 정규화 순서(정규화 먼저 → 접두 검사)로 `..` 트래버설을 실측 차단했고, 독립 실행(`vitest run`, 68 tests passed)으로 plan 이 주장한 테스트 개수·GREEN 상태를 직접 재현해 확인했다. CRITICAL 급 결함은 발견되지 않았다. 유일한 관찰 사항은 이번 diff 밖의 인접 가드(`spec-status-lifecycle.test.ts` guard (c))에 같은 클래스의 "존재만 보고 plan 여부는 안 본다" 틈이 아직 남아 있다는 것과, 신규/기존 두 단언의 역할 분담을 설명하는 주석이 다소 부족하다는 것으로, 둘 다 INFO 수준이며 이번 PR 의 스코프(plan §F 가 명시적으로 가른 경계)를 넘지 않는다.

## 위험도
NONE
