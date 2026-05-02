## 발견사항

### **[WARNING]** `search()` 메서드 과도한 책임 집중
- **위치**: `rag-search.service.ts` `search()` 메서드 (약 120줄)
- **상세**: KB 메타데이터 로드 → 그룹핑 → 임베딩 → SQL 실행 → 병합/정렬까지 6단계가 한 메서드에 집중. 순환 복잡도(Cyclomatic Complexity)가 높고, 새 단계 추가 시 메서드가 더 길어질 위험.
- **제안**: `groupKbsByModel(kbs)`, `searchGroup(group, query, ...)`, `mergeAndRank(results, topK)` 등 private 헬퍼로 단계 분리

---

### **[WARNING]** `SUPPORTED_DIMS`와 SQL 마이그레이션 간 원거리 결합
- **위치**: `rag-search.service.ts:8` `const SUPPORTED_DIMS = new Set([768, 1536, 3072])` ↔ `V021__variable_embedding_dimension.sql`
- **상세**: 새 차원 모델 추가 시 SQL 마이그레이션 작성과 TypeScript 상수 변경이 반드시 함께 이루어져야 하나, 이를 강제하는 자동화된 수단이 없음. 주석으로만 안내되어 있어 한쪽을 놓칠 경우 런타임에야 발견됨.
- **제안**: 테스트에서 실제 인덱스 조회로 검증하거나, 최소한 마이그레이션 파일에 `rag-search.service.ts`의 정확한 파일 경로와 변수명을 명시하고 반대 방향도 동일하게 주석 교차 참조

---

### **[WARNING]** 테스트에서 SQL 문자열 하드코딩 매칭
- **위치**: `embedding.service.spec.ts:95`, `105`
  ```ts
  q.sql.includes('UPDATE knowledge_base SET embedding_dimension')
  ```
- **상세**: SQL 텍스트 일부를 문자열로 비교. 공백 변경, 대소문자 변경, 컬럼 순서 변경 등 의미 없는 SQL 리팩터링에도 테스트가 깨짐. 실제로 검증해야 할 것은 "KB에 올바른 차원이 기록됐는가"이지 SQL 텍스트가 아님.
- **제안**: TypeORM Repository의 `kbRepository.update` 또는 `kbRepository.save`를 spy로 검증하거나, `DataSource.query`의 call args 전체를 snapshot으로 비교

---

### **[WARNING]** `[id]/page.tsx` 모달 3개가 인라인으로 반복
- **위치**: `knowledge-bases/[id]/page.tsx:316~437`
- **상세**: Settings 모달, KB 재임베딩 확인 모달, 문서 삭제 확인 모달이 각각 `fixed inset-0 z-50 flex items-center justify-center bg-black/50` 구조를 그대로 복사. 오버레이 투명도, z-index, 애니메이션 등 변경 시 3곳을 모두 수정해야 함.
- **제안**: 이미 프로젝트에 `shadcn/ui Dialog` 또는 유사 공통 컴포넌트가 있다면 사용. 없으면 `ConfirmModal` 컴포넌트를 추출

---

### **[WARNING]** `kbReEmbedMutation.onSuccess` 응답 형태 이중 분기
- **위치**: `knowledge-bases/[id]/page.tsx:152~160`
  ```tsx
  const payload = (res as { data?: { documentCount?: number } } | null)?.data;
  const count =
    (res as { documentCount?: number } | null)?.documentCount ??
    payload?.documentCount ??
    0;
  ```
- **상세**: 두 가지 응답 형태를 동시에 지원하는 임시 로직이 컴포넌트 내부에 인라인으로 존재. API 계층의 `reEmbedAll`이 이미 `unwrap`을 거치지 않아 raw `data`가 오는 상황. 유지보수 시 이 분기를 이해하는 데 불필요한 시간 소모.
- **제안**: `knowledge-bases.ts`의 `reEmbedAll`에서 envelope을 벗겨 `{ documentCount: number }` 타입으로 반환하거나, 다른 API 함수들처럼 `unwrap` 헬퍼 적용. 컴포넌트는 타입이 확정된 값만 사용

---

### **[INFO]** `?? null` 불필요한 이중 처리
- **위치**: `embedding.service.ts:127`
  ```ts
  let expectedDim: number | null = kb.embeddingDimension ?? null;
  ```
