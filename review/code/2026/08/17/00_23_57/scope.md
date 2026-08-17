# 변경 범위(Scope) 리뷰

## 검토 방법

`origin/main` 대비 이 브랜치 전체 diff(70~71 파일)를 대상으로 했다. 이 changeset 은
`plan/in-progress/eia-fanout-and-internal-data-masking.md` 작업의 **누적 diff**이며, 이미 같은
diff 를 두 차례(`review/code/2026/08/16/23_08_19/scope.md`, `review/code/2026/08/16/23_50_03/scope.md`)
scope 리뷰했고 둘 다 **LOW** 로 판정했다. 이번 라운드에서는 (1) 두 선행 라운드의 판정이 지금도
유효한지 재확인하고, (2) 그 이후 델타(주로 커밋 `b05756d9e`)에 새로운 scope 이탈이 있는지를
`git log origin/main..HEAD`, `git show --stat`, `git diff origin/main --stat -M -- plan/` 로
직접 대조했다.

이 브랜치의 커밋 5개: `a8b0cbfdd`(plan lifecycle) · `1b8fd5cc7`(§A) · `fe6a54c80`(§B) ·
`e5a63abff`(spec 반영 + consistency 산출물) · `b05756d9e`(`inputData` 마스킹 철회 + 23_50_03
RESOLUTION/산출물 + 23_49_05 consistency 산출물 + spec 정정).

## 발견사항

