# Rationale 연속성 검토 — `spec-draft-inputoverride-marker-reject.md`

## 점검 대상
- target: `plan/in-progress/spec-draft-inputoverride-marker-reject.md` (spec draft, `--spec` 모드)
- 대조 대상: `spec/5-system/14-external-interaction-api.md §R17`(특히 "닫는 조건은 충족됐다" 잔여②) ·
  `spec/5-system/3-error-handling.md §1` · `spec/5-system/13-replay-rerun.md §10.2` 의 `## Rationale`,
  그리고 target 이 스스로 인용하는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  (W5 항목) · 최근 code review 세션(`2026/08/20` 15_32_34~17_38_33) · 실제 backend 코드
  (`trigger-parameter.types.ts`, `executions.service.ts`, `workflows.controller.ts`,
  `http-exception.filter.ts`).

## 발견사항

- **[WARNING]** "저장소 밖 소비자 없음"을 확인된 사실로 단정 — 같은 PR 계열의 아직 열린 트래커 항목과 정면 충돌
  - target 위치: target 문서 `## 왜 지금인가` 문단, "함께 확인된 사실 — **저장소 밖에서
    `GET /api/executions*` 의 `inputData` 를 직접 소비하는 것은 없다**(프런트가 유일 소비자).
    이 사실이 거부 도입의 안전성을 뒷받침한다..."
  - 과거 결정 출처: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:348-352`
    (`14_44_08` W5, 2026-08-20 등재, 아직 `[ ]` open) — "**존재 여부를 확인하고**, 있으면
    릴리스 노트에 breaking 으로 공지." `review/code/2026/08/20/14_44_08/api_contract.md:10`·
    `side_effect.md:17-20` 도 동일하게 "실제 존재 여부는 이 diff 범위 밖"이라고 명시적으로
    **미확인 상태**로 남겨 뒀다.
  - 상세: target 은 "확인된 사실"이라는 표현으로 저장소 밖 소비자 부재를 이미 검증된 전제인
    것처럼 서술하고, 이를 근거로 서버측 400 거부(breaking 성격의 새 실패 모드)의 안전성을
    정당화한다. 그러나 같은 작업 계열의 트래커 항목(W5)은 오늘 같은 날짜에 등재된 채 여전히
    미해결이며, "존재 여부를 확인"하라는 지시가 그대로 남아 있다. 이번 세션이 그 확인 작업
    (API 문서 공개 여부·외부 파트너 연동 여부 등 실제 조사)을 수행한 흔적이 diff/git log
    어디에도 없다 — target 은 열린 질문을 검증 없이 닫힌 사실로 재서술한 것에 가깝다.
    이는 MEMORY 의 "유예 근거는 실측해야 한다" / "미측정 전제가 백로그 항목을 만든다" 교훈과
    같은 형태이며, 이 문장이 그대로 spec `## Rationale` 로 옮겨지면 검증되지 않은 주장이
    영구적 근거로 굳어진다.
  - 제안: (a) 실제로 외부 소비자 부재를 확인했다면 그 근거(문서·API 게이트웨이 로그·계약서
    등)를 target 에 명시하고 W5 항목을 함께 닫을 것. (b) 미확인이라면 "확인된 사실"이라는
    표현을 "가정(assumption)"으로 낮추고, W5 를 이번 PR 의 선행 조건 또는 병행 확인 항목으로
    명시할 것. 서버측 거부 자체(400)는 W5 와 무관하게 유효한 defense-in-depth 이므로 착수를
    막을 필요는 없으나, "안전성 근거"로 쓰는 것은 검증 전에는 부적절하다.

