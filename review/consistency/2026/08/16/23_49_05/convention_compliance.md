# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 방법 메모

조립된 `_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 두 핵심 입력이 절단돼 있었다:
`<git diff origin/main...HEAD -- code_areas>` 전체(원래 53,870자)와 `spec/conventions/` 의 다수
파일(`error-codes.md`·`node-output.md`·`swagger.md`·`execution-context.md`·`spec-impl-evidence.md`·
`redis-keys.md`·`conversation-thread.md`·`interaction-type-registry.md` 등)이 "본문 생략됨" 마커만
남기고 비어 있었다. 이 checker 는 파일시스템 직접 read 권한이 있으므로:

- `git diff origin/main...HEAD --stat` / `git diff origin/main...HEAD -- spec/5-system/*.md` 를
  워크트리에서 직접 실행해 실제 변경분을 확인했다 (실제 target 커밋: `e5a63abff` "새 마스킹 불변식
  등재 + 리뷰 발견 8건 반영", 그 전 `107c8038f`·`57917975c`·`b5e4dbb9c`·`f5351e9c2`·`1b8fd5cc7`·
  `fe6a54c80` 가 선행).
- 절단된 conventions 7개 파일을 `spec/conventions/` 에서 직접 read 했다 (`error-codes.md`·
  `node-output.md`·`swagger.md`·`spec-impl-evidence.md` 전문 확인, `secret-store.md`·`audit-actions.md`
  는 번들에 전문이 있었음).
- target 이 인용하는 식별자(`redactStoredErrorForResponse`/`redactStoredDataForResponse`/
  `WIRE_PRESERVED_FIELDS`/`FANOUT_EVENTS`/`executionEventSubject.next`/`deepRedactSecrets`)를
  실제 코드(`executions.service.ts`/`websocket.service.ts`/`redact-stored-error.ts`/
  `notification-fanout.service.ts`)에서 grep 으로 대조했다 — 전부 정확히 일치.

이 세션은 동일 target 에 대한 **세 번째** convention_compliance 라운드다. 앞 두 라운드
(`22_22_36`은 초기 코드 PR, `23_10_41`은 `plan/in-progress/spec-draft-eia-fanout-masking.md`
draft)에서 나온 WARNING("draft 에 `## Rationale` 섹션 없음")과 INFO("`12-webhook §5.3` 인용에
앵커 누락")는 이번 커밋(`e5a63abff`)에서 모두 해소됐음을 확인했다 — draft 는 이제 `## Rationale`
섹션(`spec-draft-eia-fanout-masking.md:140`)을 갖고, 실제 spec 반영본은
`[12-webhook §5.3](./12-webhook.md#53-민감-헤더-마스킹-ingestion)` 로 기존 3곳(`5-expression-language.md`)과
동일한 앵커-포함 인용을 쓴다 (`14-external-interaction-api.md:1561`).

## 발견사항

- **[INFO]** 신규 DTO JSDoc 이 swagger.md §3 의 길이 가이드라인(10~40자)을 크게 초과
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    의 `inputData`/`outputData`/`error`(`NodeExecutionSummaryDto.error`) 필드 JSDoc — 이번 diff 로
    각 4~6줄짜리 문단이 추가됨 (예: `inputData` 필드, `:49-57`).
  - 위반 규약: [`spec/conventions/swagger.md` §3 "주석/설명 톤"](spec/conventions/swagger.md) —
    *"DTO `description`은 10~40자 내외"*. `swagger.md` 서두는 JSDoc 이 `introspectComments: true`
    로 그대로 Swagger `description` 필드가 된다고 명시하므로, 이 문단들은 non-production
    `/docs` Swagger UI 에 그대로 노출된다.
  - 상세: 새 JSDoc 은 결정 날짜(`2026-08-16`)·내부 함수명(`redactStoredDataForResponse`)·spec
    파일 경로(`spec/5-system/12-webhook.md`)·타 필드 참조("위 `inputData` 와 같은 정책")까지
    담아 API 소비자용 설명이라기보다 내부 rationale 메모에 가깝다. 다만 **이 파일 자체에
    이미 선례가 있다** — 같은 파일의 `TriggerSourceType`(`:22-25`)·`NodeExecutionSummaryDto.outputData`
    (`:164-169`) 필드도 기존에 이미 40자를 넘는 다문장 JSDoc 을 쓰고 있어, 이번 추가는 기존
    패턴의 반복이지 새로운 이탈은 아니다.
  - 제안: 정식 위반이라기보다 기존 스타일 부채의 연장이므로 이번 PR 에서 되돌릴 필요는 없다.
    다만 이 파일이 계속 길어지는 추세라면, `swagger.md §3` 규약 문구를 "DTO 필드 중 보안/마스킹처럼
    소비자가 알아야 하는 caveat 은 길이 제한 예외" 로 갱신하거나, 짧은 `@ApiPropertyOptional({
    description })` 한 줄 + 나머지 rationale 은 순수 코드 주석(JSDoc 밖)으로 분리하는 대안을
    검토할 것.

## 검토 관점별 결론

1. **명명 규약**: 위반 없음. spec 텍스트가 인용하는 모든 신규/기존 식별자
   (`redactStoredErrorForResponse`/`redactStoredDataForResponse`/`WIRE_PRESERVED_FIELDS`/
   `FANOUT_EVENTS`/`sanitizePayloadForWs`/`stripExternalOnlyFields`/`deepRedactSecrets`/
   `executionEventSubject.next`)가 실제 코드베이스에 정확히 그 이름으로 존재함을 grep 으로
   확인했다. `executionEventSubject.next` 호출부가 "정확히 둘"이라는 R17 신규 문장도 실측
   일치(`websocket.service.ts:281`, `:348`). `FANOUT_EVENTS` 화이트리스트에 `execution.node.*`
   가 없다는 주장도 `notification-fanout.service.ts:21-27` 과 일치.
2. **출력 포맷 규약**: 위반 없음. WS 이벤트 필드 표의 `nodeName`→`nodeLabel` 정정은 실측
   (`nodeLabel: node.label ?? node.type` 다수 emit, `nodeName` emit 0건)과 일치하는 spec-wire
   드리프트 교정이다. 신규 값-패턴 마스킹은 필드 shape 를 바꾸지 않고 값만 치환하며(§R17
   "형태는 바꾸지 않는다" 명시), 기존 `{ executionId, ..., seq, timestamp }` 봉투 구조·
   `error-codes.md`/`node-output.md §3.2` 의 `output.error` 표준 형태와 충돌하지 않는다. DTO
   description 건은 위 INFO 참조.
3. **문서 구조 규약**: 위반 없음. 편집된 세 spec 파일(`14-external-interaction-api.md`·
   `6-websocket-protocol.md`·`12-webhook.md`) 모두 Overview/본문/`## Rationale` 3섹션 구조가
   그대로 유지되고, 신규 내용은 기존 R17/§4.1/§5.3 섹션 **내부**에 삽입돼 구조를 훼손하지
   않는다. frontmatter(`id`/`status`/`code`/`pending_plans`)도 `spec-impl-evidence.md` 스키마를
   그대로 따르며 `pending_plans` 대상 파일(`spec-sync-external-interaction-api-gaps.md`)이
   실존한다. 취소선(`~~잔여 ①~~`) 표기도 `13-replay-rerun.md`/`8-embedding-pipeline.md`/
   `17-agent-memory.md` 에 이미 있는 "해소된 항목 취소선 표기" 관행과 일치한다.
4. **API 문서 규약**: 위 INFO 항목(길이 가이드라인) 외 위반 없음. 신규 Controller/DTO 클래스나
   `@Api*` 데코레이터 추가는 없고, 기존 optional object 필드(`type: 'object',
   additionalProperties: true`)의 JSDoc 설명만 보강했다 — `swagger.md §1-4` 의 "닫힌 union을
   `additionalProperties` 로 뭉개지 말 것" 원칙과도 무관(이 필드들은 원래부터 열린 map).
5. **금지 항목**: 위반 없음. `node-output.md` 의 `{ ...rawConfig }` spread 금지·`output.view`
   판별자 부활 등 금지 패턴에 해당하는 코드 변경이 diff 안에 없다(핸들러 코드 자체는 이번
   diff 의 대상이 아니다). `secret-store.md`(마스터키 노출 금지 등)에 해당하는 변경도 없다.

## 요약

target(`spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·`12-webhook.md`)은
이미 머지된 마스킹 구현(#1174~#1179 계열 커밋)을 spec 에 사후 등재하는 정본화 작업으로, 인용
식별자·호출 횟수·화이트리스트 멤버십이 실제 코드와 grep 레벨로 정확히 일치하고 문서 구조
(Overview/본문/Rationale)·frontmatter·앵커 인용 스타일 모두 이 저장소의 기존 확립된 패턴을
따른다. 앞선 두 리뷰 라운드(`22_22_36`/`23_10_41`)가 지적한 WARNING·INFO 는 이번 커밋에서 모두
해소됐다. 유일하게 새로 눈에 띈 것은 신규 DTO JSDoc 이 `swagger.md §3` 의 길이 가이드라인을
넘는다는 INFO 이며, 이는 같은 파일의 기존 필드에도 이미 있던 패턴의 연장이라 규약 위반이라기보다
스타일 부채다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
