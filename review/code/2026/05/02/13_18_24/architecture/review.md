### 발견사항

---

**[WARNING] 비즈니스 로직이 컨트롤러 레이어에 위치**
- 위치: `llm-config.controller.ts:212-218`
- 상세: `if (type === 'chat' || type === 'embedding') { return models.filter(...) }` 필터링은 비즈니스 로직이므로 서비스 레이어(`LlmService.listModels`)에 있어야 한다. 현재 구조에서는 컨트롤러가 데이터 변환 책임을 가진다. 동일 필터가 필요한 다른 엔드포인트 추가 시 중복이 발생한다.
- 제안: `llmService.listModels(id, workspaceId, { type })` 시그니처로 옮기고, 컨트롤러는 파라미터만 전달

---

**[WARNING] `SUPPORTED_DIMS` 화이트리스트가 마이그레이션과 이중 변경 지점을 만듦**
- 위치: `rag-search.service.ts:8`
- 상세: 새 차원 모델 도입 시 "마이그레이션 추가 + `SUPPORTED_DIMS` 수정" 두 곳을 동시에 바꿔야 한다. 코드 주석으로 경고하고 있지만, 이 두 변경이 강제로 연결되는 메커니즘이 없다. 배포 순서가 어긋나거나(migration 배포 전 코드 배포) 한쪽만 변경하는 실수가 가능하다.
- 제안: 단기적으로는 현 구조 유지가 합리적이나, 중장기적으로 `migration_dimension_indexes` 같은 설정 테이블에서 지원 차원을 읽어오는 방식으로 단일 변경 지점을 확보하는 것을 검토

---

**[WARNING] `reEmbedAll`의 fire-and-forget 패턴은 내구성 보장 없음**
- 위치: `knowledge-base.service.ts:119-130`
- 상세: `embeddingService.processDocument(doc.id, true).catch(...)` 는 프로세스 재시작 시 진행 중인 작업이 무음 소실된다. 현재 per-document 임베딩도 동일 패턴이지만, KB 단위 재임베딩은 수십~수백 개 문서를 동시에 큐잉하므로 리스크가 증폭된다. 또한 `embedding_dimension = NULL` 초기화와 재임베딩 큐잉이 트랜잭션으로 묶이지 않아, NULL 초기화 후 프로세스 크래시 시 dimension이 NULL인 채로 남는다.
- 제안: 현재 스코프에서 즉각 해결이 어렵다면, `reEmbedAll` 응답에 "재임베딩 중" 상태 필드를 KB에 추가해 사용자가 진행 여부를 인지할 수 있도록 하는 것이 최소 조치

---

**[WARNING] `KnowledgeBaseService.reEmbedAll`이 ORM 우회하여 raw SQL 사용**
- 위치: `knowledge-base.service.ts:112-115`
- 상세: `embedding_dimension = NULL` 업데이트에 `dataSource.query(raw SQL)`을 사용하고 있다. 동일 파일 내 다른 업데이트는 repository를 통한다. 일관성 측면에서 `kbRepository.update({ id }, { embeddingDimension: null })`가 적합하다.
- 제안: `kbRepository.update({ id }, { embeddingDimension: null as unknown as number })` 또는 entity 로드 후 save 패턴 사용

---

**[INFO] 프런트엔드 페이지 컴포넌트에 상태와 핸들러가 과도하게 집중**
- 위치: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx:74-203`
- 상세: 7개 신규 state(`showSettings`, `showKbReEmbedConfirm`, `formName`, `formDescription`, `formEmbeddingModel`, `formChunkSize`, `formChunkOverlap`), 2개 mutation, 2개 핸들러가 페이지 컴포넌트에 직접 위치한다. 설정 모달과 재임베딩 확인 모달이 인라인 JSX로 렌더링되어 있다. 단일 책임 관점에서 페이지 컴포넌트의 책임이 비대해지고 있다.
- 제안: `useKbSettings(kb)` 훅과 `<KbSettingsModal>`, `<KbReEmbedConfirmModal>` 컴포넌트로 분리 — 지금 당장 필수는 아니나 이 패이지에 다음 기능이 추가될 때는 필요

---

**[INFO] `kbReEmbedMutation.onSuccess` 응답 shape 이중 분기**
- 위치: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx:145-152`
- 상세: `res?.data?.documentCount ?? res?.documentCount ?? 0` 와 같이 두 가지 응답 envelope를 코드에서 직접 다루고 있다. 테스트 파일에도 동일한 TODO 주석이 있다. 이 패턴이 컴포넌트 로직에 누수되면 응답 계약이 흐려진다.
- 제안: axios interceptor로 envelope 통일 작업 후 제거 (기존 TODO와 동일 방향)

---

**[INFO] `EmbeddingModelCombobox`가 워크스페이스 전역 설정을 직접 조회**
- 위치: `frontend/src/components/knowledge-base/embedding-model-combobox.tsx:32-50`
- 상세: 컴포넌트가 `llmConfigsApi.getAll()`로 모든 LLM 설정을 조회해 default를 찾은 뒤 해당 config의 embedding 모델을 다시 조회한다. React Query의 캐싱으로 네트워크 비용은 관리되나, 이 컴포넌트가 워크스페이스 컨텍스트를 스스로 해결하는 것은 단일 책임에 어긋난다.
- 제안: `defaultConfigId`를 prop으로 받거나 상위에서 Context를 통해 주입하는 방식이 더 명확. 현 구조는 이 컴포넌트가 "어디서든" 사용될 수 있다는 가정인데, 실제로는 워크스페이스 컨텍스트 내에서만 사용된다.

---

### 요약

전체 설계는 spec(embedding 가변 차원, KB별 모델 일관성, 검색 그룹핑) 요구사항을 충실히 구현했고, DB 레이어(partial HNSW), 서비스 레이어(dimension 검증·재임베딩), API 레이어(type 필터), UI 레이어(combobox·설정 모달)까지 수직으로 일관되게 연결되어 있다. 주요 아키텍처 리스크는 세 가지다: ① 컨트롤러에 놓인 모델 타입 필터링 로직, ② fire-and-forget 재임베딩의 내구성 부재(현 시스템의 구조적 한계를 KB 수준으로 확장한 것), ③ `SUPPORTED_DIMS`와 DB 마이그레이션 간 묵시적 결합. 세 가지 모두 현재 스코프에서 즉각 차단 수준은 아니나, 시스템이 프로덕션 규모로 커지기 전에 ②는 상태 추적 필드 추가 또는 BullMQ 같은 큐 도입으로 보강이 권장된다.

### 위험도

**MEDIUM**