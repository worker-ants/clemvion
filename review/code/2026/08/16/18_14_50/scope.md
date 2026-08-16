# 변경 범위(Scope) 코드 리뷰

## 조사 방법

`git diff origin/main...HEAD --stat` (101 files, +7402/-56)로 전체 changeset 을 재확인하고,
프롬프트에서 diff 가 생략된 대형 파일(`executions.service.ts`/`.spec.ts` 등)은 직접
`git diff origin/main...HEAD -- <path>` 로 원문을 열어 대조했다. 또한 이 브랜치의 커밋
이력(`git log origin/main..HEAD`)을 확인해 실질 기능 커밋 6개와 별도 housekeeping 커밋
1개(`fafb57e46`)로 구성돼 있음을 확인했다.

## 발견사항

- **[INFO]** 핵심 과제(내부 REST/WS 읽기 경로 `Execution.error` 마스킹)와 무관한 **plan 위생
  housekeeping 이 별도 commit 으로 번들**됨 — 근거 있는 관행이나 스코프는 명백히 확장됨
  - 위치: 커밋 `fafb57e46` (`chore(plan): mark 6 EIA plans complete`). 파일:
    `plan/complete/eia-stalled-atomicity.md`(신규, `plan/in-progress/`에서 이동) 외
    `eia-terminal-emit-facade.md` · `eia-terminal-error-sanitize.md` ·
    `spec-draft-eia-error-masking-catalog.md` · `spec-draft-eia-r8-alignment.md` ·
    `spec-draft-ws-types-canonical-location.md` 5건의 동일 이동 + 인입 링크 갱신 7건
    (`plan/in-progress/backend-lint-gate-broken-on-main.md:787`,
    `plan/in-progress/retry-turn-terminal-guard.md:308,372`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:106`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 3곳 등) +
    `.claude/docs/plan-lifecycle.md:80-101`(`pending_plans` 의미 구분 신설 문서화, +22줄).
  - 상세: 이동 대상 6개 plan 은 전부 **이미 별도 PR 로 머지 완료**된 다른 작업(#1173~#1178)의
    잔여 체크박스(`push 게이트 통과 → PR`)를 뒤늦게 닫는 housekeeping 이며, 이번 브랜치의
    실질 과제(`plan/in-progress/eia-internal-rest-error-masking.md`)와 직접 관련이 없다.
    `.claude/docs/plan-lifecycle.md §3` 의 *"이동은 마지막 작업 PR 안에서 별 commit 으로 · plan
    이동만 담은 별 PR 분리 금지"* 규정은 원래 **"그 plan 자신의 마지막 작업 PR"** 을 뜻하는데,
    여기서는 6개의 서로 다른(이미 종결된) plan 의 뒤늦은 정리를 지금 당면 과제와 무관한 이
    브랜치에 얹었다 — 문언보다는 취지("plan-move-only PR 증식 방지")를 원용한 확장 해석이다.
    다만 (a) 별도 commit 으로 명확히 격리돼 기능 diff 와 섞이지 않았고, (b) 이 정확한 지적이
    이미 이전 라운드(`17_35_49` scope WARNING #3)에서 제기돼 `.claude/docs/plan-lifecycle.md
    §3` 인용으로 검토·기록됐으며(`review/code/2026/08/16/17_35_49/RESOLUTION.md` #3), (c) 실제
    규정 문언도 확인 결과 존재해 완전한 허구 근거는 아니다.
  - 제안: 이번 PR 로는 조치 불필요(과거 라운드 판단 유지에 동의). 다만 향후 유사 상황에서
    "당면 과제와 무관한 6개 plan 의 뒤늦은 이동"을 별 PR 없이 아무 진행 중 브랜치에나 얹는
    관행이 굳어지면 diff 리뷰가 "이 변경이 무엇을 위한 것인가"를 매번 재구성해야 하는 비용이
    커진다 — 다음에는 가능하면 plan 위생 전용 세션(다른 실질 코드 변경이 전혀 없는 세션)에서
    처리하는 편이 스코프 추적에 더 유리하다.

- **[INFO]** 확인 결과 — 리뷰 중 제안됐다 되돌려진 변경(`explore-tools.service.ts` 값-패턴
  마스킹 합성)이 최종 diff 에 잔존하지 않음. 깨끗하게 되돌아갔다
  - 상세: `review/code/2026/08/16/17_12_34/RESOLUTION.md` #7 이 "처방을 실제로 적용해 봤더니
    기존 테스트가 RED 여서 되돌렸다"고 기록했는데, `git diff origin/main...HEAD --stat` 에
    `explore-tools.service.ts` 는 나타나지 않는다 — 되돌림이 실제로 완전했다는 뜻이다.
    스코프 위반이 아니라 스코프가 올바르게 좁혀졌음을 확인하는 항목으로만 기록.

- **[INFO]** 실질 코드 변경은 핵심 과제 하나로 잘 수렴함 — 무관한 파일·불필요한 리팩터·
  포맷팅 노이즈·미사용 임포트·설정 변경 없음
  - 확인: `git diff origin/main...HEAD -w --stat -- codebase/` 결과가 공백 무시 여부와
    무관하게 동일해(8 files, 638 insertions/20 deletions) 공백/포맷팅만의 변경이 섞여 있지
    않음을 확인. `executions.service.ts` 의 `stripPrivateRelations` → `toResponseExecution`
    개명과 `stop()`/`stopInternal()` 분리, `ResponseExecution`/`ResponseNodeExecution` 타입
    신설은 전부 "응답 egress 마스킹을 단일 관문으로 묶는다"는 이번 과제에 직접 종속된 최소
    변경이며(각 변경 지점 JSDoc 에 이유가 명시돼 있고 실제로 이전 리뷰 라운드에서 발견된
    null-hiding 캐스트·자매 표면 누락 결함의 직접적 수정이다), 과제와 무관한 정리가 아니다.
    신규 import 는 `redact-stored-error` 단 하나(`executions.service.ts`,
    `background-runs.service.ts`)이고 둘 다 실제로 소비된다. spec 문서 6곳(`1-data-model.md`,
    `2-navigation/14-execution-history.md`, `4-nodes/1-logic/12-background.md`,
    `5-system/14-external-interaction-api.md`, `5-system/6-websocket-protocol.md`,
    `conventions/secret-store.md`) 변경은 전부 이번 마스킹 결정(I1/D)의 정본 등재이고,
    `CHANGELOG.md` 갱신은 이 저장소가 같은 계열 직전 6개 커밋(#1171~#1177)에서 지켜 온
    "wire 변화 기록" 관행과 일치한다. `review/code/**`·`review/consistency/**` 산출물은
    프로젝트 규약상 저장 위치가 지정된 리뷰 프로세스 산출물이며 임의 추가가 아니다.

## 요약

이번 changeset 의 실질 코드 변경(`redact-stored-error.ts`(+spec) 신설, `executions.service.ts`,
`background-runs.service.ts`(+spec), 응답 DTO JSDoc 2곳)은 "내부 REST/WS 읽기 경로에도
`Execution.error`/`NodeExecution.error` egress 마스킹을 건다"는 단일 목적에 정확히 수렴하며,
타입 신설·함수 분리·개명은 전부 그 목적에 직접 종속된 최소 변경이다. 리뷰 라운드에서 시도됐다
되돌려진 변경(workflow-assistant 도구 마스킹 합성)도 최종 diff 에 흔적 없이 깨끗하게 제거됐다.
유일하게 주목할 만한 스코프 확장은 이미 머지된 6개의 무관한 EIA plan 을 `complete/` 로 옮기는
housekeeping 커밋인데, 이는 (1) 기능 diff 와 분리된 별도 commit, (2) 실재하는 프로젝트 규약
인용, (3) 이전 리뷰 라운드에서 이미 검토·수용됨이라는 세 조건이 겹쳐 반려할 사유는 아니라고
판단했다. CRITICAL/WARNING 급 스코프 위반은 발견되지 않았다.

## 위험도

LOW
