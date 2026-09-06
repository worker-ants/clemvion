# Plan 정합성 검토 — spec/2-navigation (impl-done)

## 조사 방법

- target scope(`spec/2-navigation/`) 델타는 0파일 — 이 브랜치는 spec 문서를 바꾸지 않았다.
  실제 변경은 `spec/2-navigation/2-trigger-list.md`(`code:` → `triggers.service.ts`) ·
  `spec/2-navigation/9-user-profile.md`(`code:` → `modules/workspaces/**`) 가 가리키는
  구현 파일 쪽이다. 두 spec 문서의 `code:` glob 을 기준으로 diff 22파일을 대조했다.
- `plan/in-progress/**` 40여 개 중 diff 가 건드린 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT` ·
  `user-entity-exposure` · `CREATOR_PROJECTION` · `isEndpointPathUniqueViolation` ·
  `pgErrorConstraint` · `dto-jsdoc-citation` · `joinedAt`/`WorkspaceMemberDto`/`listMembers`)
  로 grep 해 관련 plan 을 좁혔다: `spec-draft-nullable-notation-followups.md` ·
  `spec-draft-review-citations-enforcement.md`. 겹치는 다른 plan(`backend-lint-gate-*` ·
  `spec-sync-auth-gaps.md` 등)은 `triggers.service.ts` 를 언급하되 이번 diff 와 겹치는
  구간이 아니라 무관함을 확인했다.

## 발견사항

- **[WARNING]** `spec-draft-api-convention-verifier-registration.md` 가 자기 자매 plan 의
  이관 지시를 미집행한 채 `plan/in-progress/`에 남아 있다
  - target 위치: 해당 없음 (target 은 spec/2-navigation, 본 항목은 plan 위생 문제)
  - 관련 plan: `plan/in-progress/spec-draft-review-citations-enforcement.md` §「함께 처리할
    것」#3 — *"`spec-draft-api-convention-verifier-registration.md` 를 `plan/complete/` 로
    이동 (열린 체크박스 0, PR #1289 로 머지됨)"*
  - 상세: 실측 결과 `spec-draft-api-convention-verifier-registration.md` 에는 실제로 미체크
    `[ ]` 항목이 하나도 없고(전수 grep), frontmatter `status` 도 여전히 `in-progress` 다.
    같은 브랜치가 만든 자매 plan(`review-citations-enforcement.md`)이 "이관하라" 고 명시한
    지시를 이번 diff 가 집행하지 않았다 — plan 위생 지시가 등재만 되고 처분되지 않은
    사례(메모리 `feedback_stale_plan_claims_and_checklist_sync.md` 가 경고하는 형태와 동일
    등급). CRITICAL 로 올리지 않는 이유: `spec/2-navigation` 과 무관하고 코드 동작에도
    영향이 없다.
  - 제안: 다음 planner 턴에서 `plan/complete/` 로 이동 + `status: complete` 갱신, 또는
    실제로 남은 작업이 있다면 그 사실 자체를 이 plan 에 명시해 "0 open" 주장을 정정한다.

- **[INFO]** `.claude/**` harness 쓰기 권한 조항 부재 — 이미 등재된 미결이며 이번 diff 도
  그 미결 상태를 그대로 유지 (충돌 아님, 확인 목적 기록)
  - target 위치: 해당 없음 (target 은 spec/2-navigation)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` §「`CLAUDE.md` 에
    harness(`.claude/**`) 수정 권한 조항이 없다」 (open, planner 담당)
  - 상세: 이번 diff 는 `.claude/hooks/_lib/review_guard.py` + `.claude/tests/test_review_guard.py`
    를 실제로 수정했다(`git diff --stat` 확인). `CLAUDE.md` 의 Skill 표는 `spec/**`·
    `plan/**`·`codebase/**`·`review/**` 만 역할별 쓰기 범위로 열거하고 `.claude/**` 는
    어느 역할에도 배정돼 있지 않다 — 현재 `CLAUDE.md` 본문(diff 미포함, 이번 브랜치가
    안 건드림)도 이 상태 그대로다. plan 은 이것을 "사용자 결정(2026-09-06): 파서 수정은
    남기고 `CLAUDE.md` 명시만 남은 planner 항목" 으로 정확히 추적하고 있어 **새로운
    충돌은 아니다** — 다만 이 상태가 여러 라운드째 그대로이므로, 다음 세션에서 실제로
    집행되는지 확인이 필요하다.
  - 제안: 별도 조치 불요(이미 추적됨). 다음 planner 턴에서 Skill 표에 `.claude/**` 행을
    명시할 때 이 항목을 닫을 것.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 `details.code` 로 구현한 것은 미해결
  일반 정책과 상충하지 않음 (검증 결과, 문제 없음)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 (기존 문서, 이번 diff 로 변경 안 됨)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` §「도메인 세부 에러 코드의 표현
    방식을 정식화한다」(open, planner) — 저장소에 "top-level `code` 교체"(7건 선례)와
    "`details.code`"(현 구현) 두 관례가 공존하며 `2-api-convention.md §5.3` 이 아직 택일
    기준을 명문화하지 않은 상태.
  - 상세: 코드 주석(`triggers.service.ts`)이 이 미결을 스스로 인지하고 "spec 이 이미 두
    층으로 나눠 적었으므로 그 서술을 그대로 실현했다. 표현 방식의 정식화는 planner 항목으로
    등재했다" 고 명시한다 — `2-trigger-list.md §3` 에 이미 있던 문면(`(세부 코드
    TRIGGER_ENDPOINT_PATH_CONFLICT, details.field='endpoint_path')`, 이번 diff 로 신설된
    문장이 아님)을 구현으로 옮긴 것이지, 미해결 일반 정책 질문에 대해 일방적 결정을 내린
    것이 아니다. 충돌 없음.
  - 제안: 없음 (이미 올바르게 처리됨).

## 요약

target(`spec/2-navigation/`) 자체의 스코프 델타는 0이지만, 실제 구현 diff(22파일)는
`2-trigger-list.md`(`triggers.service.ts`) 와 `9-user-profile.md`(`modules/workspaces/**`)의
`code:` 로 spec-linked 돼 있다. 두 spec 파일 및 관련 plan(`spec-draft-nullable-notation-
followups.md`, `spec-draft-review-citations-enforcement.md`)을 대조한 결과, 이번 diff 는 그
plan 들이 이미 상세히 추적·등재해 온 항목들(`TRIGGER_ENDPOINT_PATH_CONFLICT` 구현·`User`
엔티티 노출 방어 3축·`joinedAt` §5.4 정정·JSDoc 인용 가드 등록)을 문서와 부합하게 실행한
것으로 확인된다. 미해결 결정을 일방적으로 우회한 사례나, target 이 전제하는 선행 조건이
plan 에서 미해소인 사례는 발견하지 못했다. 다만 (1) 자매 plan 이 스스로 지시한 문서 이관이
집행되지 않은 채 남아 있고 (2) `.claude/**` harness 권한 미기술이 여러 라운드째 열려 있다 —
둘 다 이미 plan 에 등재된 기존 미결이며 이번 diff 가 새로 만든 충돌은 아니다.

## 위험도

LOW
