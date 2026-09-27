# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 검토 대상 요약
`--impl-prep` 재실행(`review/consistency/2026/09/27/20_21_21`)이 낸 **BLOCK: YES** (Critical 1 — `spec/2-navigation/1-workflow-list.md` 의
`pending_plans:` 미등재 + 존재하지 않는 `plan/complete/cross-workspace-refs.md` 를 완료형으로 인용)를 해소하기 위한 spec 소정정 draft.
target 자신은 `spec/**` 를 직접 고치지 않고 변경안만 담은 `plan/in-progress/` 문서다.

## 사실관계 검증 (target 의 규약 인용이 실제와 일치하는지)

- `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행 — "`status: partial` 시 ✓ … `plan/in-progress/` 또는
  `plan/complete/`(in-progress 경로를 complete 로 치환) 에 실존 의무" 문구를 직접 확인. target 의 인용과 일치.
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` 실제 구현 확인 — `isPendingPlanPath` (형태) +
  `fs.existsSync(inProgressAbs) || fs.existsSync(completeAbs)` (존재, `/in-progress/` → `/complete/` 치환) 두 단계로 정확히 target 의
  주장("§4 가드는 in-progress 경로를 complete 로 치환해서도 찾는다")과 일치. 허위 인용 아님.
- `spec/2-navigation/1-workflow-list.md` 현재 상태 실측 — `pending_plans:` 에 `marketplace-and-plugin-sdk.md`·
  `workflow-duplicate-nodes-edges.md` 만 있고 `cross-workspace-refs` 관련 항목이 실제로 없음. §3 Rationale 이 실제로
  `` `plan/complete/cross-workspace-refs.md` `` (존재하지 않는 경로)를 "더했다"(완료형)로 인용 중임을 확인 — target 의 문제 진단이 정확하다.
- `plan/in-progress/cross-workspace-refs.md` 실측 — frontmatter `spec_impact` 에 이미 `spec/2-navigation/1-workflow-list.md` 포함,
  본문에 "폴더 `parentId` 는 **생성 경로에 소속 검사를 더한다**"(현재형, 미완료)라고 명시 — target 이 제안하는 시제 정정(완료형 →
  현재형)이 실제 구현 상태·plan 서술과 부합한다.

## 발견사항

