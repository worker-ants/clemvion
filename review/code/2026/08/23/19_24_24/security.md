# Security Review — `nodeOutput` fail-closed allowlist (재커밋 / RESOLUTION 반영본)

## 검토 범위

이번 changeset 은 이전 리뷰 라운드(`19_00_23`)의 CRITICAL 0 · WARNING 4 를 전부 반영(RESOLUTION.md)한
최종 상태다. 실질 코드는 3곳:

- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `getStatus` waiting
  출구에 `allowlistNodeOutputKeys` 배선 + JSDoc 정정
- `codebase/backend/src/shared/utils/node-output-allowlist.ts` (신규) — fail-closed allowlist 필터.
  이전 라운드의 architecture WARNING(계층 역전) 반영으로 `strip-external-only-fields.ts` 에서 분리됨
- `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts` (신규) — 유틸 캐너리

나머지(CHANGELOG.md, plan/*, review/*, spec/5-system/14-external-interaction-api.md)는 이 코드 변경의
문서화·추적 산출물이다. `strip-external-only-fields.ts`/`.spec.ts` 는 `git diff origin/main --
codebase/backend/src/shared/utils/strip-external-only-fields.ts` 로 직접 확인한 결과 **순변경 0** —
이전 라운드에서 그 파일에 추가됐던 allowlist 코드가 분리 커밋으로 완전히 빠져나가 중복 정의가
남아있지 않음을 실측 확인했다(`grep -rn "NODE_OUTPUT_ALLOWED_KEYS\|allowlistNodeOutputKeys" codebase/backend/src` → `node-output-allowlist.ts`/`.spec.ts`/`interaction.service.ts` 세 파일에만 존재).

## 발견사항

- **[WARNING]** SSE/WebSocket fanout 경로는 여전히 fail-open deny-list — 동일 클래스의 엔진 내부 필드가 그 채널로는 계속 샌다 (이번 diff 가 새로 만든 결함은 아니나, 현재 실서비스 상태의 실질 노출이므로 재확인해 기록)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:392` (이번 PR 이 닫은 REST 출구, 대조군), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:72`(신규 등재 불릿 시작)~`:87`(호출부 실측 기록)
  - 상세: `allowlistNodeOutputKeys` 는 `InteractionService.getStatus` 한 곳에만 배선됐다. 같은
    `NodeHandlerOutput` shape 의 `nodeOutput` 이 WebSocket `EXECUTION_WAITING_FOR_INPUT` 이벤트로도
    나가는데, 직접 grep 으로 재확인한 결과 `FormInteractionService`(`codebase/backend/src/modules/execution-engine/form-interaction.service.ts:82-133`)와
    `ButtonInteractionService`(`codebase/backend/src/modules/execution-engine/button-interaction.service.ts:369-421`)는
    `context.structuredOutputCache?.[node.id] ?? context.nodeOutputCache[node.id]` 를 필터 없이
    이벤트 payload 의 `nodeOutput`/`nodeOutputForEvent` 필드에 그대로 싣는다. 이 payload 는
    `WebsocketService.toFanoutEnvelope()` → `stripExternalOnlyFields`(여전히 `EXTERNAL_STRIPPED_FIELDS = ['llmCalls']` 한 칸)만 거친다 — `allowlistNodeOutputKeys` 는 이 경로에 배선돼 있지 않다.
    즉 REST 로는 막힌 `_retryState`(및 향후 미지 핸들러 키)가 WS 채널 구독자에게는 그대로 나간다.
    이 구독은 REST 와 동일 인가(`verifyOwnership(executionId, workspaceId)`, role 무관)를 쓰는 동일
    수신 인구이고, chat-channel 어댑터가 같은 subject 를 구독해 외부 채널로도 전파될 수 있어
    blast radius 는 REST 단독 열람보다 넓다.
  - 이 갭은 이번 diff 가 새로 만든 회귀가 아니라 착수 전부터 있던 것이고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 정확한 호출부(`waitForFormSubmission`/`waitForButtonInteraction`)까지 등재돼 후속 착수자가 다시 찾지 않아도 되게 문서화됐다. `_retryState` 자체도 CHANGELOG(`CHANGELOG.md:14-16`)가 명시하듯 자격증명이 아니라 재시도 continuation 상태(시도 횟수·TTL·메시지 일부)라 심각도는 credential 유출보다 낮다. 다만 이 필드가 WS 경로로는 여전히 실제로 노출된다는 사실 자체는 이 diff 만으로는 해소되지 않으므로 보안 리뷰 관점에서 재확인해 기록한다.
  - 제안: 이미 tracker 에 등재돼 이번 PR 의 blocking 사유는 아니다. 후속 PR 에서 (a) `toFanoutEnvelope()` 의 `nodeOutput`/`buttonConfig.nodeOutput` 서브트리에 `allowlistNodeOutputKeys` 를 대칭 적용하거나, (b) `waitForFormSubmission`/`waitForButtonInteraction`(및 `processButtonResumeTurn`) 이 WS emit 직전 같은 헬퍼를 호출하도록 배선할 것.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 가 보안 경계(allowlist) 값인데 `Object.freeze()` 없이 모듈 레벨 배열로 export 됨
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:54` (`export const NODE_OUTPUT_ALLOWED_KEYS = [`)
  - 상세: `as const` 는 컴파일타임 리터럴 타입만 부여하고 런타임 불변성을 주지 않는다. 이 배열은
    `allowlistNodeOutputKeys`(같은 파일 95-111행)가 매 호출마다 참조하는 fail-closed 필터 기준이므로,
    같은 프로세스 내 어떤 코드가 실수로(또는 향후 리팩터링 과정에서) `.push()`/`.splice()` 로
    변형하면 이후 모든 호출의 필터링 결과가 전역적으로 넓어질 수 있다. 실제 소비처가
    `interaction.service.ts` 한 곳뿐이라 즉시 위험은 낮고(`grep` 재확인 결과 정의·타입가드·함수
    내부 및 자기 테스트 파일 외 참조 없음), 자매 상수(`EXTERNAL_STRIPPED_FIELDS`)도 동일 패턴이라
    이 PR 이 새로 만든 위험은 아니다.
  - 제안: 필수는 아니나 `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)` 로 런타임에도 불변을 강제하면
    이 배열이 "보안 경계" 라는 JSDoc 의 주장과 런타임 보장이 일치한다.

- **[INFO]** (확인됨, 조치 불요) `allowlistNodeOutputKeys` 는 prototype pollution 벡터가 아니며 회귀 테스트로 고정돼 있다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:95-111` (구현), `codebase/backend/src/shared/utils/node-output-allowlist.spec.ts:101-112` (`__proto__` 캐너리)
  - 상세: `{ ...obj }` 스프레드로 만든 얕은 복제본에 대해 `delete out[k]` 만 수행하고 bracket
    대입으로 새 값을 쓰지 않으므로, own-property `"__proto__"` 케이스에서도 `[[Delete]]` 는 own
    속성만 건드려 상속 setter 를 타지 않는다(CWE-1321 벡터 없음). `JSON.parse('{"output":{},"__proto__":{"polluted":true}}')` 입력으로 실제 프로토타입 오염 없음을 테스트가 고정했다.
  - 제안: 없음.

## 요약

이번 changeset 은 `InteractionService.getStatus` 의 waiting `nodeOutput` REST 출구에서 fail-open
deny-list(`llmCalls` 한 칸)를 fail-closed allowlist(`NodeHandlerOutput` 공개 키 + 위젯 wire 전용
키, 컴파일타임 결속)로 교체해 실제로 새고 있던 엔진 내부 필드 `_retryState` 의 REST 노출을 차단하는
정당한 보안 하드닝이다. 새 코드(`allowlistNodeOutputKeys`)는 순수·비변형이며 prototype pollution
벡터가 없고, 계층 분리(architecture WARNING 반영)로 `strip-external-only-fields.ts` 에 중복/잔존
코드도 남기지 않았다(직접 diff·grep 로 확인). CHANGELOG 도 과거 노출 가능성을 과장 없이 정확히
기록했다. 다만 같은 클래스의 필드가 여전히 WebSocket `EXECUTION_WAITING_FOR_INPUT` fanout 경로
(`FormInteractionService`/`ButtonInteractionService` → `toFanoutEnvelope`)로는 필터 없이 나가는
상태가 이 diff 이후에도 그대로 남는다 — 이미 투명하게 문서화·추적됐고 이번 PR 의 의도된 축소
범위이지만, REST 와 동일 인가·동일 수신 인구를 갖는 병렬 표면이 아직 코드로는 닫히지 않았다는
사실 자체는 보안 리뷰 결과에 반영해 둔다. 인젝션·하드코딩 시크릿·인증 우회·안전하지 않은 암호화·
에러 메시지 정보노출 등 다른 OWASP 축의 신규 문제는 발견되지 않았다.

## 위험도

MEDIUM
