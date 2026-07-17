# 신규 식별자 충돌 검토 — `rag-tool-row-distinct-ui`

대상: `plan/in-progress/rag-tool-row-distinct-ui.md` (Slice A+B, `spec/conventions/conversation-thread.md` 개정 계획)

## 발견사항

- **[WARNING]** `ConversationItem.rag.turnIndex` 가 기존 top-level `ConversationItem.turnIndex` 와 동일 이름으로 중복 선언
  - target 신규 식별자: Phase 2 항목 2 — `execution-store.ts` 에 `rag?: { sources: RagSource[], turnIndex }` 필드 신설 (Phase 1 §1.2.2 의 "rag 한정 `data?` shape (`sources: RagSource[]`, `turnIndex`)" 와 동일)
  - 기존 사용처: `codebase/frontend/src/lib/stores/execution-store.ts:161` — `ConversationItem` 인터페이스에 이미 **top-level 필수 필드** `turnIndex: number;` 가 존재하며, `user`/`assistant`/`tool`/`presentation` 등 **모든** item type 에 공통 적용된다. 이 필드는 렌더 key(`` `${item.type}-${item.turnIndex}` ``, `conversation-inspector.tsx:241,1091,1139`)와 `turnRefIndex` 조회(`conversation-inspector.tsx:379,1202`)의 근거로 이미 광범위하게 소비된다.
  - 상세: target 의 `rag?: { sources, turnIndex }` 는 같은 `ConversationItem` 객체 안에 **동일한 의미의 필드를 두 위치**(`item.turnIndex` vs `item.rag.turnIndex`)에 중복 선언하게 된다. `injectRagItems` 가 새 `rag` item 을 배열에 삽입할 때 위치 결정을 위해 top-level `turnIndex` 도 당연히 채워야 하므로(다른 모든 type 과 동일하게 렌더 key·정렬에 필요), nested `rag.turnIndex` 는 사실상 값이 겹치는 **잉여 필드**가 될 가능성이 높다. 두 값이 구현 과정에서 어긋나면(예: 삽입 로직이 top-level 만 갱신하고 nested 는 stale 로 남거나 반대) 어느 쪽이 SoT 인지 불명확해지는 버그 소지가 생긴다. 참고로 `output-shape.ts:330` 의 `TurnRagDelta`(구 `TurnDebugEntry`, "conversation-utils.ts 의 canonical-shaped `TurnDebugEntry` 와의 동명 충돌 해소를 위해 rename" 이력 존재)도 `{ turnIndex, ragSources, ragDiagnostics }` 형태라 이번 target 필드가 그와 구조적으로 유사한데, 그 전례가 보여주듯 이 프로젝트는 정확히 이런 종류의 "동일 이름·다른 위치" 필드 충돌을 이미 한 번 겪고 해소한 바 있다.
  - 제안: (a) `rag.data` shape 에서 `turnIndex` 를 빼고 top-level `item.turnIndex` 만 사용 — `injectRagItems` 는 삽입 위치 계산에 이미 그 turnIndex 값을 알고 있으므로 top-level 셋팅만으로 충분한지 먼저 검토. (b) 굳이 nested 사본이 필요하면(예: 원본 turnDebug 매칭용 키를 top-level 표시용 turnIndex 와 분리 보존) `rag.sourceTurnIndex` 등으로 rename 해 top-level 필드와 시각적으로 구분한다. Phase 1 §1.2.2 문구도 그에 맞춰 갱신.