- **[INFO]** (선행 라운드에서 이미 확인·반복) `plan/in-progress/eia-internal-rest-error-masking.md`
  → `plan/complete/`로의 git rename(R099, +6/-변경) 이 이번 선언된 작업(§A/§B/§D)과 별개 사유로
  같은 브랜치에 묶여 있다.
  - 위치: 커밋 `a8b0cbfdd` (`git diff origin/main --name-status -M -- plan/` 로 rename 확인).
  - 상세: 이전 세션이 완료한 작업(#1179)의 plan 문서가 `in-progress/`에 stale 로 남아 있던 것을
    이번 세션이 정정한 것으로, 내용 변형 없는 순수 이동(+링크 정정)이다. `23_08_19/scope.md`·
    `23_50_03/scope.md` 둘 다 이미 INFO 로 지적·수용했고 이번 라운드에서 추가 변경은 없다.
  - 제안: 조치 불요(반복 지적 방지 차 재확인만).

- **[INFO]** (선행 라운드에서 이미 확인·반복) `docs(spec)` 커밋(`e5a63abff`)에 이번 마스킹 작업과
  무관한 기존 `nodeName`→`nodeLabel` spec drift 정정이 곁들여져 있다.
  - 위치: `spec/5-system/6-websocket-protocol.md` §4.1 이벤트 표.
  - 상세: `23_50_03/scope.md` 가 이미 "직전 검토자(`22_22_36` convention_compliance)가 명시적으로
    '함께 정정' 을 권고했고 같은 파일을 이미 열고 있어 한계비용이 0" 이라고 판단해 조치 불요로
    정리했다. `plan/in-progress/eia-fanout-and-internal-data-masking.md:240-244` 도 이 사유를
    "범위 확장이 아니다" 로 명시 기록했다. 이번 라운드에서 추가 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** 이번 라운드 이전 델타(23 개 신규 파일)는 거의 전부
  `review/code/2026/08/16/23_50_03/**`(그 라운드 자신의 출력물 13개)와
  `review/consistency/2026/08/16/23_49_05/**`(`--impl-done` consistency 출력물 8개)로,
  구현 완료 후 강제되는 review-fix-consistency 워크플로의 정규 산출물이다.
  - 위치: `review/code/2026/08/16/23_50_03/*`, `review/consistency/2026/08/16/23_49_05/*`.
  - 상세: `CLAUDE.md` "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 절이 이를 상시
    사전 승인된 강제 단계로 규정한다. `23_50_03/scope.md` 가 같은 패턴(당시는 `23_08_19` +
    `22_22_36`/`23_10_41`)에 대해 이미 동일 판정(scope 이탈 아님)을 내렸다.
  - 제안: 조치 불요.

- **[INFO]** 델타의 유일한 실질 코드 변경은 커밋 `b05756d9e`(`inputData` 마스킹 철회)이며,
  범위가 정확히 `inputData` 컬럼 하나로 좁혀져 있다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`
    (`MASKED_INPUT_DATA_REASON` 도입, `ResponseExecution`/`ResponseNodeExecution` 에서
    `inputData` 제거, `findById`/`toExecutionDto`/`toResponseExecution`/`getChain` 4개
    호출부 원복), `background-runs.service.ts`(대칭 원복), 두 DTO 의 Swagger 설명, 두 유저가이드
    `.mdx`, `CHANGELOG.md`, `spec/5-system/12-webhook.md`·`14-external-interaction-api.md`.
  - 상세: `git show b05756d9e` 로 직접 대조한 결과, 이 커밋은 `23_49_05`(impl-done)와
    `23_50_03`(리뷰 2R)이 독립으로 낸 CRITICAL(재제출 경로 오염)을 되돌리는 것 외에 다른 표면을
    건드리지 않는다. `outputData`/`error` 마스킹은 그대로 유지되고, 근거를
    `MASKED_INPUT_DATA_REASON` 한 곳에 정본화해 호출부 4곳이 참조하는 구조도 이 결함 클래스에
    맞는 정확한 정정이다. plan 체크리스트(`eia-fanout-and-internal-data-masking.md:204-257`)도
    §B 행을 "재택일"로 갱신해 문서-코드 정합이 유지된다.
  - 제안: 조치 불요 — 범위 내 정확한 되돌림.

## 확인했으나 문제 없음 (참고)

- 선행 두 라운드가 "기능 코드는 plan §A/§B/§D 로 정확히 추적된다" 고 판정한 부분은 이번 라운드
  델타로 인해 바뀌지 않았다 — `b05756d9e` 는 그 §B 판정을 좁히는 정정일 뿐 새 기능 영역을
  추가하지 않는다.
- `plan/in-progress/spec-draft-eia-fanout-masking.md`(181줄, 신규)는 `e5a63abff` 커밋에서
  이미 도입됐고 `23_50_03/scope.md` 검토 범위(4개 커밋)에 포함돼 있었다 — 이번 라운드의 신규
  항목이 아니다(`git log --follow` 로 확인).
- 임포트·포맷팅·주석-only 변경이 실질 변경과 분리되지 않은 채 섞인 흔적은 델타 안에 없다 —
  `b05756d9e` 의 코드 diff는 전부 `inputData` 원복이라는 단일 의도에 종속된 국소 치환이다.

## 요약

이번 changeset(70~71 파일)의 scope 판정은 선행 두 라운드(`23_08_19` LOW, `23_50_03` LOW)와
동일하게 **LOW** 를 유지한다. 이번 라운드에서 새로 검토한 델타는 (1) 정확히 `inputData` 컬럼
하나로 범위가 좁혀진 CRITICAL 되돌림 커밋(`b05756d9e`) — 두 개의 독립 게이트가 낸 결함을
소스까지 추적해 정정한 것으로 범위 이탈이 아니라 오히려 이전 라운드의 범위 초과(§B 가 두
컬럼을 모두 닫으려 한 것)를 스스로 교정한 조치다 — 와 (2) 그 자신을 포함한 구현 완료 후 강제
review-fix-consistency 워크플로 산출물의 추가 누적뿐이다. 두 선행 라운드가 이미 INFO 로
기록·수용한 plan-lifecycle 이동과 `nodeName`/`nodeLabel` spec drift 정정은 이번 라운드에서
추가 변경 없이 그대로 반복 확인됐다. 새로운 기능 확장, 무관한 파일 수정, 드리프트성 리팩터링,
불필요한 포맷팅/주석/임포트 변경은 델타 안에서 발견되지 않았다.

## 위험도

LOW
