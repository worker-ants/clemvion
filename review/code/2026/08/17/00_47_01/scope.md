# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main` 대비 브랜치 전체 diff(91 파일, `+6357/-114`)를 대상으로 했다. 이 changeset 은
`plan/in-progress/eia-fanout-and-internal-data-masking.md` 작업의 **누적 diff**이며, 이미 세 차례
(`review/code/2026/08/16/23_08_19`, `23_50_03`, `2026/08/17/00_23_57`) scope 리뷰를 거쳐 매번
**LOW** 로 판정됐다. 이번 라운드는 (1) 세 선행 판정이 지금도 유효한지, (2) 그 이후 델타(커밋
`81c9fcd60` 1개)에 새로운 scope 이탈이 있는지를 `git log`, `git show --stat`, `git show <sha>
-- <path>` 로 직접 대조했다.

브랜치 커밋 6개: `a8b0cbfdd`(plan lifecycle) → `1b8fd5cc7`(§A) → `fe6a54c80`(§B) →
`e5a63abff`(spec 반영 1R) → `b05756d9e`(`inputData` 마스킹 철회, CRITICAL 정정) →
`81c9fcd60`(chat-channel verbatim 계약 캐비엇 + 3R 게이트 잔여, **이번 라운드의 유일한 신규
델타**).

## 발견사항

- **[INFO]** (선행 라운드에서 반복 확인) `plan/in-progress/eia-internal-rest-error-masking.md` →
  `plan/complete/`로의 git rename 과, `plan/in-progress/spec-draft-eia-fanout-masking.md` →
  `plan/complete/`로의 추가 rename(커밋 `81c9fcd60`)이 이번 선언된 작업(§A/§B/§D)과 별개 사유로
  같은 브랜치에 묶여 있다.
  - 위치: `plan/complete/eia-internal-rest-error-masking.md`(커밋 `a8b0cbfdd`) ·
    `plan/complete/spec-draft-eia-fanout-masking.md`(커밋 `81c9fcd60`, R091 rename).
  - 상세: 둘 다 이미 완료된 작업 문서를 lifecycle 규약(`plan/in-progress` ↔ `plan/complete`)에
    맞춰 이동한 것으로, 내용 변형이 없거나(전자) 서두에 "철회된 `inputData` 결정을 근거로
    재집행하지 말 것"이라는 경고문만 추가된(후자, `status: applied`·`spec_impact` 선언 동반)
    최소 편집이다. `23_08_19`·`23_50_03`·`00_23_57` scope.md 셋 다 이미 같은 패턴을 INFO 로
    지적·수용했다.
  - 제안: 조치 불요(반복 지적 방지 차 재확인만).

