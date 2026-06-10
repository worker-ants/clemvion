# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/2-navigation/5-knowledge-base.md`
**검토 일시**: 2026-06-11
**검토 범위**: 데이터 모델 충돌 · API 계약 충돌 · 요구사항 ID 충돌 · 상태 전이 충돌 · 권한·RBAC 모델 충돌 · 계층 책임 충돌

---

## 발견사항

### 요약: 신규 추가된 주요 변경사항

target 문서가 기존 대비 추가한 핵심 내용:
1. `§2.2.1 컬렉션 카드`: `embeddingDimension == null` + `reembedStatus` 조건별 경고 표시
2. `§2.4.1 진행 박스`: 검색 불가 배너 (`embeddingDimension == null` 인 KB 상세 상단)

---

### 발견사항

- **[INFO]** `§2.4.1` 배너 소멸 조건 서술이 `embedding_dimension` 기준으로 되어 있으나, RAG 검색 사전 차단 기준과 정렬됨
  - target 위치: `§2.4.1` 검색 불가 배너 — "재임베딩이 완료돼 `embedding_dimension` 이 다시 채워지면 배너는 자동 소멸한다"
  - 충돌 대상: `spec/5-system/9-rag-search.md §3.1`, `spec/5-system/8-embedding-pipeline.md §7.3.2`
  - 상세: target 과 RAG 검색 spec 모두 `embedding_dimension IS NULL` 을 검색 차단 기준으로 사용하고 있어 일관성 있음. `8-embedding-pipeline.md §7.3.2` 도 "같은 UPDATE 에서 `embedding_dimension=NULL` 초기화" 로 동일 기준 사용. 충돌 없음 — 오히려 cross-reference 가 잘 정렬됨.
  - 제안: 현재 상태 유지.

- **[INFO]** `§2.2.1` 의 `reembedStatus` camelCase 와 DB 컬럼명 `reembed_status` 의 명시적 매핑 표기
  - target 위치: `§2.2.1` 첫 문단 — "응답 DTO 의 camelCase 필드 — DB `reembed_status` 매핑"
  - 충돌 대상: `spec/1-data-model.md §2.11 KnowledgeBase` — `reembed_status Enum idle / in_progress`
  - 상세: target 이 "응답 DTO 의 camelCase 필드 — DB `reembed_status` 매핑" 을 명시해 데이터 모델과의 관계를 명확히 했다. `1-data-model.md §2.11` 의 `reembed_status Enum idle / in_progress` 와 target 의 `reembedStatus === 'idle'` / `reembedStatus === 'in_progress'` 은 완전히 일치한다.
  - 제안: 현재 상태 유지.

- **[INFO]** `§2.4.1` 배너가 polling 과 `useKbEvents` 를 소멸 트리거로 명시
  - target 위치: `§2.4.1` — "임베딩 진행 박스의 polling·`useKbEvents` 캐시 invalidate"
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §8.1` WebSocket 이벤트 목록
  - 상세: `embedding_dimension` 이 채워지는 시점은 `document:embedding_completed` 이벤트(또는 polling)로 KB 메타가 갱신될 때다. target 은 배너 소멸 트리거로 "임베딩 진행 박스의 polling·`useKbEvents` 캐시 invalidate"를 명시했는데, 이는 `embedding_pipeline §8.1`의 WS 이벤트 흐름과 일치한다. 충돌 없음.
  - 제안: 현재 상태 유지.

- **[INFO]** `§2.4.1` 배너와 `spec/0-overview.md §3.4 Inline Alert` 패턴 정합성
  - target 위치: `§2.4.1` 검색 불가 배너
  - 충돌 대상: `spec/0-overview.md §3.4 Inline Alert` — warning(amber), 사용자 dismiss X 버튼, 생존 주기 정책
  - 상세: `0-overview.md §3.4` Inline Alert 는 "외부 작업 진행 중 계속 참조해야 할 때" 사용하며 "다음 관련 mutate 가 시작되기 직전 비워, X 버튼은 두지 않는다" 고 정의한다. target 의 배너는 상태 표시 + CTA 혼합형으로, Inline Alert 패턴의 부분 적용이다 — 소멸 조건이 "재임베딩 완료 시 자동 소멸"(mutate 결과 기반)로 spec §3.4 생존 주기와 일치한다. X 버튼 유무는 target 에서 명시되지 않으나 §3.4 원칙상 명시 dismiss 없이 자동 갱신이 권고된다 — 구현 시 확인 권장.
  - 제안: 구현 시 `spec/0-overview.md §3.4` Inline Alert 생존 주기(X 버튼 없이 자동 갱신)를 따르도록 구현 명세에서 확인.

- **[INFO]** `§3 API` 표의 `POST /api/knowledge-bases/:id/re-embed` 에 RBAC 권한 미명시
  - target 위치: `§3 API` 표 — `POST /api/knowledge-bases/:id/re-embed` 행
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §Rationale` — "KnowledgeBaseController: `POST /:id/re-embed` (HTTP 202, **editor**, `@Throttle 3/min`)"
  - 상세: `8-embedding-pipeline.md` Rationale 에는 `editor` RBAC + `@Throttle 3/min` 이 명시돼 있고, target §2.4.1 배너 CTA 에도 "RoleGate(editor)" 가 언급된다. 그러나 §3 API 표 자체에는 해당 endpoint 의 권한·Throttle 이 기재되어 있지 않다. 동일 §3 표의 `POST /embedding-probe` 는 "editor, Throttle 30회/분", `POST /retry-failed` 는 "editor, Throttle 3회/분" 이 명시돼 있어 표기 일관성 미흡.
  - 제안: `§3 API` 표의 `POST /api/knowledge-bases/:id/re-embed` 행에 "editor, Throttle 3회/분" 을 추가해 `8-embedding-pipeline.md` 및 인접 행들과 표기 일관성 유지.

- **[INFO]** `§3 API` 표의 `POST /api/knowledge-bases/:id/documents/:docId/re-embed` 에도 RBAC 미명시
  - target 위치: `§3 API` 표 해당 행
  - 충돌 대상: `spec/5-system/8-embedding-pipeline.md §7.3.1`, `§9.4`
  - 상세: 문서 단건 재임베딩 endpoint 도 `editor` RBAC 가 적용되지만 표에 미기재. 동일한 표기 일관성 문제.
  - 제안: 해당 행에도 권한 명시 권장 (별도 우선순위가 낮으므로 INFO).

---

## 요약

target 문서(`spec/2-navigation/5-knowledge-base.md`)가 추가한 핵심 내용 — §2.2.1 목록 카드 검색 불가 경고 및 §2.4.1 상세 배너 + [지금 재임베딩] CTA — 은 `spec/1-data-model.md §2.11`(KnowledgeBase.reembed_status / embedding_dimension), `spec/5-system/9-rag-search.md §2.2·§3.1·§5·§6`(not_searchable 봉투 / 사전 차단 기준), `spec/5-system/8-embedding-pipeline.md §7.3.2`(reembed_status CAS / embedding_dimension NULL 초기화·복구) 과 정렬이 잘 되어 있고 실질적인 데이터 모델·API 계약·상태 전이 충돌은 발견되지 않았다. 단, `§3 API` 표에서 `POST /api/knowledge-bases/:id/re-embed` endpoint 의 RBAC(editor) 및 Throttle(3/분) 이 누락돼 `8-embedding-pipeline.md` 와 표기 비일관성이 있다. 이는 기능 동작에는 영향이 없는 문서 동기화 수준의 INFO 항목이다.

---

## 위험도

LOW
