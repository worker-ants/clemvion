# 문서화(Documentation) 리뷰

## 검증 방법

프롬프트에 실린 unified diff(코드 4파일 + plan 2파일 + spec frontmatter 1파일 + 이전 라운드
`review/**` 산출물 다수) 를 프롬프트 게이트 숫자로 인용하되, 확신이 필요한 곳은 `Read`/`Grep` 으로
현재 워크트리 파일을 직접 열어 대조했다. 이 PR 은 이미 `/ai-review` 두 라운드(`19_25_39`,
`19_36_12`)와 `/consistency-check` 두 라운드(`19_03_59`, `19_48_18`)를 거쳤고, 각 라운드가 지적한
WARNING 은 다음 커밋으로 처분됐다:

- `19_25_39` W1(base JSDoc 블록 내 영↔한 언어 전환) → `5ad216901` 로 해소
- `19_36_12` W1(미머지 PR #1194 를 기정사실 전제) → `d1d8a95bc` 로 폴백 등재
- `19_48_18` WARNING(re-run.dto.ts Swagger description 이 `swagger.md §3` 형식 위반, 304자·SoT 링크
  누락) → **`4a1c8bc48`**(현재 HEAD, 이번 diff 에 포함)로 해소 — `Read` 로 현재 파일을 직접 열어
  236자로 축약되고 `SoT: EIA §R17` 링크가 붙었음을 확인했다.

이번 라운드는 그 누적 상태(HEAD)를 대상으로 재검증한 결과다. 새로 열어 문서-구현 정합을 확인한
파일: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`(전문),
`codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts`(전문),
`codebase/backend/src/modules/executions/dto/re-run.dto.ts`(전문),
`codebase/backend/src/modules/workflows/workflows.controller.ts`(`execute()` 핸들러 전체),
`spec/conventions/swagger.md` §3, `spec/5-system/14-external-interaction-api.md` §R17(1395-1723행),
`spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts`(실재 확인).

## 발견사항

- **[INFO]** (긍정 확인) `re-run.dto.ts` Swagger description 이 직전 라운드(`19_48_18`) WARNING을
  정확히 해소했고, 참조된 SoT(`EIA §R17`)가 실제로 마커 3종 리터럴(`` `***` ``·`` `[REDACTED]` ``·
  `` `[REDACTED_DEPTH]` ``)을 전부 포함하는 유효한 대상임을 확인
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-24` (현재 파일 실측 줄번호;
    diff 게이트로는 파일 3 `:19-23`)
  - 상세: 커밋 `4a1c8bc48` 이 description 을 304자→236자로 줄이고 마커 리터럴 나열을
    `` 'SoT: EIA §R17 (`spec/5-system/14-external-interaction-api.md`).' `` 로 대체했다.
    `spec/conventions/swagger.md:260-267` 의 "보안·정책 캐비엇 예외"(요약 1~2문장 + SoT 링크)
    형식을 따른다. `spec/5-system/14-external-interaction-api.md` 의 `### R17` 은 1395~1723행에
    걸쳐 있고, 그 안 1568~1608행이 서버측 거부 규칙("값 leaf 가 마커와 정확히 일치하면 거부")을,
    1717행이 마커 3종 리터럴을 전부 나열한다 — 참조가 헤딩 제목("`getStatus` 의 `currentNode`/
    `context` 실값 노출")만 보면 무관해 보이지만 실제로는 정확한 타겟이다(이전 라운드
    `19_25_39` documentation INFO 가 이미 확인한 바를 재검증).
  - 제안: 없음. 다만 참고로 — description 이 이제 마커 리터럴 자체를 나열하지 않으므로, OpenAPI
    스펙만 보고 SoT 링크를 따라가지 않는 소비자는 실제 거부 대상 문자열(`***` 등)을 알 수 없다.
    이는 `swagger.md §3` 형식 준수의 의도된 트레이드오프(상세는 spec, 여기는 요약+링크)이지
    결함은 아니다 — 기록만 남긴다.

- **[INFO]** `workflows.controller.ts` `execute()` 는 이번 diff 이후에도 같은 메서드 안에 한/영 주석
  혼재가 남아 있음 (이미 트래킹된 사실의 재확인, 신규 아님)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts` — 한국어로 통일된 곳
    `:281-283`, `:286-287`, `:314-316`, `:320-322`; 영어로 남은 곳 `:294`(`// Verify workflow
    belongs to workspace`), `:297-299`(`// Resolve trigger parameters against...`),
    `:332-335`(`// Stamp the trigger-source marker...`)
  - 상세: `plan/complete/masked-marker-cosmetic-followups.md` 가 스코프를 "같은 try/catch 블록"으로
    명시적으로 좁혔고 실제로 그 블록(`:313-330`)만 번역됐다. 세 라운드 전부(19_25_39 documentation/
    maintainability, 19_36_12 maintainability, 19_48_18 convention_compliance)가 같은 사실을
    INFO로 이미 기록했고 이번 diff 는 그 스코프를 넘지 않는다.
  - 제안: 없음(이미 트래킹). 다음에 이 메서드를 만질 때 나머지 3곳도 한국어로 통일.

- **[INFO]** `POST /workflows/:id/execute` 는 `re-run` 과 동일한 마스킹 마커 거부 규칙을 적용받지만
  OpenAPI 문서엔 그 사실이 없음 (신규 갭 아님, 트래커에 이미 등재됨)
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:275-279`(`execute()`의
    `@Body()` 가 DTO/`@ApiProperty` 없는 인라인 타입) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md:836-843`(2026-08-22 신규 등재, "지금 고치지 않는 이유"+"이식 대상" 명시)
  - 상세: 세 라운드 전부(19_25_39 documentation WARNING → RESOLUTION.md 로 "DTO 승격은 코스메틱이
    아니라 컨트롤러 시그니처 변경"이라 스코프 밖 처분, 19_36_12 api_contract INFO, 19_48_18 은
    재론하지 않음)가 같은 결론에 도달했다. 이번 라운드에서 직접 파일을 열어 재확인한 결과 여전히
    `body?: { input?; parameterValues?; }` 인라인 타입이고 트래커 항목도 그대로 남아 있다 — 상태
    변화 없음.
  - 제안: 없음(이미 트래킹, DTO 승격 기회에 이식 예정).

- **[INFO]** JSDoc·주석·spec frontmatter 상호 참조가 전부 실재하는 대상을 가리킴 (broken/stale
  reference 없음)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:110-122`
    (`{@link resolveTriggerParametersRejectingMasked}`, `repo-guards/__tests__/masked-reject-callers-guard.ts`,
    `spec/5-system/14-external-interaction-api.md §R17`, `spec/4-nodes/7-trigger/1-manual-trigger.md §6`)
  - 상세: 가드 파일 실존(`ls` 확인) · `spec/4-nodes/7-trigger/1-manual-trigger.md` 에 `## 6. 에러
    코드` 섹션 실존(158행) · EIA §R17 실존·마커 3종 포함(위 항목) 을 각각 직접 확인. 지어낸 참조나
    섹션 번호 오기 없음.
  - 제안: 없음.

- **[INFO]** `REASON_TO_DETAIL` 4항목 JSDoc 은 "사용자가 취할 행동" 기준으로 일관되고 실제 발생
  조건과 부합
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
  - 상세: `missing_required`/`coerce_failed`(같은 파일 `validateTriggerParameterSchema`,
    `resolve-trigger-parameters.ts` 의 `isCoerceFailure`) · `invalid_schema`(이름 정규식
    `^[A-Za-z_][A-Za-z0-9_]*$`·중복·미지원 타입, 40-98행) · `masked_value_resubmitted`(기존,
    변경 없음)의 서술이 코드와 일치. `missing_required` 만 단일행 `/** ... */`, 나머지는 다중행
    JSDoc — 물리 포맷 불일치는 `19_36_12` maintainability INFO 가 이미 지적했고 내용 정합에는
    영향 없는 스타일 사안이라 재론하지 않는다.
  - 제안: 없음.

## 요약

이 PR(`masked-marker-cosmetic-followups`)은 실행 코드 0줄 변경의 순수 문서화 변경(JSDoc·Swagger
description·인라인 주석 언어 통일·spec frontmatter `code:` 1줄)이며, 이미 두 번의 `/ai-review`와 두
번의 `/consistency-check`를 거치며 발견된 모든 WARNING(블록 내 언어 혼재, 미머지 PR 전제, Swagger
description 형식 위반)이 후속 커밋으로 순차 해소됐다. 이번 라운드에서 현재 HEAD 상태를 독립적으로
재검증한 결과 새로운 CRITICAL/WARNING 은 발견되지 않았다 — Swagger description 의 SoT 링크(EIA
§R17)가 실제로 유효한 대상(마커 3종 리터럴 포함)을 가리키고, 모든 `{@link}`/spec 섹션/CI 가드 경로
참조가 실재를 확인했다. 남은 항목(`execute()` 잔존 영문 주석, `execute()` OpenAPI 마커 설명 부재)은
전부 plan/트래커에 명시적 스코프 축소 사유와 함께 이미 등재돼 있어 이번 PR의 신규 결함이 아니다.

## 위험도
NONE