- **[WARNING]** "세 라운드에 걸쳐 리뷰어가 `coerce_failed` 재사용을 제안"— 실제 리뷰 이력과 라운드 수가 맞지 않는다
  - target 위치: target 문서 `## Rationale`, "**기각한 대안 — `coerce_failed` 재사용**: 세
    라운드에 걸쳐 리뷰어가 *"기존 코드 재사용"* 을 제안했고..."
  - 과거 결정 출처: `review/code/2026/08/20/{15_32_34,15_59_17,16_25_35,16_51_19,17_38_33}/*.md`
    (전부 같은 날짜의 연속 라운드) — `coerce_failed` 언급 자체는 다섯 라운드에 걸쳐 있으나,
    "기존 코드 재사용" 을 **제안**한 곳은 `17_38_33/api_contract.md:18`
    ("트래커가 제안한 대로... `coerce_failed` 류와 같은 계열의 `INVALID_INPUT` 으로 거부한다")
    과 `17_38_33/security.md:41-44`("예: 기존 `coerce_failed` 류 에러 코드 재사용") **한 라운드
    (17_38_33) 안의 두 reviewer** 뿐이다. 그 이전 라운드(15_32_34·15_59_17·16_25_35·16_51_19)는
    `coerce_failed` 를 "이미 존재하는 2차 방어"로만 언급했지, 신규 마커 거부 기능에 그 코드를
    재사용하라고 제안하지 않았다.
  - 상세: "세 라운드" 라는 수치는 target 자신의 서두("이 항목은 세 라운드 연속 지적됐고 매번
    같은 근거로 유예됐다: '§R17 이 가드 범위를 UI 정상 흐름으로 명시했다'")에서 다루는 별개의
    사실(서버측 거부 여부 자체를 INFO 로 유예해 온 라운드 수, `spec-sync-external-interaction-api-gaps.md:331`
    "security reviewer 가 라운드마다 독립적으로... INFO 판정")과 혼동된 것으로 보인다. "거부를
    할지 말지"에 대한 유예와 "거부를 어떤 코드로 구현할지(coerce_failed 재사용)"에 대한 제안은
    서로 다른 이력이며, 후자는 실측상 1라운드(2 reviewer)다.
  - 제안: "세 라운드"를 "리뷰 라운드(17_38_33)에서 두 reviewer 가" 등으로 정정하거나, 두
    맥락(서버측 거부 여부의 3라운드 유예 vs `coerce_failed` 재사용 제안의 1라운드)을 분리해
    서술할 것. 기각 사유 자체(#1188 의 실제 UX 퇴화 — `15_32_34/testing.md:48-56` 의 "일반 오류
    토스트" 관측)는 실측과 정확히 일치하므로 유지 가능.

- **[WARNING]** re-run 경로는 현재 `details[]` 를 채우지 않는다 — "details[] 항목 코드만 새로 는다"는 전제가 re-run 에 대해 성립하지 않는다
  - target 위치: target 문서 `## 에러 계약 — 기존 헬퍼를 확장한다` 절, "봉투는 기존과 같다 —
    `INVALID_TRIGGER_PARAMETERS`(execute) · re-run 경로의 400. `details[]` 항목 코드만 새로
    는다."
  - 과거 결정 출처: `plan/complete/spec-sync-webhook-gaps.md:19`(WH-EP-05-2, 2026-06-28 완료)
    가 확립한 원칙 — trigger-parameter 검증 실패는 `error.details[]`(UPPER_SNAKE field code)
    로 노출해야 한다는 합의. `spec/5-system/3-error-handling.md §1.7` 이 그 SoT.
  - 상세: 실제 코드(`codebase/backend/src/modules/executions/executions.service.ts:493-503`)를
    보면 re-run 경로는 `TriggerParameterValidationException` 을 잡아
    `throw new BadRequestException({ code: 'INVALID_INPUT', message: ..., errors: err.errors })`
    로 던진다 — `toTriggerParameterErrorDetails()` 를 거치지 않은 **원문 소문자 `reason`** 을
    `errors` 키에 담는다. 반면 `GlobalExceptionFilter`(`http-exception.filter.ts:73`)는
    `resp.details ?? nested?.details` 만 읽는다 — `errors` 키는 인식되지 않아 **그대로
    드롭**된다. 즉 re-run 은 오늘 시점에 `details[]` 를 클라이언트에 전혀 노출하지 않는다
    (execute 경로 `workflows.controller.ts:314-324` 만 `details: toTriggerParameterErrorDetails(...)`
    를 쓴다). target 이 "`REASON_TO_DETAIL` 에 네 번째 항을 더한다"만으로 해결된다고 서술하면,
    execute 경로는 목표(마커 재입력 안내 코드 `MASKED_VALUE_RESUBMITTED` 노출)를 달성하지만
    **re-run 경로(target 자신의 표에서 유일하게 "사용자가 되보낸 `inputOverride`"로 표시된,
    이 작업의 원 동기가 된 그 호출부)는 여전히 코드가 드롭되어 일반 오류만 노출**된다 — 이는
    target 이 `coerce_failed` 를 기각한 바로 그 이유("사용자가 '마커를 채우라' 대신 일반 오류
    토스트를 본" 문제)를 re-run 에서 그대로 재현한다.
  - 제안: re-run 의 catch 블록도 `details: toTriggerParameterErrorDetails(err.errors)` (또는
    `errors` → `details` 매핑 정정)로 바꾸는 작업을 이번 스코프에 명시적으로 포함시킬 것.
    포함하지 않으려면 최소한 "re-run 은 별도 후속 필요" 라고 target 에 남겨 구현 단계에서
    누락되지 않게 할 것.

## 정합성 확인 (문제 없음으로 판정한 항목)

1. **§R17 "정확 일치만 감지" 경계 준수** — target 의 "정확 일치만" / "중첩까지 본다"(leaf 검사) /
   `MAX_REDACT_DEPTH`(10) 정렬은 §R17 기존 서술 및 `masked-markers.ts`/`sanitize-error-message.ts`
   실측(`review/code/2026/08/20/16_51_19/*`)과 정확히 일치 — 새 대안이 아니라 기존 경계를
   그대로 서버측에 이식.
2. **§R17 잔여② "닫는 조건 충족" 서술을 UI 한정으로 좁히는 갱신** — `18_24_31/rationale_continuity.md`
   WARNING("닫는 조건은 충족됐다"가 실제로는 UI 렌더 경로 한정인데 그 경계가 spec 본문에
   없음)을 target 의 "spec 변경 3곳" 항목 1이 정확히 그 지적대로 해소하려 한다 — 과거 발견의
   무시가 아니라 이행.
3. **`13-replay-rerun.md §10.2` 갱신 방향** — 현재 §10.2 본문은 실제로 클라이언트 차단만
   서술하고 API 직접 우회 가능성을 언급하지 않는다(실측). target 의 "차단이 클라이언트
   전용이라는 전제를 갱신" 은 현재 상태와 부합하는 정확한 진단.
4. **`resolveTriggerParameters` 공유 함수 안에 넣지 않는다는 설계 판단** — R10("엔진 단일
   sink + 결합 회피") 계열이 반복해 온 "공유 프리미티브를 넓히면 무관한 경로가 오염된다"는
   원칙과 결이 같고, 5개 호출부 실측(`grep`)도 target 의 표와 정확히 일치한다(webhook·schedule
   2곳 제외, re-run·execute 만 대상). 기각이 아니라 원칙의 올바른 적용.
5. **`trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` 확장 방식** — 실제 코드에 3개 항목이
   이미 있고, 네 번째 항목을 더하는 것은 신규 표면이 아니라는 target 의 서술과 일치.

## 요약
target 은 §R17·§10.2 등 기존 spec Rationale 이 이미 확립한 "정확 일치만 감지", "공유 함수
오염 금지", "UI 한정 폐쇄를 명문화해야 한다"는 원칙들을 정확히 계승하며 새로운 결정(서버측
거부)에 맞는 새 Rationale 도 함께 쓰고 있어 기본 골격은 건전하다. 다만 세 곳에서 근거의
정확성이 흔들린다 — (1) "외부 소비자 없음"을 같은 날 여전히 열려 있는 트래커 항목(W5)과
모순되게 "확인된 사실"로 단정해 breaking 변경의 안전성 근거로 쓰고 있고, (2) `coerce_failed`
재사용 제안의 이력을 실제보다 부풀려("세 라운드") 인용했으며, (3) 이 작업의 원 동기인 re-run
호출부가 현재 `details[]` 를 전혀 채우지 않는다는 사실(코드 실측으로 확인)을 놓쳐 "details[]
항목만 추가하면 된다"는 전제가 정작 re-run 에서는 성립하지 않는다 — 방치하면 re-run 사용자는
새 마커 코드를 추가한 뒤에도 여전히 일반 오류만 보게 되어, target 이 `coerce_failed` 를 기각한
바로 그 이유를 스스로 재현하게 된다.

## 위험도
MEDIUM
