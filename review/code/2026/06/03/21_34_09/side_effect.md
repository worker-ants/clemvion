# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `catalog-sync.spec.ts`의 `resolveRepoRoot()`가 테스트 실행 시 `execSync('git rev-parse --show-toplevel', ...)` 를 호출한다.
  - 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts` lines 429–437
  - 상세: 테스트 초기화(`describe` 블록 상단)에서 `git` 서브프로세스를 실행한다. CI/격리 환경에서 git이 없거나 worktree 외부에서 실행될 경우 fallback 경로(`join(__dirname, '../../../../../../../')`)로 전환되나, 이는 CI 컨테이너 내 패키지 배치에 따라 잘못된 경로를 참조할 수 있다. 부작용 자체는 읽기(stdout)만이고 `stdio: ['ignore', 'pipe', 'ignore']`로 stderr를 숨기므로 환경 오염은 없다.
  - 제안: `REPO_ROOT` 환경변수 인젝션 방식을 대안으로 고려할 수 있으나 현재 구현이 실용적으로 수용 가능한 수준이다. jest `setupFiles`에서 `process.env.REPO_ROOT`를 주입하면 git 서브프로세스 실행을 완전히 제거할 수 있다.

### 발견사항 2
- **[INFO]** `catalog-sync.spec.ts`는 `describe` 블록 최상단(모듈 로드 시점)에서 `loadCatalog()`를 호출하여 7개의 `.md` 파일을 `readFileSync`로 읽는다.
  - 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/catalog-sync.spec.ts` lines 586–587 (`const catalog = loadCatalog()`)
  - 상세: 파일시스템 I/O가 테스트 선언 단계에서 발생한다. 파일이 없으면 `readFileSync`가 throw되어 전체 `describe` 블록이 실패한다. 이는 파일 존재를 보장하는 구조이지만, `beforeAll`이 아닌 모듈 상단 실행이므로 jest 병렬 격리와 무관하게 동기적으로 FS에 접근한다. 의도된 설계로 보이며 실제 부작용(쓰기·삭제)은 없다.
  - 제안: `beforeAll(() => { catalog = loadCatalog() })`로 이동하면 jest 라이프사이클과 더 잘 정렬되지만 필수 변경은 아니다.

### 발견사항 3
- **[INFO]** `MAKESHOP_OPERATIONS_BY_RESOURCE`와 `SECTION_SCOPE`는 모듈 수준 상수다.
  - 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/index.ts` lines 1168–1197
  - 상세: 두 객체 모두 `const`이고 내용은 컴파일 타임에 확정된 읽기 전용 데이터다. `MAKESHOP_OPERATIONS_BY_RESOURCE`의 값 배열은 `readonly`로 선언되어 있어 런타임 변이가 타입 수준에서 차단된다. 전역 변수이나 불변이므로 공유 상태 오염 위험은 없다.
  - 제안: 현재 구조 유지 적절.

### 발견사항 4
- **[INFO]** `public-meta.ts`의 `buildMakeshopExtras()`는 `MAKESHOP_OPERATIONS_BY_RESOURCE`를 직접 참조하여 호출 시마다 새 객체를 생성한다.
  - 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/public-meta.ts` lines 1694–1709
  - 상세: 매 `GET /nodes/definitions` 요청마다 161개 operation을 map하는 연산이 발생한다. 주석에 "Cheap (pure map over compile-time data)"라고 명시하나, 반복 요청 시 GC 압력이 발생할 수 있다. 상태 변경은 없으며 순수 함수다.
  - 제안: 결과를 모듈 수준에서 `const PUBLIC_MAKESHOP_EXTRAS = buildMakeshopExtras()`로 한 번만 계산하면 호출 당 객체 생성을 제거할 수 있다. 필수 사항은 아니나 요청 빈도가 높다면 검토 가치 있음.

### 발견사항 5
- **[INFO]** `constraint-validator.ts`의 `validateMakeshopConstraints()`에서 exhaustive check 분기가 `throw new Error(...)`를 실행한다.
  - 위치: `/codebase/backend/src/nodes/integration/makeshop/metadata/constraint-validator.ts` lines 876–881
  - 상세: TypeScript 타입 시스템이 이 분기를 `never`로 처리하므로 정상 코드 경로에서는 도달 불가능하다. 런타임에서 예상치 못한 `kind`가 들어올 경우 호출자에게 예외를 던지는 것은 의도된 동작이며 적절하다. 부작용 없음.
  - 제안: 현재 구현 적절.

