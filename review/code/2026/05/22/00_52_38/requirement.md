# 요구사항(Requirement) 리뷰 보고서

**리뷰 대상**: Chat Channel (Telegram) spec 및 관련 plan·review 산출물 35개 파일
**리뷰 일시**: 2026-05-22
**리뷰어**: requirement-reviewer

---

## 발견사항

### Plan 파일 (파일 1·2)

#### [INFO] `node-config-required-defaults-sweep.md` — 기능 완전성
- **위치**: `plan/in-progress/node-config-required-defaults-sweep.md`
- **상세**: Plan 자체의 의도(zod schema `.optional()` 유지 + `ui.required` / `requiredWhen` 메타 추가)는 명확하고, 적용 대상 표(Commit 1~3), 진행 체크리스트, 후속 follow-up 목록이 충실하게 기재되어 있다. 본 리뷰 대상 PR 과 직접 관련 없는 sweep plan 이므로 spec fidelity 점검 범위 밖이나, `switch.switchValue` 의 `requiredWhen` DSL 변경 이력(종전 `notEquals` → 화이트리스트 `equals`)이 별 plan으로 분리된 점은 적절히 추적되고 있다.
- **제안**: 특별한 조치 없음. 체크리스트 미완 항목(PR 본문 작성, ai-review/consistency-check, git mv)은 정상 미완 상태.

#### [INFO] `presentation-button-render-investigation.md` — 소유권 이전 처리
- **위치**: `plan/in-progress/presentation-button-render-investigation.md`
- **상세**: frontmatter `worktree` 가 `button-cap-spec-validator` 로 정확히 갱신되어 있고, root cause 확정(후보 2 — Carousel itemButtons cap 4)과 fix PR 분리가 명시되어 있다. 본 plan의 완료 조건 중 `[ ] fix 작업이 별도 worktree·PR 로 분리되어 머지됨` 항목이 미완이지만, 조사 investigation plan 이므로 fix PR 머지가 완료 조건임은 적절하다.
- **제안**: 특별한 조치 없음.

---

### Consistency Review 산출물 (파일 3~25)

#### [INFO] Round 1/2 consistency check — 프로세스 준수
- **위치**: `review/consistency/2026/05/21/17_55_28/` 및 `review/consistency/2026/05/21/18_10_33/`
- **상세**: Round 1 에서 BLOCK(Critical 2건)이 식별되었고, Round 2 에서 두 C 항목 모두 WARNING 으로 하향되어 BLOCK: NO 판정이 올바르게 처리되었다. sub-agent 호출 규약(STATUS 라인, _retry_state.json) 이 정상 기록되어 있다.
- **제안**: 특별한 조치 없음.

#### [INFO] Round 3 consistency check (--impl-prep) — spec 신규 파일 대상
- **위치**: `review/consistency/2026/05/21/23_49_16/`
- **상세**: 세 spec 파일(`15-chat-channel.md`, `chat-channel-adapter.md`, `telegram.md`) 대상 impl-prep 검토가 수행되었고, SUMMARY 없음 — 해당 세션 디렉토리에 SUMMARY.md 가 생성되지 않은 것으로 보인다 (파일 목록에 포함되지 않음). 개별 checker 파일만 존재. 이는 summary sub-agent 가 호출되지 않은 것이거나 별 파일에 존재할 수 있으나, 본 리뷰 페이로드에 해당 SUMMARY.md 가 포함되지 않아 Round 3 의 BLOCK 판정 여부를 직접 확인할 수 없다.
- **제안**: Round 3 의 SUMMARY.md 존재 여부와 BLOCK 판정을 확인할 것. 개별 checker 결과로 판단 시 위험도는 MEDIUM(cross_spec) / LOW(convention_compliance / rationale_continuity / naming_collision) / MEDIUM(plan_coherence)이며 CRITICAL 발견은 없다.

---

### Spec 파일들 — spec fidelity 상세 점검

