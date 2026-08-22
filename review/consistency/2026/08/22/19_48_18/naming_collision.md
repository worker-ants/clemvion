# 신규 식별자 충돌 검토 — spec/4-nodes/7-trigger/ (impl-done, diff-base=origin/main)

## 검토 방법

`git diff origin/main...HEAD` 로 실제 변경분을 먼저 특정했다. 전체 diff(38 files, +2240/-14) 중
`spec/`·`codebase/` 코드 영역의 실질 변경은 다음 5곳뿐이고 **나머지는 전부 `plan/**`·`review/**` 산출물**이다:

1. `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — 기존
   `REASON_TO_DETAIL` 매핑 각 항목 위에 **JSDoc 주석만 추가**(코드/식별자 변경 없음).
2. `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — 기존
   함수 `resolveTriggerParameters` 위 doc 주석을 한국어로 재작성 + wrapper 관계를 설명하는
   문단 추가(함수 시그니처·식별자 불변).
3. `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `@ApiPropertyOptional` 의
   `description` 문자열(Swagger 문서 텍스트)만 확장. DTO 필드명·타입 불변.
4. `codebase/backend/src/modules/workflows/workflows.controller.ts` — 인라인 주석 문구를
   영어에서 한국어로 교체(코드 동작 불변).
5. `spec/4-nodes/7-trigger/1-manual-trigger.md` — frontmatter `code:` 목록에
   `codebase/backend/src/modules/executions/executions.service.ts` **경로 1줄 추가** (이미
   존재하는 파일에 대한 cross-link 보강 — 새 파일도 새 식별자도 아님).

diff 내 `+` 라인 중 주석이 아닌 유일한 실질 텍스트는 `re-run.dto.ts` 의 Swagger 설명문에 등장하는
`INVALID_TRIGGER_PARAMETERS` / `MASKED_VALUE_RESUBMITTED` 인용인데, 둘 다 **origin/main 시점에
이미 존재**함을 직접 확인했다:

```
$ git grep -n "MASKED_VALUE_RESUBMITTED" origin/main -- codebase/
origin/main:.../trigger-parameter.types.ts:32:    | 'MASKED_VALUE_RESUBMITTED';
origin/main:.../trigger-parameter.types.ts:60:    code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../resolve-trigger-parameters.spec.ts:189:        code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../executions-rerun.service.spec.ts:437:        code: 'MASKED_VALUE_RESUBMITTED',
origin/main:.../workflows.controller.spec.ts:154,205: 'MASKED_VALUE_RESUBMITTED'
```

즉 이 PR("masked-marker-cosmetic-followups")은 **요구사항 ID, 엔티티/타입명, API endpoint,
이벤트/메시지명, 환경변수·설정키, 신규 spec 파일 경로 그 어느 범주에서도 새 식별자를 도입하지
않는다.** target 문서 번들에 포함된 `spec/4-nodes/7-trigger/{1-manual-trigger,0-common,
providers/_overview,providers/discord,providers/slack,providers/telegram}.md` 의 나머지 내용은
diff-base 대비 unchanged 문서 전문(컨텍스트용 번들)이며, 그 안의 reason 코드
(`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`), 필드 코드
(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`),
엔드포인트(`POST /workflows/:id/execute`, `POST /executions/:id/re-run`,
`POST /workflows/:id/save`) 등은 모두 2026-08-20/21 이전 PR 에서 이미 도입·검토된 식별자이며
본 PR 범위(diff) 밖이다.

## 발견사항

없음 — 본 diff 는 주석·Swagger 설명 텍스트·frontmatter cross-link 한 줄만 바꾸는 순수 문서화
정정(cosmetic)이며 신규 식별자를 전혀 도입하지 않는다.

## 요약

`git diff origin/main...HEAD` 로 실제 변경 표면을 먼저 좁혀 확인한 결과, 코드 변경은 기존
함수·타입·DTO 필드에 대한 JSDoc/Swagger 설명 보강과 주석 한영 교체뿐이고, spec 변경은 이미
존재하는 파일 경로 1개를 frontmatter `code:` 목록에 추가한 것뿐이다. 새로 부여된 요구사항 ID,
새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 이벤트/메시지명, 새 ENV/설정키, 새 spec 파일
경로가 전무하므로 신규 식별자 충돌 관점에서 검토할 대상 자체가 없다. diff 내 유일하게 눈에
띄는 식별자 인용(`INVALID_TRIGGER_PARAMETERS`, `MASKED_VALUE_RESUBMITTED`)은 origin/main 에
이미 정의돼 있음을 `git grep` 으로 직접 확인했으므로 충돌 소지가 없다.

## 위험도

NONE
