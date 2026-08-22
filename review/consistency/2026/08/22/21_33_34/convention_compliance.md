# 정식 규약 준수 검토 — `spec/4-nodes/7-trigger/` (impl-done)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, target `spec/4-nodes/7-trigger/`(`1-manual-trigger.md` · `0-common.md` · `providers/_overview.md` · `providers/discord.md` · `providers/slack.md` · `providers/telegram.md`), diff-base `origin/main`.
- 이번 diff(`origin/main...HEAD -- code_areas`)는 `reject-masked-resubmission.spec.ts` 에 캐너리 테스트 1건을 추가한 것뿐이다 — **spec 파일 변경은 없다**. 즉 이번 게이트는 신규 spec 변경 검증이 아니라, 구현(테스트) 완료 시점에 target spec 번들이 여전히 `spec/conventions/**` 와 정합한지 재확인하는 성격이다.
- 프롬프트 예산 초과로 `node-output.md`·`node-cancellation.md`·`chat-channel-adapter.md`·`error-codes.md`(일부)·EIA(`14-external-interaction-api.md`) 등 참조 대상 다수가 본문 생략됐다. 관련도가 높은 것들은 워크트리에서 `Read`/`grep` 로 직접 열어 원문을 대조했다(아래 "확인 근거" 참조).

## 발견사항

### [INFO] `1-manual-trigger.md`/`0-common.md`/`providers/_overview.md` 에 명시적 `## Overview` 헤더 부재 (0-common.md 는 Rationale 도 부재)

- target 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md`(제목·관련 문서 직후 바로 `## 1. 설정`), `spec/4-nodes/7-trigger/0-common.md`(바로 `## 1. 트리거 진입 파라미터 공통 계약`, 문서 끝까지 `## Rationale` 섹션 자체가 없음), `spec/4-nodes/7-trigger/providers/_overview.md`(바로 `## 1. Supported providers`, 단 `## Rationale` 은 있음 — L500).
- 위반 규약: `.claude/skills/project-planner/SKILL.md` 의 spec 문서 3섹션 구성(Overview / 본문 / Rationale) 권장 + CLAUDE.md "Spec 문서 3섹션 구성 … 각 SKILL.md 참고".
- 상세: 같은 디렉토리의 `providers/discord.md`·`slack.md`·`telegram.md` 3개는 `## Overview (제품 정의)` → 번호 섹션 → `## Rationale` 3섹션을 정확히 갖췄다(L554/942/1315, L848/1217/1533). 반면 트리거 핵심 문서 2개 + provider 인덱스는 Overview 헤더가 없다. `0-common.md` 는 한 걸음 더 나아가 `## Rationale` 섹션 자체가 없다(문서 안에 결정 배경을 요구할 만한 자체 결정은 없어 보이나, 3섹션 규약을 문자 그대로 보면 미충족).
- **이 갭은 diff 로 신규 도입되지 않았고 target 특유도 아니다.** `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,6-presentation}/0-common.md` 6개를 모두 대조한 결과 **0/6** 이 `## Overview` 헤더를 갖고 있고, `## Rationale` 도 **2/6**(`3-ai`, `6-presentation`)만 갖고 있다 — repo 전역에 걸친 `0-common.md` 카테고리의 일관된 관행이다. 이번 target(`7-trigger/0-common.md`)은 그 다수 패턴을 그대로 따르는 것이지 이번 PR 이 새로 만든 편차가 아니다.
- 제안: 차단 사유 아님. 후속 spec 정리 라운드에서 (a) `0-common.md` 부류 문서에 짧은 `## Overview` 단락(현재 도입부 문장 승격)을 일괄 추가하거나, (b) SKILL.md 에 "카테고리 인덱스/공통 문서처럼 Overview·Rationale 이 자연 발생하지 않는 문서는 헤더 생략 가능"이라는 예외를 명문화해 실제 관행과 규약 문서를 맞출 것 — 이전 `spec/5-system/` impl-prep 검토(`review/consistency/2026/08/22/20_57_25/convention_compliance.md`)가 이미 같은 종류의 INFO 를 낸 것과 동일 계열의 지적이다.

## 준수 확인 (검토 근거로 남김)