#### [WARNING] `spec/5-system/15-chat-channel.md` §4.1 `botTokenRef` — 구현과 spec 기술 불일치
- **위치**: `spec/5-system/15-chat-channel.md` 라인 153 및 176
- **관련 spec**: `spec/5-system/15-chat-channel.md §3.4 CCH-SE-03`
- **상세**: CCH-SE-03 은 "config JSONB 평문 금지" 를 필수 요구사항으로 명시한다. 그러나 §4.1 의 `botTokenRef` 필드 주석에 `v1 stub: notification.signing.secret 와 동일 plaintext 보관` 이라고 명시되어 있어, spec 의 요구사항 ID(CCH-SE-03: 필수)와 동일 문서 §4.1의 구현 가이드가 충돌한다. v1 에서 plaintext 를 허용한다면 CCH-SE-03 의 우선순위를 "필수" 가 아닌 "권장(v2)" 으로 등록하거나, §4.1 주석을 "v1 임시 stub — CCH-SE-03 위반이며 별 plan `spec-update-chat-channel-bot-token-stub.md` 에서 추적" 으로 명확히 해야 한다. 현재 상태는 같은 문서 안에서 요구사항과 구현 가이드가 상충한다.
- **제안**: CCH-SE-03 우선순위를 "필수 (v2; v1 은 §4.1 plaintext stub — `spec-update-chat-channel-bot-token-stub.md` 참조)" 로 조정하거나, §4.1 botTokenRef 주석에 "현재 v1 구현은 CCH-SE-03 의 stub — 별 plan 에서 추적" 을 더 명시적으로 기재.

#### [CRITICAL] `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` — `execution.cancelled` 와 `execution.ai_message` 가 동일 섹션 번호(`EIA §6.5`) 를 공유하며 하나가 오기일 가능성
- **위치**: `spec/conventions/chat-channel-adapter.md` 라인 72 (`/* EIA §6.5 */`)
- **관련 spec**: `spec/5-system/14-external-interaction-api.md §6.5`
- **상세**: `EiaEvent` union 에서 `execution.ai_message` 는 `/* EIA §6.5 + WS §4.4 ai_message */`, `execution.cancelled` 는 `/* EIA §6.5 */` 로 태깅되어 있다. EIA §6.5 가 실제로 두 이벤트를 하나의 섹션에 묶는다면 주석 자체는 틀리지 않지만, `execution.cancelled` 가 §6.5 가 아닌 다른 섹션(예: §6.6)에 별도로 정의된다면 주석이 오기다. 이 오기가 구현자로 하여금 잘못된 섹션을 참조하게 만들어 payload shape 불일치를 유발할 수 있다. consistency-check Round 3 의 cross_spec 및 naming_collision 모두 이를 INFO 로 식별했으나, EIA spec 의 실제 섹션 번호를 확인해 정정하지 않은 상태다.
- **제안**: `spec/5-system/14-external-interaction-api.md §6` 를 직접 확인해 `execution.cancelled` 의 정확한 섹션 번호를 확인하고 주석을 정정. 만약 §6.5 가 두 이벤트를 묶는다면 `/* EIA §6.5 (cancelled 부분) */` 로 구분. project-planner 위임 대상.

