# Consistency Check 통합 보고서 — `rag` 행 신설 draft (2회차)

**BLOCK: NO** — 1회차 CRITICAL **판정 취소**. spec 개정(Phase 1) 착수 가능.

5/5 checker 전수 확보 (Agent fan-out).

> 1회차: [`review/consistency/2026/07/17/11_32_25/`](../11_32_25/SUMMARY.md) — BLOCK: YES (Cross-Spec CRITICAL)

## 위험도

| Checker | 1회차 | 2회차 | 핵심 |
|---|---|---|---|
| **Cross-Spec** | **CRITICAL** | **LOW** | **CRITICAL 취소** — 실측 결과 기존 drift 였음이 확인되고 "D4 번복 아닌 범위 명확화" 논증이 성립. 새 WARNING 1(=`1-ai-agent.md:732` 누락) |
| Rationale Continuity | MEDIUM | MEDIUM | D4 범위 명확화 판단 **근거 있음 확인**. 새 WARNING 2 (D4 완화 스코프 과대 / CT-S20 vs §8.5 구분) |
| Convention Compliance | MEDIUM | MEDIUM | 명명 자기모순 + 카운트 drift 재발 |
| Naming Collision | MEDIUM | MEDIUM | `turnDebug` 파라미터명이 해소된 충돌 재도입 / `RagInjection*` 이 `isInjected` 와 충돌 |
| Plan Coherence | LOW | LOW | plan 이동·Slice B 정정 확인 |

## CRITICAL 취소 근거 (2회차 cross_spec)

호출자의 실측 반증을 checker 가 **직접 재검증**해 수용:

- `result-detail.tsx:1026-1032/:1093/:1116` + `conversation-inspector.tsx:1199-1213` → **`meta.turnDebug` 는 이미 Preview 의 소스** (📚 chip)
- `conversation-thread.md:322` D4 원문 → 우려 대상은 **emit messages 의 prefix/마커 raw 노출**. `RagSource`(`9-rag-search.md §4.1`)는 마커 없는 구조화 데이터 → **D4 의 위험 요인 구조적 부재**

### checker 가 새로 발견한 근본 원인 (내 논거보다 강함)

**이 관행은 "미문서화" 가 아니었다** — **`9-rag-search.md §4.1` 이 이미 Preview 의 📚 chip 을 `meta.turnDebug[].ragSources` 출처로 문서화**하고 있었다. 문제는 그 문서와 `conversation-thread.md` 사이 **상호 참조가 0건**(양방향 grep)이라 §9.3·D4 가 그 사실을 모른 채 서술된 것이다.

→ **상호 링크 신설(Phase 1 항목 15)이 drift 의 근본 원인을 닫는 조치**다. 링크 없이 문구만 고치면 같은 drift 가 재발한다.

## Warning 처분 (전부 plan 반영)

| Checker | 발견 | 처분 |
|---|---|---|
| Cross-Spec | `1-ai-agent.md:732`(turnDebug 목적 = 디버그 탭 한정 서술) — 1회차 CRITICAL 이 지목한 **4번째 충돌 지점**인데 Phase 1 누락 | ✅ **개정 대상 D** 신설 |
| Cross-Spec (INFO) | `conversation-thread.md` ↔ `9-rag-search.md` 상호 링크 부재 = **근본 원인** / 헤더 "관련 spec" 목록 누락 | ✅ 항목 15 + 헤더 재작성 |
| **Rationale** | **D4 완화 스코프 과대** — `meta.turnDebug` **전체**를 열면 형제 필드 `llmCalls`(= `6-websocket-protocol.md` L506 이 "raw debug payload, editor-only" 로 못박은 필드)까지 열려 **D4 보호가 다른 경로로 재도입** | ✅ **`ragSources` 한정으로 축소** 명시 |
| Rationale | CT-S20(cross-node 결측)이 §8.5 "노드 필터 부재는 의도" 와 표면 유사 — §8.6 이 명시 해소 안 함 | ✅ §8.6 서술 범위에 추가 (스코프가 다름: thread=execution / meta=node) |
| Rationale (INFO) | target 의 "미문서화" 표현 부정확 | ✅ 정정 (오히려 논거 강화) |
| **Convention** | **`RagRetrieval*` 명명 자기모순** — 식별자만 바꾸고 문서 프레이밍은 "주입" 유지 | ✅ **프레이밍 전체를 "검색(retrieval)" 으로 일관화** |
| Convention | §9.9 "8가지" → 9가지 / §9.1 위젯 blockquote 행수 / §9.11 서수 | ✅ 항목 17~19. **§9.11 은 과도 갱신 회피** — `mergeRagRetrievalItems` 는 1차 변환이 아니라 `mergeOrphanToolItems` 계열 후처리라 "두 1차 변환 함수" 는 유지 |
| Convention | §9.6 인용 오류 / 항목 번호 중복 / §8.6 제목 중복 | ✅ 정정 |
| **Naming** | **파라미터명 `turnDebug` 가 `conversation-utils.ts:360` 의 기존 `TurnDebugEntry`(ragSources 없음)와 충돌** — 이 저장소가 **이미 rename 으로 해소한 충돌**(`output-shape.ts:324-328`)을 되살릴 뻔 | ✅ `mergeRagRetrievalItems(items, ragDeltas: TurnRagDelta[])` |
| Naming | `RagInjection*` 이 `execution-store.ts:174` 의 `isInjected`·`meta.contextInjection` 과 어휘 충돌 | ✅ `RagRetrieval*` |
| Naming (1회차) | `rag.turnIndex` 가 top-level `turnIndex` 와 중복 | ✅ payload 에서 제거 |
| Plan Coherence | Slice B "동일 파일" 근거가 #1 에 부정확 | ✅ 문구 정정 |
| Plan Coherence (INFO) | `ai-node-failed-conversation-preview.md` 미이동 | ✅ **`plan/complete/` 이동 + `spec_impact` 4경로 + `completed`**. Gate C 726/726 통과 실측 |

## 판정

**BLOCK: NO** — Phase 1 착수 가능. 개정 대상은 4개 spec 문서(A `conversation-thread.md` / B `6-websocket-protocol.md` / C `9-rag-search.md` / D `1-ai-agent.md`) + 카운트 drift 정정.
