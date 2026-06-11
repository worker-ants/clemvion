# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
대상 범위: `spec/2-navigation/`
diff-base: `origin/main`
주요 변경: `spec/2-navigation/5-knowledge-base.md §2.4.1` — 검색 불가 배너 + "지금 재임베딩" CTA (kb-reembed-banner)

---

## 발견사항

### 발견사항 없음 (충돌 없음)

모든 6개 검토 관점에서 충돌하는 발견사항이 없다. 아래에 각 관점별 검토 근거를 기술한다.

---

### 관점 1: 데이터 모델 충돌

`spec/2-navigation/5-knowledge-base.md §2.2.1 / §2.4.1` 이 사용하는 두 필드:

- `embeddingDimension` (응답 DTO camelCase) — `spec/1-data-model.md §2.11` `embedding_dimension Integer?` 로 정의됨. 설명("첫 임베딩 후 자동으로 채워지고, KB 재임베딩 시 NULL 로 reset")이 KB spec 의 사용 방식("모델 변경 후 미재임베딩 상태를 NULL 로 신호")과 일치한다.
- `reembedStatus` (DTO camelCase) — `spec/1-data-model.md §2.11` `reembed_status Enum (idle / in_progress)` 로 정의됨. KB spec §2.2.1 / §2.4.1 이 `idle` / `in_progress` 두 값으로 분기하는 방식이 데이터 모델 Enum 정의와 완전히 일치한다.

결론: **충돌 없음**. DTO camelCase 와 DB snake_case 매핑도 spec 내에서 명시되어 있다.

---

### 관점 2: API 계약 충돌

`spec/2-navigation/5-knowledge-base.md §2.4.1` 이 사용하는 API:

- `POST /api/knowledge-bases/:id/re-embed` — KB spec §3 API 표에 정의("KB 전체 재임베딩 요청. `reembed_status` 가 `idle` 일 때만 진입, 진행 중이면 409 `KB_REEMBED_IN_PROGRESS`"). 배너의 CTA 가 신규 API 를 도입하지 않고 기존 엔드포인트를 재사용한다고 명시되어 있으며, `spec/5-system/8-embedding-pipeline.md §7.3` 이 동일 endpoint 의 동작(atomic CAS, `reembed_status` 전환 규칙)을 정의한다.

배너 관련 신규 API 엔드포인트가 없으므로 기존 계약과의 충돌 가능성 자체가 없다.

결론: **충돌 없음**.

---

### 관점 3: 요구사항 ID 충돌

`spec/2-navigation/5-knowledge-base.md §2.4.1` 에 새로운 요구사항 ID(NAV-KB-* 등)가 추가되지 않았다. 배너 기능은 별도 요구사항 ID 없이 §2.4.1 섹션으로 기술되어 있다.

결론: **충돌 없음**.

---

### 관점 4: 상태 전이 충돌

KB `reembed_status` 상태 머신은 `spec/1-data-model.md §2.11` 과 `spec/5-system/8-embedding-pipeline.md §7.3` 에서 `idle → in_progress → idle` 의 단일 흐름으로 정의된다. KB spec §2.4.1 이 참조하는 상태(`idle` 일 때 CTA 노출, `in_progress` 일 때 CTA 숨김 + 진행 표시)는 이 상태 머신과 일치한다.

- idle + NULL → CTA 노출 → `POST /re-embed` → in_progress + NULL
- in_progress + NULL → CTA 숨김(진행 표시) → 완료 → idle + dimension 채워짐 → 배너 소멸

`spec/5-system/9-rag-search.md §6` 의 `not_searchable` 신호(두 케이스: `reembedding_in_progress` / `reembedding_required`)도 이 두 상태에 정확히 대응한다. 3개 영역(KB 화면 spec, 임베딩 파이프라인 spec, RAG 검색 spec)이 동일한 2상태(idle+NULL / in_progress+NULL) 를 일관되게 기술한다.

결론: **충돌 없음**.

---

### 관점 5: 권한·RBAC 모델 충돌

`spec/2-navigation/5-knowledge-base.md §2.4.1`: 배너 텍스트는 모든 멤버(viewer+)에게 노출, "지금 재임베딩" CTA 는 `RoleGate(editor)` 로 editor 이상에게만 노출.

- `spec/5-system/1-auth.md` 의 role enum(`owner / admin / editor / viewer`) 과 일치.
- `spec/5-system/8-embedding-pipeline.md §7.3` 의 `POST /re-embed` 엔드포인트 권한(editor)과 일치: KB spec §3 API 표에도 `editor` 권한이 명시되어 있다.
- `spec/0-overview.md §6.1` 의 "작성/수정/삭제(create·update·delete)는 `editor`+ 로 제한" 패턴과 일치.

결론: **충돌 없음**.

---

### 관점 6: 계층 책임 충돌

배너 구현은 frontend-only(presentational 컴포넌트 `UnsearchableBanner` + i18n 키)이며 backend 변경이 없다. `spec/2-navigation/5-knowledge-base.md §2.4.1` 이 이를 명시("신규 API 없음 — 기존 `POST /re-embed` 재사용"). 기존 `useKbEvents` WebSocket 캐시 invalidate + polling fallback 인프라를 배너 소멸 트리거로 활용한다.

`spec/0-overview.md §3.4 Inline Alert 생존 주기` 규칙: "다음 관련 mutate 가 시작되기 직전(`useMutation` 의 `onMutate`)에 비워 ... X 버튼은 두지 않는다". KB spec §2.4.1 은 "수동 닫기(X) 버튼이 없다 — 재임베딩이 완료돼 `embedding_dimension` 이 다시 채워지면 ... 자동 소멸한다"로 이 규칙을 따른다. onMutate 리셋 대신 캐시 invalidate 기반 자동 소멸 방식이나, X 버튼 부재 원칙은 동일하게 준수한다.

계층 책임(frontend presentational, backend API 무변경, 기존 WebSocket/polling 재활용)이 기존 결정과 일치한다.

결론: **충돌 없음**.

---

## 요약

`spec/2-navigation/` (주요 변경: `5-knowledge-base.md §2.4.1` 검색 불가 배너) 는 기존 spec 영역들(`spec/1-data-model.md §2.11 KnowledgeBase`, `spec/5-system/8-embedding-pipeline.md §7.3`, `spec/5-system/9-rag-search.md §2.2·§6`, `spec/0-overview.md §3.4`)과 완전히 일관된다. 데이터 모델의 `reembed_status` / `embedding_dimension` 필드 의미, API 계약(`POST /re-embed` 재사용), 상태 머신(idle/in_progress 2상태), RBAC(editor+ for CTA), 계층 책임(frontend-only) 모두 기존 정의와 모순이 없다. 새 요구사항 ID 추가 없이 섹션 기술로만 구성되어 ID 충돌도 없다. `spec/2-navigation/` 의 다른 화면 문서들(대시보드, 워크플로우 목록, 인증 플로우 등)은 이번 변경과 무관하며 기존과 동일하다.

## 위험도

NONE
