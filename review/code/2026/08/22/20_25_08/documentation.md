# 문서화(Documentation) 리뷰

## 검증 방법

이 diff(`main...HEAD`)는 `masked-marker-cosmetic-followups` 코스메틱 4건(`b2c604469`) +
후속 리뷰/consistency 라운드 처분 커밋 4개(`5ad216901`·`d1d8a95bc`·`4a1c8bc48`·`a578366c7`)의
누적 상태다. 이미 `/ai-review` 3라운드(`19_25_39`·`19_36_12`·`20_05_07`)와 `/consistency-check`
3라운드(`19_03_59`·`19_48_18`·`20_05_10`)를 거쳤고, 그 라운드들의 documentation/convention_compliance
리포트를 전부 읽어 이번 라운드가 처음 보는 상태가 무엇인지부터 특정했다.

**신규 상태는 재-run 코드 파일 1개(`re-run.dto.ts`, 커밋 `a578366c7`) + 트래커 신규 등재 1건
(`spec-sync-external-interaction-api-gaps.md`)뿐이다** — `trigger-parameter.types.ts` ·
`resolve-trigger-parameters.ts` · `workflows.controller.ts` · `spec/4-nodes/7-trigger/1-manual-trigger.md`
는 `git log --oneline -- <path>` 로 확인한 결과 `5ad216901` 이후 더 이상 수정되지 않았고, 그 상태는
이미 `20_05_07` documentation 라운드가 전문 대조로 RISK NONE 처리했다(재론하지 않음). 나머지
`review/**` 신규 파일 다수는 이전 라운드들의 자기 산출물이 저장소에 커밋된 것으로, 문서화 관점의
신규 코드 대상이 아니다.

재검증한 것:
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts`(전문, `Read`) — 최종 blob
  `9ba9cfbf4`(=`git rev-parse HEAD:...`) 가 프롬프트 diff 게이트와 바이트 단위 일치 확인.
- `spec/conventions/swagger.md` §3(전문) — 길이 가이드(`description` 50~150자)와 "보안·정책
  캐비엇" 예외 문구("**응답** 값이 저장된 값과 다를 수 있는 필드") 원문 대조.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:825-834`(신규 등재 항목).
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` — "SoT: EIA
  §R17" 표기가 같은 파일 안에서도 완전 경로형(`:55,171`)과 축약형(`:191,205`) 두 형태가 이미
  공존함을 `grep` 으로 확인(신규 비일관 아님).
- `CHANGELOG.md` — 전체 `## Unreleased` 항목이 예외 없이 동작/계약 변경 건이고 순수 문서화
  변경은 하나도 없음을 확인(이번 코스메틱 PR 이 항목을 안 넣은 것이 갭이 아니라 일관된 관행).

## 발견사항

- **[INFO]** (긍정 확인) `re-run.dto.ts` description 이 두 라운드 연속 지적(길이 위반 → 예외
  문면 범위 밖)을 순차로 해소해 최종 129자로 가이드(≤150자) 안에 들어왔고, 캐비엇 핵심(마커
  정확 일치 → `400 MASKED_VALUE_RESUBMITTED`)과 SoT 링크는 보존됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-22`
  - 상세: `swagger.md §3` 의 길이-예외 문구는 "**응답** 값이 저장된 값과 다를 수 있는 필드"로
    한정돼 있어 **요청** 필드인 `inputOverride` 는 문면상 그 예외의 대상이 아니다(커밋
    `a578366c7` 스스로 이를 근거로 예외에 기대는 대신 가이드 안으로 재축약). 이 판단은 정확하다
    — §3 예외 문단을 직접 읽어도 "응답"으로만 적혀 있다. 그 결과 실제 `description` 길이(129자,
    `python3 -c "print(len(...))"` 로 재계산해 커밋 메시지 수치와 일치 확인)가 가이드 범위
    안이며, 정보 손실 없이 축약됐다.
  - 제안: 없음.

- **[INFO]** `swagger.md §3` 예외 조항의 문면 범위(응답 전용)가 실제로는 요청 필드
  보안 캐비엇에도 필요하다는 사실이 정본 트래커에 사유·이식 대상까지 함께 등재됨
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:825-834`
  - 상세: 같은 DTO 의 `dryRun` description(174자, 재계산 확인)이 이미 가이드를 초과한 상태로
    존재해 "규약 문면이 현실보다 좁다"는 주장도 실측으로 뒷받침된다. 이 갭은 규약 개정(§3 예외
    범위 확장) 성격이라 developer 권한 밖 — planner 턴으로 정확히 분류돼 있고, `spec/conventions/swagger.md`
    본문은 이번 diff 에서 손대지 않았다(스코프 침범 없음).
  - 제안: 없음 — 이미 올바르게 트래킹됨. planner 턴에서 §3 예외 조항 확장 검토.

