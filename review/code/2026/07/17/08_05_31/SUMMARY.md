# AI Review 통합 보고서 (2회차 — fix 델타)

**대상**: `aee4f75e9..HEAD` — 1회차(`review/code/2026/07/17/07_12_33/`) 지적을 반영한 fix 커밋 `b04654f94`
**리뷰어**: architecture · side_effect · testing · scope (4/4 확보, fix 델타 성격에 맞춰 선별)

**전체 위험도: MEDIUM** → fix 후 **LOW**
**Critical 0건 / Warning 3건** — 전부 처분 완료.

> 1회차가 codebase 7파일을 바꿨고 push 가드가 "리뷰 이후 변경" 으로 정당하게 차단 → 그 델타를 덮는 2회차. `BYPASS_REVIEW_GUARD` 미사용 (실제 코드 변경이므로 우회 대상이 아님).

## Warning 처분

| # | Reviewer | 발견 | 처분 |
|---|---|---|---|
| 1 | architecture | **producer 는 지웠는데 consumer 가 남아 새 orphan 발생** — `type:"rag"` 합성부는 삭제됐으나 렌더 분기(`isRag`, `RagDetail`, `RagBubbleSummary`, `ragSourceCount` 등 6곳)가 잔존. **이번 fix 가 스스로 적용한 원칙("guard 만으로 부족, 물리적 삭제 필요")이 반대편에 적용되지 않은 비일관성** | ✅ **fix** — consumer 전부 제거(`RagDetail`·`RagBubbleSummary` 컴포넌트 포함). producer 0건·테스트 0건으로 dead 확정 후 삭제. side_effect 도 동일 INFO 로 독립 지적 |
| 2 | testing | 갱신된 history tool 테스트가 `parseHistoryMessages` 를 **테스트에서 직접 호출**해 주입하므로 `result-detail.tsx` 의 실제 배선(`hasLiveSystemError` → `effectiveConversationMessages`)을 우회. **CT-S15~17 에 tool assertion 0건** → 이번 버그와 동일 계열(호출자 배선 실패)을 잡는 e2e 테스트 부재 | ✅ **fix** — CT-S17 fixture 에 tool-call 왕복 추가 + `result-detail` 레벨에서 `kb_search` assertion 추가. 이제 ResultDetail → parseHistoryMessages → ConversationInspector 실제 배선을 통과해 검증 |
| 3 | side_effect | **RAG 소실의 근거 서술이 변화 크기를 과소평가** — "live 는 원래부터 없었다 / history 전용 비대칭" 은 사실이나, 실제로 사라진 것은 "history 에서 **동작하던 기능**" 이다 (옛 `items` useMemo 는 history 에서 **무조건** 재파싱했으므로 rag 행이 실제 렌더됐다) | ✅ **문서 정정** — 아래 §RAG 판단(정정) |
| — | architecture | (INFO) `items` 위 기존 주석이 새 주석과 모순 | ✅ **fix** — stale 주석 제거 |

## 핵심 질문에 대한 testing reviewer 답변

1회차 fix 에서 red 가 된 "History 모드 tool 표시 (Critical fix 회귀 방지)" 테스트를 제가 고친 것에 대해 **"테스트를 구현에 맞춰 무력화한 것 아니냐"** 를 핵심 질문으로 제시했다. 답변:

- **무력화 아님** — assertion 은 여전히 진짜로 깨질 수 있다.
- 다만 **보호 범위가 명칭과 어긋나게 축소**됐다: `items = conversationMessages` 이후 `isLive` 는 items 계산에 관여하지 않으므로 "History 모드 전용" 이라는 주장이 무의미해졌고, `conversation-utils.test.ts` 의 tool 파싱 테스트와 상당 부분 중복된다.
- **더 중요한 갭**: 실제 배선 우회 (위 Warning #2 로 처분).

## RAG 판단 (side_effect Warning #3 반영해 정정)

**사라진 것**: history conversation view 의 `🔎 KB Reference` 행 (`role:'system'` + `### Relevant Knowledge` → `rag` item).

**1회차 서술의 부정확성**: "live 는 원래부터 없었다 — history 전용 비대칭" 이라고만 적어 마치 죽어있던 기능처럼 읽혔다. 정확히는 **옛 `items` useMemo 가 history 경로에서 무조건 인라인 재파싱했으므로 그 행은 실제로 렌더되고 있었다.** 제거는 "동작하던 기능의 의도적 삭제" 다.

**그럼에도 삭제를 유지하는 근거**:

1. **신규 데이터에는 애초 나타나지 않는다** — `RagSearchService.buildContext` 의 **프로덕션 호출부가 전무**함을 requirement reviewer 가 독립 확인. 즉 지금 생성되는 실행에는 그 마커가 실리지 않는다.
2. **대체 표면이 SoT** — KB 청크는 References 탭(`meta.turnDebug[].ragSources` → `turnRefIndex`)이 turn 별로 노출하며, 이것이 현재 규약상 단일 진실이다.
3. **live/history 일관성** — live 경로(`messagesToConversationItems`)는 rag 를 만들지 않아 두 surface 가 어긋나 있었다. 제거가 §9.6 "양 surface 동일 결과"(Inv-5) 정신에 부합.

**잔여 영향(정직한 서술)**: 마커가 실린 **구형 영속 데이터**의 이력 조회에서는 그 행이 더 이상 보이지 않는다. References 탭이 대체하지만 구형 run 에 `meta.turnDebug` 가 없으면 KB 표시가 비게 된다. 후속 백로그 항목으로 남긴다.

## 검증 (fix 이후)

| 항목 | 결과 |
|---|---|
| `run-results/__tests__` + `websocket/__tests__` + `lib/conversation` | **510/510 passed** |
| eslint (변경 파일 전체) | **clean** |
| `tsc --noEmit` (변경 파일) | **clean** |

## 후속 백로그 (1회차 것에 추가)

6. 구형 영속 데이터(`### Relevant Knowledge` 마커 보유)의 이력 KB 표시 — References 탭이 `meta.turnDebug` 부재 시 비는 케이스 확인
7. `conversation-inspector.test.tsx` 의 "History 모드" 테스트 명칭·범위 정리 (`isLive` 가 items 계산에서 빠져 명칭이 실제 검증 내용과 어긋남 — testing INFO)
