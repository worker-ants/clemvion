# Cross-Spec 일관성 검토 — `inputOverride` 서버측 마커 리터럴 거부

## 검토 방법
`_prompts/cross_spec.md` 의 번들에서 `spec/5-system/14-external-interaction-api.md`(EIA, R17 포함)가
"컨텍스트 예산 초과"로 통째로 생략돼 있어, 해당 파일과 관련 소비처 문서(§R17 이 인용하는
`1-data-model.md`·`3-workflow-editor/3-execution.md`·`4-nodes/7-trigger/1-manual-trigger.md`)를
저장소에서 직접 읽어 대조했다.

## 발견사항

- **[WARNING]** `spec_impact` 목록에 실제 reason-코드 taxonomy 의 도메인 SoT (`spec/4-nodes/7-trigger/1-manual-trigger.md §6`)가 빠졌다
  - target 위치: front-matter `spec_impact:` (14-external-interaction-api.md · 3-error-handling.md · 13-replay-rerun.md 3곳만 등재), 그리고 "spec 변경 4곳" 절
  - 충돌 대상: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 "에러 코드" — reason 코드 표(162~169행: `invalid_schema`/`missing_required`/`coerce_failed` 셋만 등재)와 그 바로 아래 어댑터별 에러 코드 표(177~182행: **Manual(주 실행 경로) → `INVALID_TRIGGER_PARAMETERS` (`workflows.controller.ts`)**, **Manual re-run(inputOverride) → `INVALID_INPUT` (`executions.service.ts`)**)
  - 상세: 이 표는 target 이 거부 대상으로 지목한 두 호출부(`workflows.controller.ts:314`·`executions.service.ts:493`)를 정확히 그 이름으로 이미 카탈로그화하고 있고, `trigger-parameter.types.ts` 의 reason→code 매핑을 "머신 코드 단일화"라는 명시 원칙 아래 문서화하는 자리다(171행: "위 4가지 구조 위반은 모두 단일 `invalid_schema` reason 으로 산출된다"). target 이 이 매핑에 네 번째 reason(`masked_marker`)을 추가하면서 이 파일을 갱신 대상에서 빼면, §6 의 reason 표는 새 reason 이 실존하는데도 세 항목만 보여주는 낡은 카탈로그가 된다 — `3-error-handling.md` 자신의 Rationale 이 여러 차례("§1 카탈로그 완결성" bullet 들) 지켜 온 "SoT 미러 전체를 함께 갱신" 관행과 어긋난다.
  - 제안: `spec_impact` 에 `spec/4-nodes/7-trigger/1-manual-trigger.md` 추가하고, §6 reason 표에 `masked_marker` 행(대상: Manual 실행 경로·Manual re-run 두 어댑터 한정, 나머지 둘은 미적용)을 등재. 어댑터별 에러 코드 표(177~182행)에도 각주로 신규 `details[].code` 참조를 남기면 `3-error-handling.md §1.7` 갱신과 대칭이 된다.

- **[WARNING]** "닫는 조건" 서술을 프런트-only 로 단정하는 문서 2곳이 target 의 갱신 대상 밖에 있다
  - target 위치: "spec 변경 4곳" 절 (④ `13-replay-rerun.md §10.2` 만 "차단이 클라이언트 전용이라는 전제를 갱신"으로 명시하고, 동일 전제를 서술하는 다른 두 문서는 다루지 않는다)
  - 충돌 대상:
    1. `spec/1-data-model.md` §2.13 Execution `input_data` 행(471행) — *"**프런트 마커 가드**(프리필 스킵·제출 차단)가 서면서 그 조건이 해소돼 전환했다"* 라고 프런트 가드만을 폐쇄 근거로 서술
    2. `spec/3-workflow-editor/3-execution.md` §2.2 "히스토리 로드" 행(91행) — 에디터 "Run with Input" JSON 경로(target 의 `workflows.controller.ts:314` 호출부와 동일 엔드포인트의 UI 소비처)의 클라이언트 전용 차단(*"Run 이 비활성된다... 마커를 실제 값으로 바꾸면 해제되며"*)을 유일한 방어로 서술
  - 상세: 두 문서 모두 §R17 이 카탈로그화하는 "닫는 조건"(마커 재입력 강제)의 근거를 프런트 가드만으로 서술한다. target 이 서버측 400 거부라는 2차 방어층을 §R17 표에 추가하면서 이 두 문서를 그대로 두면, 같은 사실(왜 이 라운드트립이 안전한가)에 대해 문서마다 다른 이야기를 하게 된다 — R17 은 2층 방어를 말하는데 data-model·execution 문서는 여전히 1층만 언급.
  - 제안: 두 문서에 "서버가 2차로도 거부한다" 한 줄씩 추가하거나, 최소한 R17 로의 cross-ref 를 "닫는 조건의 최신 상세는 R17 참조"로 갱신. `spec_impact` 에 두 파일을 추가하거나, 최소 이 draft 의 "구현 스코프" 절에 "문서 동기화 필요"로 명시.

- **[INFO]** 신규 reason `masked_marker` 의 명명축이 형제 세 항목과 다르다
  - target 위치: "에러 계약 — 기존 헬퍼를 확장한다" 표 (`masked_marker` → `MASKED_VALUE_RESUBMITTED`)
  - 충돌 대상: `spec/4-nodes/7-trigger/1-manual-trigger.md §6` reason 표 — `invalid_schema`/`missing_required`/`coerce_failed` (모두 "무엇이 실패했나"를 서술하는 상태/동사형)
  - 상세: 기존 세 reason 은 검증 실패의 **성격**(무엇이 어긋났는가)을 표현하는 반면 `masked_marker` 는 **값의 정체**(그것이 마스킹 마커라는 사실)를 표현해 명명 축이 다르다. 기능상 문제는 없으나 `conventions/error-codes.md` 의 "의미 기반 명명" 원칙에 비춰 형제 항목과 나란히 읽었을 때 일관성이 떨어진다.
  - 제안: `masked_value_resubmitted` 처럼 형제와 같은 "실패 서술" 형태로 맞추거나, 현재 이름을 유지한다면 §6 표 갱신 시 다른 세 항목과 구분되는 이유를 한 줄 남긴다.

## 요약

target 의 핵심 설계(호출부 판정·정확 일치·깊이 상한 재사용·`coerce_failed` 비재사용·공유 함수 오염 회피)는 실측한 기존 spec 본문(§R17 "닫는 조건" 표·`3-error-handling.md §1.7`·`13-replay-rerun.md §8.1/§10.2`)과 직접 모순되는 지점이 없고, 오히려 기존 카탈로그 구조(reason→code 매핑, details[] 레이어)를 정확히 재사용한다. 다만 번들에서 EIA 본문이 예산 초과로 생략된 상태에서 원본을 대조한 결과, target 이 건드리는 두 호출부(`workflows.controller.ts:314`·`executions.service.ts:493`)를 이미 이름으로 카탈로그화하고 있는 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 이 `spec_impact` 에서 빠져 있고, 같은 "닫는 조건"을 프런트-only 로 서술하는 `1-data-model.md §2.13`·`3-workflow-editor/3-execution.md §2.2` 도 갱신 대상 밖이다 — 셋 다 채택 자체를 막는 모순은 아니지만, 이 저장소가 반복해서 지적받아 온 "SoT 미러 동기화 누락" 패턴과 같은 형태라 명시 반영이 필요하다.

## 위험도
MEDIUM
