# Consistency Check 통합 보고서

**BLOCK: YES** — CRITICAL 2건 해소 전까지 spec write 차단

---

## 전체 위험도
**CRITICAL** — 규약 위반(Principle 0·단일 진실 원칙) 2건. 미수정 반영 시 구현자가 잘못된 필드 경로를 코드에 박거나 v1 push 대상 노드를 누락할 위험.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Convention Compliance | `output.meta.contextInjection` 경로 — `meta` 가 `output` 의 하위 필드로 기술됨. Principle 0(최상위 5필드 구조) + Principle 1·2 동시 위반 | `conversation-thread.md` line 201 | `spec/conventions/node-output.md` Principle 0 | line 201 을 `meta.contextInjection: { scope, mode, injectedTurns, droppedTurns, totalInjectedChars }` 로 수정 (동일 draft §3.3·line 507 은 이미 올바름 — 오기 정정) |
| 2 | Convention Compliance ＋ Rationale Continuity | `conversation-thread.md §2.3` "v1 은 `ai_agent` 만 자동 누적" — draft 핵심 결정 표("모든 AI 노드 turn 누적은 v1") 및 `0-common.md §11` 변경안과 정면 모순. 단일 진실 원칙 위반 | `conversation-thread.md §2.3` (line 121–123) | 동일 draft 핵심 결정 표 (line 30) + `0-common.md §11` 변경안 | §2.3 을 push(누적)와 inject(주입) 를 명확히 구분한 문구로 교체: "v1: 모든 AI 노드(text_classifier 포함) turn push 적용. contextScope 활성화(주입)는 v1 ai_agent 전용, 나머지 AI 노드는 v2 추가." |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | Cross-Spec | `form_submit` vs `form_submitted` — 폼 제출 이벤트 enum 값 명칭 불일치 | draft §1.1·§1.4·§2.1 (`form_submitted`) | `spec/1-data-model.md §2.14` `interactionType: "form_submit"` | `spec/conventions/node-output.md §4.5` 실제 enum 값 확인 후 authoritative 값으로 단일화. node-output spec 이 `form_submitted` 이면 data model 동기화, `form_submit` 이면 draft 수정 |
| 2 | Convention Compliance | `meta.contextInjection` 에 config 값(`scope`·`mode`) echo 포함 — Principle 2 "meta 는 런타임 측정값만" 경계 위반 | draft §5.3 Cap 표 | `spec/conventions/node-output.md` Principle 2 | `meta.contextInjection` 에서 `scope`·`mode` 제거하고 `{ injectedTurns, droppedTurns, totalInjectedChars }` 만 유지. 디버그 필요 시 `appliedScope`·`appliedMode` 로 rename 하여 config echo 와 구분 |
| 3 | Plan Coherence | `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표 미래 병렬 수정 위험 — 이 draft 와 `ai-agent-tool-connection-rewrite` plan 이 동일 표 수정 예정 | draft §3 (conversationHistory DEPRECATED + 신규 5필드) | `plan/in-progress/ai-agent-tool-connection-rewrite.md §3` | 도구 연결 재설계 plan 활성화 시 신규 5필드 위치·DEPRECATED 마커 조율을 체크리스트에 명시 |
| 4 | Plan Coherence | `node-output-redesign` 의 `output.messages` 통일 제안이 승인될 경우 draft §4 영속화 섹션의 SoT 경로 기술 무효화 위험 | draft §4 "영속화" (`output.messages` / `output.result.messages` 분산 SoT) | `plan/in-progress/node-output-redesign/ai-agent.md` 경로 통일 검토 | node-output-redesign 합의 시 `plan/in-progress/node-output-redesign/README.md` 에 follow-up 항목 추가: "conversation-thread §4 SoT 경로 점검 필요" |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/0-overview.md §8` 문서 맵에 `conversation-thread.md` 미등록 | `spec/0-overview.md §8` 정식 규약 행 | spec 반영 시 overview §8 테이블에 `conversation-thread.md` 한 줄 추가 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.14` NodeExecution 에 ConversationThread 재구성 관계 미기술 | `spec/1-data-model.md §2.14` | NodeExecution 표 하단에 cross-link 한 줄 추가 ("ConversationThread 분산 SoT. 상세: [Spec Conversation Thread §4]") |
| 3 | Cross-Spec | 실행 이력 화면의 ConversationThread 크로스노드 뷰 미정의 | draft §7 WS payload | draft Rationale 또는 §7 v2 로드맵에 "EH-DETAIL-06 과 함께 v2 UI spec 에서 정의" 명시 |
| 4 | Convention Compliance | 신규 `conversation-thread.md` 에 `## Rationale` 섹션 부재 | draft §1 전체 구조 | §8 CHANGELOG 앞에 Rationale 섹션 추가 또는 "설계 근거는 [Spec AI Agent §12.1] 참조" 포인터 배치 |
| 5 | Rationale Continuity | `system_text` 모드 end-user 입력의 prompt injection sanitization 정책 미명시 | draft §5.2·§1.4 | §5.2 또는 Rationale 에 "thread-renderer 는 turn.text 를 system prompt 에 첨부 시 `sanitizeLlmProvidedString` 규약 준용" 한 줄 추가 |
| 6 | Naming Collision | `ConversationTurnSource='system'` vs `AssistantMessage.role='system'` — 네임스페이스 달라 런타임 충돌 없음, 오독 가능 | draft §1.1 `system` row | §1.1 source='system' 설명에 "AssistantMessage.role='system' 과 무관, 워크플로우 레벨 수동 push 전용" 주석 추가 |
| 7 | Naming Collision | `ConversationThread.id = "default"` 가 port 예약어 `"default"` 와 동일 값 — 네임스페이스 분리로 안전 | draft §1.3 id 설명 셀 | "(v1 고정값 — port 예약어 'default'와 무관)" 1문구 보강. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장 |
| 8 | Naming Collision | `0-common.md §10` CHANGELOG 를 §11 로 밀기 — 앵커 링크 깨짐 가능성 | `spec/4-nodes/3-ai/0-common.md` | `grep -r "0-common.md#10" spec/` 로 점검 후 발견 시 앵커 갱신 |
| 9 | Plan Coherence | `spec/5-system/5-expression-language.md` §4.4 부재 — §4.5 로 신설하면 §4.4 공란 | draft §6.2 ("§4.5 $thread 속성 신설") | spec 반영 시 §4.4 로 번호 정정 |
| 10 | Plan Coherence | `plan/in-progress/conversation-thread.md` Phase 1 체크박스 전부 `[ ]` 상태 | Phase 1 체크리스트 | spec 반영 직후 Phase 1 전체 `[x]` 로 갱신 |
| 11 | Plan Coherence | `ai-agent-tool-connection-rewrite.md`·`background-monitoring-api.md`·`merge-p2-async-fanin.md` frontmatter 부재 | 각 plan 파일 | `worktree`·`started`·`owner` frontmatter 추가 (plan_coherence 자동 검출을 위해) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `form_submit`/`form_submitted` 명명 불일치(WARNING 1), 문서 갭 3건(INFO) |
| Rationale Continuity | LOW | draft 내부 v1 스코프 불일치(→ CRITICAL로 상향 통합), sanitization 정책 미명시(INFO) |
| Convention Compliance | **CRITICAL** | `output.meta` 경로 오기(CRITICAL), §2.3 단일 진실 위반(CRITICAL), Principle 2 경계(WARNING), Rationale 미포함(INFO) |
| Plan Coherence | LOW | 미래 병렬 수정 위험 2건(WARNING), 섹션 번호·체크박스·frontmatter 보완(INFO 3건) |
| Naming Collision | LOW | 네임스페이스 분리로 런타임 충돌 없음. 오독 방지용 문서 보강 3건(INFO) |

