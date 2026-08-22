# Cross-Spec 일관성 검토 — `spec/4-nodes/7-trigger/`

## 검토 방식 메모

전달된 payload 는 컨텍스트 예산 초과로 `spec/5-system/2-api-convention.md`,
`3-error-handling.md`, `12-webhook.md`, `13-replay-rerun.md`,
`14-external-interaction-api.md`, `15-chat-channel.md`, `conventions/**` 등
관련 영역 대부분이 **본문 없이 절단**되어 있었다 (payload 자체가 "의도된 절단"이라 명시).
이 절단으로 인한 거짓 음성을 피하기 위해, payload 대신 워크트리의 실제
`spec/**` 파일을 직접 `grep`/`Read` 하여 target(`1-manual-trigger.md`,
`0-common.md`, `providers/_overview.md`, `providers/{discord,slack,telegram}.md`)의
핵심 주장(에러 코드, requirement ID, 데이터 모델 필드, secret ref 슬롯, R-번호
참조)을 실제 cross-spec 파일과 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 대조한 항목은 모두 정합했다:

- **에러 코드 계약**: `INVALID_TRIGGER_PARAMETERS`(Manual 주 실행·저장·re-run 3경로 공용) ·
  `INVALID_WEBHOOK_PAYLOAD` · `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/
  `INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED` 필드 코드가 `1-manual-trigger.md`,
  `spec/5-system/3-error-handling.md` §1.7, `spec/5-system/12-webhook.md` §5.2,
  `spec/5-system/13-replay-rerun.md` §8.1 네 문서에서 동일하게 기술됨(발행 날짜
  `2026-08-22` 표기도 오늘 날짜·PR #1193 시점과 정합).
- **`[EIA §R17]` 참조**: `manual-trigger.md` §6·Rationale 이 `masked_value_resubmitted`
  범위(webhook·schedule 비대상, 판정 기준 = 페이로드 저작 주체)의 SoT 로 인용하는
  `EIA §R17` 은 실제로 `spec/5-system/14-external-interaction-api.md` 1395~1724행
  구간(`### R17. getStatus 의 currentNode/context...`) 안의 "표면 제약(보안)" 하위
  `Execution.inputData` 카브아웃 종결 서술과 정확히 일치한다 — 얼핏 R17 표제(“getStatus
  노출”)와 인용 목적(“마커 재제출 거부 범위”)이 달라 보여 오참조를 의심했으나, 실제
  내용은 같은 R17 절 안에 중첩된 하위 항목이라 참조가 유효함을 확인했다.
- **데이터 모델**: `Trigger.config.chatChannel.{botIdentity, inboundSigningRef, botTokenRef}`
  구조가 `spec/1-data-model.md` §2.8, `spec/conventions/chat-channel-adapter.md` §2.3,
  `spec/conventions/secret-store.md` §1/§5.5 세 곳에서 필드명·타입(`botId: number`,
  `teamId?: string`, `publicKey?: string`)까지 동일. `secret://triggers/{id}/{bot-token,
  inbound-signing}` ref 슬롯도 discord.md/slack.md 본문과 secret-store.md 카탈로그가 일치.
- **요구사항 ID**: `CCH-MP-01~04`, `CCH-SE-02`, `CCH-CV-05`, `CCH-ERR-03` 이 모두
  `spec/5-system/15-chat-channel.md` 한 곳에서만 정의되고 provider 문서(discord/slack/
  telegram)는 인용만 한다 — 중복 정의·의미 충돌 없음. Rationale 번호(`R-D-1~9`,
  `R-S-1~9`, telegram `R1~R5`)도 provider 간 겹치지 않음(prefix 로 이미 분리).
- **API 계약**: `POST /workflows/:id/execute` 의 RBAC(`@Roles('editor')`,
  `spec/data-flow/12-workspace.md`)·바디 shape(`data-flow/10-triggers.md`)·WS 비채택
  결정(`spec/5-system/6-websocket-protocol.md` §4.2 won't-do)이 trigger 문서의 서술과
  충돌 없음.
- **Webhook trigger 의 `config.chatChannel` 분기**(비활성 시 202 vs 410, isActive 검사
  선행 순서)가 `spec/5-system/12-webhook.md` WH-EP-07/§7 과 provider 문서의 서술이 일치.

## 스코프 경계에 대한 메모 (미보고 사유)

`1-manual-trigger.md` frontmatter `code:` 목록이 본문에서 명시 인용하는
`workflows.controller.ts`(Manual 주 실행 처리 위치) · `executions.service.ts`
(re-run 처리 위치) · `execution-engine/types/trigger-parameter.types.ts`
(`toTriggerParameterErrorDetails` 소재, 이번 cosmetic PR 이 직접 건드리는 파일)를
포함하지 않는다. 이는 실제로 관측했지만 **cross-spec 6개 관점(데이터 모델/API 계약/
요구사항ID/상태전이/RBAC/계층 책임) 어디에도 속하지 않는** frontmatter-vs-code
완결성 이슈라 본 리포트에는 발견사항으로 올리지 않는다 (spec-coverage 류 감사의 영역).

## 요약

Target 영역(`spec/4-nodes/7-trigger/` 전체 — manual-trigger, 0-common, provider
catalog·discord·slack·telegram)은 이번 세션에서 spec 자체의 변경이 없는(순수 코드
cosmetic PR, `spec_impact: none`) 상태로, 기존에 이미 폭넓게 cross-link 된 성숙한
spec 뭉치다. 에러 코드 체계·데이터 모델·requirement ID·secret 슬롯·API 계약을
관련 영역(`1-data-model.md`, `5-system/{2,3,12,13,14,15}`, `conventions/{chat-channel-
adapter,secret-store}`, `data-flow/{10,12}`)과 직접 대조한 결과 모순을 찾지 못했다.
payload 자체는 예산 절단으로 다수 관련 spec 이 비어 있었으나, 실제 저장소 파일을
직접 대조해 그 갭을 메웠다.

## 위험도

NONE