- **[WARNING]** `RagDetail` — PR #959(`12ceee587`)에서 삭제된 동명 컴포넌트의 재사용, git 이력 상 혼동 소지
  - target 신규 식별자: Phase 2 항목 3 — `conversation-inspector.tsx` 에 `RagRow`(SummaryView) + `RagDetail`(SelectedItemDetail) 신설
  - 기존 사용처: 커밋 `12ceee587`(PR #959, 같은 날 직전 병합)이 `conversation-inspector.tsx` 의 `RagDetail`·`RagBubbleSummary` 컴포넌트와 `isRag` 분기 전체를 삭제. 삭제 전 `RagDetail` 은 `role:'system'` + `### Relevant Knowledge` 마커 기반 인라인 파서가 만든 `type:"rag"` 아이템의 SelectedItemDetail 렌더러였다.
  - 상세: 현재 저장소에는 `RagDetail`/`RagRow` 어느 것도 존재하지 않아(grep 0건) **즉시 충돌은 없다**. 또한 target 이 채택하는 이름은 파일 기존 네이밍 컨벤션(`SystemErrorRow`+`SystemErrorDetail`, `PresentationDetail`, `SystemDetail`, `UserDetail`, `ToolDetail` — 모두 `SummaryView` 인라인용 `XxxRow` + `SelectedItemDetail` 변형용 `XxxDetail` 패턴)을 정확히 따른 것이라 **이름 선택 자체는 합리적**이다. `RagBubbleSummary`(구, 버블형) 대신 `RagRow`(신, full-width 라인)로 이름을 바꾼 것도 §9.2 3중 신호 설계(bubble 아님)와 정확히 정합해 의도적·타당한 선택으로 보인다. 다만 **같은 날 삭제된 컴포넌트를 곧바로 다른 데이터 출처로 재도입**하는 시점이라, `git log -S"RagDetail"` / `git blame` 로 이 심볼을 추적하는 향후 유지보수자는 "삭제 후 부활(resurrection)"로 오인하거나, 반대로 옛 마커 기반 로직이 남아있다고 착각할 위험이 실재한다. target 문서 자체는 이 위험을 "**#959 에서 지운 것과 이름은 같지만 데이터 출처가 다르다 — 그대로 되살리지 말 것**" 로 명시해 인지하고 있으나, 이 경고가 **plan 문서에만** 있고 실제 코드에는 반영되지 않으면 plan 이 소멸(complete 이동)한 뒤에는 근거가 사라진다.
  - 제안: 구현 시 `RagDetail`/`RagRow` 함수 JSDoc 에 "PR #959(`12ceee587`)에서 삭제된 동명 컴포넌트와 무관 — 데이터 출처는 `meta.turnDebug[].ragSources` (옛 `role:'system'` 마커 파서 아님), 상세는 `conversation-thread.md §8.6`" 형태의 명시적 cross-ref 주석을 코드에 직접 남길 것. plan 문서만의 설명으로는 향후 git 고고학에서 재발견되지 않는다.

- **[INFO]** `injectRagItems` 의 "inject" 동사가 backend `injectConversationContext()` 와 다른 의미로 겹침
  - target 신규 식별자: Phase 1 §9.11 / Phase 2 항목 1 — `conversation-utils.ts` 의 신규 변환 함수 `injectRagItems(items, turnDebug)`
  - 기존 사용처: `spec/conventions/conversation-thread.md` §2.3 — backend 공유 유틸 `injectConversationContext()` (`codebase/backend/src/nodes/ai/shared/conversation-context-injection.ts`), `contextScope`/`contextInjectionMode` 자동 주입 로직을 가리키는 기존 "주입(inject)" 용어.
  - 상세: 두 함수는 서로 다른 레이어(backend LLM prompt 컨텍스트 주입 vs frontend UI 아이템 배열 삽입)에 있고 이름도 다르므로 **직접 충돌은 아니다**. 다만 `conversation-thread.md` 문서 전체에서 "주입/inject" 라는 용어가 이미 "AI 노드가 `contextScope` 로 thread 를 LLM 컨텍스트에 넣는 것"이라는 특정 의미로 §2.3·§5 전반에 걸쳐 쓰이고 있어, 같은 문서 §9.11 에 "RAG 청크를 UI 배열에 끼워 넣는" 전혀 다른 의미의 `injectRagItems` 가 같은 "inject" 어휘로 등장하면 문서 읽는 사람이 두 "주입"을 혼동할 여지가 있다.
  - 제안: 필수는 아니나, `conversation-utils.ts` 의 기존 변환 함수 네이밍 패턴(`xxxToConversationItems`, `mergeOrphanToolItems`)에 맞춰 `insertRagItems` 또는 `mergeRagItems` 등 "inject" 를 피한 동사로 바꾸면 §2.3/§5 의 "자동 주입(contextScope inject)" 용어와 명확히 분리된다. 채택 여부는 선택.

- **[정보 없음 — 문제 없음]** 아래 항목은 전수 확인 결과 충돌 없음
  - **source 값 `"rag"`**: `ConversationTurnSource`(`conversation-utils.ts:14-20`, 6값) / `ConversationItem.type`(`execution-store.ts:107-114`, 6값) 어디에도 `"rag"` 없음. 저장소 전체(`codebase/`)에서 `"rag"` 리터럴을 discriminator 로 쓰는 프로덕션 코드 0건(PR #959 리뷰가 이미 확인·본 검토에서 재확인) — 신설에 걸림돌 없음.
  - **spec 섹션 번호**: 실측 결과 `conversation-thread.md` 는 §1.1.1(존재, `system_error`) 뿐 §1.1.2 없음, §1.2.1(존재) 뿐 §1.2.2 없음, §8 은 §8.1~§8.5 뿐 §8.6 없음 — target 이 신설하려는 세 번호 모두 비어있어 충돌 없음.
  - **CT-S18/CT-S19**: 현재 §9.10 표는 CT-S1~CT-S17 까지 이미 존재(CT-S15~17 은 PR #959 에서 신설·병합됨) — CT-S18/19 는 정확히 다음 연속 번호이며 저장소 전체(`plan/`, `spec/`)에 다른 문서가 CT-S18/19 를 선점하지도 않음.
  - **`RagSource` 타입 재사용**: `output-shape.ts:336` 의 기존 `RagSource` 인터페이스(`chunkId`/`documentId`/`documentName`/`content`/`score`/`origin`)를 target 이 새로 정의하지 않고 그대로 import 재사용하는 설계 — 의도된 정합 재사용이며 경쟁 정의 아님.
  - **`ragSources`/`turnRefIndex` 와의 관계**: target 의 `rag.data.sources` 필드명은 `ragSources`(AiMetadata/TurnRagDelta 레벨의 누적 필드)와 다른 이름(`sources`)을 택해 이름 충돌을 피했다. `turnRefIndex` 는 target 이 새로 선언하지 않고 "기존 `turnRefIndex` 와 동일 소스"라고만 참조 — 재정의 없음, 혼동 없음.
  - **아이콘 🔎**: `spec/`, `codebase/frontend/src` 전체에 기존 사용 0건 — 다른 의미로 이미 쓰이는 글리프와 충돌 없음. 📚 chip 은 기존 `ReferencesChip`(`conversation-inspector.tsx:95`, `conversation-timeline-item.tsx:103`) 그대로 병존시키는 것으로 명시돼 있어 재정의 아님.
  - **API endpoint / 환경변수 / 웹훅·큐 이벤트명**: target 은 새 endpoint, 새 ENV var/config key, 새 webhook·queue·SSE 이벤트를 전혀 도입하지 않는다 (기존 `meta.turnDebug[].ragSources` 읽기 전용 소비) — 해당 관점 N/A.
  - **파일 경로**: 신규 spec 파일 없음(기존 `conversation-thread.md` 개정), 신규 소스 파일 없음(기존 4개 파일 수정 + fixture 파일에 항목 추가) — 경로 충돌 없음.

## 요약

target 이 새로 도입하는 식별자 중 spec 섹션 번호(§1.1.2/§1.2.2/§8.6), 회귀 시나리오 ID(CT-S18/19), source 값 `"rag"`, 함수명 `injectRagItems`, 컴포넌트명 `RagRow` 는 실측 대조 결과 기존 사용처와 **직접 충돌이 없다** — 특히 CT-S 연속성과 §1.1.1/§1.2.1/§8.1~§8.5 대조는 정확히 다음 빈 번호를 정직하게 선점했다. 다만 두 가지는 실제 구현 단계에서 혼동을 유발할 수 있어 WARNING 으로 표시했다: (1) `ConversationItem.rag.turnIndex` 가 이미 모든 아이템에 존재하는 top-level `ConversationItem.turnIndex` 와 이름이 겹쳐 같은 객체 안에 SoT 가 둘이 될 위험(§1.2.2 spec 문구 자체의 설계 결함일 수 있음), (2) `RagDetail` 이 같은 날 앞선 커밋(PR #959)에서 삭제된 동명 컴포넌트를 다른 데이터 출처로 재사용해 git 이력상 "부활" 오인 소지가 있음(단, target 문서 자체가 이미 이 위험을 인지·경고하고 있어 실제 위해는 낮고, 코드 주석으로 근거를 남기면 해소됨). `injectRagItems` 의 "inject" 어휘 중복은 경미한 용어 명확화 제안(INFO) 수준이다.

## 위험도

MEDIUM
