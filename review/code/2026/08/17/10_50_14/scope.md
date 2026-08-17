# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main`(정확히는 fork-point `f5351e9c2`) 대비 브랜치 전체 diff(144 파일, `+10455/-121`,
10 커밋)를 대상으로 했다. 이 changeset 은 `plan/in-progress/eia-fanout-and-internal-data-masking.md`
작업의 **누적 diff**이며, 이미 네 차례(`23_08_19`·`23_50_03`·`00_23_57`·`00_47_01`·`10_26_58`,
전부 **LOW**) scope 리뷰를 거쳤다. 이번 라운드는 (1) 다섯 선행 판정이 지금도 유효한지,
(2) 그 이후 유일한 신규 델타인 커밋 `09286d542`(직전 라운드 `10_26_58` WARNING 6건에 대한
후속 조치, `10:50:04`)에 새로운 scope 이탈이 있는지를 `git log`·`git show --stat`·
`git show <sha> -- <path>` 로 직접 대조했다.

## 발견사항

- **[INFO]** (선행 라운드 4회 반복 확인, 변화 없음) 완료된 이전 세션 plan 문서를
  `plan/in-progress/` → `plan/complete/` 로 이동하는 lifecycle 정리가 이번 기능(§A WS emit
  값-패턴 마스킹 / §B 내부 REST `inputData`/`outputData` 마스킹 / §D 표면 수 단일화)와 별개
  사유로 같은 브랜치에 묶여 있다.
  - 위치: `plan/complete/eia-internal-rest-error-masking.md`(신규, 커밋 `a8b0cbfdd`) ·
    `plan/complete/spec-draft-eia-fanout-masking.md`(신규 rename, 커밋 `81c9fcd60`) ·
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 내 상대링크 정정 2곳.
  - 상세: 내용은 `status` 플래그 전환·`spec_impact` 채움·경고문 1단락 추가 수준의 최소 편집이고
    실질 재작성은 없다. `23_08_19` 스코프 라운드가 최초 지적했고 이후 세 라운드가 매번 재확인·
    변화 없음으로 판정, `RESOLUTION.md`(`23_08_19`)에 "PR 설명에 별개 사유임을 명시"로 처리
    방침이 남아 있다. 이번 라운드도 상태 변화 없음을 재확인했다.
  - 제안: 조치 불요(반복 수용됨). PR 설명에 한 줄 명시 권고는 유효.

- **[INFO]** (선행 라운드 2회 반복 확인, 변화 없음) `nodeName` → `nodeLabel` 용어 정정이
  이번 마스킹 기능과 무관하게 곁들여 반영됐다.
  - 위치: `spec/5-system/3-error-handling.md:249`(예시 값)·`:258`-`259`(정정 각주) · 자매 정정이
    `spec/5-system/6-websocket-protocol.md` 에도 있음(`00_47_01`/`10_26_58` RESOLUTION 기록).
  - 상세: WS spec 을 이미 열어 값-마스킹 캐비엇을 추가하는 김에 발견한 사실 오류(엔진 emit
    전수가 `nodeLabel`, `nodeName` emit 0건 실측)를 그 자리에서 고친 drive-by 수정. 파급은
    문서 2곳·각 1~2줄 수준.
  - 제안: 조치 불요. 범위 순수성만 보면 별도 plan 항목이 이상적이나 규모·위험 모두 낮다.

