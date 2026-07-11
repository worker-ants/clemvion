# Rationale 연속성 검토 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 모드: `--impl-prep` (착수 전 설계 검토, target spec 본문 diff 없음 — 설명된 구현 계획을 기존
`## Rationale` 대비 검증)

## 발견사항

- **[WARNING]** 신규 검증 로직에 대응하는 새 `## Rationale` 항목 작성 의무 누락 위험
  - target 위치: 착수 예정 구현 전체 (`execution-engine.service.ts` `resolveWaitingNodeExecutionId` 확장) — spec 반영 시 `spec/5-system/4-execution-engine.md §7.5.1` 및/또는 `spec/5-system/14-external-interaction-api.md ## Rationale`
  - 과거 결정 출처: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 이 프로젝트는 `14-external-interaction-api.md`(R1~R18)·`4-execution-engine.md`(§7.5.1/§7.5.2 포함 20+ 항목)·`4-nodes/6-presentation/0-common.md`(§10.9 Rationale) 전부에서 사소한 정정까지도 예외 없이 근거를 기록해 왔다(예: R13 "표면별 코드명 + cross-ref 동치 고정" 원칙, §7.5.1 "publisher 측 사전 검증" 자체가 별도 항으로 분리돼 있음)
  - 상세: 이번 가드는 `resolveWaitingNodeExecutionId`(§7.5.1 이 문서화한 정확히 그 chokepoint)의 책임을 "존재/유일성 검증"(0건/2건↑ 두 케이스)에서 "존재+표면 적합성 검증"(3번째 케이스 추가)으로 확장한다. 신규 에러 코드가 없어(`InvalidExecutionStateError` 재사용) R13 의 코드명 분리 원칙 자체는 위반하지 않지만, §7.5.1 의 표(2-case)와 코드 JSDoc("0건 / 2건 이상" 만 언급)은 세 번째 케이스를 반영하지 못한 채로 stale 해진다. 이 프로젝트의 기록된 습관상 이 확장은 반드시 (a) §10.9 button_click invariant 와의 관계(왜 AI 표면만 4종 허용), (b) fail-open 근거(왜 legacy row 는 거부하지 않는가, 아래 발견 참조), (c) 신규 코드 미도입(R13 표 무변경) 세 가지를 명시하는 새 Rationale 항목을 요구한다. 이 항목 없이 코드만 반영되면, 다음 rationale-continuity 검토가 "왜 form/buttons 는 엄격, ai_conversation 은 관대한가"를 스스로 재구성해야 하는 근거 공백이 생긴다
  - 제안: `4-execution-engine.md ## Rationale` 에 항목 신설(예: "publisher 사전 검증에 표면 매트릭스 추가") — §10.9/R13/`assertFormSubmissionValid` 세 가지를 명시적으로 cross-ref. §7.5.1 본문 표에도 3번째 행 추가

- **[WARNING]** `hooks.service.ts` 의 `ConflictException` graceful catch 가 silent 이면 §10.9 에서 명시적으로 기각된 "silent skip" 패턴 재도입
  - target 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `forwardToInteractionService` (현재 try/catch 없이 `interactionService.interact()` 호출 — 이번 작업으로 신규 도입되는 catch)
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.9 ## Rationale` "form submission wire format wrap" — "dispatch 4 케이스 명시 매칭 + 매칭 실패 케이스는 **warn log + loop 재진입 (silent skip 금지)**", "raw `formData` publish 를 유지한 채 dispatch elif 순서만 조정하는 안은 본질적으로 휴리스틱이라 다른 collision 에서 재발하므로 채택하지 않는다"
  - 상세: 이 가드가 배포되면 `forwardToInteractionService`(chat-channel 의 `button_callback`→`click_button`, `text_message`→`submit_message` 포워딩)가 새로 `STATE_MISMATCH`(409) 를 받을 수 있다 — 예: AI 대화가 아직 폼을 기다리는데 텔레그램 사용자가 버튼 콜백을 보내는 race. 이 실패를 "graceful catch"로 완전히 삼키면(로그 없이) §10.9 에서 이미 한 번 검토·기각된 "silent skip" 패턴을 다른 진입점(chat-channel)에서 재도입하는 셈이다. `hooks.service.ts` 자체의 기존 관례(다른 모든 catch 블록 — L178/402/426/451/462/479/508/555/696/773/847/929/958 — 가 예외 없이 `logger.warn` 동반)도 이 패턴을 뒷받침한다
  - 제안: catch 블록에 `logger.warn`(executionId, 시도한 command, 사유) 필수 포함 — 기존 파일 관례 + §10.9 "silent skip 금지" 원칙 준수를 명시적으로 구현/코드리뷰 체크리스트에 남길 것