#### [WARNING] `spec/4-nodes/7-trigger/providers/telegram.md` §5.3 — `phone` 필드 타입이 Form 노드 spec 과 명시적 불일치
- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md` 라인 118
- **관련 spec**: `spec/4-nodes/6-presentation/4-form.md §1 FormField type Enum`
- **상세**: `telegram.md §5.3` 표의 `(특수) phone` 행이 `"Form spec type: text + custom validation rule = phone pattern"` 으로 괄호 주석을 달았다. 이는 consistency-check Round 3 의 WARNING(W-4) 흡수 후 반영된 수정이지만, 실제 Form spec(`4-form.md`) 의 `type` Enum 에 `phone` 이 없다는 사실과, `ValidationRule` 에 `phone` pattern 을 어떻게 표현하는지에 대한 명시가 spec 어디에도 없다. 구현자가 "Form 필드 type: text + custom validation rule" 로 `phone` 을 처리한다고 이해하더라도, 해당 custom validation rule 의 shape(`pattern: /^\+?[\d\s\-()]+$/` 등)이 스펙화되지 않았다.
- **제안**: Form spec `4-form.md §1` 에 전화번호 패턴 validation 의 예시 또는 `telegram.md §5.3` 에 구체 `ValidationRule.pattern` 예시를 추가. 또는 `telegram.md` 주석을 "phone validation rule 의 구체 pattern 은 별 follow-up — v1 은 `request_contact` 버튼만 제공" 으로 한정.

#### [WARNING] `spec/5-system/15-chat-channel.md` §3.2 CCH-CV-03 — `running` 상태 입력 처리 미명시 (엣지 케이스)
- **위치**: `spec/5-system/15-chat-channel.md` 라인 42, CCH-CV-03
- **관련 spec**: `spec/1-data-model.md §2.13 Execution.status Enum`
- **상세**: CCH-CV-03 는 두 케이스만 정의한다 — `waiting_for_input` 이면 인터랙션 forwarding, 종료된 execution 이면 새 execution 시작. `running` 상태(워크플로우 실행 중, `waiting_for_input` 미도달)에서 두 번째 메시지가 도착하는 케이스가 미정의이다. "무시", "대기 큐 적재", "새 execution 시작" 중 어느 동작을 해야 하는지 구현자가 임의 결정해야 한다. 이는 데이터 유효성 관점에서 에러 시나리오 누락에 해당한다.
- **제안**: CCH-CV-03 에 `running` 상태 처리를 명시 ("running 이면 무시 + optional `"처리 중입니다"` 안내" 가 가장 단순한 선택). project-planner 위임 대상.

#### [WARNING] `spec/conventions/chat-channel-adapter.md` §4 Form 다단계 시퀀스 step 3 — `parseUpdate` 책임 경계 모호
- **위치**: `spec/conventions/chat-channel-adapter.md §4` (Form 다단계 시퀀스 규약)
- **관련 spec**: `spec/conventions/chat-channel-adapter.md §1.1` (`parseUpdate` 부작용=none, pure)
- **상세**: Convention §1.1 표는 `parseUpdate` 를 "DB 미접근, 외부 API 미호출, 부작용 없음, pure" 로 정의한다. 그러나 `telegram.md §4` 의 명령 매핑 표에서 group chat update 도착 시 `null` 반환 + `languageHints.groupChatRefusal` 안내 발송이라고 기술하였으나, v2 에서 telegram.md 가 "호출자(HooksService) 가 별도 sendMessage 호출" 로 수정되어 parseUpdate 는 pure 계약을 유지한다(라인 75). 그러나 §4의 step 3 (필드 단위 클라이언트-side 검증)에서 "실패 → 같은 필드 재질문" 이라고 기술하는데, 재질문 발송이 adapter 가 직접 sendMessage 를 호출하는 것인지, 아니면 Form 다단계 시퀀스 상태를 업데이트하고 호출자에게 재질문 ChannelMessage 를 반환하는 것인지 불명확하다. 이를 `parseUpdate` 안에서 수행한다면 pure 계약 위반이다.
- **제안**: §4 step 3의 "같은 필드 재질문" 표현을 "같은 필드의 `form_prompt` ChannelMessage 를 반환 — `sendMessage` 는 호출자(ChatChannelDispatcher)가 담당" 으로 명확화.

#### [WARNING] `spec/5-system/14-external-interaction-api.md` EIA-AU-08 — `InteractionRequestContext.scope` 신규 필드의 기존 코드 인터페이스와 불일치
- **위치**: `spec/5-system/14-external-interaction-api.md` 라인 2244, `spec/5-system/15-chat-channel.md` §5.1 라인 223
- **관련 코드**: `codebase/backend/src/modules/external-interaction/interaction.guard.ts` 라인 27~34 (`InteractionRequestContext`: `{ executionId, tokenFamily, triggerId? }` 3필드, `scope` 없음)
- **상세**: EIA-AU-08 spec 은 `InteractionRequestContext.scope: 'in_process_trusted'` 플래그를 명시하고, 15-chat-channel §5.1 은 이 플래그가 set 된 경우 token 검증을 skip 한다고 기술한다. 그러나 현재 codebase 의 `InteractionRequestContext` 인터페이스에는 `scope` 필드가 존재하지 않는다. spec 이 코드보다 앞서 정의되는 SDD 원칙상 당연하지만, spec 에 `scope` 필드를 추가하는 방식(별도 `scope?: 'in_process_trusted'` vs `tokenFamily` 확장)이 명확히 결정되어 있어야 구현자가 인터페이스를 올바르게 확장할 수 있다. `15-chat-channel §5.1` 라인 223에 "별도 필드 도입 — `tokenFamily` 확장이 아님" 이라고 명시되어 있어 방향은 결정되었다. 따라서 현재 spec 은 충분하나, 실제 구현 시 기존 코드의 `InteractionRequestContext` 를 extend 하는 방식이 EIA-AU-08 요구사항에 일치하는지 구현자가 확인해야 한다.
- **제안**: EIA-AU-08 의 구현 메모에 "`InteractionRequestContext` 확장 방식: `scope?: 'in_process_trusted'` 선택적 필드 추가 (`tokenFamily` 는 기존 `'iext' | 'itk'` 유지). 외부 HTTP guard 는 ctx 합성 시 절대 `scope` 를 set 하지 않음" 을 명시. 이미 15-chat-channel §5.1 에 있는 내용을 EIA-AU-08 행에도 교차 참조로 추가.

#### [INFO] `spec/4-nodes/7-trigger/providers/telegram.md` §5.4 섹션 번호 중복
- **위치**: `spec/4-nodes/7-trigger/providers/telegram.md` 라인 129 (`### 5.4 Carousel / Chart / Table`) 와 라인 144 (`## 5.4 보안`)
- **상세**: consistency-check Round 3 cross_spec 에서 WARNING 으로 식별(파일 21)되었으나 spec 에 반영되지 않았다. `##` (최상위) 와 `###` (하위) heading level 이 다름에도 번호가 충돌하여 Markdown 앵커가 중복된다. `15-chat-channel §5.1` 에서 `[providers/telegram §5.4](...)` 를 링크로 참조한다면 어느 섹션을 가리키는지 렌더러에 따라 달라진다.
- **제안**: `## 5.4 보안` 를 `## 6. 보안` 으로 승격 (현행 `## 6. 명령 처리` → `## 7.`, `## 7. 비기능` → `## 8.` 로 변경). `15-chat-channel §5.1` 의 참조 앵커도 동시 갱신. project-planner 위임 대상.

