# Plan 정합성 검토 — `spec-draft-workspace-path-guard.md`

## 발견사항

- **[WARNING]** §D-8 "새 교차 링크는 한 줄로 쓴다" 의 근거("알려진 사각")가 이미 해소된 상태를 가리킨다
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` D-8 — "spec 을 고칠 때 새 교차 링크는
    **한 줄**로 쓴다 — 여러 줄에 걸친 링크는 doclink 가드의 앵커 검증을 우회한다(알려진 사각)."
  - 관련 plan: `plan/in-progress/harness-review-gate-followups.md` "미해결 항목" 첫 항목
    (`spec-link-integrity` 가 멀티라인 마크다운 링크를 통째로 못 본다)
  - 상세: 그 항목은 **2026-08-29 `#1235`** 로 이미 닫혔다 — `extractLinks()` 가 줄 단위 매칭에서
    마스킹된 전문(全文) 매칭으로 바뀌어, CommonMark 와 동등하게 멀티라인 링크의 목적지·앵커를
    검증한다(뮤테이션 3/3 재현·양방향 확인 완료). 즉 지금은 여러 줄 링크도 앵커 검증을
    **우회하지 않는다** — target 의 "우회한다(알려진 사각)" 서술은 2026-09-25 시점 기준
    stale 이다. 실무 조언("한 줄로 쓴다") 자체는 무해하지만, 근거 문장이 이미 닫힌 가드
    한계를 살아 있는 것처럼 인용해 다음 편집자가 잘못된 전제로 판단할 수 있다.
  - 제안: target D-8 의 괄호 안 근거를 "2026-08-29 `#1235` 로 이미 닫힘 — 지금은 검증됨.
    다만 가독성을 위해 한 줄을 권장" 정도로 정정하거나, 근거 문장 자체를 삭제.

