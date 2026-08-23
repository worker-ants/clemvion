# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

검토 모드: `--impl-prep` (구현 착수 전), scope=`spec/5-system/`

## 방법

번들(`_prompts/convention_compliance.md`)은 **컨텍스트 예산 초과로 이 target 이 직접 의존하는
conventions 12개**(`node-output.md`·`egress-masking.md`·`swagger.md`·`error-codes.md`·
`execution-context.md`·`interaction-type-registry.md`·`audit-actions.md` 등)의 본문을 전부
생략한 상태로 조립돼 있었다. 번들만으로는 판정이 불가능해, 워크트리의 실제 `spec/conventions/**`
파일과 대상 코드(`node-output-allowlist.ts`·`strip-external-only-fields.ts` 등)를 직접 열어
대조했다.

## 발견사항

- **[WARNING]** 리뷰 하네스가 정확히 이 target 이 필요로 하는 conventions 를 통째로 떨어뜨린다
  - target 위치: 해당 없음 (하네스 산출물 자체의 결함)
  - 위반 규약: 없음 — 이것은 target 문서의 위반이 아니라 `_prompts/convention_compliance.md`
    조립 로직의 예산 배분 문제
  - 상세: 번들의 "정식 규약 모음" 섹션(2312~2401줄 부근)에서 `node-output.md`·
    `egress-masking.md`·`swagger.md`·`error-codes.md`·`execution-context.md`·
    `interaction-type-registry.md`·`redis-keys.md`·`migrations.md`·`node-cancellation.md`·
    `chat-channel-adapter.md`·`conversation-thread.md`·`spec-impl-evidence.md` 가 전부
    "⚠️ 본문 생략됨 — 컨텍스트 예산 초과" 로 대체돼 있다. 하필 이 target 문서(EIA §R17)가
    본문에서 명시적으로 위임하는 바로 그 conventions 들이다(§R17 이 "구현 좌표계는 별도
    규약이 소유" 라고 egress-masking.md 를, node-output.md Principle 7 을 각각 지목). 번들만
    보고 판정하는 checker 는 이 위임 대상들을 검증할 수 없어 거짓 PASS 를 낼 위험이 있다 —
    이미 알려진 회귀 패턴(`feedback_consistency_spec_mode_budget.md`: "consistency `--spec`
    기본 예산이 conventions 를 통째로 떨군다")과 동일 형태다.
  - 제안: 본 checker 는 실제 리포지토리 파일을 직접 읽어 우회했으므로 이번 회차 결론에는
    영향이 제한적이나, 번들 조립 스크립트가 target 문서의 상호참조 conventions 를 우선
    적재하도록(예: target 이 링크하는 `spec/conventions/*` 를 다른 conventions 보다 먼저
    싣는 순서 정책) 개선을 고려할 것.

- **[INFO]** `node-output-allowlist.ts` 상단 JSDoc 그룹 표가 chat-channel 전용 4키 추가 후
  stale 상태로 관측됨(리뷰 도중 실시간 편집 확인)
  - target 위치: 코드 `codebase/backend/src/shared/utils/node-output-allowlist.ts`
    (target frontmatter `code:` 목록에 포함), 관련 spec 위치는 `14-external-interaction-api.md`
    §R17 "`nodeOutput` 일반 키 allowlist" 서술부(1762~1783줄)
  - 위반 규약: 엄밀한 위반은 아님 — `node-output.md` Principle 0/8 이나
    `spec/conventions/chat-channel-adapter.md` 자체를 어기지는 않는다. 다만 문서-코드
    상호 최신성이 일시적으로 어긋난 상태
  - 상세: 리뷰 시작 시점엔 `NODE_OUTPUT_ALLOWED_KEYS` 의 JSDoc "그룹" 표가 2그룹
    (`핸들러 계약 공개분` / `wire 전용(위젯)`)만 나열했으나, 이후 (동시 진행 중인
    `plan/in-progress/sse-nodeoutput-allowlist.md` 작업으로) `payload`·`title`·`rendered`·
    `nodeType` 4키가 "wire 전용 (chat-channel)" 그룹으로 배열에 추가됐다. 배열 아래
    인라인 주석은 새 그룹을 설명하지만, 배열 **위** JSDoc 요약 표는 여전히 2그룹만
    보여준다. 이 4키의 근거(`nodeOutput.payload`/`title`/`rendered`/`nodeType` flat
    legacy shape)는 `spec/5-system/15-chat-channel.md`
    "`renderPresentationByType` shape 처리 우선순위" 절(695~703줄)이 이미 문서화하고
    있으나, `node-output-allowlist.ts` 의 JSDoc 은 그 SoT 를 인용하지 않는다.
  - 제안: JSDoc 그룹 표에 3번째 행("chat-channel wire 전용 · SoT:
    `15-chat-channel.md` shape 처리 우선순위")을 추가하고, target 문서의 §R17 allowlist
    표(현재 "SSE/fanout emit — deny-list 유지 (잔여)")를 plan 이 이미 예정한
    "(planner 턴) §R17 표의 SSE 행 flip" 작업에서 함께 갱신할 것. 이미 plan 체크리스트에
    있으므로 새 작업 항목은 아니고, 정확성 확인 차 기록.

## 준수 확인 (위반 없음, 근거를 남김)

아래는 명시적으로 대조해 **위반이 발견되지 않은** 항목이다. 정식 규약 준수 검토이므로
근거를 남긴다.

- **에러 코드 명명 (`error-codes.md`)**: target §5.1/§6.4/§6.5/§R17 의 모든 `error.code`
  값(`VALIDATION_ERROR`·`INVALID_COMMAND`·`TOKEN_REFRESH_NOT_IN_WINDOW`·`STATE_MISMATCH`·
  `EXECUTION_TERMINATED`·`RATE_LIMITED`·`TOO_MANY_CONNECTIONS`·`EXECUTION_TIMEOUT`·
  `EXECUTION_TIME_LIMIT_EXCEEDED`·`RESUME_*`·`WEBCHAT_IDLE_TIMEOUT`·
  `MASKED_VALUE_RESUBMITTED` 등)이 `UPPER_SNAKE_CASE` 표기·의미 기반 명명 원칙을 따른다.
  `MASKED_VALUE_RESUBMITTED` 는 error-codes.md §4.2 가 "정의 SoT = EIA §R17" 로 정확히
  역참조해 양방향 SoT 포인터가 착지한다.
- **감사 액션 명명 (`audit-actions.md`)**: target EIA-NX-12/EIA-AU-07 이 언급하는
  `trigger.notification_secret_rotated`·`trigger.interaction_token_revoked` 는
  audit-actions.md §3 레지스트리(2026-08-11 등재, "과거분사" 분류)에 정확히 등재돼 있다.
  `<resource>.<verb>` + 언더스코어 토큰 구분자 규칙도 준수.
- **문서 구조 (Overview/본문/Rationale)**: target 은 `## Overview (제품 정의)` →
  숫자 섹션(1~12) → `## Rationale` 3단 구조를 그대로 따른다. `_product-overview.md`·`0-`
  prefix 컨벤션은 이 문서(영역 하위 기술 spec)에는 적용 대상이 아니다(루트 진입 문서가
  아님) — 오적용 없음.
- **API 문서 규약 (`swagger.md`)**: swagger.md 본문이 EIA `getStatus.context` 를
  discriminator 비-sound 사례·open-map 예외 사례로 **직접 인용**하며, target §R17/§5.3 의
  서술과 상호 정합한다(양쪽 문서가 서로를 가리키고 내용이 어긋나지 않음). §5 응답 봉투
  (`{ data: ... }`, `202 Accepted` ack body) 서술도 swagger.md §2-5/§5-2 헬퍼 규약과 합치.
- **Egress 마스킹 좌표계 (`egress-masking.md`)**: target §R17 은 "구현 좌표계는 별도
  규약이 소유" 라고 명시적으로 egress-masking.md 에 위임하고 재선언하지 않는다 — 책임
  분리가 규약과 일치. `strip-external-only-fields.ts`/`sanitize-error-message.ts` 실제
  코드의 상한·연산자·마커도 egress-masking.md 표(§1)와 정확히 일치(`MAX_REDACT_DEPTH=10,
  >=` / `MAX_SANITIZE_DEPTH=10, >`).
- **`node-output.md` Principle 0 (5필드 불변 + internal 예외)**: `node-output-allowlist.ts`
  의 `NODE_OUTPUT_ALLOWED_KEYS`(fail-closed) 와 `NodeHandlerOutput` 인터페이스
  (`node-handler.interface.ts`)가 `_resumeState`/`_retryState` 를 외부 표면에서 명시
  제외하는 것도 Principle 0 의 "internal top-level 필드 허용 예외" 정신과 합치한다.
  `_resumeCheckpoint` 는 `NodeHandlerOutput` 의 키가 아니라(별도 저장 계층) allowlist
  타입 결속에 안 걸리는 것도 self-consistent(코드 주석이 이 구분을 명시).

## 요약

번들 자체는 target 이 참조하는 conventions 본문 다수를 예산 초과로 생략해 그대로라면
판정 근거가 부실했겠지만, 실제 `spec/conventions/**` 파일을 직접 대조한 결과 target 문서
(`spec/5-system/14-external-interaction-api.md`)는 명명(에러 코드·감사 액션)·출력 포맷
(egress 마스킹 좌표계 위임)·문서 구조(Overview/본문/Rationale)·API 문서 규약(swagger.md
open-map/discriminator 지침) 전반에서 CRITICAL 급 정식 규약 위반이 발견되지 않았다. 유일한
실질적 관찰은 진행 중인 병렬 작업(`sse-nodeoutput-allowlist` plan)이 코드의
`NODE_OUTPUT_ALLOWED_KEYS` 를 확장하면서 그 JSDoc 요약 표가 일시적으로 stale 해진 것인데,
plan 자체가 이 spec 갱신(§R17 SSE 행 flip)을 이미 후속 작업으로 추적하고 있어 새로 등재할
결함이 아니라 진행 상황 기록에 가깝다. 가장 무게 있는 발견은 리뷰 하네스의 컨텍스트 예산
배분 문제(WARNING)이며, target 문서 자체의 결함이 아니다.

## 위험도

LOW
