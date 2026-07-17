# AI Review 통합 보고서 — 🔎 `rag` 행 신설

**대상**: `main..HEAD` (리뷰 시점 `78c120a5a`) · **fix 커밋**: `b1698d538`
**리뷰어**: requirement · side_effect · testing · architecture (4/4)

**위험도: CRITICAL → fix 후 LOW**
**Critical 3건 / Warning 5건** — 전부 처분.

## Critical (3건 — 전부 해소)

| # | Reviewer | 발견 | 처분 |
|---|---|---|---|
| 1 | **side_effect + requirement (독립 교차 발견)** | **live 분기가 🔎 행을 누락** — `result-detail.tsx:1097` 이 병합 전 raw store prop 을 넘겨 (a) 대화 진행 중 🔎 행이 **아예 안 나옴** — 이 PR 의 목적이 live 에서 미달성 (b) `ResultTimeline`(병합 배열)과 인덱스 공간이 갈려 공유 `selectedConversationItemIndex` 가 다른 항목을 가리킴 | ✅ `effectiveConversationMessages` 로 교체 |
| 2 | testing | **CT-S18(e) 양 surface 동시 노출 테스트 부재** — spec §9.6·§9.10 이 의무화한 항목인데 `result-timeline.test.tsx` 에 없음 | ✅ 신설 (+CT-S19) |
| 3 | testing | **CT-S18(f) Inv-9 테스트 부재** — 🔎 행·📚 chip·References 탭의 `sources[]` 동일성 | ✅ `result-detail.test.tsx` 에 세 표면 동시 검증 신설 |

> Critical 1·2·3 의 공통점: **내가 spec 에 의무로 써놓고 구현·테스트에서 빠뜨린 것들**이다. spec 을 쓴 주체와 이행하는 주체가 같아도 자동으로 지켜지지 않는다는 게 이번 교훈.

## Warning 처분

| Reviewer | 발견 | 처분 |
|---|---|---|
| testing | fixture 가 §9.10 **"단일 export" 규약 위반** (인라인 정의) — 내가 쓴 규약을 내가 어김 | ✅ `conversation-scenarios.ts` 로 이관 |
| testing | `RagRetrievalRow`·timeline `rag` 분기 렌더 테스트 전무 | ✅ CT-S18(e)/(f) 신설로 해소 |
| **architecture** | **문서명 dedup 로직 3곳 복제 + cap 적용 불일치** — 주석은 "Inv-9 상 세 표면 동일" 이라 써놓고 규칙을 복제한 **자기모순**. 표시 정책이 이미 갈라짐 | ✅ `uniqueDocumentNames` 헬퍼로 통합 |
| requirement | **spec drift** — registry §2 가 `RagRetrievalDetail` 을 명시했으나 실제는 `RagRetrievalRow` 재사용 | ✅ spec/plan 정정 |
| architecture | 비메모이즈 재계산 — "훅 규칙상 불가" 근거가 `result-timeline.tsx` 에는 미적용 | ⏸ **후속** — 두 호출부 모두 순수 계산이고 기존 `items` 도 비메모이즈였다. 성능 측정 없이 memo 추가는 근거 부족 |
| architecture (INFO) | `lib/` → `components/` 경계가 **주석에만 의존** — ESLint 가드 부재 | ⏸ **후속 백로그** — 이번에 최초 위반을 만들 뻔했으므로 자동 가드가 있어야 재발을 막는다 |

## 확인된 항목 (문제 없음)

| Reviewer | 검증 |
|---|---|
| architecture | 타입 레이어 이동 + re-export — 판단·실행 모두 타당, 기존 선례와 정합 |
| architecture | `rag` 방어 case — `ConversationTurnSource` 유지가 제거 대안보다 우월, `system_error` 와 동형 |
| side_effect | 타입 이동이 re-export 로 기존 소비처 안전 / 7값 확장이 판별 지점 4곳 모두 방어 / `groupToolCallItems` 가 `rag` 미claim (§9.6 의도대로) |
| testing | 인덱스 시프트 정정(3→5, 1→2)은 **정당** — 원래 의도(두 번째/첫 번째 assistant 선택) 유지 확인 |
| testing | Slice B 두 테스트 의미 있음 |

## 검증 (fix 이후)

| 항목 | 결과 |
|---|---|
| frontend 전체 | **5171 passed / 0 failed** |
| eslint · tsc | **clean** |

> 25 파일 실패는 `@workflow/*` 미빌드(환경) — baseline 동일.

## 후속 백로그

1. `lib/` → `components/` 레이어 경계 ESLint 가드 (architecture INFO — 이번에 최초 위반 직전까지 갔다)
2. `effectiveConversationMessages`/`items` 메모이즈 필요성 — 성능 측정 후 판단
3. (기존) `cancelled` 표면 · 에디터 redaction 정책 · `isConversationOutput` OR-체인 구조