- **[WARNING]** §7.5.1 표·EIA §5.1 `STATE_MISMATCH` 행 예시가 3번째 케이스(표면 불일치)를 반영하지 못해 문서가 코드보다 좁아짐
  - target 위치: `spec/5-system/4-execution-engine.md §7.5.1` 표(0건/2건↑ 2-case) + JSDoc 주석, `spec/5-system/14-external-interaction-api.md §5.1` `STATE_MISMATCH` 행("예: completed 상태에서 submit_message, 또는 다른 nodeId")
  - 과거 결정 출처: 두 문서 모두 해당 절 자체가 이미 "표면별 코드/케이스 완전 열거"를 원칙으로 삼아왔다(§7.5.1 자체가 §7.5 rehydration 과 직교 분류를 명시하고, EIA §5.1 은 각 코드마다 조건을 세세히 열거)
  - 상세: 이 자체는 결정의 번복이 아니라 열거 누락이지만, 이 프로젝트는 반복적으로 "표/매트릭스가 SoT" 원칙(`interaction-type-registry.md` 의 존재 이유 자체)을 적용해 왔다. 신규 케이스가 표에 반영되지 않으면 향후 코드 변경 검토자가 §7.5.1 표만 보고 "표면 검증은 없다"고 오판할 수 있다
  - 제안: §7.5.1 표에 3번째 행("표면(interactionType) 불일치") 추가, EIA §5.1 `STATE_MISMATCH` 예시에 "buttons 대기 노드에 submit_form 도착" 류 예시 추가