- **[INFO]** 커밋 `81c9fcd60`이 `spec/5-system/3-error-handling.md` §2.2 예시의 `nodeName` →
  `nodeLabel` 을 정정 — 이번 마스킹 작업(§A/§B/§D) 자체와는 무관한 기존 spec drift 정정이 델타에
  또 하나 추가됐다.
  - 위치: `spec/5-system/3-error-handling.md` §2.2 예시 JSON.
  - 상세: `e5a63abff`가 이미 `6-websocket-protocol.md` §4.1 표의 같은 `nodeName`→`nodeLabel`
    drift 를 정정했고(`23_50_03/scope.md`가 "직전 검토자가 명시적으로 '함께 정정'을 권고했고
    같은 파일을 이미 열고 있어 한계비용이 0"이라 수용), 이번 델타는 같은 drift 클래스를 두 번째
    파일에 적용한 것이다. 커밋 메시지가 "WS §4.1 과 같은 drift"임을 명시하고, 근거(엔진 emit
    전수가 `nodeLabel`, `nodeName` emit 0건)도 앞선 커밋의 실측을 재인용한다 — 독립적인 새
    조사가 아니라 이미 이 PR 이 실측·검증해 둔 사실의 적용 확장이다.
  - 제안: 조치 불요. 다만 마스킹 작업과 직접 관련 없는 spec-drift 정정이 이 PR 의 커밋 로그에
    두 번째로 등장한다는 점은 향후 PR 설명에서 "동봉 사유"로 한 번 더 명시하면 리뷰어 혼선을
    줄일 수 있다.

- **[INFO]** 커밋 `81c9fcd60`의 `executions.service.spec.ts` 변경은 순수 JSDoc 텍스트 정정으로,
  프로덕션 코드·테스트 assertion 변경이 전혀 없다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` (`⑧ getChain·stop`
    테스트 바로 위 JSDoc 블록).
  - 상세: "네 표면"이라 적고 다섯을 나열했던 자기모순(`00_23_57` documentation WARNING 1)을
    "각 표면을 이름으로" 나열하는 방식으로 고쳤을 뿐, `it(...)` 본문·assert 는 1바이트도 바뀌지
    않았다. 같은 라운드에 강제된 fix 이므로 scope 이탈이 아니다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음 (참고)

- 이번 라운드의 유일한 실질 코드/spec 델타(`81c9fcd60`)는 (1) impl-done 이 낸 CRITICAL
  (`15-chat-channel.md` CCH-MP-06 verbatim 계약과 emit 값-마스킹의 충돌) 대응 캐비엇 추가,
  (2) 같은 라운드 ai-review 3R 의 유일한 WARNING(테스트 JSDoc 표면 수 불일치) 수정,
  (3) `3-error-handling.md`/§R17 stale 개수 표기 두 건의 문서 정정, (4) 완료된 spec draft 의
  `complete/` 이동으로 정확히 구성된다 — 전부 이번 PR 이 자기 자신의 review/consistency 게이트가
  낸 발견에 대한 강제 후속 조치이며(`CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된
  강제 의무"), 새 기능 영역이나 무관한 파일을 추가하지 않는다.
- 프로덕션 코드(파일 1~13: `background-runs`/`executions`/`websocket`/`redact-stored-error`/
  `sanitize-error-message`) 는 이번 델타에서 `executions.service.spec.ts` JSDoc 1건 외 변경이
  없다 — `redactStoredDataForResponse`·`deepRedactSecretsPreserving`/`deepRedactCore`·
  `maskWireEnvelope`/`toFanoutEnvelope`·`maskIfPresent` 등 핵심 로직은 선행 라운드가 이미
  검증한 상태 그대로다.
- `review/code/**`·`review/consistency/**` 하위의 대량 신규 파일(디렉터리 `23_08_19`·`23_50_03`·
  `00_23_57`·`22_22_36`·`23_10_41`·`23_49_05`·`00_22_23`)은 전부 이 PR 자신이 거쳐온
  구현-완료-후 강제 review-fix-consistency 워크플로의 정규 산출물이며, 이번 라운드에서 새로
  생긴 카테고리가 아니다(선행 두 scope 라운드가 각각 자기 시점까지의 산출물에 대해 이미 같은
  판정을 내렸다).
- 임포트·포맷팅·주석-only 변경이 실질 변경과 분리되지 않은 채 섞인 흔적은 델타 안에 없다 —
  `81c9fcd60`의 코드 diff는 JSDoc 1건, spec 문서 diff는 명시적 근거가 달린 국소 캐비엇/정정
  뿐이다.

## 요약

이번 changeset(91 파일)의 scope 판정은 선행 세 라운드(`23_08_19`·`23_50_03` LOW, `00_23_57`
LOW)와 동일하게 **LOW**를 유지한다. 이번 라운드에서 새로 검토한 델타(커밋 `81c9fcd60` 1개)는
이 PR 자신의 impl-done CRITICAL 1건과 ai-review 3R WARNING 1건에 대한 강제 후속 조치, 그리고
이미 앞서 정정한 `nodeName`→`nodeLabel` drift 를 같은 클래스의 두 번째 파일에 적용한 소규모
spec 정정으로 정확히 구성되며, 코드 로직 변경은 프로덕션 파일에 전혀 없다(`executions.service
.spec.ts`의 JSDoc 텍스트 1건뿐). 새로운 기능 확장, 무관한 파일 수정, 드리프트성 리팩터링,
불필요한 포맷팅/주석/임포트 변경은 델타 안에서 발견되지 않았다. 선행 라운드가 이미 INFO 로
기록·수용한 plan-lifecycle 이동 패턴이 이번 라운드에서 두 번째 파일(`spec-draft-eia-fanout-
masking.md`)로 한 차례 더 반복됐으나, 매번 같은 정당한 사유(완료 문서의 lifecycle 이동)이고
내용 변형이 없어 위험도에 영향을 주지 않는다.

## 위험도

LOW