#### [INFO] `spec/5-system/15-chat-channel.md` 본문 섹션 번호 3으로 재시작 — Overview 내 §3과 충돌
- **위치**: `spec/5-system/15-chat-channel.md` 라인 75 (`## 3. 처리 흐름`)
- **상세**: Overview 내부에 §1 개요 / §2 사용 시나리오 / §3 요구사항(CCH-*) 이 있고, 이어지는 본문이 `## 3. 처리 흐름` 으로 시작한다. Overview §3(요구사항)과 본문 `## 3.`(처리 흐름)이 같은 번호를 사용해 앵커 링크가 모호해진다. consistency-check Round 3 convention_compliance 에서 WARNING 으로 식별(파일 20)되었으나 미수정.
- **제안**: 본문 섹션을 4부터 시작 (`## 4. 데이터 모델` → `## 5.` 등) 또는 Overview 내부 소섹션을 번호 없이 제목으로 통일. project-planner 위임 대상.

#### [INFO] `spec/5-system/2-api-convention.md` — RPC-style endpoint 예외 명시 (긍정적 확인)
- **위치**: `spec/5-system/2-api-convention.md` 라인 2296
- **상세**: consistency-check Round 3 의 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 중첩 depth 초과 WARNING(W-3)이 `2-api-convention.md` 에 예외 조항을 명시적으로 추가함으로써 적절히 해소되었다. 이는 spec 요구사항(2-api-convention §2.2 중첩 2단계 제한)과 신규 endpoint 간 괴리를 spec 수준에서 명시적으로 해소한 올바른 처리다.
- **제안**: 특별한 조치 없음.

