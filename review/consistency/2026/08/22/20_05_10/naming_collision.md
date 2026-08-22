# 신규 식별자 충돌 검토 — spec/4-nodes/7-trigger/ (impl-done, diff-base=origin/main)

## 검토 방법

`git diff origin/main...HEAD` 로 `codebase/**` · `spec/**` 범위의 실질 변경분을 먼저 특정했다
(`plan/**`·`review/**` 산출물은 검토 대상 제외). 실질 변경은 다음 5곳뿐이다:

1. `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 기존
   `REASON_TO_DETAIL` 매핑 4개 항목 각각에 **JSDoc 주석만 추가**. 식별자(코드/필드명) 변경 없음.
2. `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — 기존
   함수 `resolveTriggerParameters` 위 doc comment 를 한국어로 재작성 + wrapper
   (`resolveTriggerParametersRejectingMasked`, 기존 파일 `reject-masked-resubmission.ts` 에 정의)
   관계를 설명하는 문단 추가. 함수 시그니처·식별자 불변.
3. `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `@ApiPropertyOptional` 의
   `description` Swagger 문자열만 두 차례 개정(19:48 라운드 이후 추가 커밋
   `4a1c8bc48` 에서 304자→236자로 재축약 + `SoT: EIA §R17` 링크 추가). DTO 필드명·타입 불변,
   본문에 등장하는 `MASKED_VALUE_RESUBMITTED` 는 기존 코드를 재인용할 뿐 새로 정의하지 않음.
4. `codebase/backend/src/modules/workflows/workflows.controller.ts` — 인라인 주석 문구를
   영어에서 한국어로 교체(코드 동작·식별자 불변).
5. `spec/4-nodes/7-trigger/1-manual-trigger.md` — frontmatter `code:` 목록에 **이미 존재하는**
   파일 `codebase/backend/src/modules/executions/executions.service.ts` 경로 1줄 추가(cross-link
   보강). 새 파일도 새 식별자도 아님.

diff 내 `+` 라인 중 주석·Swagger 문자열이 아닌 실질 텍스트는 없다. 유일하게 눈에 띄는 식별자
인용(`INVALID_TRIGGER_PARAMETERS` / `MASKED_VALUE_RESUBMITTED`)은 `origin/main` 시점에 이미
정의돼 있음을 직접 확인했다:

```
$ git grep -n "MASKED_VALUE_RESUBMITTED" origin/main -- codebase/
origin/main:.../trigger-parameter.types.ts:32:    | 'MASKED_VALUE_RESUBMITTED';
origin/main:.../trigger-parameter.types.ts:60:    code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../resolve-trigger-parameters.spec.ts:189:        code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../executions-rerun.service.spec.ts:437:        code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../workflows.controller.spec.ts:154,205: 'MASKED_VALUE_RESUBMITTED'
```

추가 커밋(`4a1c8bc48`, "Swagger description 을 `swagger.md §3` 형식으로")이 새로 인용하는
`SoT: EIA §R17` 도 실제 존재하는 절임을 확인했다:

```
$ grep -n "^### R17" spec/5-system/14-external-interaction-api.md
1395:### R17. `getStatus` 의 `currentNode`/`context` 실값 노출 ...
```

target 문서 번들에 포함된 `spec/4-nodes/7-trigger/{1-manual-trigger,0-common,
providers/_overview,providers/discord,providers/slack,providers/telegram}.md` 의 나머지 내용은
diff-base 대비 **unchanged 문서 전문**(컨텍스트용 번들)이며, 그 안의 reason 코드
(`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`), 필드 코드
(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`),
엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`,
`POST /workflows/:id/save`), Discord provider 관련 식별자(`provider: "discord"`,
`clemvion_form`/`clemvion_reply` custom_id, CCH-MP-* 등)는 모두 2026-08-20/21 또는 그 이전 PR
에서 이미 도입·검토된 식별자이며 본 PR(diff) 범위 밖이다.

## 발견사항

없음 — 본 diff(`origin/main...HEAD`)는 JSDoc 주석·Swagger `description` 문자열·인라인 주석
언어 교체·frontmatter cross-link 한 줄만 바꾸는 순수 문서화 정정(cosmetic)이며 요구사항 ID,
엔티티/DTO/인터페이스명, API endpoint, 이벤트/메시지명, 환경변수·설정키, spec 파일 경로 그
어느 범주에서도 신규 식별자를 도입하지 않는다.

## 요약

`git diff origin/main...HEAD` 로 `codebase/**`·`spec/**` 실질 변경 표면을 먼저 좁혀 확인한 결과,
코드 변경은 기존 함수·타입·DTO 필드에 대한 JSDoc/Swagger 설명 보강과 주석 한/영 교체뿐이고,
spec 변경은 이미 존재하는 파일 경로 1개를 frontmatter `code:` 목록에 추가한 것뿐이다. 이 세션
직전(`19:48:18`) 라운드 이후 추가된 커밋(`4a1c8bc48`, Swagger description 재축약 + SoT 링크
추가)도 동일하게 순수 텍스트 편집이며 새 식별자를 만들지 않는다 — 오히려 마커 리터럴 3종
verbatim 나열을 제거하고 기존 spec 절(`EIA §R17`)로의 참조 링크로 대체해 SoT 집중도를
높였다. 새로 부여된 요구사항 ID, 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새
이벤트/메시지명, 새 ENV/설정키, 새 spec 파일 경로가 전무하므로 신규 식별자 충돌 관점에서
검토할 대상 자체가 없다.

## 위험도

NONE
