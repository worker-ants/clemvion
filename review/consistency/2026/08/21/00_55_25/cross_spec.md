### 발견사항

- **[WARNING]** `spec/1-data-model.md:471` 의 `Execution.input_data` 필드 설명이 정정 2 가 고치는 것과 같은
  "재제출 경로" 프레이밍을 쓰고 있는데 target 의 `spec_impact` 범위 밖이다
  - target 위치: `plan/in-progress/spec-update-masked-reject-framing.md` "정정 2 — 자매 두 곳의
    '재제출 경로 한정'" 절 및 frontmatter `spec_impact` (`1-manual-trigger.md` /
    `3-error-handling.md` / `12-webhook.md` 셋만 열거)
  - 충돌 대상: `spec/1-data-model.md:471` (`Execution.input_data` 행)
  - 상세: target 은 `3-error-handling.md:193` 과 `12-webhook.md:312` 두 곳의 "`MASKED_VALUE_RESUBMITTED`
    는 재제출 경로 한정이다" 프레이밍이 `14-external-interaction-api.md` §R17 캐비엇("가드의
    범위 — Manual 실행 경로 전체다, 재제출만이 아니다")과 어긋난다고 정확히 짚었다. 그런데
    `spec/1-data-model.md:471` 도 같은 defect 계열이다: "2026-08-20 부터는 서버도 2층으로
    거부한다 — **재제출 경로에서** 값 leaf 가 마커와 정확히 일치하면 `400`
    `details[].code = MASKED_VALUE_RESUBMITTED` (UI 를 우회한 API 직접 호출 대비)" — 이 문장도
    거부가 "재제출 경로"(re-run/`inputOverride`)에서 일어나는 것처럼 읽히고, `POST
    /workflows/:id/execute` 의 fresh 입력(문서 편집기에 리터럴 `***` 를 직접 타이핑한 경우)도
    거부 대상이라는 §R17 정정을 반영하지 않는다. `grep -rn "재제출 경로에서\|재제출 경로 "
    spec/` 로 확인 — `1-data-model.md`, `error-handling.md`, `webhook.md` 세 곳이 나오는데
    target 은 뒤의 둘만 다룬다.
  - 제안: `spec_impact` 에 `spec/1-data-model.md` 를 추가하고, 471행 문구를 "재제출 경로에서" →
    "Manual 실행 경로(저작 주체 기준)에서" 류로 정정 2 와 동일하게 맞춘다. target 문서 자신이
    "이 브랜치에서 자매 발산이 반복된다" 고 자인하는 바로 그 패턴의 세 번째 사례이므로,
    이번에도 grep 커버리지가 한 곳 부족했던 것으로 보인다.

- **[INFO]** target 의 기술적 진단(정정 1·정정 2)은 코드·SoT 와 대조해 정확함을 확인
  - target 위치: "정정 1", "정정 2" 절
  - 충돌 대상: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`,
    `spec/5-system/14-external-interaction-api.md:1573-1596` (§R17 캐비엇)
  - 상세: (a) 실제 구현은 `resolveTriggerParametersRejectingMasked` 가 raw 검사(①) →
    `resolveTriggerParameters` → resolve 검사(②) 순으로 감싸는 **2단계** 이며,
    `1-manual-trigger.md:170` 의 "adapter `resolveTriggerParameters` **직후**" 는 이제 stale —
    target 이 제안하는 "전후(raw 우선 검사 → resolve → 재검사)" 정정과 코드가 정확히 일치한다.
    (b) `error-handling.md:193`·`webhook.md:312` 의 "재제출 경로 한정" 문구와 §R17 의 "Manual
    실행 경로 전체다(재제출만이 아니다)" 문구가 실제로 상충하며, 다른 두 소비처
    (`3-workflow-editor/3-execution.md:90-91`, `5-system/13-replay-rerun.md:246,378`)는 이미
    올바른 프레이밍("Manual 실행 경로 전체", 출처 무관 마커 거부)을 쓰고 있어 이 두 곳만
    stale 임을 grep 으로 확인. (c) `fix(security)` 커밋 `50f799efd` 는 실제로
    `spec/5-system/14-external-interaction-api.md` 표 행 라벨만 2줄 수정했고(diff 확인),
    코드/CHANGELOG/리뷰 산출물 등 21개 다른 파일도 같은 커밋에 포함돼 있어 target 이 말하는
    "developer 턴이 spec 표 행을 직접 고쳤다"는 서술이 정확함. 이 항목은 조치 불필요 — 검증
    결과만 기록.

### 요약

target 이 짚은 두 정정(§6 시점 서술, 자매 두 곳의 "재제출 경로 한정" 프레이밍)은 코드와
`14-external-interaction-api.md` §R17 SoT 를 대조해 검증한 결과 모두 정확하고, 제안된 교체
문구도 인접 서술(§R17 캐비엇, `3-workflow-editor/3-execution.md`, `13-replay-rerun.md`)과
자연스럽게 정합된다. 다만 target 이 스스로 경계한 "같은 문구를 쓴 자리를 grep 으로 전수 세지
않으면 자매 발산이 반복된다"는 패턴이 이번에도 한 곳 재발했다 — `spec/1-data-model.md:471`
의 `Execution.input_data` 필드 설명이 정정 2 가 고치는 것과 동일한 계열의 "재제출 경로"
프레이밍을 쓰지만 target 의 `spec_impact`·정정 범위 밖에 있다. 이 한 곳을 추가하면 이번
정정 라운드가 자매 위치를 완전히 커버한다.

### 위험도

MEDIUM
