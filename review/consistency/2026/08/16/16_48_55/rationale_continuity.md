# Rationale 연속성 검토 — `eia-internal-rest-error-masking.md`

## 검토 방법

target(`plan/in-progress/eia-internal-rest-error-masking.md`)이 인용하는 spec 근거를
프롬프트 번들이 아니라 **저장소 원문**(`spec/5-system/14-external-interaction-api.md`
§R17·§6.4, `spec/2-navigation/14-execution-history.md` R-5, `spec/conventions/secret-store.md`
§1·Rationale, `spec/1-data-model.md` §2.14, `spec/5-system/6-websocket-protocol.md` Rationale
"llmCalls 외부 수신자 strip", `plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에서
직접 읽어 대조했다 — 번들이 `14-external-interaction-api.md`·`secret-store.md` 를 컨텍스트
예산 초과로 절단했기 때문이다.

## 발견사항

- **[INFO]** `secret-store.md` 서두 원칙 문장과 신설 예외의 표면적 불일치
  - target 위치: target 문서 `## D — interaction.triggerToken` 및 `### ② secret-store.md §1` 초안
  - 과거 결정 출처: `spec/conventions/secret-store.md:12` (Rationale 아님, 본문 서두) —
    *"모든 도메인 모듈 (chat-channel / external-interaction / 향후 cafe24·OAuth 등) 은 본
    convention 의 `SecretResolver` 를 경유해 secret 을 읽고 쓴다."*
  - 상세: target 이 신설하려는 `Trigger.config.interaction.triggerToken` 비대상 예외는
    바로 이 문장이 이름으로 지목한 `external-interaction` 도메인 안에서 발생하는 두 번째
    "비대상" 카브아웃이다. 신설 후 이 서두 문장은 "예외 없이 모든 도메인이 경유" 라는
    문자 그대로의 의미로는 더 이상 참이 아니게 된다. 다만 이 충돌은 target 이 처음
    만든 게 아니라 — 정본 트래커(`spec-sync-external-interaction-api-gaps.md:194`)가
    이미 *"secret-store.md Overview 의 '모든 도메인 모듈은 SecretResolver 경유' 와
    충돌"* 로 명시 등재했고, 사용자가 2026-08-16 에 (b) 명시적 예외 등재를 택일했다.
    또한 기존 `AuthConfig.config` 예외도 같은 서두 문장을 개정하지 않은 채 §1 하단에
    "비대상" 블록으로만 존재해 왔으므로, target 은 **기존 저장소 관행을 그대로 따르는
    것**이지 새로운 위반 패턴을 도입하는 것은 아니다.
  - 제안: 필수는 아니나, planner 턴 ⓒ 작업 시 서두 문장에 "(§1 하단 비대상 예외 제외)" 정도의
    짧은 caveat 을 추가하면 두 예외가 누적된 뒤에도 서두 문장이 계속 정확한 상태를 유지한다.

## 상세 검증 — 위반 없음을 확인한 항목 (참고용)

- **R17 "내부 REST 와의 비대칭은 미결이다" → 결정 flip**: 원문 확인 결과 이 항목은
  *"아직 정하지 않았다"* 는 명시적 미결 상태였고, 특정 방향으로 이미 내려진 결정을
  뒤집는 것이 아니다. target 은 대체 불릿에 근거(§R-5 인용 범위 정정, `execution.ai_message`
  선례, `@Roles` 게이트 부재 실측)를 온전히 새로 작성해 "결정의 무근거 번복" 기준을
  충족한다.
- **`toTerminalErrorPayload` 비재사용**: §6.4 원문이 이 함수를 "wire 형태 정규화"로 명시
  규정하고 있어, target 이 내부 REST 에 별도 함수(`redactStoredErrorForResponse`)를 쓰는
  것은 §6.4/§R17 의 기존 구분을 그대로 따르는 것이지 이를 우회하는 것이 아니다.
- **egress-only 원칙(DB 원문 보존)**: target 은 `Execution.error` DB 컬럼을 그대로 두고
  응답 시점에만 마스킹한다 — R17 "conversationThread" 불릿이 명시한 store-time redaction
  기각 사유(LLM 컨텍스트 손상 가능성)와 동일한 방향이며, 이를 재도입하려는 시도가 없다.
- **`AuthConfig.config` 예외를 근거로 재사용하지 않음**: target 의 §D 초안은 *"위
  AuthConfig.config 예외와 같은 종류가 아니다"* 라고 명시적으로 선을 긋고 독립 근거
  (a)(b)(c)를 세운다 — `secret-store.md` R1 이 채택한 "app-side AES-256-GCM" 원칙을
  침해하지 않으며, `AuthConfig.config` 문구를 부정확하게 확장 적용하는 실패 모드를
  스스로 경계한다(이 경계 문구 자체가 이번 편집분).
- **§2.14 `Execution.error` = `NodeExecution.error` 복사 관계**: `spec/1-data-model.md:556-562`
  원문과 target 의 인용이 정확히 일치. 이전 라운드에서 "다른 컬럼이라 범위 밖"으로
  판단했던 것을 "같은 값" 이라는 이유로 번복한 것도 실측(§2.14)에 근거한 정당한 정정.
  실제 이력도 `spec-sync-external-interaction-api-gaps.md:205-211` 에서 확인됨(허구 아님).
  `interaction.triggerToken` 의 32-byte random hex, timing-safe 비교, revoke=rotation
  주장도 `spec/data-flow/15-external-interaction.md:69·90·293` 원문과 일치.
- **"단일 chokepoint" 설계 원칙과의 정합**: `spec/5-system/6-websocket-protocol.md` Rationale
  "`llmCalls` 외부 수신자 strip" 항목이 확립한 "출구가 여럿이면 각자 조립하지 말고 공용
  유틸로 묶는다" 패턴을, target 의 "공통 관문(`toResponseExecution`)" 설계가 그대로
  따르고 있다 — 반례가 아니라 선례 재사용.

## 요약

target 이 인용하는 모든 spec 근거(§R17, §6.4, R-5, §2.14, `secret-store.md` §1/Rationale)를
저장소 원문과 직접 대조했으며, 기각된 대안을 이유 없이 재도입하거나 합의된 원칙을
위반하는 지점은 발견되지 않았다. "내부 REST 마스킹 미결" 항목의 flip 은 실제로 미결
상태였던 것을 근거와 함께 확정하는 것이고, `toTerminalErrorPayload` 비재사용·egress-only
DB 보존·단일 관문 설계는 모두 기존 Rationale 이 이미 세운 구분·패턴을 그대로 따른다.
유일한 관찰 사항은 `secret-store.md` 서두의 "모든 도메인 모듈은 SecretResolver 를
경유" 문장이 신설 예외로 문자 그대로는 더 이상 참이 아니게 된다는 점인데, 이는 기존
`AuthConfig.config` 예외에서도 동일하게 존재해 온 저장소 관행이고 정본 트래커에 이미
충돌로 등재되어 사용자가 명시 택일한 사안이라 INFO 수준으로만 남긴다.

## 위험도
LOW
