# 유지보수성(Maintainability) 리뷰

## 발견사항

### WARNING W-1: `findAccessible` 의 boolean 플래그 파라미터 — 이중 모드 함수
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts` — `findAccessible(id, workspaceId, userId, requireOwner: boolean)`
- **상세**: `requireOwner` 플래그 하나로 "소유자 전용" / "조회 가능" 두 가지 접근 정책을 분기한다. 함수 시그니처만으로는 호출 측에서 의미를 파악하기 어렵고(`findAccessible(..., true)` vs `findAccessible(..., false)`), 내부에 `if (requireOwner) { ... } else if (!isOwner && ...) { ... }` 의 두 단계 중첩 분기가 생긴다. 향후 접근 정책이 세분화될 때 플래그 값 조합이 폭발하는 전형적인 boolean-flag 냄새다.
- **제안**: 두 접근 방식을 별도 private 메서드(`findAsOwner`, `findAsAccessible`)로 분리하거나, `accessMode: 'owner' | 'readable'` 형태의 리터럴 유니온 타입으로 교체하면 호출부에서 의도가 명확히 드러난다.

### WARNING W-2: `saveUnique` 내 `QueryFailedError` 코드 추출 패턴 — 타입 단언 중복
- **위치**: `workflow-test-datasets.service.ts` — `saveUnique` 메서드, `(err as { code?: string }).code === '23505'`
- **상세**: TypeORM `QueryFailedError` 에서 DB 에러 코드를 꺼내기 위해 `err instanceof QueryFailedError` 체크 이후 다시 `(err as { code?: string })` 타입 단언을 한다. 이는 프로젝트 전반에 동일 패턴이 반복될 때마다 단언 방식이 달라질 위험이 있다. 또한 `'23505'` 는 파일 안에서 한 번만 나타나지만 프로젝트 수준에서 매직 스트링으로 취급해야 한다.
- **제안**: `isUniqueConstraintError(err: unknown): boolean` 유틸 함수를 공통 모듈에 추출하고, `PG_UNIQUE_VIOLATION = '23505'` 상수를 정의한다.

### WARNING W-3: `copyName` 매직 넘버 — `255`와 `' (Copy)'` 분산
- **위치**: `workflow-test-datasets.service.ts` — `copyName` 메서드 (`const suffix = ' (Copy)'`, `const max = 255 - suffix.length`)
- **상세**: `255`는 DB 컬럼 `VARCHAR(255)` 및 DTO `MaxLength(255)`, SQL 스키마와 세 곳에 분산돼 있다. 상수 하나로 관리하지 않으면 길이 변경 시 누락이 생긴다. 또한 ` (Copy)` suffix가 하드코딩돼 있어 국제화나 suffix 변경 시 서비스 코드를 직접 수정해야 한다.
- **제안**: `DATASET_NAME_MAX_LENGTH = 255`, `CLONE_SUFFIX = ' (Copy)'` 상수를 entity 파일 또는 공통 상수 파일에 정의하고 세 곳 모두 참조한다.

### INFO I-1: `EditorToolbar` 컴포넌트 상태 변수 증가 — 단일 컴포넌트 책임 비대화
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`
- **상세**: 이번 변경으로 `datasetPickerOpen`, `saveFormOpen`, `datasetName`, `shareWorkspace`, `savingDataset` 5개 상태가 추가됐다. 기존에 히스토리 관련 상태, 실행 상태, 삭제 확인 상태 등이 이미 있어 단일 컴포넌트에 상태가 계속 누적되고 있다. 함수도 `handleSaveDataset`, `handleCloneDataset`, `handleDeleteDataset`, `handleLoadDataset`, `refreshDatasets` 5개가 추가됐다.
- **제안**: 데이터셋 관련 상태와 핸들러를 `useTestDatasets(workflowId, ...)` 커스텀 훅으로 추출하면 툴바 컴포넌트는 UI 렌더링에만 집중할 수 있다. 또는 데이터셋 패널 자체를 `<DatasetPanel>` 서브컴포넌트로 분리하는 방안도 고려할 수 있다.

