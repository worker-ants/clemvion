# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] ROOT_ENTITIES 전용 파일 분리 — 올바른 SRP 적용
- 위치: `/codebase/backend/src/database/root-entities.ts` (신규), `app.module.ts` (변경)
- 상세: `app.module.ts` 에 인라인으로 정의되어 있던 `ROOT_ENTITIES` 배열을 `src/database/root-entities.ts` 로 추출한 것은 단일 책임 원칙(SRP) 관점에서 적절하다. `app.module.ts` 는 DI 모듈 조합 책임만 남기고, entity 목록 관리 책임은 별도 파일로 분리되었다. `app.module.ts` 에서 `export { ROOT_ENTITIES } from './database/root-entities'` re-export 를 유지해 기존 import 사이트(app.module.spec 등) 하위 호환도 보장했다.
- 제안: 변경 방향 긍정적. 추가 조치 불필요.

---

### [INFO] EvalCliModule — 경량 DI 컨텍스트 분리로 모듈 경계 명확화
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: `KnowledgeBaseModule` 전체(BullMQ 큐·프로세서 포함) 를 부팅하지 않고, 검색 경로(`RagSearchService`/`RerankService`)와 `LlmModule`/`RerankConfigModule` 만 포함한 CLI 전용 모듈을 신규 정의했다. "스크립트는 AppModule 미부팅" 관례와 일치하며, 운영 worker 를 깨우지 않는다는 설계 의도가 명확하다.
- 제안: 변경 방향 긍정적.

---

### [WARNING] EvalCliModule 이 ROOT_ENTITIES 전체를 등록 — 과도한 entity 의존
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` (line `entities: [...ROOT_ENTITIES]`)
- 상세: EvalCliModule 은 검색(`RagSearchService`)에만 의존하며, 실제 검색 경로가 raw SQL 로 `document_chunk`·`knowledge_base` 에 직접 접근하므로 ORM 관계 메타데이터가 엄밀히 필요한 entity 수는 매우 적다. 주석에 "LlmConfig→Workspace 등 관계 타깃 누락 방지를 위해 전체 등록" 이라 기술했으나, 이는 TypeORM 관계 메타데이터 로딩 의존성을 명시적으로 관리하지 않아 생긴 광범위한 안전장치다. 장기적으로 eval CLI 가 추가 entity 를 의도치 않게 사용하는 것을 막을 경계가 없다.
- 제안: 단기적으로 현재 구조를 유지해도 큐/프로세서가 미인스턴스화되므로 운영 부작용은 없다. 중장기에는 `EVAL_CLI_ENTITIES` 를 별도로 선언해 eval 에 필요한 최소 entity 집합만 등록하는 방향이 결합도를 낮춘다.

---

### [WARNING] generate-golden-set.ts 에서 raw SQL ORDER BY 에 동적 값 인터폴레이션
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` line 194–203
- 상세: `ORDER BY ${orderBy}` 에서 `orderBy` 는 `order === 'id' ? 'id' : 'random()'` 로 2가지 상수값 중 하나로 분기되므로 실질적 SQL injection 위험은 없다. 그러나 이 패턴 자체가 미래 코드 변경 시 위험하며, TypeORM QueryBuilder 나 조건별 쿼리 분기로 개선할 여지가 있다.
- 제안: `if (order === 'random') { ...ORDER BY random()... } else { ...ORDER BY id... }` 형태로 쿼리를 조건별로 분기하거나, 화이트리스트 const 매핑을 명시해 패턴 의도를 코드로 보증하는 것이 권장된다.

---

### [INFO] eval 레이어의 레이어 책임 분리 — 순수 지표 로직과 I/O 분리 적절
- 위치: `src/modules/knowledge-base/eval/retrieval-metrics.ts`, `src/scripts/eval-retrieval.ts`
- 상세: 검색 지표 계산(`retrieval-metrics.ts`) 과 CLI I/O·NestJS 부팅·파일 읽기/쓰기(`eval-retrieval.ts`) 가 명확하게 분리되어 있다. `retrieval-metrics.ts` 는 순수 함수 모음이고, 단위 테스트가 외부 의존 없이 작성될 수 있다. 레이어 책임 분리·테스트 가용성 면에서 모범적이다.
- 제안: 변경 방향 긍정적.