#### [INFO] `spec/1-data-model.md` §2.8 Trigger — `chat_channel_*` 컬럼 추가 정합성 확인
- **위치**: `spec/1-data-model.md` 라인 1962~1966
- **상세**: cross_spec Round 1 의 WARNING(W1 — 1-data-model 누락)이 정확히 해소되어 5개 컬럼(`chat_channel_health`, `chat_channel_last_error`, `chat_channel_setup_at`, `chat_channel_token_v2`, `chat_channel_rotated_at`)이 Trigger 엔티티 표에 추가되었다. SoT 갱신이 spec 파일 간 일관성을 유지하고 있다. `config` JSONB 설명에도 `chatChannel` 서브 필드 cross-link 가 추가되어 있어 적절하다.
- **제안**: 특별한 조치 없음.

#### [INFO] `spec/5-system/12-webhook.md` §7 처리 흐름 분기 — 202 반환 시점 명시
- **위치**: `spec/5-system/12-webhook.md` 라인 2176
- **상세**: consistency-check Round 1 의 W4(202 반환 시점 명시 권고)가 webhook.md §7 분기에 Chat Channel 경로의 step 7f (`f. 202 Accepted 즉시 반환`) 로 반영되어 있다. WH-NF-01 의 200ms 시한과 CCH-NF-01 의 50ms parseUpdate 시한이 함께 명시되어 있다.
- **제안**: 특별한 조치 없음.

#### [INFO] `spec/2-navigation/4-integration.md` — cafe24 다이어그램 `install_token` 참조 정정
- **위치**: `spec/2-navigation/4-integration.md` 라인 1989, 1998, 2001, 2010
- **상세**: 이전 commit(#248)에서 정정된 항목과 관련된 변경이 포함되어 있다. `install_token 보존` 제거 및 `install_token=NULL` 참조 제거, Rationale 문구 단순화가 이루어졌다. 본 PR 의 주 목적(Chat Channel spec)과 직접 관련 없는 chore 변경이며, 내용 자체는 적절해 보인다.
- **제안**: 특별한 조치 없음.

---

## 요약

본 PR 은 Chat Channel (Telegram 서버사이드 어댑터) 기능의 spec 문서 일체를 정의한다. 핵심 기능 — EIA consumer 포지셔닝, NotificationDispatcher in-process EventEmitter subscription, InteractionService in-process bypass (EIA-AU-08), Webhook 트리거 config 갈래 설계 — 의 요구사항(CCH-AD/CV/MP/SE/NF-* 21개 ID)은 spec, convention, provider-catalog 세 파일에 걸쳐 일관되게 기술되어 있다. 그러나 몇 가지 요구사항 충족 관점의 문제가 남아 있다. 가장 중요한 것은 (1) CCH-SE-03("config JSONB 평문 금지" — 필수)와 §4.1의 v1 plaintext stub 기술이 같은 문서 안에서 충돌하며 별 plan 생성이 아직 없다는 점, (2) `EiaEvent` union 의 `execution.cancelled` 주석 `EIA §6.5` 가 오기일 가능성이 있고 payload shape 불일치로 이어질 수 있다는 점, (3) CCH-CV-03 의 `running` 상태 처리가 미정의여서 구현자가 임의로 결정해야 한다는 점이다. 그 외 `telegram.md §5.4` 섹션 번호 중복(앵커 혼동 위험)과 본문 섹션 번호 충돌 등 문서 구조 오류도 수정이 권장된다. 전체적으로 spec fidelity 는 높으나, 위 CRITICAL/WARNING 항목들이 구현 착수 전 정리되지 않으면 구현자 혼동과 런타임 에러 위험이 존재한다.

---

## 위험도

**MEDIUM**

`execution.cancelled` 주석 오기 가능성(CRITICAL)이 구현 시 payload shape 불일치로 이어질 수 있으며, CCH-SE-03 vs v1 plaintext stub 충돌(WARNING), CCH-CV-03 `running` 상태 미정의(WARNING), Form 다단계 시퀀스의 parseUpdate 책임 경계 모호(WARNING)가 추가로 존재한다. CRITICAL 1건은 project-planner 위임 후 spec 정정이 필요하다. WARNING 항목들은 구현 전 해소 권장이나, 시스템 invariant 를 즉각 파괴하지는 않는다.

---

STATUS: SUCCESS
