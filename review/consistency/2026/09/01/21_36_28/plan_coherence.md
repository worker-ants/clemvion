# Plan 정합성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 개요

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 `EngineErrorCode` 를
두 번째 대표 surface 로 병기하는 spec draft(`plan/in-progress/spec-draft-error-code-two-surfaces.md`)다.
착수 근거 plan `plan/in-progress/spec-conventions-engine-error-code-surface.md` 및 그 상위 이력
`plan/complete/exec-intake-followups.md` ARCH#5 ⑤와 대조했다.

## 발견사항

- **[INFO]** 착수 근거 plan 의 `worktree:` frontmatter 가 실제 작업 상태보다 뒤처져 있다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` 상단 `worktree: easy-a-harness-hygiene`
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` frontmatter `worktree: (unstarted)`
  - 상세: 착수 근거 plan 의 체크리스트에는 "판단 기준을 함께 적을지" 결정이 **2026-09-01 날짜로 이미 체크(`[x]`)**
    돼 있고, `git status` 상 이 파일이 현재 `easy-a-harness-hygiene` worktree 에서 **수정 중(M)**이다.
    즉 실제 작업이 이 worktree 에서 진행되고 있는데 frontmatter 는 여전히 미착수 sentinel 을 유지한다.
    `.claude/docs/plan-lifecycle.md §4` 는 "착수 시 실제 `<task>-<slug>` 로 교체" 하라고 명시하며,
    sentinel 이 방치되면 push-gate 의 "연결 판정"(§3)이 이 plan 을 이 worktree 의 작업으로 인식하지
    못한다(단, 이번 변경은 `codebase/**` 를 건드리지 않아 게이트 자체는 발화하지 않는 범위다).
  - 제안: `spec-conventions-engine-error-code-surface.md` 의 `worktree:` 를 `easy-a-harness-hygiene`
    로 갱신한다 (target 과 동일한 세션이 만든 편집이므로 낮은 비용).

- **[INFO]** 두 plan 의 종결 동기화가 아직 명시돼 있지 않다
  - target 위치: `plan/in-progress/spec-draft-error-code-two-surfaces.md` 전체 (draft 자체에 종결 절차 서술 없음)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "## 할 일" 체크리스트
    1번째 항목(`spec/conventions/error-codes.md §Overview... 두 surface 병기`) — 아직 `[ ]`
  - 상세: `project-planner` SKILL.md §3-5 워크플로대로 draft → `--spec` 검토 → spec 반영 순서를 따르고
    있어 현재 상태 자체는 정상이다. 다만 draft 가 실제로 spec 에 반영되는 시점에 (a) 착수 근거 plan의
    체크리스트 1번째 항목을 `[x]` 로, (b) 두 plan 모두 완료 조건(모든 체크박스 완료 + `spec_impact`
    선언)을 만족시키는지 확인 후 `plan/complete/` 로 옮기는 절차가 draft 본문에 언급돼 있지 않다.
    `plan-lifecycle.md §3` 은 "이동은 마지막 작업 PR 안에서" 를 요구하므로, spec 반영 커밋에서 두
    plan 을 함께 정리하지 않으면 착수 근거 plan 이 완료된 항목을 미체크 상태로 `in-progress/` 에
    잔류시킬 수 있다.
  - 제안: spec 반영 커밋에서 `spec-conventions-engine-error-code-surface.md` 체크리스트를 갱신하고,
    남은 미해결 항목이 없으면 두 plan 을 `complete/` 로 함께 이동한다. (target 문서 자체를 지금
    수정할 필요는 없음 — 실행 시점의 체크리스트로 충분.)

## 교차 검증 결과 (문제 없음으로 확인된 항목)

- **미해결 결정 우회 여부**: target 의 "판단 기준은 이번에 안 쓴다" 결정은 착수 근거 plan의
  체크리스트 항목(동일 날짜 2026-09-01, 동일 결론)과 **정확히 일치**한다 — 일방적 결정이 아니라
  착수 근거 plan 에 이미 기록된 결정을 그대로 반영한 것이다. 충돌 없음.
- **ARCH#5 ⑤ 인용의 정확성**: target 이 인용한 `exec-intake-followups.md` ARCH#5 ⑤ 문구
  ("이 논리는 `RETRY_*` 에도 똑같이 적용될 수 있었고 그때는 채택되지 않았다" 등)를 원본과 대조한 결과
  **왜곡 없이 정확**하다. 지어낸 근거 없음.
  (`plan/complete/exec-intake-followups.md:64-90` 대조.)
  - 단, ARCH#5 ⑤ 원문의 "후속(planner 트랙)" 서술은 "`EngineErrorCode` 병기 **1줄**이 필요하다" 로
    더 좁게 적혀 있고, 실제 착수 근거 plan 의 할 일 항목은 "같은 파일에 있다는 점도 함께 적을 것" 으로
    이미 그보다 확장돼 있다 — 이 확장은 착수 근거 plan 자체에서 일어난 것이고 target 은 그 확장된
    범위를 그대로 따른다. 두 홉 모두 일관돼 문제 없음.
- **실측 사실관계**: `ErrorCode`(`:8`) / `EngineErrorCode`(`:147`) 선언 위치, `error-codes.spec.ts:59`
  의 `overlap` 단언(`shares no code with ErrorCode`) 모두 실제 코드와 **바이트 단위로 일치** 확인.
  현재 `spec/conventions/error-codes.md` §Overview 도 target 의 전제("`ErrorCode` 단수만 대표
  surface 로 서술") 그대로다. 왜곡 없음.
- **다른 in-progress plan 과의 충돌**: `error-codes.md` 를 참조하는 다른 4개 plan
  (`spec-update-node-cancellation-shutdown-classification.md`, `auth-guard-reflection-hardening.md`,
  `spec-sync-external-interaction-api-gaps.md`, `cafe24-backlog-residual.md`)은 모두 §1/§3(명명
  예외 레지스트리)·§4(패턴 표)·§5(rename 이력)를 다루며, target 이 편집하는 §Overview "적용 범위"
  문단과 겹치지 않는다. "대표 surface"/"적용 범위" 문구가 등장하는 다른 plan
  (`retry-turn-terminal-guard.md`, `spec-draft-eia-62-waiting-payload.md`)도 각각 무관한 맥락
  (§코드 표 범위, blockquote 적용 범위)이라 우연한 문자열 일치일 뿐 충돌 없음.
- **범위 제한 서술**: target 이 "§3·§4 정규화 파이프라인은 건드리지 않는다" 고 명시한 것은 실제로
  다른 plan 들이 §1/§3/§4/§5 를 별도로 다루고 있는 현재 상태와 부합한다 — 범위를 좁게 잡은 것이
  실제 후속 작업들과 어긋나지 않는다.

## 요약

target 은 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`)이 이미 기록한 결정과
정확히 일치하고, 인용한 이력(ARCH#5 ⑤)과 실측(코드 라인·테스트)도 왜곡 없이 정확하다. 미해결
결정을 일방적으로 우회하는 지점, target 이 가정하는 미해소 선행조건, 다른 plan 의 무효화된 후속
항목은 발견되지 않았다. 두 건의 INFO(착수 근거 plan 의 `worktree` sentinel 미갱신, spec 반영
시점의 두 plan 종결 동기화 미서술)는 plan 위생 차원의 낮은 비용 개선 권고이며 target 문서의
정합성 자체를 훼손하지 않는다.

## 위험도

LOW
