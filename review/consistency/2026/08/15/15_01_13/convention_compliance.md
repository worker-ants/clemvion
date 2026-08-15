# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위 요약

- 이번 PR 의 실제 diff 는 `spec/5-system/14-external-interaction-api.md`(+12/-4) 와
  `spec/conventions/node-cancellation.md`(+9/-1) 두 파일뿐이다 (`git diff --stat
  origin/main...HEAD -- spec/5-system/ spec/conventions/` 로 직접 확인).
- target 문서(`14-external-interaction-api.md`) 전문을 읽고, 그 문서가 인용하는
  `spec/conventions/*.md` 를 **번들이 예산 초과로 생략한 파일까지 포함해 워크트리에서
  직접 절대경로로 재조회**해 대조했다 (swagger.md, error-codes.md, redis-keys.md,
  migrations.md, audit-actions.md, secret-store.md, interaction-type-registry.md,
  conversation-thread.md 발췌, spec-impl-evidence.md). 코드 측도 `main.ts`
  Bearer scheme 등록, `interaction.controller.ts`/`interaction-stream.controller.ts`
  데코레이터, `dto/responses/*.ts` 파일명, migrations V060/V066, `audit-action.const.ts`,
  `terminal-duration.ts` 등 실존 여부를 grep/ls 로 확인했다.

## 발견사항

### [WARNING] 번들 예산이 이번 리뷰에 가장 필요한 conventions 를 통째로 떨어뜨림

- target 위치: 프롬프트 페이로드 자체 (`_prompts/convention_compliance.md` §"정식 규약 모음")
- 위반 규약: 직접적인 `spec/conventions/**` 위반은 아니나, 검토 절차 자체의 신뢰도 문제
- 상세: 번들에서 `spec/conventions/node-cancellation.md`·`audit-actions.md`·
  `cafe24-api-catalog/**`(300개 이상) 를 실은 뒤 예산이 소진되어, 정작 target 본문이
  섹션 앵커까지 명시해 인용하는 `swagger.md`(§1-4/§2-1/§5)·`error-codes.md`·
  `redis-keys.md`·`node-output.md`·`execution-context.md`·`interaction-type-registry.md`·
  `conversation-thread.md`·`chat-channel-adapter.md`·`secret-store.md`·
  `spec-impl-evidence.md` 가 **전부** "컨텍스트 예산 초과로 생략" 처리됐다. 정작
  이번 target 과 무관한 cafe24/makeshop API 카탈로그 하위 파일들이 앞자리를 차지해
  예산을 소모한 탓이다. 이 패턴은 기존에도 지적된 적 있는 번들링 우선순위 문제([`feedback_consistency_spec_mode_budget.md`]와 동형 — `--spec` 모드뿐 아니라 `--impl-done` 모드에서도 재현)다.
  본 checker 는 워크트리 절대경로로 위 10개 문서를 전부 직접 재조회해 우회 검증했고
  (아래 항목들 참고), 그 결과 CRITICAL 위반은 발견하지 못했다. 하지만 이 우회를 하지
  않았다면 target 이 스스로 인용하는 규약 원문을 하나도 대조하지 못한 채 판정을 냈을
  것이다 — 자동화된 재실행에서는 동일하게 false negative(정합성 미검증)가 재발할 수 있다.
- 제안: orchestrator 번들러가 target 문서 본문이 명시적으로 링크하는 `spec/conventions/*.md`
  를 저관련 대량 하위 트리(`*-api-catalog/**`)보다 **먼저** 적재하도록 우선순위를 조정.
  (target 산출물 수정 대상 아님 — harness 개선 항목.)

### [INFO] node-cancellation.md §2.4 표/Rationale 서술이 실제 `finalizeCancelledExecution` 분기보다 좁다 — scope 경계 밖 참고

