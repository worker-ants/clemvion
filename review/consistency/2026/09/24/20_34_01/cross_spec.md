# Cross-Spec 일관성 검토 — `pending_plans` 가드 강화 (impl-done)

## 검토 범위

이 PR 은 `spec/**` 델타 0개(코드 전용)다. `spec/conventions/spec-impl-evidence.md` 자체는
`origin/main` 대비 변경되지 않았고(target 문서로 번들됐으나 diff 대상 아님), 구현
diff 는 3개 파일 / 160줄:

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — `isPendingPlanPath(relPath: unknown): boolean` 신설
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` — 단위 테스트 8건
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — 가드가 `isPendingPlanPath` 를 소비하도록 강화

plan(`plan/in-progress/pending-plan-is-plan.md`)이 명시하듯 "규약은 바꾸지 않는다 — SoT 가 이미
옳다. 구현을 SoT 에 맞춘다" — 즉 이 변경은 새 계약을 도입하는 게 아니라 기존 `spec-impl-evidence.md`
§2.1/§4 가 이미 선언한 "pending_plans 는 plan/in-progress 또는 plan/complete 의 plan 경로" 를
코드가 실제로 강제하게 만드는 것이다. 이 전제 위에서 다른 spec 영역·문서와의 충돌 여부를 확인했다.

## 실측 대조

- **현재 `spec/**` 전체의 `pending_plans:` 항목(17개 문서, 약 27개 엔트리)을 전수 추출해
  `isPendingPlanPath` 규칙(정규화 후 `plan/in-progress/` 또는 `plan/complete/` 로 시작 +
  `.md` 로 끝남)에 대조** — 전부 통과한다. `node-output-redesign/*.md` 같은 하위 클러스터
  경로도 포함해 위반 0건. plan 문서 자체가 주장하는 "0건/27개" 실측과 별도로 재현했고 일치한다.
- 사건의 발단이었던 `spec/5-system/10-graph-rag.md` 는 현재 `status: implemented` 이고
  `pending_plans:` 자체가 없다 — 이미 정리되어 있어 이 강화로 새로 깨지는 문서는 없다.
- `.claude/docs/plan-lifecycle.md` §"pending_plans (선택, plan 레벨)" 는 spec 레벨
  `pending_plans`(spec→plan, `spec-impl-evidence.md §2.1` SoT)와 plan 레벨
  `pending_plans`(plan→plan, "가드 없음")를 **같은 키, 다른 도메인**으로 이미 명시적으로
  분리해 두었다. 이번 diff 가 강화한 `isPendingPlanPath` 는 `spec-pending-plan-existence.test.ts`
  (spec 레벨 가드)에만 배선되고 plan 레벨 필드는 건드리지 않는다 — 두 문서가 이미 합의한 경계를
  그대로 지킨다. 충돌 없음.
- `plan/research/` 배제는 `isPendingPlanPath` 주석·plan 문서·`.claude/docs/plan-lifecycle.md`
  §2.1(완료 종착점이 없는 참조 자료)이 서로 같은 근거를 든다 — 세 자리가 일치.

## 발견사항

- **[INFO]** `PROJECT.md` §자동 가드 표의 `spec-pending-plan-existence.test.ts` 설명이 이번
  강화를 반영하지 못해 더 좁게 남는다
  - target 위치: (diff 밖) `PROJECT.md` "자동 가드" 목록 — `spec-pending-plan-existence.test.ts — spec frontmatter pending_plans: path 가 plan/in-progress/ 실존 검증`
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §2.1/§4 (plan/in-progress **또는**
    plan/complete 허용) 및 이번 diff 가 추가한 "plan 인가"(`.md` + 두 디렉터리 접두 + `plan/research/`
    배제 + `..` 정규화) 축
  - 상세: `PROJECT.md` 행은 diff 이전부터 `plan/complete/` 를 언급하지 않은 채였고(이번 PR 이
    악화시킨 것은 아님), 이번에 추가된 "실존 이전에 plan 형태인가" 검사도 반영되지 않는다.
    실제 계약(§2.1/§4)보다 문서 요약이 더 좁게 남아, 이 표만 보고 가드 범위를 판단하면
    `plan/complete/` 종료 plan 을 가리키는 것이 실패한다고 오판할 수 있다. 기능 저해는 없음(SoT 는
    `spec-impl-evidence.md` 이고 표는 포인터일 뿐).
  - 제안: `PROJECT.md` 해당 행을 "`plan/in-progress/` 또는 `plan/complete/` 의 **plan(.md)** 경로
    실존 검증" 정도로 갱신. 이번 diff 범위는 아니라도 도큐 싱크 매트릭스 갱신 대상.

- **[INFO]** `spec-status-lifecycle.test.ts` guard (c)(모두 complete 로 이동했는지 판정)는 새
  `isPendingPlanPath` 를 재사용하지 않고 기존 `fs.existsSync` 만으로 "complete 로 이동했는가"를
  판정한다
  - target 위치: 이번 diff 가 강화한 `spec-pending-plan-existence.test.ts` (guard 4) 대비,
    같은 §4 표에 나란히 있는 `spec-status-lifecycle.test.ts` guard (c)
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §3.1 (`partial → implemented` 전이
    가드) — 같은 `pending_plans` 필드를 보는 두 가드가 "plan 형태 여부"를 서로 다른 엄격도로 본다
  - 상세: guard 4(이번 diff)는 이제 "plan 인가 → 실존하는가" 순으로 보지만, guard (c)는 여전히
    비-plan 경로(예: `.sql`)가 우연히 `.../complete/...` 로 치환된 경로에 존재하면 "완료로 이동함"
    으로 오판할 수 있는 원 구조를 그대로 갖고 있다. 다만 같은 빌드에서 guard 4 가 비-plan 항목을
    이미 실패시키므로(두 가드가 같은 테스트 스위트에서 함께 돈다는 전제 하에) **오늘 시점에 실제로
    깨지는 시나리오는 없다** — 두 가드가 같은 §4 표 안에서 "plan 형태" 엄격도가 갈린다는 사실
    자체를 기록해 둔다.
  - 제안: 급하지 않음(작동 결함 아님). 향후 두 가드 중 하나만 독립 실행되는 경로가 생기면
    (예: `PROJECT.md` 181행의 부분 실행 커맨드가 `spec-status-lifecycle` 을 빠뜨리고 있다)
    guard (c) 도 `isPendingPlanPath` 를 재사용하도록 정리하는 편이 두 가드의 "plan 정의"를
    한 곳(SoT 함수)으로 모은다.

## 요약

이번 diff 는 `spec/conventions/spec-impl-evidence.md` 가 이미 §2.1/§4 에서 선언해 둔 계약
("pending_plans 는 plan/in-progress 또는 plan/complete 의 plan 경로")을 구현이 뒤늦게
따라잡는 변경이라, spec 자체는 바뀌지 않았고 다른 spec 영역과 새로 모순을 만드는 지점도 찾지
못했다. `spec/**` 의 기존 `pending_plans` 엔트리 27개 전수를 새 규칙에 직접 대조해 위반 0건을
확인했고, plan 레벨/spec 레벨 `pending_plans` 의 의미 분리는 `.claude/docs/plan-lifecycle.md`
가 이미 명시한 경계를 이번 코드가 그대로 존중한다. 발견한 것은 CRITICAL/WARNING 급 충돌이 아니라
문서 동기화 여지(`PROJECT.md` 가드 설명이 더 좁음)와 같은 §4 표 안 두 가드의 엄격도 불일치
(오늘은 서로 겹쳐서 가려지는 잠재 이슈) 두 건의 INFO 뿐이다.

## 위험도

NONE
