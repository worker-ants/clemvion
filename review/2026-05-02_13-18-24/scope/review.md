### 발견사항

- **[INFO]** KB 설정 모달이 임베딩 모델 이상의 항목을 편집 가능하게 함
  - 위치: `frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` `openSettings` / `handleSaveSettings`
  - 상세: 이번 작업의 1차 목표는 임베딩 모델 선택 UI였으나, 설정 모달이 `name`, `description`, `chunkSize`, `chunkOverlap`까지 편집 가능하게 추가함. `update` API·DTO는 이미 해당 필드를 지원하고 있었으므로 신규 로직이 추가된 건 아니지만, 프론트엔드에서는 기존에 노출되지 않았던 기능을 함께 열어준 것임.
  - 제안: 스코프 초과라기보다 자연스러운 UX 개선으로 볼 수 있으나, 티켓/스펙에 명시되지 않은 변경이므로 리뷰어가 인지하고 명시적으로 수락하는 것이 좋음. 별도 이슈로 추적하거나 PR 설명에 "intentional scope expansion" 으로 기록 권장.

- **[INFO]** `SUPPORTED_DIMS` 화이트리스트가 코드·마이그레이션 양쪽에 중복 관리됨
  - 위치: `rag-search.service.ts:8`, `V021__variable_embedding_dimension.sql:18–28`
  - 상세: partial HNSW 인덱스를 만드는 마이그레이션 파일과 검색 서비스의 화이트리스트 Set이 분리되어 있어, 새 차원 모델 도입 시 두 곳을 동시에 수정해야 한다는 사실이 주석으로만 안내됨. 이 패턴은 이번 작업에서 의도적으로 선택된 설계임.
  - 제안: 현재 주석으로 충분히 설명되어 있으므로 스코프 문제는 아님. 필요 시 후속 작업으로 단일 진실의 원천(예: 설정 테이블 또는 별도 constants 파일)으로 통합 가능.

- **[INFO]** `llm-config.controller.ts`의 API 설명 문자열 수정
  - 위치: `llm-config.controller.ts` L198–199
  - 상세: `?type` 쿼리 파라미터 지원을 설명 문자열에 반영한 것으로, 실제 기능 변경(`@Query('type')` 추가)을 동반한 필요한 문서화임.
  - 제안: 스코프 내 변경으로 문제없음.

---

### 요약

변경 범위는 전반적으로 작업 목적("가변 차원 임베딩 모델 선택 + KB 단위 재임베딩 + RAG 검색 모델 일치 버그 수정")에 충실하게 한정되어 있다. DB 마이그레이션 → 엔티티/DTO → 서비스/컨트롤러 → 프론트엔드 API 클라이언트 → UI → i18n 까지 수직으로 일관되게 구성되어 있으며 무관한 파일 수정이나 불필요한 리팩토링은 발견되지 않는다. 유일한 주목 사항은 KB 설정 모달이 임베딩 모델 외에 name·description·chunkSize·chunkOverlap 편집까지 함께 노출하는 점이나, 이는 기존 백엔드 능력을 프론트엔드에서 처음으로 연결한 것으로 over-engineering보다 자연스러운 UX 통합에 가깝다.

### 위험도

**LOW**