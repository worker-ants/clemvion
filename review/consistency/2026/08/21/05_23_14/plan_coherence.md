# Plan 정합성 검토 — `spec/5-system/**` (inputOverride 마커 서버측 거부 PR, 최종 라운드)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 실제 변경 파일을 확인하고(프롬프트 번들의 diff/EIA
본문 섹션은 예산 초과로 절단돼 있어 워크트리에서 직접 재확인), target(`spec/5-system/**` +
연쇄 파일 `spec/1-data-model.md`·`spec/3-workflow-editor/3-execution.md`·
`spec/4-nodes/7-trigger/1-manual-trigger.md`)의 diff 전문을 읽었다. 관련
`plan/in-progress/**`(`spec-sync-external-interaction-api-gaps.md`·`eia-terminal-payload.md`·
`eia-context-schema-followups.md`·`spec-draft-eia-62-waiting-payload.md`·
`ie-resume-turn-boundary-cancel.md`) 및 이번 PR 로 새로 생겼다가 이미 `plan/complete/` 로
이동한 두 문서(`spec-draft-inputoverride-marker-reject.md`·`spec-update-masked-reject-framing.md`)
를 대조했다. 이 PR 은 11 라운드 코드 리뷰(`00_03_57`~`05_08_35`) + 4 라운드 선행 consistency
리뷰(`19_34_37`·`19_48_56`·`23_33_00`·`00_55_25`)를 이미 거쳤으므로, 직전 라운드
(`00_55_25`)가 낸 WARNING 3건이 이후 커밋에서 실제로 해소됐는지를 우선 재검증했다.

## 발견사항

(없음 — CRITICAL·WARNING 모두 미발견)

### 참고: 직전 라운드(`00_55_25`) WARNING 3건은 전부 해소 확인됨 (재발 아님, 기록용)

- **`spec/1-data-model.md:471` "재제출 경로에서" stale 프레이밍** — `00_55_25` WARNING #1 이
  지적한 자리. 현재 워크트리 실측(`git diff origin/main...HEAD -- spec/1-data-model.md`)에서
  이미 *"Manual 실행 경로(저작 주체 기준, 재제출뿐 아니라 직접 입력도 포함)에서"* 로 정정돼
  있다. `plan/complete/spec-update-masked-reject-framing.md` "정정 2" 절도 이 자리를
  "세 번째 자매"로 명시 등재하고 자기귀책("자매 발산을 경고하는 문서를 쓰면서 자매를
  놓쳤다")까지 기록해 뒀다.
- **frontmatter `spec_impact` 누락** — `00_55_25` WARNING #2. `plan/complete/spec-update-masked-reject-framing.md`
  현재 frontmatter 는 `spec/1-data-model.md`·`spec/5-system/14-external-interaction-api.md`
  둘 다 포함한다(정정 완료).
- **선행 plan `spec-draft-inputoverride-marker-reject.md` 항목 5(a) stale "직후" 지시** —
  `00_55_25` WARNING #3. 해당 문서는 이제 `plan/complete/` 로 이동했고(`status: complete`),
  항목 5(a)는 취소선 처리 + *"⚠️ '직후' 는 폐기됐다(2026-08-21) … 정정:
  spec-update-masked-reject-framing.md"* 각주가 붙어 stale 지시가 단독으로 읽히지 않는다.
  제안됐던 두 대안(각주 추가 / 완료 처리) 중 후자를 택했고 전자도 실질적으로 포함됐다.

### 그 외 확인한 축 (문제 없음)

- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`**: 이 PR 이 종결한 두 항목
  (`inputOverride` 서버측 마커 리터럴 거부·`Execution.inputData` 외부 소비자 확인)이 `[x]`
  로 갱신됐고, 11 라운드 리뷰가 남긴 8건의 이월 항목("두 Manual 엔드포인트 error.code
  drift"·Swagger description·cross-stack 계약 테스트 부재 등)이 새 절 "마커 재제출 거부
  PR 의 이월 항목"으로 **처음 등재**됐다(직전엔 review 산출물에만 있었고 트래커엔 없었다 —
  PR 자체가 이 gap 을 자인하고 고쳤다). 각 항목에 "별도 결정 필요"/"조치 불요, 다음 기회에"
  구분이 명확해 미해결 결정을 일방적으로 판정하지 않는다(예: error.code 통일은 "통일하면
  기존 클라이언트가 보는 코드가 바뀌므로 별도 결정 필요"로 열어 둔 채 남김).
- **§R17 다른 축과의 충돌 여부**: `spec-draft-eia-62-waiting-payload.md`(in-progress, §R17
  `getStatus`/`llmCalls` strip 관련 별도 정정 항목 보유)와 target 이 §R17 표에 추가한
  "서버(Manual 실행 경로)" 행은 §R17 내 서로 다른 하위 주제(전자는 SSE/waiting emit 의
  필드 삭제 범위, 후자는 마커 값 재제출 거부)라 실제 충돌·전제 의존 없음.
- **`eia-terminal-payload.md`·`eia-context-schema-followups.md`·`ie-resume-turn-boundary-cancel.md`**:
  `resolveTriggerParameters`/`inputOverride`/`MASKED_VALUE_RESUBMITTED` 관련 언급 없음 —
  후속 항목 무효화·누락 없음.
- **신규 repo-guard 2종**(`masked-reject-callers-guard`·`production-build-devdep-guard`)을
  등록해야 할 별도 "가드 카탈로그" 성격의 in-progress plan 은 존재하지 않아 후속 누락 없음.
  CHANGELOG 에 "부산물로 저장소 전역 가드 두 개가 생겼다" 로 범위 초과가 명시돼 있고, 이는
  plan tracker 의 "관행 권고" 콜아웃과 일치한다.

## 요약

이번 라운드는 마커 재제출 거부 기능의 11차 코드 리뷰·5차(본 라운드 포함) consistency 리뷰
연쇄의 마지막 지점이다. 직전 라운드(`00_55_25`)가 낸 plan-coherence WARNING 3건(선행 plan
lineage stale 지시·`spec/1-data-model.md` 자매 문구 누락·frontmatter `spec_impact` 누락)은
모두 이후 커밋(`e4a27e5d3` "라운드2 처분" 및 `0a1e5e896` "라운드3 수렴")에서 실제로 해소됐고,
플랜 문서 두 건은 `plan/complete/` 로 정상 이동했다. 관련 트래커
`spec-sync-external-interaction-api-gaps.md` 는 완료 항목을 `[x]` 로 갱신하고 11 라운드가
남긴 이월 항목을 새 절로 빠짐없이 등재했으며, 각 항목이 "결정 필요"와 "조치 불요"를 명확히
구분해 미해결 결정을 우회하지 않는다. §R17 의 다른 진행 중 축(waiting payload/llmCalls
strip)과도 주제가 분리돼 있어 전제 충돌이 없다. 새로 발견된 CRITICAL·WARNING 없음.

## 위험도
NONE
