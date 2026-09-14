# Plan 정합성 검토 — `trigger-config-lost-update` (scope: `spec/5-system/`)

## 발견사항

- **[INFO]** 원 트래커 항목이 다른 in-progress plan 에 아직 열려 있다 — 종결 커밋에서 반드시 같이 닫을 것
  - target 위치: (target 은 `spec/5-system/` bundle 이나, 실제 근거는 target 밖) `plan/in-progress/spec-draft-nullable-notation-followups.md:2278-2293`
  - 관련 plan: `plan/in-progress/trigger-config-lost-update.md` (본 문서)
  - 상세: `trigger-config-lost-update.md` 가 닫으려는 항목은 `spec-draft-nullable-notation-followups.md` 의 **아직 `[ ]` 인 원본 트래커 항목**(2026-09-11 등재, `/ai-review` `concurrency` W1 + `database` INFO)이다. 그 항목은 락 배치를 "호출자가 트랜잭션/락을 열고 binder 를 그 안에서 부를지, binder 가 스스로 잠글지" 라는 **미결 설계 질문**으로 남겨 뒀는데(`review/consistency/2026/09/11/17_39_32` INFO#3), 본 plan 의 §B 가 "각 쓰기 지점이 자기 락을 잡는다"(binder 자가-잠금)로 이 질문에 답한다. 이는 **결정을 우회하는 것이 아니라 트래커가 위임한 그 결정을 정확히 내리는 것**이고(`owner: developer`, `spec_impact: none` — 순수 구현 세부라 planner 합의 불요), 본 plan 의 체크리스트에도 "트래커 항목 `[x]` + 실측 각주(창이 셋이었다는 정정 포함)" 이 이미 있어 종결 시 반영을 약속하고 있다. **다만 이 약속이 실제로 지켜지지 않으면** 같은 항목이 두 plan 파일에 **분기된 채(하나는 닫히고 하나는 열린 채)** 남는다 — 종결 커밋에서 두 파일을 함께 갱신했는지 확인 필요.
  - 제안: 본 plan 완료 시 `spec-draft-nullable-notation-followups.md:2278` 도 같은 커밋/세션에서 `[x]` + "창이 셋이었다" 각주로 갱신(이미 계획에 있음 — 누락 방지용 재확인 항목으로 등재 권장).

- **[INFO]** 구조적으로 유사한 "advisory lock + 외부 HTTP 호출" 트레이드오프가 이미 문서화된 선례가 있고, 본 plan 은 그것을 인용하지 않는다
  - target 위치: target(`spec/5-system/`) 밖 — `spec/2-navigation/4-integration.md:1443-1446` ("검토 후 배제한 대안: PostgreSQL advisory lock … lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고 …")
  - 관련 plan: `plan/in-progress/trigger-config-lost-update.md` §B
  - 상세: Cafe24 토큰 리프레시의 cross-pod race 를 다룬 이 Rationale 은 `pg_advisory_xact_lock` 을 **명시적으로 배제**했는데, 이유가 "락 보유 구간에 외부 HTTP 호출이 들어간다"는 것이었다. 본 plan 은 반대로 `execution-engine.service.ts:2977` 의 advisory lock 선례를 채택 근거로 인용하면서, **같은 저장소 안의 반대 선례(외부 호출을 이유로 advisory lock 을 기각한 사례)는 언급하지 않는다.** 결론적으로 본 plan 의 설계(§B: "외부 호출을 락 밖에 두고, 락 안에서 다시 읽는다")는 배제 사유(락 구간에 HTTP 호출 포함)를 정확히 피하고 있어 **실질적 충돌은 아니다** — 그러나 두 선례를 나란히 놓고 "왜 이번엔 advisory lock 이 맞는가"를 명시하지 않으면, 리뷰 단계에서 동일 논쟁이 재연될 여지가 있다.
  - 제안: 구현/PR 설명 또는 plan §B 에 "Cafe24 사례와 달리 여기선 외부 호출이 락 밖에 있다"는 한 줄 대조를 남겨 재논쟁을 예방. spec 변경은 불요(둘 다 최종 spec 문서 아님, 본 plan 은 code 레벨).

- 확인 결과 CRITICAL/WARNING 없음. 아래는 검토 과정에서 확인해 배제한 잠재 이슈:
  - **선행 조건 충족 확인**: plan 이 전제하는 "방금 닫은 fail-open"(`previousInboundSigningRef` 캡처)은 `bfa124920`(이미 main 이력에 포함)으로 실제로 닫혀 있고, "T2"(`setupChatChannel` 을 `ChatChannelBinderService` 로 이관)도 코드에 반영되어 있다(`codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 존재) — plan 이 가정하는 선행 상태와 실측이 일치한다.
  - **인접 미해결 항목과의 스코프 경계**: 같은 트래커의 열린 형제 항목("`setupChatChannel` 이 6~8가지 관심사를 한 함수에 담고 있다" 리팩터)은 본 plan 의 "하지 않는 것" 절이 명시적으로 배제하고 있어, 두 작업이 같은 파일을 다른 이유로 동시에 건드리는 혼선을 이미 피하고 있다.
  - **spec 컨벤션 충돌 없음**: `spec/5-system/2-api-convention.md`·`15-chat-channel.md` 어디에도 트리거 PATCH 의 동시성 제어(ETag/낙관적 버전 등)를 규정하는 조항이 없어, advisory lock 기반 처방이 기존 spec 문서와 충돌하지 않는다. `CCH-SE-01`(재시도/`degraded` 정책)도 락 배치와 무관한 축이라 저촉 없음.

## 요약

`trigger-config-lost-update.md` 는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 아직 열려 있는 원본 트래커 항목(락 배치 미결 설계 질문 포함)을 정확히 위임받아 구현 세부로 해소하는 파생 plan 이며, `spec_impact: none` 이 타당하다 — target(`spec/5-system/`) 의 어떤 조항과도 충돌하지 않고, 이 plan 이 전제하는 두 선행 상태(fail-open 수정, `setupChatChannel` 의 서비스 이관)도 코드에 이미 반영돼 있다. 유일한 위험은 절차적인 것으로, (1) 완료 시 원 트래커 체크박스를 실제로 같이 닫는지, (2) `4-integration.md` 에 기록된 "advisory lock + 외부 호출" 반대 선례와의 관계를 설계 근거에 명시적으로 대조해 두는지 — 둘 다 계획을 뒤집는 결정 충돌이 아니라 문서 위생·재논쟁 예방 차원의 권고다.

## 위험도

LOW