- **에러 코드 명명·정규화 파이프라인**: `1-manual-trigger.md §6` 의 `INVALID_TRIGGER_PARAMETERS`/`INVALID_WEBHOOK_PAYLOAD`(봉투 코드)와 `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`(`details[].code`)가 `spec/conventions/error-codes.md §4.2`(2026-08-22 신설) 표와 정확히 1:1 일치, `UPPER_SNAKE_CASE`(§1) 준수. `error-codes.md §4.2` 자체도 봉투 필드(`error.details[].code`)와 정규화 함수(`toTriggerParameterErrorDetails`, 실재 확인: `codebase/backend/.../trigger-parameter.types.ts`)를 §4.1(Code 노드, `output.error.code`)과 명확히 분리해 참조 혼선이 없다.
- **egress 마스킹 좌표계 인용**: `1-manual-trigger.md §6` 이 인용하는 마커 리터럴 `` `***`/`[REDACTED]`/`[REDACTED_DEPTH]` `` 는 `codebase/packages/masked-markers/src/index.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`(=`MASKED_MARKERS`) 와 정확히 일치(직접 `Read` 로 대조). `spec/conventions/egress-masking.md` 의 "마커 리터럴을 적지 않는다" 자기 규율은 그 문서 자신에게만 적용되며, wire 계약을 서술하는 EIA §R17 은 예외로 명시돼 있다 — `1-manual-trigger.md §6` 도 같은 "wire 계약 서술" 레이어(클라이언트가 관측하는 재제출 거부 조건)라 동일 예외가 자연스럽게 적용된다. 위반 아님.
- **SoT 앵커 유효성**: `EIA §R17`(`spec/5-system/14-external-interaction-api.md` L1395~) 을 직접 열어 확인 — R17 섹션 안에 `masked_value_resubmitted`/`MASKED_VALUE_RESUBMITTED`/"재제출" 관련 서술(L1580~1691)이 실제로 존재해, `1-manual-trigger.md` 가 "정의 SoT" 로 인용하는 것이 정확하다. `node-output.md` 의 Principle 0/1.1/2/3.1/7/10/11 앵커도 실재(직접 grep 대조) — manual-trigger.md/0-common.md 가 인용하는 번호 전부 유효.
- **CI 가드 실재성**: `1-manual-trigger.md §6` Rationale 이 인용하는 `repo-guards/__tests__/masked-reject-callers-guard.ts` 와 `resolveTriggerParametersRejectingMasked`/`throwIfAny`(`execution-engine/utils/reject-masked-resubmission.ts`) 모두 워크트리에 실재.
- **provider 명명 컨벤션**: `providers/_overview.md §4` 의 provider 식별자 규칙(lower-case kebab-case)과 `discord`/`slack`/`telegram` 실제 식별자가 일치. `providers/_overview.md` 자체의 `_` prefix 사용은 문서가 스스로 인용하는 `spec/conventions/cafe24-api-catalog/_overview.md` 선례와 동일 패턴 — CLAUDE.md 의 `_product-overview.md`(영역 레벨)와는 스코프가 다른 하위 카탈로그 인덱스 관행으로, 기존 저장소 선례를 그대로 따른다.
- **문서 구조 — provider 문서 3종**: `discord.md`/`slack.md`/`telegram.md` 는 `providers/_overview.md §2` 가 요구하는 "8섹션 + Rationale" 템플릿(Overview / API 매핑 / 명령 매핑 / UI 매핑 / 보안 / 명령 처리 / 비기능 / Rationale)을 3개 모두 동형으로 따른다 — 신규/변경 없는 대조 확인.
- **파일·경로 명명**: `spec/4-nodes/7-trigger/<n>-<slug>.md` 넘버링·kebab-case, `0-common.md` prefix 가 `spec/4-nodes/` 하위 6개 카테고리 전체와 동형(위 발견사항 참조) — CLAUDE.md 명명 컨벤션과 저장소 실제 관행 모두 준수.
- **diff 자체(코드)**: 신규 캐너리 테스트는 마커 리터럴을 하드코딩하지 않고 `VALUE_MASK_MARKER` 상수를 import 해 조립한다 — egress-masking.md 가 요구하는 "리터럴을 박지 말고 상수를 import" 코드 규율과 일치(코드 리뷰 영역이라 별도 code-review 산출물(`review/code/2026/08/22/21_15_53`, `21_25_45`)에서 이미 다뤄졌으나 정식 규약 관점에서도 저촉 없음을 확인).

## 요약

target(`spec/4-nodes/7-trigger/`)은 이번 diff(테스트 전용, spec 미변경) 전후로 `spec/conventions/**` 전반과 정합하다. 에러 코드 명명·정규화 파이프라인, egress 마스킹 마커 리터럴 인용의 레이어 예외, SoT 교차 인용(EIA §R17·node-output.md Principle·CI 가드 파일)이 모두 실재 코드/문서와 1:1 로 대조 확인됐고 CRITICAL·WARNING 급 위반은 없다. 유일한 발견은 `1-manual-trigger.md`/`0-common.md`/`providers/_overview.md` 의 명시적 `## Overview` 헤더 부재(및 `0-common.md` 의 `## Rationale` 부재)로, `spec/4-nodes/` 전역 `0-common.md` 6개 중 0개가 Overview 를 갖는 것으로 확인되는 **repo 전역 pre-existing 관행**이며 이번 target·이번 diff 특유의 편차가 아니다. `--impl-done` 게이트를 차단할 사유는 없다.

## 위험도

LOW