- **[INFO]** `plan/in-progress/ie-resume-turn-boundary-cancel.md`(**이 PR 의 §A/§B/§D 와 무관한
  별개 plan**)에 이번 브랜치의 WS 마스킹 작업이 그 plan 의 기존 우려를 해소했다는 각주가
  추가됐다.
  - 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md:399`-`405`.
  - 상세: 8줄 추가로, `emitExecutionEvent` 값-패턴 마스킹이 `USER_MESSAGE` 를 포함한 모든
    execution 이벤트에 적용됨을 근거로 그 plan 이 미해결로 남겨뒀던 항목을 "코드 변경 불요"로
    닫는다. 코드 변경은 없고, `00_59_32` consistency 라운드(plan_coherence W2)가 발견해 강제한
    후속 조치라 §마스킹 작업 자체의 파생물이다. 다른 plan 파일을 건드리긴 하지만 내용 변형이
    아니라 사실 관계 갱신이라 위험은 낮다.
  - 제안: 조치 불요.

- **[INFO]** `review/code/**`·`review/consistency/**` 아래 대량 신규 파일(130+ 파일)이 이번
  diff 의 대부분을 차지한다.
  - 위치: `review/code/2026/08/16/23_08_19/**` 부터 `review/code/2026/08/17/10_26_58/**` 까지
    코드 리뷰 5라운드, `review/consistency/2026/08/16/22_22_36/**` 부터
    `review/consistency/2026/08/17/10_27_01/**` 까지 일관성 검토 7라운드.
  - 상세: `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 규약에 따른 정규
    워크플로 산출물이다. 각 라운드의 `RESOLUTION.md` 가 그 라운드에서 실제로 코드/spec 에
    반영한 항목을 追跡 가능하게 기록하고 있어(예: `09286d542` 는 `10_26_58` WARNING 6건을
    전부 그 커밋 하나로 반영), scope 이탈이 아니라 이 PR 자신이 거친 review-fix 루프의 정상
    부산물이다.
  - 제안: 조치 불요.

## 신규 델타(커밋 `09286d542`, 이전 라운드 이후 유일한 추가분) 확인

`git show 09286d542`로 직접 대조. 실질 변경 파일은 `CHANGELOG.md`·
`execution-response.dto.ts`(`NodeExecutionSummaryDto.inputData` 필드 선언, JSDoc 포함)·
`executions.service.spec.ts`(캐너리 JSDoc 을 "네 표면 목록"에서 "방향별 표"로 재작성, `it()`
본문·assertion 무변경)·`run-results.mdx`/`.en.mdx`(Input 행 마스킹 캐비엇 KO/EN)·
`eia-fanout-and-internal-data-masking.md`·`spec-sync-external-interaction-api-gaps.md`
(범위 정정 절 추가) 7개뿐이며, 나머지는 `10_26_58` 라운드 산출물(`review/code/**` 13파일)과
`10_27_01` consistency 산출물(2파일)이다. 커밋 메시지가 "ai-review 5R WARNING 6건 전부 조치"로
명시한 대로, 모든 편집이 직전 라운드가 낸 발견(캐너리 방향 오분류·CHANGELOG stale·Swagger
선존 갭)에 대한 강제 후속 조치이고 새 기능·무관한 파일 추가는 없다. 프로덕션 로직(비-JSDoc)
변경은 신규 필드 선언 1건(`inputData?: Record<string, unknown> | null`, 런타임엔 이미 존재하던
값을 스키마에 처음 선언한 것) 외에는 없다.

## 확인했으나 문제 없음

- 프로덕션 핵심 로직(`executions.service.ts`·`websocket.service.ts`·
  `sanitize-error-message.ts`·`redact-stored-error.ts`·`background-runs.service.ts`)은
  전체 브랜치에 걸쳐 §A(WS emit 값-패턴 마스킹, `maskWireEnvelope`/`toFanoutEnvelope` 공유
  초크포인트)·§B(`Execution`/`NodeExecution`/`BackgroundRun` 의 `inputData`/`outputData`
  마스킹, `Execution.inputData` 만 재제출 경로 보호로 카브아웃)·§D(표면 수·마커 상수 단일
  정본화)로 정확히 추적된다. `sanitize-error-message.ts` 의 `deepRedactCore`/`deepRedactObject`
  분리(`git diff f5351e9c2..HEAD` 로 직접 확인)는 `preserveKeys`(`llmCalls` wire 예외) 옵션이
  기존 depth-0 캐시를 오염시키지 않도록 하는 §A 의 직접 파생이다.
- spec 변경 8개 파일(`14-external-interaction-api.md`·`6-websocket-protocol.md`·
  `12-webhook.md`·`13-replay-rerun.md`·`15-chat-channel.md`·`1-data-model.md`·
  `3-error-handling.md`·`conventions/node-output.md`)도 전부 이 결정(값-마스킹 범위,
  `inputData` 레벨별 카브아웃, chat-channel verbatim 계약과의 우선순위)을 문서화하는 편집이며,
  `055ca996f`·`39cb0bf1a`·`83436ed45` 세 커밋 모두 "이 PR 자신이 만든 spec-spec 모순 정정"으로
  커밋 메시지에 명시돼 있다.
- 임포트·포맷팅·주석-only 변경이 실질 변경과 분리되지 않은 채 섞인 흔적은 없다 — 문서 커밋은
  spec/plan 만, 코드 커밋은 프로덕션 로직+대칭 테스트만 건드린다.

## 요약

이번 라운드(144 파일)의 scope 판정은 선행 다섯 라운드(`23_08_19`·`23_50_03`·`00_23_57`·
`00_47_01`·`10_26_58`, 전부 LOW)와 동일하게 **LOW**를 유지한다. 유일한 신규 델타(커밋
`09286d542`)는 직전 라운드가 낸 WARNING 6건에 대한 강제 후속 조치로 정확히 구성되며, 새로운
기능 확장·무관한 파일 추가·드리프트성 리팩터링은 없다. 반복 확인된 두 개의 경미한 INFO
(plan-lifecycle 이동, `nodeName`→`nodeLabel` drive-by 정정)는 매번 같은 저위험 상태를 유지하고
있고, `ie-resume-turn-boundary-cancel.md` 각주는 이 작업의 자연스러운 파생 효과를 별개 plan에
기록한 것이라 위험이 낮다. `review/code/**`·`review/consistency/**` 아래 대량 신규 파일은 이
저장소가 규약으로 강제하는 review-fix 루프의 정상 산출물이며 스코프 이탈로 볼 수 없다. 요청하지
않은 기능 확장(over-engineering), 무관한 임포트·포맷팅 정리, 의도하지 않은 설정 파일 변경은
발견되지 않았다.

## 위험도

LOW
