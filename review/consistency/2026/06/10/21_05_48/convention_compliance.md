# Convention Compliance Review

**검토 대상**: perf 백로그 01 최종 상태 재검증  
**diff-base**: origin/main  
**검토 모드**: 구현 완료 후 검토 (--impl-done)  
**검토 일시**: 2026-06-10

---

## 발견사항

### [INFO] `deleteMany` 반환 형태 — `spec/conventions/node-output.md` Principle 0 와 무관하나 직접 API 출력 형식 검토

- **target 위치**: `codebase/backend/src/common/services/s3.service.ts` — `deleteMany` 반환 `Promise<{ errored: string[] }>`
- **위반 규약**: `spec/conventions/node-output.md` Principle 0, Principle 3.2 (출력 포맷 규약). 해당 메서드는 노드 핸들러가 아니라 서비스 레이어이므로 node-output 규약의 직접 적용 대상은 아니다.
- **상세**: `deleteMany` 는 `{ errored: string[] }` 을 반환한다. 이는 node-output convention 범위 밖이지만, 호출 측(`knowledge-base.service.ts`)이 `errored` 를 warn 처리하는 "best-effort" 의미론은 `spec/conventions/node-output.md §3.1 Pre-flight/Runtime 에러 분류` 의 런타임 부분 실패 처리 정책과 정렬되어 있다. `output.error` 표준 컨트랙트(`code`, `message`, `details`)를 따르지 않지만, 이 메서드는 노드 핸들러가 아니므로 위반이 아니다.
- **제안**: 현행대로 유지. 다만 코드 주석에 "best-effort warn 의미 — node-output Principle 3.1 의 runtime 에러 처리와 의미 동등" 임을 이미 명시하고 있어 추적 가능하다.

---

### [INFO] `resolveMaxNodeIterations` / `resolveParallelEngineFlag` 메서드 명명

- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — private 메서드 `resolveMaxNodeIterations`, `resolveParallelEngineFlag`; 필드 `maxNodeIterationsOnce`, `parallelEngineFlagOnce`
- **위반 규약**: `spec/conventions/` 에 메서드 명명 규약을 별도 명문화한 파일은 없다. CLAUDE.md 및 `swagger.md` 는 API endpoint / DTO 명명만 다룬다.
- **상세**: `resolve*` 접두어 + `*Once` 필드명 조합은 프로젝트 내 기존 패턴(`resolveExecutionRunWorkerConcurrency`)과 일관된다. 코드 주석도 "read-once 규율 — naming W2" 로 내부 참조를 명시한다. 규약 위반 없음.
- **제안**: 변경 불필요.

---

### [INFO] `selectSortedNodeResults` 함수 — 프론트엔드 스토어 내보내기 규약

- **target 위치**: `codebase/frontend/src/lib/stores/execution-store.ts` (diff 에 일부만 표시됨) 및 소비 측 (`run-results-drawer.tsx`, `use-expression-context.ts`, `preview.tsx`, 테스트 파일들)
- **위반 규약**: `spec/conventions/` 에 프론트엔드 스토어 export 명명 규약이 별도 명문화된 파일은 없다.
- **상세**: `selectSortedNodeResults` 는 Zustand selector 패턴의 `select*` prefix 를 따른다. `findReconcilableOptimisticIdx` 등 기존 export 와 동일 패턴이다. 규약 위반 없음.
- **제안**: 변경 불필요.

---

### [INFO] 테스트 describe 그룹 명명 — `(W3a)`, `(W3b)`, `(W3c)` 주석 표기

- **target 위치**: `dashboard.service.spec.ts:330`, `execution-engine.service.spec.ts:749`, `workflows.service.spec.ts:1447`
- **위반 규약**: `spec/conventions/` 에 테스트 describe 명명 규약 없음. CLAUDE.md 는 `spec/conventions/<name>.md` 형식의 정식 규약 외 테스트 명명을 직접 규정하지 않는다.
- **상세**: `W3a`, `W3b`, `W3c` 는 내부 리뷰 라운드 추적 식별자로 사용되고 있다. 이 패턴은 코드베이스에서 일관성 있게 사용 중이며(기존 `W2`, `W1` 도 동일 패턴) conventions 에 명문화된 금지 항목이 아니다.
- **제안**: 변경 불필요.

---

### [INFO] `workflows.service.ts` — `manager.insert` 사용과 `swagger.md` DTO 명명 무관

- **target 위치**: `codebase/backend/src/modules/workflows/workflows.service.ts` — `QueryDeepPartialEntity<Node>[]` 타입 단언
- **위반 규약**: `spec/conventions/swagger.md` §5-1 응답 DTO 위치 규약은 서비스 레이어 내부 TypeORM insert 타입 단언에는 적용되지 않는다.
- **상세**: `QueryDeepPartialEntity` 는 TypeORM 내부 타입으로, DTO 명명 규약과 무관하다. 코드 주석에 "JSONB(Record) 컬럼은 TypeORM 의 QueryDeepPartialEntity 인덱스-시그니처 quirk 로 단언이 필요" 라고 설명되어 있어 추적 가능하다. 규약 위반 없음.
- **제안**: 변경 불필요.

---

### [INFO] 코드 주석의 `spec/` 경로 인라인 참조 형식

- **target 위치**: 
  - `execution-engine.service.ts:831` — `spec §1.6/§11`
  - `dashboard.service.ts:480` — `spec/2-navigation/0-dashboard.md §3·§7`
- **위반 규약**: CLAUDE.md "정보 저장 위치 (단일 진실 원칙)" 에서 spec 참조는 `spec/<영역>/*.md` 파일을 단일 진실로 지정하고 있다.
- **상세**: 코드 주석 내의 spec 경로 인라인 참조(`spec/2-navigation/0-dashboard.md §3·§7`)는 정식 규약 문서에 명시된 형식을 준수한다. `spec §1.6/§11` 는 전체 경로 없이 섹션만 참조하는 약식 표기지만, 이는 구현 코드 주석의 관용 범위 내에 있다. 규약 위반은 아니나 일관성을 위해 full path 를 사용하는 것이 권장된다.
- **제안**: `spec §1.6/§11` 를 `spec/5-system/4-execution-engine.md §1.6/§11` 형식으로 갱신 권장 (INFO 수준).

---

## 요약

검토 대상 diff 는 `codebase/` 경로 내 구현 파일들(서비스, 테스트, 스토어)로 구성된다. `spec/conventions/` 의 정식 규약 — swagger DTO 명명 패턴, node-output 5필드 invariant, error-code UPPER_SNAKE_CASE 규칙, spec-impl frontmatter 의무 등 — 을 직접 위반하는 항목은 없다. 발견사항은 모두 INFO 수준이며, 대부분은 "규약 적용 대상 범위 밖" 임을 확인하는 내용이다. 특히 `deleteMany` 의 best-effort 에러 수집 패턴은 node-output §3.1 의 런타임 에러 처리 의미론과 정렬되어 있으며, `selectSortedNodeResults` / `resolve*Once` 패턴은 기존 코드베이스 관용과 일치한다. 규약 갱신이 필요한 항목은 없다.

---

## 위험도

NONE