- **[INFO]** `plan/complete/masked-marker-cosmetic-followups.md` 는 `5ad216901`(19_25_39 라운드
  처분) 시점에 봉인된 이후, 그 뒤 이어진 리뷰/컨시스턴시 4라운드와 후속 커밋 3개(`d1d8a95bc`·
  `4a1c8bc48`·`a578366c7`)의 작업 이력을 포함하지 않음
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md` (전체 — `git log --follow` 상
    `5ad216901` 이후 미수정)
  - 상세: 이는 결함이 아니라 의도된 설계다 — 커밋 `d1d8a95bc` 메시지가 명시적으로 "완료 plan 은
    이미 봉인돼 손대지 않았다"고 밝히고, 후속 처분은 전부 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    (계속 편집 가능한 정본 트래커)에 등재하는 방식을 택했다. `plan/complete/` 문서가 어떤 거짓
    주장도 하지 않으며(완료 시점의 사실을 정확히 서술), 후속 사실은 다른 SoT 에 정확히 남아 있어
    "완료 plan ≠ 실제 최종 상태"인데도 오도하지 않는다.
  - 제안: 없음 — 참고용 기록. 이 프로젝트의 plan lifecycle 관행(완료 문서 append 금지, 후속은
    별도 in-progress 트래커)과 일치한다.

- **[INFO]** `EIA §R17` 참조가 이번 diff 의 최종 형태에서 파일 경로 없이 축약(`SoT: EIA §R17.`)됐지만,
  같은 마스킹 관련 형제 DTO(`execution-response.dto.ts`)에서 이미 완전 경로형과 축약형이 공존하는
  기존 관행이라 신규 비일관이 아님
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:22`
  - 상세: `grep -n "SoT: EIA" codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    결과 `:55`·`:171` 은 `SoT: EIA §R17 (\`spec/5-system/14-external-interaction-api.md\`).`(완전
    경로), `:191`·`:205` 는 `SoT: EIA §R17.`(축약) 형태로 이미 혼재한다. "EIA" 축약어 자체도
    저장소 전역에서 20곳 이상 bare 로 통용되는 정착된 관행이다(`main.ts`·`redact-stored-error.ts`
    등). 이번 diff 가 새 비일관을 만든 것이 아니라 기존 두 관행 중 짧은 쪽을 선택했을 뿐이다.
  - 제안: 없음.

- **[INFO]** (긍정 확인) `trigger-parameter.types.ts` · `resolve-trigger-parameters.ts` ·
  `workflows.controller.ts` 는 이번 diff 구간에서 `5ad216901` 이후 추가 수정이 없어 이전
  라운드(`20_05_07`)의 documentation 리포트(RISK NONE — JSDoc 정합성·`{@link}`/spec 참조 실재성·
  가드 파일 경로 실존 전부 확인됨)가 그대로 유효함
  - 위치: 해당 3개 파일 (`git log --oneline -- <path>` 로 확인, 목록 생략)
  - 상세: 재론 불필요. 유일한 참고 사항으로, `trigger-parameter.types.ts` 의 `TriggerParameterErrorDetail`
    인터페이스 JSDoc(영문)과 그 아래 `REASON_TO_DETAIL` 맵 항목들의 신규 주석(순한국어)이 파일
    수준에서는 언어가 혼재하지만, 이는 이번 diff 가 건드리지 않은 기존 인터페이스 docblock 이고
    새로 추가된 4개 주석 블록 자체는 전부 한국어로 통일돼 있다(19_25_39 maintainability 리포트가
    이미 "새 comment 들은 순한국어"로 확인한 바와 일치).
  - 제안: 없음.

## 요약

이번 라운드에서 실제로 신규 관찰이 필요했던 표면은 재-run DTO 의 최종 Swagger description(129자,
`a578366c7`)과 정본 트래커 신규 등재 1건뿐이었고, 나머지는 이미 세 번의 `/ai-review` + 세 번의
`/consistency-check` 를 거치며 처분·검증이 끝난 상태의 재확인이었다. 재-run description 은 규약
길이 가이드 안으로 정확히 들어왔고 정보 손실 없이 축약됐으며, 규약 문면 자체의 갭(응답-전용
예외 문구가 요청 필드 캐비엇을 못 덮는 것)은 developer 권한 밖 사안으로 정확히 트래커에 등재돼
있다. 완료로 봉인된 plan 문서가 후속 3커밋의 이력을 담지 않는 것도 결함이 아니라 이 저장소의
plan lifecycle 관행(봉인 후 append 금지, 후속은 in-progress 트래커)과 일치하는 설계다. 신규
CRITICAL/WARNING 은 발견되지 않았다.

## 위험도
NONE
