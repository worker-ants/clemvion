# AI Review 통합 보고서

**대상**: `main..HEAD` — AI 대화 노드 오류 종결 시 대화 이력 도달성 복구 (Inv-8)
**리뷰 시점 커밋**: `aee4f75e9`
**후속 fix 커밋**: `b04654f94`

**위험도: MEDIUM** → fix 후 **LOW**
**Critical 2건 / Warning 14건** — Critical 2건 전부 해소, Warning 은 아래 표대로 처분.

> 실행 경로: native ai-review Workflow 의 router 매핑 이슈(reviewers 빈 배열)로 **fallback Agent fan-out** 사용 (CLAUDE.md §자동 트리거 시 허용). 강제 7종(documentation·maintainability·requirement·scope·security·side_effect·testing) + 변경 성격상 architecture 추가 = **8/8 전수 확보**.

## Critical (해소 완료)

| # | Reviewer | 발견 | 처분 |
|---|---|---|---|
| 1 | documentation | **§7.9 cross-ref 7곳이 존재하지 않는 섹션을 가리킴** — `spec/5-system/4-execution-engine.md` 의 §7 은 "장애 복구"(§7.1~§7.5.2)로 §7.9 부재. 실제 §7.9 는 `spec/4-nodes/3-ai/1-ai-agent.md` (Multi Turn 모드 — 오류 error 포트) | ✅ `b04654f94` — spec 4곳 + 코드 주석 3곳 전수 정정. requirement reviewer 도 독립 발견(교차 검증) |
| 2 | documentation | **§9.10 표 파손** — CT-S14/CT-S15 사이 빈 줄로 GFM 테이블이 끊겨 신설 CT-S15~17 이 표 밖으로 이탈 | ✅ `b04654f94` — 빈 줄 제거, CT-S1~S17 단일 표 복원 |

## Warning 처분

| # | Reviewer | 발견 | 처분 |
|---|---|---|---|
| 1 | architecture | 인라인 재파싱이 **dead code 로 잔존** — guard 우회만으로는 나중에 조건 완화 시 이번 회귀가 조용히 재발. `parseHistoryMessages` 와 동일 소스·동일 우선순위라 도달 불가임을 데이터 흐름으로 입증 | ✅ **fix** — 블록 전체 삭제, `items = conversationMessages` 로 축소. §9.11 3-함수 계약을 우회가 아니라 실제 복원. orphan 심볼 5개 정리 |
| 2 | documentation | Inv-8 이 Inv-6/Inv-7 사이에 삽입돼 번호 순서 어긋남 | ✅ **fix** — Inv-1~8 순서 교정 |
| 3 | documentation | CHANGELOG 항목 누락 | ⏸ **보류** — 본 저장소의 CHANGELOG 갱신 관례가 일관되지 않아 별도 판단 필요 |
| 4 | scope | `endReason` 화이트리스트의 `'condition'` 추가가 범위 밖 + **무테스트** | ✅ **fix** — 제거 대신 **테스트로 정당화**. `condition` 은 backend enum 의 실제 값이고 `error` 와 동일한 drift 라 함께 고치는 것이 정합 |
| 5 | testing | R3(`endReason`)·R4(인스펙터) 직접 테스트 부재. 특히 `output-shape.test.ts:574` 의 기존 "accepts every unified endReason" 열거 테스트 미갱신 | ✅ **fix** — 기존 열거 테스트에 `condition`/`error` 추가(backend enum 정합 고정). R4 는 dead code 삭제로 분기 자체가 소멸 → `conversation-inspector.test.tsx` 를 프로덕션 배선대로 갱신 |
| 6 | maintainability | `endReason` OR-체인이 파일 기존 `ReadonlySet` 패턴 미준수 | ✅ **fix** — `CONVERSATION_END_REASONS` ReadonlySet 도입 |
| 7 | maintainability | fixture 헤더 주석이 신규 시나리오 범위 미반영(stale) | ✅ **fix** — 갱신 |
| 8 | requirement | (Critical 1·architecture 1 과 동일 발견 — 독립 교차 검증) | ✅ 위와 동일 |
| 9 | side_effect | **R4 가 오류 종결뿐 아니라 모든 완료 대화 이력의 소스를 교체** — 옛 인라인 파서의 `rag` 행 합성이 대응점 없이 소실 | ✅ **의도된 변경으로 확정** (근거 아래 §RAG 판단) |
| 10 | side_effect | `outputData: payload.output ?? null` 이 AI 노드에 국한되지 않고 **error-port 라우팅 8종 전체**에 적용. 비AI 실패+실제 output 조합 전용 테스트 없음 | ⏸ **후속** — `node.completed`(L778) 와의 **대칭 복원**이라 방향은 옳다(비대칭이 오히려 결함이었다). 다만 전용 테스트는 미작성 |
| 11 | side_effect | status 게이트 제거로 **취소된 노드**의 stale conversation-shape `outputData` 가 `isCanonicalWaiting` 경로로 미리보기 노출 | ⏸ **후속** — §10.6.1 L471 이 이미 "completed/failed/**cancelled**/waiting 노드는 서브 탭 바 표시"를 규정하므로 **spec 준수에 가까워지는 방향**. 다만 계획 밖 표면 + 무테스트 |
| 12 | security | `output.result.messages`(tool-call 원문)에 `redactThreadForPublic`/`deepRedactSecrets` 미적용 | ⏸ **후속(기존 갭)** — `completed` 대화 노드에 **이미 존재하던 갭**을 실패 노드까지 대칭화한 것으로 신규 도입 아님. 에디터는 인증 표면이라 공개 노출 아님. §9.5 마커 strip 은 새 경로에서도 유지됨을 백엔드까지 확인해 검증 |