- **[WARNING] Rationale 의 plan 경로 인용이 bare backtick 이지 실제 markdown 링크가 아니다 — 저장소 지배적 관례와 거리**
  - target 위치: "## 변경안" 항목 2 — `` `plan/in-progress/cross-workspace-refs.md` 가 생성에도 소속 검사를 더한다… `` (제안 문구,
    bare backtick 유지)
  - 위반 규약: 명시적 단일 규약 문서는 없으나, `spec/conventions/spec-impl-evidence.md` §4 표 (`spec-link-integrity.test.ts` 행)가
    "spec 본문 스캔에는 target 필터가 없다 — spec 문서가 쓴 `plan/**` 링크도 검사 대상이라, plan 이동 시 갱신하지 않으면 build 가
    깨진다"고 명시한다. 즉 **실제 markdown 링크로 쓰면 이동 후 drift 를 build 가드가 잡아준다.** 저장소 전체에서 spec 본문 Rationale
    이 `plan/in-progress/**.md` 를 인용하는 자리는 거의 전부 `[label](../../plan/in-progress/....md)` 형태의 실제 링크다 (실측:
    `4-integration.md:822`, `9-rag-search.md:237,406`, `4-execution-engine.md` 다수, `14-external-interaction-api.md:846,850,854`,
    `1-auth.md:119`, `11-merge.md:240` 등). bare backtick 인용은 이번에 고치려는 바로 그 버그(`plan/complete/cross-workspace-refs.md`
    라는 존재하지 않는 경로가 몇 주간 검출되지 않음)를 만든 자리이기도 하다 — 원인이 "backtick 인용은 어떤 build 가드도 보지 않는다"
    는 사실 자체였다.
  - 상세: 직전 라운드(`review/consistency/2026/09/27/20_21_21/SUMMARY.md` INFO #2)가 이미 "실제 마크다운 링크로 전환하면 향후
    drift 를 build 가드가 잡는다"고 지적했는데, 이번 draft(§변경안 항목 2)는 문구·시제·경로만 정정하고 인용 형식은 그대로
    backtick 으로 남긴다. 즉 이번 정정이 착지해도 **다음에 이 plan 이 `complete/` 로 이동하면서 링크를 안 고치는 실수가 재발해도
    build 가 잡지 못하는 구조**는 그대로 남는다.
  - 제안: 항목 2 의 정정 문구를 `[plan/in-progress/cross-workspace-refs.md](../../plan/in-progress/cross-workspace-refs.md)` 형태의
    실제 링크로 바꿀 것. 저장소 다른 spec Rationale 들이 이미 쓰는 패턴과 맞추면 `spec-link-integrity.test.ts` 가 이후 plan 이동
    시 drift 를 강제로 잡아준다. (INFO 로 다뤄도 무방하나, 이번 Critical 의 근본 원인과 같은 패턴이라 WARNING 으로 올림 — 규약
    문서 자체에 "링크로 쓸 것" 을 명문화하는 편도 대안이다.)

## 확인된 준수 사항 (긍정)

- 파일명 `plan/in-progress/spec-draft-cross-workspace-refs-2.md` — `project-planner` SKILL.md §3 "`plan/in-progress/spec-draft-<name>.md`
  에 변경안 작성" 패턴 및 저장소 선례(`spec-draft-chat-channel-drift-3.md` 등 번호 접미사)와 일치.
  본문 끝 `## Rationale` 배치도 동일 SKILL 지시("본문 끝에 `## Rationale` 로 결정 근거 명시")를 따른다.
  `## 변경안` 섹션명은 다른 완료 spec-draft 문서들(`spec-draft-cross-workspace-refs.md` 등)과 동일한 관행이다.
- frontmatter 3필수 필드(`worktree`/`started`/`owner`) 모두 존재, `worktree: cross-workspace-refs` 는 실제 worktree 디렉토리명과
  일치, `started: 2026-09-27` 은 실제 작성일과 일치 ([`.claude/docs/plan-lifecycle.md` §4](../../../../../.claude/docs/plan-lifecycle.md)).
- `spec_impact:` 가 실재 경로의 리스트(`spec/2-navigation/1-workflow-list.md`)이고 bare `none`/`[]`/`- none` 오류 형태 아님
  (Gate C, 동일 §4). in-progress 단계에서 `spec_impact` 선언은 §4 상 의무는 아니지만 금지도 아니다.
- `owner: project-planner` — CLAUDE.md 역할표상 `spec/**` 변경 담당과 일치. 직전 라운드 SUMMARY 가 "developer 자기-반증 예외 조건1
  미충족(그 문장을 planner 가 씀) → planner 인계" 라고 명시한 것과 정확히 부합하는 역할 배정.
- W1(“(Planned)” 라벨 미부기)·W2(`details[].field='parentId'`)·W4(트래커 dead path)에 대한 기각·이관 근거가 모두 실측 가능한
  실제 문서/plan 상태에 근거한다 (예: `plan/in-progress/cross-workspace-refs.md` 본문에 이미 "PATCH 의 기존 거부도 같은 배열
  `details` 를 싣는다" 처방이 존재함을 확인) — 지어낸 근거가 아니다.

## 요약
target 은 직전 `--impl-prep` Critical(1건)의 근본 원인을 정확히 진단했고, 인용한 정식 규약(`spec-impl-evidence.md §2.1` + 관련
build 가드 `spec-pending-plan-existence.test.ts`)의 실제 동작과 target 의 서술이 모두 일치함을 코드·문서 대조로 확인했다.
frontmatter 스키마·파일 명명·역할(owner) 배정도 `plan-lifecycle.md`·`project-planner` SKILL 규약을 그대로 따른다. 유일한 아쉬움은
제안된 정정 문구가 plan 경로를 bare backtick 으로 인용해, 저장소 전역에서 지배적인 "실제 markdown 링크" 관례(및 그로 인해 얻는
`spec-link-integrity.test.ts` build 가드 보호)를 취하지 않는다는 점이다 — 공교롭게도 이 형식 선택 자체가 이번에 고치는 Critical 이
몇 주간 검출되지 않은 원인과 같은 종류다. CRITICAL 급 규약 위반은 발견되지 않았다.

## 위험도
LOW
