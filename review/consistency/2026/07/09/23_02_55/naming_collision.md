# 신규 식별자 충돌 검토

## 검토 범위 확인

`plan/in-progress/trigger-param-output-enricher.md` 를 함께 확인한 결과, 본 작업은
**프론트엔드 전용 autocomplete enricher 추가**이며 `spec/4-nodes/7-trigger/` 문서
본문은 변경하지 않는다 (plan §비고: "spec 변경 불필요"). `git diff main...HEAD` 에도
`spec/**` 변경분이 없다 (untracked 는 plan 파일과 review 산출물뿐). 즉 이번 --impl-prep
검토에서 실제로 "새로 도입"되는 식별자는 spec 레벨이 아니라 코드 레벨
(`enrichManualTriggerOutputSchema` 함수, `MANUAL_TRIGGER_TYPE_MAP` 상수, 2개
`nodeType === "manual_trigger"` 분기)뿐이다. 아래는 이 신규 식별자들과 spec 코퍼스
(`spec/0-overview.md`, `spec/1-data-model.md`, `plan/in-progress/*`,
`spec/conventions/*`) 및 target spec (`spec/4-nodes/7-trigger/**`) 전체를 대조한
결과다.

## 발견사항

없음 (충돌 미발견).

검토 근거:

- `enrichManualTriggerOutputSchema` / `MANUAL_TRIGGER_TYPE_MAP` 은
  `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts`
  내 기존 4개 enricher(`enrichInfoExtractorOutputSchema` / `INFO_EXTRACTOR_TYPE_MAP`,
  `enrichFormOutputSchema` / `FORM_FIELD_TYPE_MAP`, `enrichTableOutputSchema`,
  `enrichTransformOutputSchema`)와 동일한 `enrich<NodeType>OutputSchema` /
  `<NODE>_TYPE_MAP` 명명 패턴을 그대로 따르며, 기존 4개와 이름이 겹치지 않는다.
  frontend 전체(`codebase/frontend/src`)에 grep 한 결과 정의 위치(1곳)와 호출부
  (`use-expression-context.ts` 2곳: `$input` fallback, `$node` output 목록) 외
  다른 재사용/재정의는 없다.
- target spec (`spec/4-nodes/7-trigger/0-common.md`, `1-manual-trigger.md`)이 이미
  정의한 `TriggerParameterDefinition`, `__triggerSource`, `meta.source`,
  `output.request`, `resolveTriggerParameters`, `INVALID_TRIGGER_PARAMETERS` /
  `INVALID_WEBHOOK_PAYLOAD` / `INVALID_INPUT`, `manual_trigger`(node type
  식별자) 는 모두 이미 `status: implemented` 로 구현·정착된 기존 식별자이며, 이번
  작업이 새로 부여하는 것이 아니다. 코퍼스( `spec/1-data-model.md` L1741
  `manual_trigger`, `spec/1-data-model.md` L2105 `POST /workflows/:id/execute`
  등) 와 대조해도 의미 차이 없이 일관되게 재참조되고 있어 충돌 없음.
- webhook chat-channel provider 식별자(`telegram`/`slack`/`discord`)와
  `plan/in-progress/chat-channel-discord-gateway.md`,
  `plan/in-progress/chat-channel-slack-socket-mode.md` 의 상호 참조도 이번 target
  범위에 포함돼 있었으나, 모두 동일 provider 를 동일 의미로 cross-link 하고 있어
  이번 작업과는 무관하며 충돌도 없다 (참고용 확인, 이번 변경과 직접 관련 없음).
- 테스트 파일(`node-output-schema-enrichers.test.ts`)의 신규 `describe` 블록명도
  기존 4개(`enrichInfoExtractorOutputSchema` 등)와 함수명 그대로 대응되어 충돌
  없음 — 단, 본 검토 시점 기준 실제 파일에는 `enrichManualTriggerOutputSchema`
  describe 블록이 아직 보이지 않았다(plan 체크박스는 `[x]`). 이는 명명 충돌이
  아니라 완성도/구현-plan 정합 이슈이므로 본 checker (신규 식별자 충돌) 관점 밖이라
  별도 보고하지 않고 참고로만 남긴다 — 필요 시 다른 관점(구현완료성)의 검토로 확인
  권장.

## 요약

이번 작업(Manual Trigger `output.parameters` autocomplete enricher 추가)은 spec
본문 변경이 없는 프론트엔드 전용 변경이며, 실제로 신규 도입되는 식별자
(`enrichManualTriggerOutputSchema`, `MANUAL_TRIGGER_TYPE_MAP`)는 기존 동일 파일 내
4개 enricher 와 동일 명명 패턴을 따르고 다른 곳에서 재사용되지 않아 충돌이 없다.
target spec 이 이미 보유한 요구사항 ID·타입명·엔드포인트·이벤트명·설정키·파일
경로 역시 모두 기존 구현 상태를 그대로 재참조하는 것이며 검색 코퍼스와 대조해도
의미 충돌이 없다. 신규 식별자 충돌 관점에서는 리스크가 없다.

## 위험도

NONE