---

## 권장 조치사항

1. **[BLOCK 해소 필수]** `conversation-thread.md` line 201 수정 — `output.meta.contextInjection` → `meta.contextInjection`
2. **[BLOCK 해소 필수]** `conversation-thread.md §2.3` 문구 교체 — push(누적)·inject(주입) 구분 명확화 (`text_classifier`·`information_extractor` 의 v1 push 포함 여부 확정)
3. **[WARNING 해소]** `spec/conventions/node-output.md §4.5` 확인 후 `form_submit` vs `form_submitted` 단일화 (spec 반영 전 확인 권장)
4. **[WARNING 해소]** `meta.contextInjection` 에서 `scope`·`mode` 제거 또는 `appliedScope`·`appliedMode` 로 rename
5. **[INFO — spec 반영 시 함께]** `spec/0-overview.md §8` 에 `conversation-thread.md` 등록, `spec/1-data-model.md §2.14` cross-link 추가, `§4.4` 번호 정정, `## Rationale` 섹션 추가
6. **[INFO — spec 반영 직후]** `plan/in-progress/conversation-thread.md` Phase 1 체크박스 `[x]` 갱신
7. **[INFO — 향후]** `node-output-redesign` 경로 통일 합의 시 conversation-thread §4 SoT 경로 점검 follow-up 등록