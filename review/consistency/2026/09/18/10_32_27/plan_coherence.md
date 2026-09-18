# Plan 정합성 검토 — spec-draft-deletion-release-current-tense.md

## 검토 방법

`plan/in-progress/spec-draft-nullable-notation-followups.md`(공유 트래커, 4687줄) 중 target 이 닫으려는
체크박스(«트리거 삭제 자원 정리 구현이 머지된 뒤 spec 을 현재형으로», 2026-09-17 등재, 7행 표 포함)와
연관 후속 체크박스(사후 정리 sweeper 재판단·성능 후속·stale 주석·중복 감사) 를 직접 Read 로 열어 target
의 실측 표·변경안(C1~C10)과 대조했다. `plan/complete/spec-draft-deletion-releases-trigger-resources.md`
(#1345, D1~D7)·`plan/complete/trigger-deletion-release.md`(#1346)도 대조했다. `pending_plans` 로 같은
트래커를 가리키는 spec 4개(`2-trigger-list.md`·`1-workflow-list.md`·`secret-store.md`·
`chat-channel-adapter.md`)는 YAML 파서로 직접 세어 target 의 R-11 주장("4개 문서")을 검증했다. target
이 인용하는 구현 코드(`trigger-resource-release.ts`·`trigger-resource-releaser.service.ts`·
`workspaces.service.ts`·`triggers.service.ts`·`schedules.service.ts`)를 읽어 실측 표·변경안 문면이
코드보다 넓은 보장을 말하는지 확인했다.

## 발견사항

- **[WARNING]** C3 의 `code:` 주석이 스스로 밝힌 예외를 다시 어긴다 — schedule 삭제는 `releaser.service.ts` 를 지나지 않는다
  - target 위치: `plan/in-progress/spec-draft-deletion-release-current-tense.md` C3, 첫 번째 YAML 블록
    두 번째 줄 — `# 네 삭제 경로와 쓰기 보상이 모두 이 둘을 지난다.`
  - 관련 plan: 같은 target 문서의 «`--spec` 1회차 처분 → 스스로 찾은 것» 항목(같은 C3 의 **다른**
    YAML 블록에서 이미 한 번 같은 클래스의 오탐을 자백·수정함 — "job 해제를 네 경로 모두 본다고
    읽혔다 … 실제 job 해제 케이스는 부모 삭제 둘뿐이다")
  - 상세: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` 클래스 JSDoc 이
    스스로 *"스케줄 삭제만 이 서비스를 쓰지 않는다"* 라고 못박고, 실제로 `SchedulesService.remove()`
    는 `trigger-resource-release.ts` 의 `deleteTriggerSecretsAfterCommit` 만 직접 import 해서 부르며
    (`grep` 확인, `trigger-resource-releaser.service.ts` import 없음), `unregister(` 호출부도 저장소
    전체에서 `TriggerResourceReleaserService.releaseExternalMany` 한 곳뿐이다. 따라서 C3 첫 블록이 새로
    추가하는 주석 *"네 삭제 경로와 쓰기 보상이 **모두** 이 둘을 지난다"* 는 `trigger-resource-releaser.service.ts`
    에 대해서는 사실이 아니다 — schedule 경로는 순수 함수 파일 하나만 지난다. 같은 C3 안에서 두 번째
    YAML 블록(e2e 주석)은 정확히 이 오탐 패턴("네 경로 모두"로 읽히는 문구)을 1회차 검토가 잡아 범위를
    좁혔는데, 인접한 첫 번째 블록의 같은 문구는 그 교정에서 빠졌다.
  - 제안: 첫 블록 주석을 실제 커버리지대로 좁힌다 — 예) *"순수 함수(`trigger-resource-release.ts`)는
    네 경로 모두, 그 서비스 배선(`trigger-resource-releaser.service.ts`)은 트리거·워크플로·워크스페이스
    삭제 셋만 지난다 — schedule 은 모듈 순환 때문에 순수 함수를 직접 부른다."*

- **[INFO]** 새로 문서화하는 «권한 선검사 → 외부 해제 → 잠금 재검사 거부» 잔여 창이 #1345 의 D7 카탈로그(D7-1/2/3)에 편입되지 않음
  - target 위치: C1 새 문단 4번째 문장(*"…워크스페이스 삭제의 권한 선검사와 잠금 재검사 사이에 역할이
    바뀌어 재검사가 거부한 경우…"*), Rationale "권한 선검사 창을 잔여 목록에 넣는 이유"
  - 관련 plan: `plan/complete/spec-draft-deletion-releases-trigger-resources.md` D7 표(D7-1/D7-2/D7-3,
    "번호는 `D7-N` 으로 적는다" 관례) · `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 열린 "트리거 자원 정리의 사후 정리(sweeper) 필요 여부 재판단" 항목(발생 빈도를 재서 판단하는
    잔여 창 목록)
  - 상세: 이 창은 #1345 설계 당시엔 없었다(권한 선검사를 외부 해제 앞으로 당긴 것은 구현 단계의 추가
    조치). target 은 이를 spec 본문(C1)에 새 잔여로 정확히 적었지만, 그 사실이 D7-1/2/3 과 같은 층위의
    "번호 붙은 잔여 창 카탈로그"에는 들어가지 않는다 — 나중에 D7 시리즈를 세는 사람은 이 창을 놓칠 수
    있다. sweeper 재판단 항목의 "재는 방법"(secret_store 고아 행·BullMQ job scheduler 수)도 이 창을
    포착하지 못한다 — 이 창은 DB 행 잔존이 아니라 "외부 자원은 뜯겼는데 워크스페이스 행은 남는" 반대
    방향 잔여라 sweeper 측정 방법의 대상이 아니다(sweep 이 아니라 재시도/알림 설계가 필요한 종류).
  - 제안: 필수 아님 — spec(C1)이 SoT 로 이미 서술했으므로 차단 사유는 아니다. 다만 `plan/complete/` 는
    보통 재수정하지 않으므로, 이 창을 향후 sweeper/성능 후속 라운드가 재발견하지 않도록 트래커의
    sweeper 항목 본문에 한 줄(포인터)만 추가하는 편이 안전하다.

## 확인했으나 문제 없음 (근거만 기록)

- R-11 "4개 문서" 주장 — `yaml.safe_load` 로 `pending_plans` 필드만 직접 세어 검증: `2-trigger-list.md`·
  `1-workflow-list.md`·`secret-store.md`·`chat-channel-adapter.md` 4개만 이 트래커를 `pending_plans`
  YAML 리스트에 갖는다(`4-integration.md`·`2-api-convention.md`·`15-chat-channel.md`·`3-error-handling.md`
  는 본문 prose 인용일 뿐 `pending_plans` 아님). 1회차 "3개"→2회차 "4개" 정정이 맞다.
- `secret-store.md` 가 2026-09-05~09-17 «implemented» 였다는 R-11 주장 — `git log --follow` 로 확인:
  `9a9c024a6`(09-05)~`aaee17206` 직전까지 `status: implemented`, `aaee17206`(#1345, 09-17)이 `partial`
  로 내림. 주장과 일치.
- `spec-status-lifecycle.test.ts` 가 "역방향"(이미 구현됐는데 `pending_plans` 트래커가 아직 in-progress
  인 상태의 조기 승격)을 강제하지 않는다는 C10/R-11 주장 — 가드 소스를 직접 읽어 확인: (c) 검사는
  `partial` 이고 `pending_plans` 가 전부 완료됐는데 **아직 승격 안 한** 경우만 잡고, `implemented` +
  `pending_plans` 없음 상태는 무조건 통과(`lifecycle guard idle`) 분기로 간다. C7 이 만드는 최종 상태와
  충돌 없음.
- 트래커 항목 6행(`4-execution-engine.md §4.4` ModuleRef 표에 트리거 정리 사례 추가) 을 target 이
  "비대상"으로 되돌리는 근거 — `trigger-resource-release.ts` 의 `TRIGGER_RESOURCE_RELEASER` JSDoc 을
  직접 읽어 확인: 이 `ModuleRef` 사용은 "모듈 import 순환 회피"(`#676` 선례 인용, forwardRef 안 씀)이지
  execution-engine.md §4.4 표가 규정하는 "DI 인스턴스화 순서 함정"과 다른 이유다. 표를 건드리지 않기로
  한 target 의 판단은 코드 근거와 일치한다.
- C6 워크스페이스 삭제 순서 서술(권한 선검사 → 외부 해제 → 잠금+열거 → 재검사 → invitation/member/
  workspace 삭제, 잠금 순서 workspace→membership) — `workspaces.service.ts` `deleteWorkspace`/
  `assertWorkspaceDeletable` 실코드와 줄 단위로 대조해 전부 일치.
- C9 unregister 호출부 "저장소 전체 한 곳" 주장 — `grep -rn "unregister("` 으로 확인, 유일한 호출부는
  `trigger-resource-releaser.service.ts:155`.
- 7' 항목(`schedule-trigger.e2e-spec.ts` 를 §3 `code:` 에 추가) — 트래커에서 정확히 같은 문구의 2026-09-14
  등재 항목을 찾아 대조, target 의 처분(C3 로 흡수)과 일치.
- 나머지 spec 파일(`1-workflow-list.md`·`10-triggers.md`·`11-workflow.md`·`12-workspace.md` 의 §1.4/§2.1/
  §3.1/§1.10/§2.1)을 참조하는 다른 in-progress plan(`marketplace-and-plugin-sdk.md`·
  `node-output-redesign/README.md`·`auth-guard-reflection-hardening.md`·`keyset-cursor-uuid-validation.md`)
  은 전부 target 이 건드리는 절과 다른 섹션(§2.7 마켓플레이스 링크·async 출력 중복·UUID 검증 비대칭)을
  가리켜 충돌 없음.

## 요약

Plan 정합성 관점에서 CRITICAL 은 없다. target 은 «결정 필요»로 남겨둔 항목을 우회하지 않으며, #1345 의
D1~D7 계약을 하나도 뒤집지 않고 구현이 더한 동작만 현재형으로 서술한다. 새로 도입하는 규약(C10, 공유
트래커 `partial→implemented` 조기 승격)은 기존 가드(`spec-status-lifecycle.test.ts`)의 실제 검사 방향과
충돌하지 않고, 이미 두 차례 `--spec` 라운드(BLOCK: YES → YES)를 거치며 slug·집계 오류·이해상충 노출을
스스로 교정한 흔적이 뚜렷하다. 유일한 실질 발견은 C3 의 두 YAML 블록 중 하나에만 적용된 "네 경로 모두"
과잉 일반화(WARNING) — 같은 결함 클래스를 인접 블록에서 이미 한 번 자체 교정했으면서 놓친 자리다. 나머지
하나는 정보성 메모(D7 카탈로그 갱신 누락, 차단 사유 아님)다.

## 위험도
LOW
