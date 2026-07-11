# Rationale 연속성 검토 결과

검토 대상: `spec/7-channel-web-chat/` 전 영역 (0-architecture / 1-widget-app / 2-sdk / 3-auth-session /
4-security / 5-admin-console), 모드 `--impl-prep`.

## 방법

target 6개 문서의 `## Rationale` 절 전체(R1~R9, R-CC 계열 포함)를 완독하고, target 이 인용하는 외부 spec 의
실제 `## Rationale` 원문을 직접 대조했다 — `spec/5-system/14-external-interaction-api.md`(R4/R10/R16/R17/R18/
R19, EIA-IN-02/EIA-RL-07/EIA-NF-03), `spec/5-system/4-execution-engine.md`(§1.1 전이표·§7.4 무기한 보존
불변식), `spec/5-system/1-auth.md`(Rationale 2.3.B m-3), `spec/conventions/conversation-thread.md`(§2.1/§2.2),
`spec/conventions/interaction-type-registry.md`(§1, 4→3 통합), `spec/4-nodes/3-ai/1-ai-agent.md`(§6.2). 전달된
`_prompts/rationale_continuity.md` 는 "관련 Rationale 발췌" 절이 `4-integration.md` 도중에 잘려(orchestrator
번들링 size limit) EIA/webhook/execution-engine/conversation-thread 원문이 누락돼 있었으므로, 그 구간은 리포에서
직접 원본을 읽어 대조했다.

## 발견사항

### INFO — R9-A "옛 gen guard" 참조에 정의 출처 링크 부재

- target 위치: `spec/7-channel-web-chat/1-widget-app.md` §R9 "A. booting 중 host `resetSession` 중복 webhook"
- 과거 결정 출처: 동일 문서 내 자기 참조("옛 gen guard 의 client-상태-only 방어", "옛 §3.1 'Planned' 제약")
- 상세: single-flight coalesce 로 대체되는 "옛 gen guard" 메커니즘이 어느 커밋/PR/plan 에서 도입됐는지 명시 링크가
  없다. 대체 자체는 새 Rationale(두 기각 대안 (a) Idempotency-Key (b) await→cancel→restart 포함)로 충분히
  정당화돼 있어 연속성 위반은 아니지만, "옛 결정이 정확히 무엇이었는지"의 추적성이 산문 서술에만 의존한다.
- 제안: 별건 조치 불요(차단 대상 아님). 후속 편집 시 여유가 있으면 `plan/complete/` 의 원 PR/plan 링크를 부기하면
  향후 리뷰어의 대조 비용이 준다.