## RAG 행 소실 판단 (side_effect #9)

옛 인라인 파서는 `role:'system'` + `### Relevant Knowledge` 를 `rag` timeline 행으로 합성했으나 `parseHistoryMessages`/`messagesToConversationItems` 는 RAG 를 처리하지 않는다. 삭제로 그 행이 사라진다. **의도된 변경으로 확정한 근거**:

1. **live 는 원래부터 없었다** — live 경로(`messagesToConversationItems`)에 RAG 처리가 없으므로 `rag` 행은 **history 전용 비대칭**이었다. 제거는 두 surface 를 일치시킨다 (Inv-5 의 "양 surface 동일 결과" 정신).
2. **프로덕션 dead** — requirement reviewer 가 독립적으로 `RagSearchService.buildContext` 의 **프로덕션 호출부가 전무**함을 확인.
3. **대체 표면 존재** — KB 청크는 References 탭(`meta.turnDebug[].ragSources` → `turnRefIndex`)이 turn 별로 노출하는 것이 현재 SoT.

## 검증

- 관련 스위트 **510/510** (`run-results/__tests__`, `websocket/__tests__`, `lib/conversation`)
- `result-detail` 35/35 (CT-S15/S16/S17 신규 3건 포함), `use-execution-events` 82/82
- eslint clean, tsc clean(변경 파일)
- 전체 frontend 스위트: 잔여 실패 2종은 **baseline 실측으로 무관 확인** — (a) `@workflow/*` 미빌드(환경), (b) `plan/complete/ai-agent-tool-payload-budget-followups.md` 의 `spec_impact` 누락(main 기존 결함)

## 후속 백로그

1. 비AI 실패 노드의 `outputData` 전달 전용 테스트 (#10)
2. `cancelled` 대화 노드 표면 정리 — `showTabs` 의 `cancelled` 누락(§10.6.1 L471 drift) + 귀속 신호 부재(`handleNodeCancelled` 가 `system_error` 미APPEND) (#11, conversation-thread §8.5 known follow-up)
3. 에디터 표면의 tool-call 원문 redaction 정책 결정 (#12, 기존 갭)
4. `plan/complete/ai-agent-tool-payload-budget-followups.md` 의 `spec_impact` frontmatter 보강 (Gate C 실패 — 본 작업 무관)
5. `isConversationOutput` heuristic OR-체인 구조 개선 (architecture INFO — 본 회귀 계열의 반복 진원지)