- **[INFO]** §10.9 `button_click` AI conversation 미도달 invariant는 보존되는 것으로 판단됨 — 명시적 cross-ref 권장
  - target 위치: 착수 예정 구현의 "ai_conversation / ai_form_render 대기 → 4종 모두 허용" 규칙
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.9` "`'button_click'` AI conversation 내 미도달 invariant" — "만약 향후 UI 변경으로 도달하게 되면 `else` 분기 (warn log + no-op park) 가 graceful degradation 으로 동작한다"
  - 상세: 현재 코드에는 `resolveWaitingNodeExecutionId` 단계의 표면 게이트가 전혀 없으므로, AI 대기 노드에 4종 명령 중 무엇이 도착하든 이미 통과해 왔다. 이번 가드가 AI 표면(`ai_conversation`/`ai_form_render`)에 대해서만 4종을 전부 허용하는 것은 이 기존 permissive 상태를 그대로 유지하는 선택이며, §10.9 가 이미 "혹시 도달하면" 대비용으로 마련해 둔 하류 graceful degradation(`processAiResumeTurn` 의 `else` 분기)이 여전히 최종 backstop 으로 작동한다. `form`/`buttons` 는 원래 단일 목적 표면이라 엄격 검증으로 좁히는 것과 비대칭이지만, 이는 AI 표면만 다중 명령을 정당하게 수신하는 §10.9/`interaction-type-registry.md §1` 의 기존 설계와 부합한다 — 반전이 아니라 보존
  - 제안: 위 첫 WARNING 의 신규 Rationale 항목에 "AI 표면 4종 허용은 §10.9 button_click invariant 를 보존하기 위함(하류 graceful degradation 이 backstop)"이라는 문장을 명시적으로 남길 것

- **[INFO]** fail-open(legacy row 판정 불가) 근거로 `assertFormSubmissionValid` 선례는 구조적으로 타당하나, RESUME_* fail-fast 와는 다른 실패 도메인임을 spec 에 명시할 것
  - target 위치: 착수 예정 구현의 "판정 불가(legacy row) → fail-open" 규칙
  - 과거 결정 출처: `execution-engine.service.ts` `assertFormSubmissionValid` JSDoc "검증 불가(노드/field 정의 부재) 시 통과(기존 whitelist-only 동작 유지) — 방어적" / `spec/5-system/4-execution-engine.md §7.5` "Rehydration 실패 케이스" 표(`RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` fail-fast)
  - 상세: `assertFormSubmissionValid` 의 fail-open 은 **같은 chokepoint 파일**(`execution-engine.service.ts`) 안에서 "신규 검증 대상 메타데이터가 없으면 그 검증을 적용하지 않고 기존(이 기능 도입 이전) 동작을 유지"하는 정확히 동형의 패턴이라 타당한 선례다. `resumeFromCheckpoint` 의 `meta.interactionType ?? top-level interactionType` fallback 도 같은 "legacy shape 관용" 취지를 보여준다(§7.5 rehydration 레이어, 발견 목적과 다른 위치). 반면 `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` 의 fail-fast 는 **claim 이후** 데이터 무결성이 깨진 상태로 처리를 계속하면 turn 상태를 잘못 재구성할 위험이 있는 rehydration 레이어의 결정이라, "새 검증을 추가할 수 없을 때 새 검증을 건너뛴다"는 publisher 레이어의 fail-open 과는 실패 도메인이 다르다 — 상충이 아니라 직교
  - 제안: 새 Rationale 항목에 "본 fail-open 은 `assertFormSubmissionValid` 선례와 동형이며, RESUME_* fail-fast(§7.5, claim 이후 데이터 무결성 도메인)와는 별개 레이어라 상충하지 않는다"를 명시해 향후 검토자의 혼동을 예방

- **[INFO]** R13(표면별 에러 코드명 분리 + cross-ref 동치 고정)·§7.5.1(publisher 사전 검증 원칙) 은 그대로 준수됨
  - target 위치: 착수 예정 구현의 "거부 = 기존 `InvalidExecutionStateError` throw … 신규 에러 코드 없음"
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md §Rationale R13`, `spec/5-system/4-execution-engine.md §7.5.1`
  - 상세: 신규 케이스가 기존 타입 에러(`InvalidExecutionStateError`)를 재사용하므로 WS ack `INVALID_EXECUTION_STATE` / EIA REST `409 STATE_MISMATCH` / REST continue `422 INVALID_STATE` 3-표면 매핑이 그대로 유지된다. 또한 `InvalidExecutionStateError` 는 고정 client-safe 메시지(`'Execution is not waiting for input.'`)만 노출하고 상세(대기 nodeId·노드 타입 등)는 `serverDetail`(서버 로그 전용)에만 남는 기존 계약(§7.5.2 client-safe/serverDetail 분리)을 그대로 물려받으므로, 검토 관점 1 의 "거부 message 내부 상세 노출" 우려는 이 에러 클래스를 그대로 재사용하는 한 발생하지 않는다. 검증 위치도 §7.5.1 이 이미 지정한 동일 chokepoint(`resolveWaitingNodeExecutionId`)이므로 "publisher 측에 검증을 모은다"는 원칙과도 정합
  - 제안: 없음 — 구현 시 반드시 **같은** `InvalidExecutionStateError` 클래스를 재사용(새 서브클래스나 별도 message 리터럴을 만들지 않도록)할 것만 주의

## 요약

이번 착수 예정 구현(EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드)은 검토 대상 네 가지 관점(§10.9 button_click invariant, R13 코드명 분리, §7.5.1 publisher 사전 검증 원칙, fail-open 선례) 모두에서 과거 Rationale 을 명시적으로 뒤집거나 기각된 대안을 재도입하지 않는다 — 기존 `InvalidExecutionStateError` 재사용으로 에러 코드 표면을 그대로 보존하고, AI 표면에는 4종을 모두 허용해 §10.9 의 기존 permissive invariant 를 유지하며, 검증 위치도 §7.5.1 이 지정한 동일 chokepoint 다. 다만 (1) 이 프로젝트가 예외 없이 지켜온 "결정마다 새 Rationale 기록" 관례가 이번 확장(§7.5.1 chokepoint 의 책임 확대)에도 적용돼야 하는데 아직 근거 문서화 계획이 명시되지 않았고, (2) `hooks.service.ts` 의 신규 `ConflictException` graceful catch 가 로그 없이 완전히 silent 하면 §10.9 에서 이미 한 번 검토·기각된 "silent skip" 패턴을 다른 진입점에서 재도입하는 위험이 있으며, (3) §7.5.1 표·EIA §5.1 STATE_MISMATCH 예시가 신규 3번째 케이스를 반영하도록 갱신돼야 문서가 stale 해지지 않는다. 세 WARNING 모두 구현 자체를 막을 사유는 아니고 spec 반영·구현 시 반드시 동반해야 할 문서화/로깅 의무로 처리하면 된다.

## 위험도

MEDIUM
