## 발견사항

### [INFO] `execute()` 내 KB 메타데이터 중복 조회
- **위치**: `kb-tool-provider.ts` — `execute()` 메서드 내 `knowledgeBaseService.findById()` 호출
- **상세**: `buildTools()`에서 이미 모든 KB 메타를 조회(`Promise.allSettled`)한 후, `execute()`에서 KB name을 얻기 위해 동일 KB를 다시 `findById()` 호출한다. 멀티턴 시나리오에서 KB tool이 여러 번 호출되면 (`maxToolCalls` 범위 내) 같은 KB row를 반복 조회하게 된다.
- **제안**: `buildTools()` 결과를 `Map<kbId, kb.name>` 형태로 `ProviderBuildCtx` 또는 provider 인스턴스 캐시에 저장해 `execute()` 시점에 재사용한다. 단, KB 수가 통상 소규모(< 10)이고 이미 `try/catch`로 graceful 처리되어 있어 실운영 영향은 낮다.

### [INFO] 이번 diff의 DB 변경사항 없음
- **위치**: `ai-agent.handler.ts` — `turnRagAcc` 추가 구간 전체
- **상세**: `turnRagAcc`는 순수 in-memory 누적기(`RagAccumulator`)로, DB 쿼리를 추가하지 않는다. `pushSources()` / `pushDiagnostic()` 호출도 메모리 연산만 수행한다.
- **제안**: 해당 없음.

### [INFO] kb-tool-provider.ts 변경사항은 포매팅 전용
- **위치**: `kb-tool-provider.ts` diff 전체
- **상세**: `execute()` 시그니처의 줄바꿈 리포맷만 적용됨. DB 로직 변경 없음.

---

## 요약

이번 변경은 turn 단위 RAG delta 추적을 위한 in-memory 누적기(`turnRagAcc`) 추가와 프론트엔드 UI 연동이 주된 내용으로, 신규 DB 쿼리·스키마 변경·트랜잭션·마이그레이션이 전혀 없다. 데이터베이스 관점의 유일한 주목 지점은 `KbToolProvider.execute()`의 KB 메타 중복 조회 패턴인데, 이는 이번 diff 이전부터 존재하던 코드이며 KB 수가 소규모인 운영 환경에서는 실질적 영향이 미미하다.

## 위험도
**LOW**