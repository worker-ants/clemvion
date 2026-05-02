## 발견사항

### **[INFO]** `reembedStatus` 필드가 Graph RAG 범위 외 추가
- **위치**: `frontend/src/lib/api/knowledge-bases.ts` — `KnowledgeBaseData` 인터페이스
- **상세**: `reextractStatus` (신규 Graph RAG 필드)와 함께 기존에 존재하던 `reembedStatus`도 인터페이스에 추가되었음. `reembedStatus`는 Graph RAG와 무관한 기존 필드이며, 본 PR 범위 밖 인터페이스 보완이 섞임.
- **제안**: 허용 가능 수준이나, 별도 커밋으로 분리하거나 주석으로 이유를 명시하는 것이 바람직함.

---

### **[WARNING]** `refreshKbStats` 메서드 두 서비스에 중복 구현
- **위치**: `graph-extraction.service.ts` (private method) ↔ `graph-query.service.ts` (private method)
- **상세**: 두 파일이 동일한 SQL 쿼리와 로직을 각자 `private refreshKbStats()`로 보유. `graph-query.service.ts`의 주석("GraphExtractionService 와 동일한 로직")이 의도적 중복임을 인정함. 순환 의존성 회피 목적이라 설명되어 있으나, 향후 통계 계산 로직이 바뀔 때 두 곳을 동시에 수정해야 하는 유지보수 위험이 생김.
- **제안**: `KbStatsHelper` 등 단일 공유 유틸/서비스로 추출하거나, 한 서비스가 다른 서비스를 `forwardRef`로 참조하는 방식 검토. 현재 구조는 기능은 동작하나 범위 내 설계 부채.

---

### **[INFO]** 기존 `document-embedding.processor.ts` 에 graph 파이프라인 분기 추가
- **위치**: `document-embedding.processor.ts` — `onCompleted` 핸들러 + `maybeChainGraphExtraction`
- **상세**: 임베딩 완료 이벤트에서 graph-extraction 큐로 chained dispatch 하는 로직이 기존 임베딩 프로세서에 삽입됨. 이 변경은 Graph RAG 파이프라인에 필수적이나, 임베딩 프로세서가 graph 큐에 암묵적으로 의존하게 됨. 오류 처리(`try/catch + warn log`)가 있어 큐 미연결 시 embedding 기능은 보호됨.
- **제안**: 현재 구현 방식 허용 가능. 다만 `graph-extraction` 큐 등록이 누락되면 silently degraded 되므로, 통합 테스트에서 체인 동작을 검증하는 케이스 추가 권장.

---

### **[INFO]** `rag-search.service.spec.ts` 테스트 픽스처 헬퍼 추가
- **위치**: `makeKbRow` / `KbRowFixture` (파일 상단)
- **상세**: 기존 테스트가 인라인 객체로 KB 행을 만들던 것을 `makeKbRow` 헬퍼로 일괄 교체함. 신규 Graph RAG 컬럼의 기본값을 채우기 위한 리팩토링으로 Graph RAG 범위 내 필수 변경이나, 기존 vector 모드 테스트 코드도 함께 리팩토링됨.
- **제안**: 기능 변경 없는 리팩토링이고 테스트 가독성도 향상되므로 허용 가능. 엄격한 scope 관리가 필요한 팀이라면 별도 커밋으로 분리.

---

## 요약

전체 변경사항은 **Graph RAG 도입**이라는 의도된 범위에 잘 집중되어 있다. 신규 파일(entity/relation/chunk-entity 엔티티, graph-extraction/graph-query 서비스, 큐 정의, 프론트엔드 컴포넌트)은 모두 Graph RAG 기능 구현의 직접적 산물이며 불필요한 기능 추가나 무관한 파일 수정은 없다. 주의할 지점은 두 서비스의 `refreshKbStats` 중복 구현과 기존 임베딩 프로세서에 graph 체이닝 로직이 삽입된 점이나, 전자는 주석으로 이유가 명시되어 있고 후자는 오류 격리가 갖춰져 있어 허용 가능한 수준이다. `reembedStatus`의 프론트엔드 인터페이스 추가는 범위를 소폭 벗어나지만 실질적 위험은 없다.

## 위험도

**LOW**