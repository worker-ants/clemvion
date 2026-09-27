# 신규 식별자 충돌 검토 — `spec/2-navigation/1-workflow-list.md` (impl-done)

## 조사 방법

- scope 델타(`spec/2-navigation/`): `1-workflow-list.md` 1개 파일, `origin/main` 대비 diff 직접 확인 (`git diff origin/main -- spec/2-navigation/1-workflow-list.md`).
- 구현 diff(25 파일/2223줄, `plan/in-progress/cross-workspace-refs.md`)는 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/cross-workspace-refs`)에서 직접 `git diff` / `grep` 으로 확인 — 이 검토가 실측한 신규 식별자의 1차 근거.
- 확인한 신규 식별자: 함수/타입 `assertReferenceInScope` · `throwInvalidReferences` · `InvalidReference`(`codebase/backend/src/common/utils/reference-in-scope.ts`), spec 신규 섹션 `데이터 모델 §1.1 참조의 소속`(`spec/1-data-model.md:57`), `data-flow/12-workspace.md` 신규 서브섹션 "본문 참조 id 도 저장 전에 소속을 본다", 그리고 target 문서가 추가한 `details[].field='folderId'` / `details[].field='parentId'` 주석.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 신규 식별자 충돌을 발견하지 못했다.

검토한 항목과 근거:

1. **요구사항 ID** — target 은 새 요구사항 ID(`NAV-WF-*` 류)를 도입하지 않는다. 기존 API 표 문구에 에러 상세만 보강했다.
2. **엔티티/타입명** — target diff 자체는 새 엔티티·DTO·인터페이스를 선언하지 않는다. target 이 참조하는 새 유틸 타입 `InvalidReference` / 함수 `assertReferenceInScope` · `throwInvalidReferences` (`codebase/backend/src/common/utils/reference-in-scope.ts`, 신규 파일)는 `git grep` 으로 사전 존재 여부를 확인한 결과 이전에 다른 의미로 쓰인 동명 식별자가 없다 — `nodes.service.ts` · `workflows.service.ts` · `edges.service.ts` · `triggers.service.ts` · `schedules.service.ts` · `alerts.service.ts` · `folders.service.ts` 전 호출부가 동일한 import 경로·시그니처로 일관되게 소비한다.
3. **API endpoint** — target 은 `POST /api/workflows` · `PATCH /api/workflows/:id` · `POST /api/folders` · `PATCH /api/folders/:id` 기존 4개 endpoint 의 설명 문구만 보강했고 새 endpoint(method+path)를 추가하지 않았다. `git diff` 로 대조 결과 표의 method/path 행 자체는 변경 없음을 확인.
4. **이벤트/메시지명** — 이번 변경은 webhook/queue/sse 이벤트를 도입하지 않는다 (범위 밖).
5. **환경변수·설정키** — 신규 ENV/config key 없음.
6. **파일 경로** — target 문서 경로(`spec/2-navigation/1-workflow-list.md`) 자체는 기존 파일이며 변경이 아니다. 관련 신규 코드 파일(`codebase/backend/src/common/utils/reference-in-scope.ts`, `reference-in-scope.spec.ts`)은 `codebase/backend/src/common/utils/` 기존 컨벤션(`omit-undefined.ts` 등과 동일 디렉터리·네이밍 패턴)을 따르며 기존 파일과 겹치지 않는다(둘 다 `new file mode` 로 신설).

교차 확인한 세부 항목 — 잠재 충돌 후보였으나 실측으로 기각:

- `details[].field='folderId'` / `field='parentId'` — 코드(`workflows.service.ts:283-296`, `folders.service.ts:149-160`)의 실제 `field` 문자열과 정확히 일치. 사전에 다른 의미로 이 필드명을 쓴 `VALIDATION_ERROR` 자리는 없음(과거엔 flat-message 였고 `details[]` 자체가 신설).
- `데이터 모델 §1.1 참조의 소속` 신규 앵커(`#11-참조의-소속`) — `spec/1-data-model.md` 전체 헤더 목록을 열거해 기존 `1.1` 앵커나 동일 슬러그 충돌이 없음을 확인.
- `MODEL_CONFIG_NOT_FOUND` / `AUTH_CONFIG_NOT_FOUND` / `INVALID_FIELD` / `VALIDATION_ERROR` 에러 코드 — 모두 기존 코드 재사용이며, 코드 주석 자체가 "다른 자리다"·"이 모듈 고유의" 식으로 의도적 구분을 이미 명시하고 있어 새로 충돌을 만들지 않는다.
- `spec/data-flow/12-workspace.md` — 기존 파일에 신규 서브섹션만 추가(파일 자체는 사전 존재, 경로 충돌 아님).

## 요약

target(`spec/2-navigation/1-workflow-list.md`)의 이번 변경은 기존 API endpoint 4개의 설명 보강과 `pending_plans` 항목 추가, 그리고 신규 cross-reference(`데이터 모델 §1.1`)뿐이며 새 요구사항 ID·엔티티/타입명·endpoint·이벤트명·환경변수·파일 경로를 도입하지 않는다. 이 변경이 의존하는 신규 코드 식별자(`assertReferenceInScope` 등)와 신규 spec 섹션(`§1.1 참조의 소속`)도 워킹트리 실측(diff + grep)으로 기존 사용처와의 의미 충돌이 없음을 확인했다. 신규 식별자 충돌 관점에서 이 변경은 안전하다.

## 위험도

NONE
