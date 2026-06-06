# Requirement Review — exec-park-b2a-followup

## 발견사항

### [INFO] `waitForUserTurn` 이 ai_user 턴 기준으로 completion 을 판단함
- 위치: `execution-park-resume.e2e-spec.ts` L544–L562, L672, L717
- 상세: `waitForUserTurn` 은 `conversation_thread` 의 `ai_user` source 턴이 나타날 때까지 polling 한다. `ai_agent` handler 는 `emitUserMessageLiveSignal` (조기 노출) 후 LLM 호출·`ai_assistant` 응답 append·re-park 를 순서대로 수행하고 `conversation_thread` 는 durable commit 시점에 DB 에 반영된다. 즉 `ai_user` 턴이 DB 에 나타나는 것은 LLM 호출과 re-park 보다 앞선 시점일 수 있다(엔진이 user 메시지를 thread 에 append 한 뒤 LLM 호출 → assistant append → park → durable commit 순). 테스트 주석(L613–L622)에서도 이를 인식해 "status 만으로는 turn 처리 완료를 판별할 수 없다"고 기술하며 `waitForUserTurn` 뒤에 `afterTurn1 = await poll(...)` 로 re-park 상태까지 별도 확인(L675–L695)하고 있다. 따라서 기능 완전성 측면에서 실제 turn 완료 보장에는 문제가 없다.
- 제안: 현상태 유지. 다만 `waitForUserTurn` 의 주석을 "user 메시지가 thread 에 push 된 시점"이 아니라 "해당 turn 의 cold rehydration 1회 사이클이 진행 중임을 확인"으로 보정하면 향후 독자 혼동이 줄어든다.

---

### [INFO] `mintInteractionToken` 이 `JWT_SECRET` fallback 으로 mint 함
- 위치: `execution-park-resume.e2e-spec.ts` L416–L451
- 상세: `InteractionTokenService` 가 사용하는 실제 secret 우선순위는 `INTERACTION_JWT_SECRET` → `jwt.secret` → `JWT_SECRET` → `'interaction-fallback'` 이다(코드 L89–99). e2e test 는 `process.env.JWT_SECRET` (docker-compose `JWT_SECRET = clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`) 으로 fallback 해 mint 한다. docker-compose.e2e.yml 에 `INTERACTION_JWT_SECRET` 이 별도 설정되지 않았으므로, 서버도 동일 `JWT_SECRET` fallback 경로를 사용해 토큰이 일치한다. 기능상 문제 없음.
- 제안: docker-compose.e2e.yml 에 `INTERACTION_JWT_SECRET` 을 명시해 service 와 test 간 secret 경로를 더 명시적으로 고정하면 향후 JWT_SECRET 교체 시 오작동 가능성을 제거할 수 있다. 필수는 아님.

---

### [INFO] [SPEC-DRIFT] `spec/5-system/7-llm-client.md §7.1` 의 stub 용도 표현 — 섹션 제목이 §8 이전에 삽입됨
- 위치: `spec/5-system/7-llm-client.md` diff (+lines 116–121)
- 상세: 새 `### 7.1` 섹션이 `## 7 API 키 보안` 아래에 추가됐다. 본문 내용("stub 이 항상 우선", "fail-closed", "캐시 우선순위")은 코드 구현(`llm.service.ts` L72–86, `main.ts` L51–59)과 정확히 일치한다. spec 이 코드 현실을 따라잡는 정상적인 SPEC-DRIFT 반영이다.
- 제안: 코드 유지 + spec 반영 완료. 추가 조치 불필요.

---

### [INFO] [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md §8.3` 토큰 family 분리 명시
- 위치: `spec/5-system/14-external-interaction-api.md` diff §8.3 / §10.1
- 상세: 기존 "secret 은 trigger 별 분리" 단일 설명에서 `itk_*`(per_trigger, trigger 별 분리) vs `iext_*`(per_execution, 글로벌 `INTERACTION_JWT_SECRET`) 로 명확화됐다. 코드(`interaction-token.service.ts`)의 실제 구현 — 단일 글로벌 secret fallback chain, execution-scoped jti blacklist — 과 line-level 로 일치한다. 의도적 SPEC-DRIFT 반영.
- 제안: 코드 유지 + spec 반영 완료. 추가 조치 불필요.

---

### [INFO] [SPEC-DRIFT] `spec/data-flow/3-execution.md` park/rehydration 시퀀스에 `resume_call_stack` 추가
- 위치: `spec/data-flow/3-execution.md` diff L48–51, L107–110
- 상세: park 시 `conversation_thread / user_variables / resume_call_stack` durable commit 및 rehydration 시 `resume_call_stack` 이 frame-by-frame driveCallStackResume 에 쓰인다는 내용이 추가됐다. 이는 PR-B2b 구현(V087) 의 실제 동작을 반영하는 SPEC-DRIFT 갱신이다.
- 제안: 코드 유지 + spec 반영 완료. 추가 조치 불필요.

---