- target 위치: 본 리뷰의 직접 대상은 아님. 참고로, 이번 PR 이 함께 수정한
  `spec/conventions/node-cancellation.md` §2.4 표의 신규 행("top-level 취소 종결 경로
  terminal 가드")과 그 아래 Rationale 문단
- 위반 규약: 이 checker 의 관할(명명/출력포맷/문서구조/API문서/금지항목)에 정확히
  들어맞진 않아 CRITICAL/WARNING 으로 매기지 않음 — spec-impl 정합성 검토(코드 리뷰 ·
  plan_coherence) 영역에 더 가깝다고 판단해 참고용 INFO 로만 남긴다
- 상세: 문서는 "조건부 UPDATE 가 0행이면 CANCELLED 재마킹·`EXECUTION_CANCELLED` emit 을
  **모두 skip**. 자매 `finalizeFailedExecution` 과 **동형**" 이라고 적는다. 그러나 실제
  `execution-engine.service.ts` 의 `finalizeCancelledExecution` (라인 ~4884-4935) 은 0행일 때
  DB 를 재조회해 (a) `live.status !== CANCELLED`(다른 종결자에게 선점) 면 skip 하지만,
  (b) `live.status === CANCELLED`(정상적인 `stop()` 이 먼저 커밋한 경우) 면 skip 하지 않고
  로컬 값을 DB 값으로 맞춘 뒤 그대로 `emitCancellationEvent` 를 호출한다 — 코드 주석 자체가
  "skip 하면 사용자가 명시적으로 누른 취소가 외부 수신자에게 영영 안 간다" 고 이 분기를
  설명한다. 즉 "모두 skip"·"자매와 동형" 이라는 문구는 (a) 경우에만 참이고, (b) 경우에는
  오히려 `finalizeFailedExecution`(무조건 skip)과 **비대칭**이다.
- 제안: 이 리뷰의 스코프 밖이라 target 수정을 지시하지 않되, `spec/conventions/**` 문서
  자체의 정확성 이슈이므로 다음 code_consistency/plan_coherence 라운드에서 해당 표
  서술을 "0행이면서 DB 가 이미 CANCELLED 가 아닐 때만 skip; DB 가 CANCELLED 면 값만
  동기화 후 계속 emit" 으로 정정할 가치가 있다는 점을 기록해 둔다.

## 확인된 준수 사례 (근거 포함, 참고용 — 결함 아님)

다음은 CRITICAL/WARNING 대상이 아니라 위 번들 갭을 우회 검증한 결과를 남기는
positive evidence 다.

- **명명 규약**: 마이그레이션 `V060__execution_token_jti_tracking.sql`,
  `V066__trigger_config_strip_inline_auth.sql` 실존 확인 — `migrations.md` §1·§2 (단조
  증가, snake_case) 위반 없음. 감사 액션 `trigger.notification_secret_rotated` ·
  `trigger.interaction_token_revoked` 가 `audit-action.const.ts` 에 실제 등록되어 있고
  `audit-actions.md` §3 레지스트리("구현 (2026-08-11)")와 정확히 일치.
- **출력 포맷 규약**: `redis-keys.md` §3 인벤토리의 `eia:rl:interact:<executionId>` ·
  `eia:rl:status:<executionId>` · `eia:notif:rl:<triggerId>` · `iext:blacklist:<jti>` ·
  `interaction:idempotency:<executionId>:<route>:<key>` 가 target §8.4/§3.4/§5.1 서술과
  1:1 대응. `error-codes.md` §1/§4 의 `EXECUTION_TIMEOUT`(엔진 레벨) 이중 레이어 각주가
  target §6.4 를 명시적으로 cross-ref. `api-convention.md` §5.4(부재 표현: null vs 키
  생략)의 실사례 표가 target §5.3 `currentNode`/`error`(null)와 `context.conversationThread`
  (키 생략)를 정확히 지목.
- **문서 구조 규약**: target 은 `## Overview (제품 정의)` → 본문(§1~§12) →
  `## Rationale` 3섹션 구성을 그대로 따름 (CLAUDE.md/SKILL.md 의 3섹션 권장과 일치).
  `spec/5-system/14-*.md` 파일명은 기존 `13-replay-rerun.md` 다음 자리로 번호 충돌 없음
  (`ls spec/5-system/` 로 확인).
- **API 문서 규약(swagger.md)**: `main.ts` 에 `interaction-token` Bearer scheme 이 실제
  등록되어 있고(§10.1 서술과 일치), `interaction.controller.ts` /
  `interaction-stream.controller.ts` 양쪽이 `@ApiBearerAuth('interaction-token')` 사용.
  응답 DTO 가 `dto/responses/*-response.dto.ts` 명명(§5-1)을 따름
  (`execution-status-response.dto.ts`, `interact-ack-response.dto.ts`,
  `refresh-token-response.dto.ts`). `execution-status-response.dto.ts` 가 실제로
  `discriminator` 를 선언하지 않고 `oneOf` 만 쓰며, 이를 고정하는 회귀 테스트
  (`execution-status-response.dto.spec.ts` "context 는 discriminator 를 선언하지
  않는다")까지 존재 — swagger.md §1-4 및 그 Rationale("discriminator 는 판별자가
  sound 할 때만")과 정확히 합치. `interaction-type-registry.md` §1.1 의 "내부 4값 ↔
  EIA 외부 3값(form/buttons/ai_conversation)" 매핑도 target 서술과 일치(이 규약 문서가
  target 을 SoT 로 직접 지목).
- **금지 항목**: target §6.2 는 스스로 "절대 URL·`/v1/` 버전 세그먼트는 API 규약 §1
  위반" 이라고 명시하며 실제로 상대경로만 사용. `PUT` 사용 없음(`api-convention.md`
  §3 "PUT 사용 안 함" 과 합치). swagger.md §6 이 금지하는 "빈 껍데기 스키마"·
  `{data:{items,totalItems,page,limit}}` 패턴은 target 에 등장하지 않음.

## 요약

이번 PR 의 실제 diff(2 파일, 소규모)와 그 diff 가 속한 target 문서
(`spec/5-system/14-external-interaction-api.md`) 전체를 대상으로 명명·출력포맷·문서구조·
API 문서·금지항목 5개 관점을 점검한 결과 **CRITICAL 위반은 없다.** target 이 인용하는
`spec/conventions/*.md` 섹션 앵커(swagger §1-4/§2-1/§5, error-codes §1/§4, redis-keys
§3, migrations §1-2, audit-actions §3, secret-store §2, interaction-type-registry §1.1,
api-convention §5.4)를 워크트리에서 직접 재조회하고 관련 코드(컨트롤러 데코레이터,
DTO 파일명, 마이그레이션 파일, 감사 액션 상수)까지 실존을 확인한 결과 전부 서술과
합치했다. 유일한 절차적 문제는 orchestrator 번들이 예산 초과로 이 검토에 가장
필요한 conventions 문서 10개를 전부 생략하고 무관한 cafe24/makeshop 카탈로그가
자리를 차지했다는 점이며(WARNING), 이는 target 자체의 결함이 아니라 harness
번들링 우선순위 문제로 별도 개선이 필요하다. 부수적으로 같은 PR 이 건드린
`node-cancellation.md` 의 서술 하나가 실제 구현보다 좁게(deferred emit skip 을
단순화해) 적혀 있는 점을 scope 경계 밖 참고(INFO)로 남긴다.

## 위험도

LOW