### INFO I-2: e2e 테스트 내 `create` 헬퍼가 `workflowId` 클로저 의존
- **위치**: `codebase/backend/test/workflow-test-dataset.e2e-spec.ts` — `const create = (token, body, ws = workspaceId) => ...`
- **상세**: `create` 헬퍼가 `workflowId`를 클로저로 캡처한다. `beforeAll` 이 완료되기 전에 `create` 가 호출되면 `workflowId`는 `undefined`다. 현재는 `beforeAll` 완료 후에만 `it` 블록이 실행되므로 동작상 문제없으나, 다른 `workflowId`를 써야 하는 케이스(IDOR 테스트 E에서 실제로 `workflowId`가 고정됨)에서 헬퍼를 재사용할 수 없다. E 테스트에서 `create` 헬퍼가 호출되지만 다른 워크플로우에 대한 접근을 시뮬레이션하지 못하므로 테스트 의도가 불명확하다.
- **제안**: `create(token, body, workflowId = ..., ws = workspaceId)` 형태로 `workflowId`를 명시적 파라미터로 추가하거나, 헬퍼 팩토리 패턴으로 전환한다.

### INFO I-3: 프론트엔드 인라인 JSX 내 중복 Tailwind 클래스 블록
- **위치**: `editor-toolbar.tsx` — 데이터셋 목록 패널 (약 670~720행 영역) 및 히스토리 피커 영역
- **상세**: 데이터셋 목록 패널(`datasetPickerOpen && ...`)과 히스토리 피커 패널(`historyPickerOpen && ...`)이 동일한 외곽 구조(`mb-3 max-h-44 overflow-y-auto rounded-md border border-[hsl(var(--border))]`)와 로딩/빈 상태 처리 패턴을 공유한다. 현재는 두 블록이 분리된 조건부 렌더링이라 JSX가 시각적으로 유사한 블록을 반복한다.
- **제안**: 공통 로딩/빈 상태 처리 래퍼를 `<PickerPanel isLoading items={...} emptyLabel={...}>` 형태의 서브컴포넌트로 추출하면 두 패널의 구조 변경 시 한 곳만 수정하면 된다.

### INFO I-4: `workflow-test-datasets.service.ts` 내 두 `import from 'typeorm'` 문 분리
- **위치**: `workflow-test-datasets.service.ts` 상단 import 구역
- **상세**: `import { InjectRepository } from '@nestjs/typeorm'` / `import { Repository } from 'typeorm'` / `import { QueryFailedError } from 'typeorm'` 로 `typeorm` 패키지로부터의 import가 두 줄로 분리돼 있다. `Repository`와 `QueryFailedError`가 같은 패키지인데 별도 import 문이다.
- **제안**: `import { Repository, QueryFailedError } from 'typeorm'`으로 합쳐 파일 상단 import 가독성을 높인다. (린트 규칙이 있다면 자동 수정 대상.)

### INFO I-5: SQL 마이그레이션 DOWN 스크립트 주석 처리
- **위치**: `codebase/backend/migrations/V097__workflow_test_dataset.sql` 마지막 행 `-- DROP TABLE IF EXISTS workflow_test_dataset;`
- **상세**: 다운 마이그레이션을 주석으로만 남기는 패턴은 프로젝트 전반에 일관된 관행이면 문제없으나, 이 파일만 봐서는 DOWN 스크립트가 의도적으로 비활성화된 것인지 실수인지 구별이 어렵다. 다른 마이그레이션 파일이 같은 패턴을 따른다면 일관성 있는 관행이다.
- **제안**: 기존 마이그레이션 파일들이 같은 패턴(`-- DOWN:`)을 쓴다면 무시 가능. 다르다면 패턴을 통일하거나 명시적 주석으로 "Flyway managed; down migration is intentionally commented" 를 달아 의도를 명확히 한다.

---

## 요약

전체적으로 코드는 깔끔하고 NestJS 모듈 패턴을 일관되게 따르며, 각 파일의 책임이 명확히 분리돼 있다. SQL 마이그레이션·엔티티·DTO·서비스·컨트롤러·e2e 테스트까지 레이어가 고르게 갖춰져 있고 각 컴포넌트의 docstring이 충실하다. 다만 서비스 계층에서는 `findAccessible`의 boolean 플래그 파라미터(W-1)와 `QueryFailedError` 코드 추출 패턴 반복(W-2), `copyName`의 매직 넘버 분산(W-3)이 향후 유지보수 부담을 높일 수 있다. 프론트엔드 `EditorToolbar`는 이번 추가로 단일 컴포넌트의 상태와 핸들러가 눈에 띄게 증가했으며(I-1), 데이터셋·히스토리 패널의 JSX 패턴 중복(I-3)이 있어 점진적 서브컴포넌트 분리를 권장한다. Critical 수준의 문제는 없으며 주요 리스크는 WARNING 등급 두 건이다.

## 위험도

LOW