### [WARNING] `docker-compose.e2e.yml` ENCRYPTION_KEY 변경이 기존 encrypted rows 에 미치는 영향 문서화 필요
- 위치: `docker-compose.e2e.yml` L887
- 상세: ENCRYPTION_KEY 를 32-char(16B) → 64-hex(32B) 로 교정했다. 본 파일 주석(L885–889) 과 plan 항목 ④ 에 "e2e DB 는 ephemeral 라 키 변경 안전"이라고 기술돼 있고, 실제로도 매 e2e 실행마다 DB 가 초기화(`postgres` 서비스 ephemeral volume)되므로 기술적으로 안전하다. 또한 기존 e2e suite 의 다른 테스트들이 llm_config 행을 DB 에 직접 insert 하거나 `crypto.util` 암호화 경로를 우회했었으므로 ENCRYPTION_KEY 교정이 해당 테스트들의 단언에 영향을 줄 위험도 없다. 다만 향후 유지보수자가 INTEGRATION_ENCRYPTION_KEY 도 같은 이유로 교체 필요한지 혼동하지 않도록, 주석이 이미 충분히 구분하고 있음(L888–890)을 확인.
- 제안: 현상태 유지. INTEGRATION_ENCRYPTION_KEY 가 credentials-transformer SHA-256 derive 방식이라 길이 무관함이 이미 주석에 명시돼 있어 충분.

---

### [WARNING] `spec/5-system/7-llm-client.md §7.1` 에 `StubLlmClient` 의 echo 동작(응답 포맷 `[stub] received: <msg>`) 미언급
- 위치: `spec/5-system/7-llm-client.md §7.1`
- 상세: `StubLlmClient.chat()` 은 마지막 user 메시지를 `[stub] received: <msg>` 형태로 echo 반환하고 tool call 을 만들지 않는다(`stub.client.ts` L35–37). e2e 테스트는 이 응답 포맷에 직접 의존해 `expect(asstTexts1).toContain('[stub] received: turn-one-question')` 으로 단언한다(L712). spec §7.1 은 "결정적 stub 클라이언트 반환"만 기술하고 stub 의 실제 응답 동작(echo 포맷, tool call 생략, max_turns 동작)은 언급하지 않는다. 이는 spec fidelity 공백이지 구현 오류는 아니다.
- 제안: `spec/5-system/7-llm-client.md §7.1` 에 stub 의 응답 동작 요약 추가: "마지막 user 메시지를 `[stub] received: <msg>` 로 echo 하고 tool call 을 생성하지 않아, AI Agent multi_turn 핸들러가 응답 emit 후 다음 turn park(waiting_for_input) 경로를 그대로 취한다." — project-planner 위임.

---

### [INFO] `llmCreateRes.body.data` 응답 구조 가정 — TransformInterceptor 봉투 의존
- 위치: `execution-park-resume.e2e-spec.ts` L586
- 상세: `(llmCreateRes.body.data as { id: string }).id` 로 id 를 읽는다. 이는 전역 `TransformInterceptor` 가 `{ data: {...} }` 로 래핑하는 API 규약을 올바르게 따른다(API 규약 §5). `llm-config.controller.ts` L91–107 의 create 엔드포인트가 entity 를 반환하고 `maskApiKey` 가 id 를 보존하므로 동작 일치.
- 제안: 현상태 유지.

---

### [INFO] `plan/in-progress/exec-park-b2a-followup.md` 항목 ①②③ (spec write) 이 본 PR 에 포함됨
- 위치: `plan/in-progress/exec-park-b2a-followup.md` §항목
- 상세: plan 의 항목 ①(LLM_STUB_MODE spec 문서화), ②(EIA §8.3 토큰 명확화), ③(durable 컬럼 doc-sync) 은 "project-planner 도메인"으로 표시됐지만, 대응하는 spec 변경이 이번 PR 에서 실제로 완료됐다(`spec/5-system/7-llm-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/3-execution.md`). 항목 ④(e2e 인프라)도 완료됐다. plan 파일 자체는 미완료 상태(`in-progress`)로 남아 있어 plan 라이프사이클 이동이 아직 안 됐다. 기능 완전성 관점에서 구현은 완료됐으나 plan 마감 절차가 남아 있음.
- 제안: 모든 항목 구현 완료 시 plan 을 `plan/complete/` 로 이동 필요(plan-lifecycle.md §3 절차에 따라). 본 리뷰 범위 밖.

---

## 요약

이번 변경은 PR-B2a follow-up 4개 항목 — (①) `spec/5-system/7-llm-client.md` 에 `LLM_STUB_MODE` 섹션 추가, (②) `spec/5-system/14-external-interaction-api.md §8.3` 의 토큰 family 명확화, (③) `spec/data-flow/3-execution.md` 의 `resume_call_stack` doc-sync, (④) `docker-compose.e2e.yml` ENCRYPTION_KEY 64-hex 교정 + e2e 의 `POST /api/llm-configs` 정식 경로 사용 — 을 완전히 구현하고 있다. 각 spec 변경은 해당 코드 구현과 line-level 로 일치하며 의도적 SPEC-DRIFT 반영임이 명확하다. e2e 테스트는 `waitForUserTurn` → re-park poll 두 단계로 turn 완료를 안정적으로 검증하고, `mintInteractionToken` 의 secret fallback 경로도 서버와 일치한다. ENCRYPTION_KEY 교정은 ephemeral e2e DB 환경에서 안전하다. 중간 정도 수준의 spec fidelity 공백으로 stub 응답 포맷(`[stub] received: <msg>`)이 spec §7.1 에 미기재된 점이 있으나 구현 오류가 아니라 spec 보완 대상이다. 전반적으로 요구사항을 충족하며 기능 완전성 관점의 결함은 없다.

## 위험도

LOW
