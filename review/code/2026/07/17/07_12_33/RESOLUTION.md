# RESOLUTION — ai-review 후속 조치

**세션**: `review/code/2026/07/17/07_12_33/`
**리뷰 대상 커밋**: `aee4f75e9`
**fix 커밋**: `b04654f94` (codebase 7 + spec 3 파일)
**리뷰 산출물 커밋**: `ea6f5f85c` (review/** 전용 — 게이트 재무장 회피)

**ESCALATE: no** — 사용자 결정이 필요한 지점 없음. Critical 2건 전부 fix, Warning 14건은 fix 8 / 후속 4 / 기존갭 2 로 분류 처분.

> 처리 주체: main Claude 직접 수행 (resolution-applier 미위임). 판정 근거·상세 표는 [`SUMMARY.md`](./SUMMARY.md).

## Critical — 전부 해소

| # | 발견 | 조치 | 검증 |
|---|---|---|---|
| 1 | **§7.9 cross-ref 7곳이 존재하지 않는 섹션 지시** — `spec/5-system/4-execution-engine.md` 의 §7 은 "장애 복구"(§7.1~§7.5.2) | 올바른 대상 `spec/4-nodes/3-ai/1-ai-agent.md#79-multi-turn-모드--오류-error-포트` 로 전수 정정 (spec 4곳 + 코드 주석 3곳) | `grep -rn "4-execution-engine.md" ... \| grep 7.9` → 0건 |
| 2 | **§9.10 표 파손** — CT-S14/CT-S15 사이 빈 줄이 GFM 테이블을 끊어 신설 CT-S15~17 이탈 | 빈 줄 제거 | `grep -n "^| CT-S"` → CT-S1~S17 단일 표 연속 확인 |

두 건 모두 documentation reviewer 발견이며 requirement reviewer 가 #1 을 독립 발견해 교차 검증됐다.

## Warning — fix 적용 (8건)

| Reviewer | 발견 | 조치 |
|---|---|---|
| architecture | 인라인 재파싱 **dead code 잔존** — guard 우회만으로는 조건 완화 시 회귀 재발 | 블록 전체 삭제 → `items = conversationMessages`. §9.11 3-함수 계약 실제 복원. orphan 심볼 5개(`useMemo`/`tryParseJson`/`stripInlineMarkers`/`RAG_CONTEXT_MARKER`/`isRagContextContent`) 정리 |
| documentation | Inv-8 이 Inv-6/Inv-7 사이 삽입 | Inv-1~8 순서 교정 |
| scope + testing | `endReason` 화이트리스트 `'condition'` 추가가 **무테스트** | 제거 대신 **테스트로 정당화** — `output-shape.test.ts` 의 기존 "accepts every unified endReason" 열거 테스트에 `condition`/`error` 추가해 backend enum 정합 고정 |
| maintainability | OR-체인이 파일 기존 `ReadonlySet` 패턴 미준수 | `CONVERSATION_END_REASONS` ReadonlySet 도입 |
| maintainability | fixture 헤더 주석 stale | 신규 시나리오 범위 반영해 갱신 |
| testing | R4 직접 테스트 부재 | dead code 삭제로 분기 소멸 → `conversation-inspector.test.tsx` 의 history tool 테스트를 **프로덕션 배선**(호출자가 `parseHistoryMessages` 결과 주입)대로 갱신 |
| side_effect | R4 가 완료 대화 이력 소스도 교체 → `rag` 행 소실 | **의도된 변경으로 확정** (근거 3건 — SUMMARY §RAG 판단) |
| requirement | (Critical 1·architecture 1 과 동일) | 위와 동일 |

## Warning — 후속 백로그 (4건, 본 PR 범위 외)

| Reviewer | 발견 | 미조치 사유 |
|---|---|---|
| side_effect | `outputData: payload.output ?? null` 이 error-port 라우팅 8종 전체에 적용 — 비AI 실패 전용 테스트 없음 | `node.completed`(L778) 와의 **대칭 복원**이라 방향은 옳다(비대칭이 결함이었다). 전용 테스트는 별도 |
| side_effect | status 게이트 제거로 **취소 노드**가 미리보기 노출 | §10.6.1 L471 이 이미 "completed/failed/**cancelled**/waiting 노드는 서브 탭 표시"를 규정 → **spec 준수에 가까워지는 방향**. 계획 밖 표면이라 무테스트로 남김 |
| architecture | `isConversationOutput` heuristic OR-체인 구조 | 본 회귀 계열의 반복 진원지 — 구조 개선은 별도 과제 |
| documentation | CHANGELOG 항목 누락 | 저장소의 CHANGELOG 갱신 관례가 일관되지 않아 별도 판단 필요 |

## Warning — 기존 갭 판정 (2건, 본 변경이 도입 아님)

| Reviewer | 발견 | 판정 |
|---|---|---|
| security | `output.result.messages`(tool-call 원문)에 `redactThreadForPublic`/`deepRedactSecrets` 미적용 | **`completed` 대화 노드에 이미 존재하던 갭**을 실패 노드까지 대칭화한 것. 에디터는 인증 표면이라 공개 노출 아님. §9.5 마커 strip 은 새 경로에서도 유지됨을 백엔드까지 확인 검증 |
| — | `plan/complete/ai-agent-tool-payload-budget-followups.md` 의 `spec_impact` 누락으로 Gate C 실패 | **main 기존 결함** — `git stash` baseline 실측으로 본 작업 무관 확인. 별도 작업으로 분리 |

## TEST WORKFLOW 재수행 (fix 이후)

| 항목 | 결과 |
|---|---|
| `run-results/__tests__` + `websocket/__tests__` + `lib/conversation` | **510/510 passed** |
| `result-detail.test.tsx` | 35/35 (CT-S15/S16/S17 신규 3건 포함) |
| `use-execution-events.test.ts` | 82/82 |
| eslint (변경 파일 전체) | **clean** (0 errors, 0 warnings) |
| `tsc --noEmit` (변경 파일) | **clean** |
| frontend 전체 스위트 | 5169 passed / 1 failed — 잔여 1건은 위 "기존 갭" Gate C (baseline 실측 확인). 26 파일 실패는 `@workflow/*` 미빌드 환경 이슈로 baseline 동일 |

fix 과정에서 `conversation-inspector.test.tsx` 의 "History 모드에서도 tool 메시지가 표시된다 (Critical fix 회귀 방지)" 가 dead code 삭제로 red 가 됐고, 보호 대상 동작(history 에서 tool 표시)을 유지한 채 프로덕션 배선대로 갱신해 green 복구했다 — 테스트가 검증하던 배선이 실제 프로덕션과 달랐던 것이 드러난 셈이다.

## 결론

**Critical 0 / 미해소 Warning 0** (후속 4건 + 기존갭 2건은 범위 분리 판정). 리뷰 게이트 종결.