- **[WARNING]** C-4 가 편집하는 `error-codes.md §3` 예외 레지스트리를 다른 미해결 plan 도 동시에 겨눈다
  - target 위치: `spec-draft-workspace-path-guard.md` C-4 (`spec/conventions/error-codes.md`) —
    "소문자 역사적 예외 목록의 `forbidden` 을 뺀다" + `admin_required` 註 추가
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    (`owner: project-planner`, 미결 — 최상단이 스스로 "미결은 이 문서 최상단의 (a)/(b) 택일
    결정뿐" 이라 적는다) — 추가 위임 (1) 항목이 **같은 §3 예외 레지스트리**에 `AbortError` 를
    historical-artifact 로 신규 등재할 것을 제안한다(`spec_impact` 에도 `error-codes.md` 명시).
  - 상세: 두 plan 이 정확히 같은 표(`error-codes.md §3` Historical-artifact 예외 레지스트리)를
    서로 다른 행에서 편집하려 한다 — `forbidden`(초대 흐름 행, C-4 가 삭제) vs `AbortError`(신규
    행, 다른 plan 이 추가 제안). 물리적 줄 충돌 가능성은 낮지만, 이 저장소는 같은 문서를
    겨누는 두 plan 의 병존을 명시적으로 기록해 온 선례가 있다
    (`spec-conventions-engine-error-code-surface.md` "나란히 가는 plan" 절 — 같은 클래스의
    사전 고지). target 은 이 병존을 언급하지 않는다.
  - 제안: C-4 절 또는 target 의 Rationale 에 "같은 절을 겨누는 미결 plan
    (`spec-update-node-cancellation-shutdown-classification.md` `AbortError` 등재)이 있다" 는
    한 줄 포인터를 추가해, 두 planner 턴이 서로의 편집을 덮지 않게 순서를 인지시킬 것.

- **[WARNING]** §D 구현 요구가 `nestjs-v12-coordinated-upgrade.md` 의 고정 캐너리 기준값을 무효화할 수 있음을 언급하지 않는다
  - target 위치: `spec-draft-workspace-path-guard.md` D-1 — "부트 캐너리
    (`assertWorkspaceIdReflectionWorks`)가 경로 소비자도 센다."
  - 관련 plan: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C "착수 시 반드시 검증할 것
    — reflection 보안 회귀" — "업그레이드 전 기준값" 으로 **부트 캐너리 소비 라우트 수 =
    142건**(2026-09-24 실측, `0b5b226b3` 기준)을 고정해 두고, 업그레이드 전/후 "**같은 수인지**"
    를 비교하는 것을 재개 조건의 일부로 못박았다.
  - 상세: D-1 이 구현되면(후속 developer PR) 캐너리가 `@WorkspaceId()` 뿐 아니라
    `@WorkspaceParam(...)` 소비 라우트도 세게 되어, 소비 라우트 수가 142 에서 (최대 D-2 가 옮기는
    15개만큼) 늘어난다. `nestjs-v12-coordinated-upgrade.md` 는 현재 `worktree: (unstarted)` 로
    보류 중이지만, 재개 시 그 문서에 박힌 "142" 를 그대로 기준값으로 쓰면 — 이 draft 의 구현이
    먼저 착지했을 경우 — 실제로는 정상인 증가를 회귀로 오판하거나, 반대로 계산 없이 방치되면
    두 번째 실측을 다시 해야 한다. target 의 §D 체크리스트 어디에도 이 상호작용이 등재돼
    있지 않다.
  - 제안: §D 에 항목 추가 — "`@WorkspaceParam` 배선이 착지하면
    `nestjs-v12-coordinated-upgrade.md` §C 의 고정 기준값(142)이 stale 해지므로 그 문서의
    기준값을 재실측해 갱신한다." 또는 반대로 그 plan 쪽에 "재개 시 기준값을 재측정할 것" 각주를
    남긴다.

- **[WARNING]** D-6 이 `ERROR_KO`/`translateBackendError` 배선 자체가 죽어 있다는 선행 미해결 결정을 참조하지 않는다
  - target 위치: `spec-draft-workspace-path-guard.md` D-6 — "frontend 는 지금 403 을 서버
    메시지로 표시한다(`ERROR_KO` 에 `FORBIDDEN`·`ADMIN_REQUIRED`·`NOT_A_MEMBER` 매핑 없음). 새
    코드를 사용자 노출 코드로 등재할지는 구현 PR 이 정한다 — 등재하면 `ERROR_KO` 와
    `backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 를 함께."
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (미해결, `- [ ]`)
    "`ERROR_KO` 의 API 에러 코드 매핑을 아무도 읽지 않는다" — `ERROR_KO` 를 읽는 유일한 함수
    `translateBackendError` 의 **프로덕션 호출부가 0건**(실측, 2026-09-25 현재도 코드 grep
    으로 재확인됨)이라 적고, "결정해야 할 것은 에러 코드를 UI 에 노출할 것인가, 노출한다면
    `translateBackendError` 를 어디에 배선할 것인가" 라고 **아직 열어 둔 채** 남겨 뒀다.
  - 상세: target D-6 은 "새 코드를 등재할지" 를 이번 구현 PR 범위의 국소 결정처럼 적었지만,
    실제로는 그 등재 여부와 무관하게 **읽는 배선 자체가 끊겨 있다** — 기존 tracker 항목이 이미
    실측한 것과 정확히 같은 함정("맵에 줄을 더하는 것은 아무것도 바꾸지 않는다")에 후속
    developer PR 이 다시 빠질 수 있다. D-6 이 이 tracker 항목을 인지하지 못한 채 진행하면,
    새 코드 3~4종을 `ERROR_KO` 에 등재하고도 화면에는 여전히 아무것도 안 뜨는 결과가 나올 수
    있다.
  - 제안: D-6 에 `spec-draft-nullable-notation-followups.md` 의 해당 항목을 포인터로 추가하고,
    "등재" 결정이 그 항목의 더 큰 배선 결정(어디에 `translateBackendError` 를 연결할 것인가)과
    독립적으로 완결되지 않음을 명시할 것.

## 요약

target 자체의 spec 변경 논리(§B 결정 채택·§C 카탈로그 정정)는 `spec-draft-nullable-notation-followups.md`
가 앞서 갈라 둔 "결정 턴" 항목과 정확히 맞물려 있고, 그 트래커의 서술도 이 draft 를 가리키도록
갱신돼 있어 **미해결 결정과 충돌하는 지점은 없다**. 다만 후속 developer PR(§D)이 건드릴 표면 셋 —
①`error-codes.md §3` 예외 레지스트리(다른 미결 planner 항목과 같은 절을 겨눔), ②부트 캐너리
소비 라우트 수(다른 plan 이 고정 기준값으로 박아 둔 값을 이 구현이 바꿈), ③`ERROR_KO` 배선
(이미 죽어 있다고 실측된 채 열려 있는 결정) — 이 각각 다른 in-progress plan 과 얽혀 있는데 target 의
§D/§C 는 이 얽힘을 언급하지 않는다. 셋 다 지금 당장 spec 반영을 막을 정도는 아니지만, 후속
developer PR 착수 전에 세 plan 을 함께 열어 조율하지 않으면 각각 stale 기준값·중복 편집·무의미한
매핑 추가로 이어질 수 있다. 부수적으로 D-8 의 doclink 가드 관련 근거 한 줄이 stale 하다.

## 위험도

MEDIUM