- **상세**: `kb.embeddingDimension`의 타입이 이미 `number | null`이므로 `?? null`은 아무 효과가 없음.
- **제안**: `let expectedDim = kb.embeddingDimension;`

---

### **[INFO]** 오류 메시지의 한/영 혼재
- **위치**: `embedding.service.ts:143`
  ```ts
  `... expected ${expectedDim}, got ${v.length}. KB 재임베딩이 필요합니다.`
  ```
- **상세**: 에러 메시지 앞부분은 영어, 끝부분은 한국어. 이 메시지는 로그에도 기록되고 `metadata.error`로 DB에도 저장됨. 운영 로그 검색 및 모니터링 일관성에 영향.
- **제안**: 영어로 통일하거나(`Re-embedding required.`), 에러 코드 기반 i18n을 적용. 최소한 로그용/사용자노출용을 분리

---

### **[INFO]** `type` 쿼리 파라미터 비검증
- **위치**: `llm-config.controller.ts:214`
  ```ts
  @Query('type') type?: string,
  ```
- **상세**: `type`이 `'chat' | 'embedding'` 외의 값이 오면 필터가 적용되지 않고 전체 목록이 반환됨. 오타 입력 시 무음 실패. 또한 서비스 계층이 아닌 컨트롤러에서 필터링 로직이 처리됨.
- **제안**: `@IsIn(['chat', 'embedding'])` 또는 `ParseEnumPipe`로 검증. 필터 로직은 서비스로 이동 고려

---

### **[INFO]** `reEmbedAll` 컨트롤러가 DTO 대신 plain object 반환
- **위치**: `knowledge-base.controller.ts:162~164`
  ```ts
  return { message: 'KB re-embedding started', documentCount };
  ```
- **상세**: `KbReEmbedAcceptedDto`를 선언했음에도 컨트롤러는 타입 없는 plain object를 반환. 다른 엔드포인트들이 DTO 인스턴스를 반환하는 패턴과 불일치.
- **제안**: `return { message: 'KB re-embedding started', documentCount } satisfies KbReEmbedAcceptedDto`로 타입 체크 강화, 또는 서비스에서 DTO를 직접 구성하여 반환

---

### **[INFO]** memory 파일 미완료 상태로 커밋
- **위치**: `memory/kb-embedding-model-selection.md` 마지막 줄
  ```md
  (작업 중. 완료 시 갱신.)
  ```
- **상세**: 작업 완료 후에도 갱신되지 않은 채 커밋됨. 이 디렉터리를 참조하는 다른 개발자(또는 미래의 AI agent)가 현재 상태를 오해할 수 있음.
- **제안**: 작업 완료 시점에 "완료" 상태로 갱신. 또한 `~/.claude/plans/wiggly-bouncing-rose.md` 경로는 로컬 머신 절대경로로, 저장소 내 상대경로나 PR 링크로 대체 권장

---

## 요약

전반적인 설계 방향은 명확하고 변경사항 간 일관성도 잘 유지되어 있다. DB 마이그레이션 → 엔티티 → 서비스 → 컨트롤러 → 프론트엔드 API 클라이언트까지의 흐름이 깔끔하며, 테스트 커버리지도 핵심 동작(차원 일관성 검증, 재임베딩 큐잉, 검색 그룹핑)을 잘 포함하고 있다. 주요 유지보수 부담은 두 가지에 집중된다: `SUPPORTED_DIMS`와 마이그레이션 파일 간의 수동 동기화 의존성(자동 검증 없음), 그리고 `search()` 메서드와 `[id]/page.tsx` 컴포넌트의 길이·책임 집중이다. 프론트엔드의 응답 envelope 이중 처리 패턴은 이미 기존 코드베이스의 "임시 계약"을 따르고 있어 이해 가능하나, 해당 임시 계약이 해소되기 전까지는 새 호출마다 같은 패턴이 반복되는 기술 부채로 작용할 수 있다.

## 위험도

**LOW** — 기능 결함이나 데이터 무결성 위험은 없으며, 대부분의 이슈는 리팩터링 기회 수준이다. `SUPPORTED_DIMS` 동기화 누락은 런타임 경고로 흘러가는 구조이나, 장기적으로 모델이 추가될 때 조용히 검색 누락이 발생할 수 있어 가장 먼저 개선할 항목이다.