### INFO — 5-admin-console.md R2 "기존 결정"의 원출처 미인용

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` §R2 "외형 per-instance 서버 저장 — 기존 '미저장'
  결정의 부분 번복"
- 과거 결정 출처: 같은 문서 내 "초기 v1 은 외형을 boot 옵션으로 emit-only 하고 백엔드에 저장하지 않았다"(원 결정이
  어느 시점 spec/plan 에 있었는지 명시 없음)
- 상세: 번복 자체(부분 번복 + 새 Rationale 명시)는 절차적으로 정확히 수행됐다 — "복잡도 회피 근거는 보존, 저장
  대상 범위만 좁게 확장"이라는 논증이 명확하다. 다만 "기존 결정"의 1차 출처(과거 spec revision 또는 plan 문서)를
  가리키는 링크가 없어, 제3자가 원 결정의 전체 맥락을 다시 찾아야 한다.
- 제안: 이 역시 차단 사유는 아니다. 여유가 있으면 git blame 기반으로 원 결정 커밋을 부기하는 정도.

CRITICAL/WARNING 등급 발견사항 없음.

## 교차검증 상세 (문제 없음 확인)

아래 항목은 "기각된 대안 재도입" 또는 "합의 원칙 위반" 여부를 의심할 만한 후보였으나, 원문 대조 결과 모두 정합했다.

1. **`0-architecture.md` §R2 "EIA §R10 단일 sink 정책에 영향 없음"** — EIA §R10 원문(엔진은 여전히
   `WebsocketService.emit*` 단일 sink, NotificationDispatcher/SSE 어댑터/ChatChannelDispatcher 는 그 sink 의
   형제 facade consumer) 과 대조 시, 위젯이 "새 listener 를 추가하지 않는 순수 external HTTP consumer" 라는
   주장은 정확 — 위반 없음.
2. **`0-architecture.md` §R5 iframe `srcdoc`/`about:blank` 기각 + admin 콘솔 same-origin carve-out** — carve-out
   은 "격리를 위해 iframe 은 실제 `src` 여야 한다"는 원 제약(≠ srcdoc self-generation) 자체는 유지한 채 origin
   관계만 좁게 예외 처리한다. 기각된 대안(srcdoc 자가생성)을 재도입한 것이 아니라 별개 축(same-origin vs
   cross-origin)의 새 결정 — 정합.
3. **`1-widget-app.md` §R6 eager-start (vs 기각된 lazy+firstMessage)** — 기각 경위·재평가 근거를 모두 명시하고,
   `firstMessage` 필드가 이후 어떤 target 문서(2-sdk.md Boot Config 스키마 포함)에도 재등장하지 않음을 grep 으로
   확인 — 기각된 메커니즘의 잔존/재도입 없음. `AI Agent §6.2` 원문("즉시 `waiting_for_input` 진입 — 첫 턴 LLM
   호출은 사용자 메시지 수신 후로 미룬다")과도 정확히 일치.
4. **`1-widget-app.md` §R7 end_conversation/cancel 분기** — EIA §EIA-IN-02·§5.1 표면 매트릭스 원문("`ai_conversation`
   /`ai_form_render`=4종 모두, `buttons`=`click_button`, `form`=`submit_form`")과 대조해 target 의 분기 규칙이
   기존 계약을 그대로 매핑함을 확인 — 신규 규칙 창설 아님.
5. **`1-widget-app.md` §R8 presentation 복원 자기 정정** — "한때 기록됐던 제약은 사실이 아니었다"는 서술은 과거
   결정의 무근거 번복이 아니라, 검증 없이 기입됐던 오기재의 사실 정정(2026-07-10 실측)이며 새 Rationale 로 근거를
   교체했다. `conversation-thread.md §2.1` 원문("표시물은 thread 에 영속되지 않는다 … `source:'ai_assistant'` 한정")
   과 정확히 일치 — 범위 제약 서술도 정합.
6. **`1-widget-app.md` §R9 single-flight coalesce + best-effort cancel** — `execution-engine.md` §1.1/§7.4 원문의
   "무기한 보존 불변식"·"`waiting_for_input → cancelled` 타임아웃 사유 예약"과 대조해, EIA-RL-07(idle-wait
   backstop)이 그 예약 사유의 최초 구현이라는 target 서술이 EIA §R19 원문과 정확히 일치.
7. **`3-auth-session.md` §R3 per_execution 단일 지원** — EIA §R4 원문("default per_execution … per_trigger 는
   advanced 케이스 한정")과 자구까지 일치.
8. **`4-security.md` §R6 IP 미식별 단일 공유 버킷** — `1-auth.md` Rationale 2.3.B 원문이 `4-security.md §R6` 를
   SoT 로 명시 역인용하고, target 도 "1-auth Rationale 2.3.B m-3 과 동일 함정"이라 인용 — 양방향 상호 참조가
   실제로 일치.
9. **`0-architecture.md` §3 EIA 표면 매핑의 `ai_form_render→ai_conversation` 4→3 통합** —
   `interaction-type-registry.md §1` 원문과 정확히 일치.

## 요약

target 6개 문서는 결정 번복 시 예외 없이 새 `## Rationale` 항목(초기 결정→기각 사유→전환 결정)을 갖추고 있고,
기각 대안은 구체적으로 열거·반증되며, 외부 spec(EIA/execution-engine/auth/conversation-thread/interaction-type-registry
/AI Agent) 의 원문을 직접 대조한 9건 모두 인용이 정확했다. 자기 정정(§R8)조차 "왜 이전 서술이 틀렸는가"를
Rationale 로 남기는 절차를 지켜, 검토 대상 중 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.
다만 orchestrator 가 조립한 payload 파일 자체가 `spec/2-navigation/4-integration.md` Rationale 도중에
잘려(size limit) EIA/webhook/execution-engine/conversation-thread 원문 발췌가 누락돼 있었다는 점은 프로세스
차원에서 별도로 짚어둔다(본 리뷰는 리포지토리에서 직접 원문을 읽어 이 갭을 메웠다).

## 위험도

NONE