### 발견사항 6
- **[INFO]** 7개 섹션 파일(`benefit.ts`, `board.ts`, `cpik.ts`, `member.ts`, `order.ts`, `product.ts`, `shop.ts`)은 모두 순수 데이터 배열 선언이다.
  - 위치: 각 섹션 파일 전체
  - 상세: 모든 파일이 `import type`만 사용하고 런타임 import side-effect가 없다. 배열 리터럴로 구성되어 있어 모듈 로드 시 메모리 할당 외의 부작용은 없다.
  - 제안: 없음.

### 발견사항 7
- **[INFO]** `cpik.md`에서 `post-cpik_member-check`와 `post-cpik_member-login`의 scope가 `write`로 표기되어 있으나, `types.ts` 주석("CPIK member check/login POSTs are read-style")과 의미적으로 상충한다.
  - 위치: `/spec/conventions/makeshop-api-catalog/cpik.md` (행: `post-cpik_member-check`, `post-cpik_member-login`)
  - 상세: `types.ts`의 JSDoc("most POST rows are `scopeType: 'write'`, but the CPIK member check/login POSTs are read-style")에서 이 두 operation을 read-style로 언급하지만, catalog와 metadata 모두 `write`로 등록되어 있다. `catalog-sync.spec.ts`가 양방향 동기를 강제하므로 테스트는 통과하지만, 향후 OAuth scope를 read/write로 구분할 때 잘못된 권한으로 연결될 수 있다.
  - 제안: Phase 3(OAuth 구현) 전에 `post-cpik_member-check`/`post-cpik_member-login`의 `scopeType`을 `read`로 수정하거나, `types.ts` 주석에서 해당 언급을 제거하여 문서와 코드 간 불일치를 해소할 것. 현재는 테스트가 catalog-metadata 일치만 검증하므로 semantic correctness는 보장되지 않는다.

### 발견사항 8
- **[INFO]** `spec/conventions/makeshop-api-catalog/_overview.md`에서 `권한 (x-scope)` 컬럼이 삭제되었다.
  - 위치: `/spec/conventions/makeshop-api-catalog/_overview.md` §3 컬럼 정의 변경
  - 상세: 기존 `권한 (x-scope)` 컬럼(메이크샵 원본 권한 그룹명: 주문/상품/상점설정 등)이 `scope`(`read`/`write`) + `status` + `paginated` 3개 컬럼으로 교체됐다. 이 컬럼을 외부에서 참조하던 문서나 도구가 있다면 영향을 받는다. spec 디렉토리 내부 참조(다른 `.md` 파일들)는 직접 변경 대상에 포함되어 있어 정합성이 유지되나, 이 catalog를 파싱하는 외부 스크립트나 도구가 있다면 확인 필요.
  - 제안: 다른 doc 생성 스크립트나 파서가 `권한 (x-scope)` 컬럼을 직접 참조하는지 확인 후 업데이트.

---

## 요약

이번 변경은 Phase 0 메타데이터 레이어 도입으로, 신규 파일 추가 위주이며 기존 코드 시그니처·전역 상태·API 인터페이스를 변경하지 않는다. 모든 섹션 파일은 순수 데이터 배열이고, `index.ts`의 공개 함수(`findMakeshopOperation`, `listAllMakeshopOperations`, `scopeForOperation`)는 새로 추가된 순수 함수이므로 기존 호출자에 영향이 없다. `catalog-sync.spec.ts`가 테스트 실행 시 `execSync('git rev-parse --show-toplevel')`로 git 서브프로세스를 생성하고 `readFileSync`로 7개 `.md` 파일을 동기적으로 읽는 것은 테스트 범위 내의 의도된 파일시스템 읽기이며 쓰기/삭제는 없다. 주목할 의미적 불일치는 `post-cpik_member-check`/`post-cpik_member-login`의 `scopeType`이 `write`로 등록된 반면 `types.ts` 주석이 이를 "read-style"로 설명한다는 점으로, Phase 3 OAuth 구현 시 scope 오할당 위험이 있다.

## 위험도

LOW