---

### [INFO] 언어 감지 모듈의 단일 책임 및 무의존성
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts`
- 상세: 외부 의존 없이 순수 정규식 로직으로 한글/라틴 비율 기반 언어 감지를 구현했다. 단일 함수 파일로 테스트 및 교체가 용이하다. 다만 이 파일이 `knowledge-base/eval/` 하위에 위치해 있는데, 범용 언어 감지 유틸리티이므로 `common/utils/` 나 `common/lang/` 위치가 더 자연스러울 수 있다.
- 제안: 현재 eval 전용으로 사용된다면 위치 무방. 미래에 다른 모듈에서 재사용 시 `common/utils/lang-detect.ts` 로 이동 고려.

---

### [INFO] CLI 파싱 로직 중복 — parseCliFlag 함수가 두 스크립트에 복사
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` (line 40–48), `codebase/backend/src/scripts/eval-retrieval.ts` (동일 구현)
- 상세: 두 스크립트에서 동일한 `parseCliFlag` 함수가 복사되어 존재한다. DRY 원칙 위반이며, CLI arg 파싱 로직 변경 시 두 파일을 모두 수정해야 한다.
- 제안: `src/scripts/cli-utils.ts` 등 공통 유틸 모듈로 추출해 두 스크립트에서 import 하도록 개선. 스크립트 파일 수가 현재 2개이므로 즉시 차단 수준은 아니나 후속 스크립트 추가 시 부채가 된다.

---

### [INFO] GoldenSetMeta.version 타입이 리터럴 1 로 고정
- 위치: `codebase/backend/src/modules/knowledge-base/eval/golden-set.types.ts` (`version: 1;`)
- 상세: `GoldenSetMeta.version` 타입을 `1` 리터럴로 정의했다. 스키마 버전 진화 시 `version: 1 | 2 | ...` 로 확장하거나 `number` 로 변경해야 하므로 breaking change 위험이 있다. 설계 의도(버전 관리 명시)는 이해되나, 실질적 버전 분기 로직이 구현 없이 타입만 고정되어 있다.
- 제안: 후속 Phase 에서 버전 분기 로직 추가 시 `version: number` 로 완화하거나 versioned union type 패턴을 적용하는 것을 검토.

---

### [INFO] eval 디렉토리가 knowledge-base 모듈 하위에 위치 — 모듈 경계 관련 논의 포인트
- 위치: `codebase/backend/src/modules/knowledge-base/eval/`
- 상세: eval 관련 타입·지표·CLI 모듈이 `knowledge-base` 모듈 서브디렉토리에 위치한다. 현재는 `RagSearchService` 에 직접 의존하므로 자연스러운 위치이나, 향후 eval 이 다른 검색 서비스나 외부 리트리버도 평가하게 되면 `knowledge-base` 모듈 경계를 벗어날 수 있다.
- 제안: 현재 범위에서는 적절한 위치. 확장 시 `src/modules/eval/` 독립 모듈로 분리 고려.

---

## 요약

이번 변경의 핵심은 (1) RAG 평가 하네스 신규 레이어 도입과 (2) `ROOT_ENTITIES` 분리다. 아키텍처 관점에서 두 변경 모두 의도가 명확하고 기존 레이어 경계를 잘 준수하고 있다. `EvalCliModule` 이 운영 워커를 격리한 경량 DI 컨텍스트를 별도로 정의한 것, 순수 지표 로직과 CLI I/O 를 명확히 분리한 것은 레이어 책임 분리·테스트 가용성 면에서 우수하다. 주요 개선 포인트는 `EvalCliModule` 의 `ROOT_ENTITIES` 전체 등록(불필요한 의존 범위), 두 스크립트 간 `parseCliFlag` 중복, raw SQL 동적 인터폴레이션 패턴으로 모두 단기 차단 수준은 아니나 중장기 관리 부채다.

## 위험도

LOW
