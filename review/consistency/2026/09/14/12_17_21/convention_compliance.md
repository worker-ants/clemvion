# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
- `spec/conventions/**` 자체의 델타는 **0개 파일** — 이 브랜치(`trigger-canary-hardening`)는 conventions 문서를 바꾸지 않았다. 이는 정상이며 그 자체로 CRITICAL 사유가 아니다.
- 실제 코드 델타는 `git diff origin/main...HEAD -- codebase/` 기준 **6개 파일 / 약 380줄 net**(신규 guard 2파일 + 기존 spec/e2e 4파일 수정) 이다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)를 절대경로로 직접 열어 diff 전문과 관련 conventions 원문(`secret-store.md`, `review-citations.md`)을 대조했다.
- 신규 파일: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`, `trigger-secret-columns.spec.ts`. 수정: `trigger-workflow-ref.spec.ts`, `chat-channel-trigger-create.e2e-spec.ts`, `schedule-trigger.e2e-spec.ts`, `trigger-workflow-ref.e2e-spec.ts`.

## 발견사항

이번 diff 범위에서 `spec/conventions/**` 위반으로 볼 CRITICAL/WARNING 은 발견하지 못했다. 근거는 다음과 같다.

- **명명 규약**: 신규 `trigger-secret-columns-guard.ts` + `trigger-secret-columns.spec.ts` 쌍은 같은 디렉토리의 기존 가드들(`redis-fail-open-catalog-guard.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`, `swagger-dto-contract-guard.ts`/`.spec.ts` 등)과 동일한 `<name>-guard.ts` + `<name>.spec.ts` 페어링 패턴을 그대로 따른다. `spec/conventions/` 안에 이 페어링을 성문화한 별도 규약 문서는 없으나(관례일 뿐 정식 규약 아님), 기존 관례와의 이탈도 없다.
- **금지 항목(정규식 vs AST)**: 신규 가드는 JSDoc 안에서 정규식이 아니라 TypeScript AST(`ts.createSourceFile` + `forEachChild`)로 상수 배열을 읽도록 명시적으로 설계했고, 그 이유(주석 안의 문자열이 정규식에 오탐되는 문제)까지 코드에 남겼다. 이는 `redis-fail-open-catalog-guard.ts` 등 자매 가드가 세운 "정밀 파서 우선" 관례와 일치하며 어떤 conventions 문서의 금지 패턴도 재발시키지 않는다.
- **`review-citations.md` §2 준수**: diff 안의 모든 리뷰 인용은 `review/code/2026/09/14/11_27_40`, `review/code/2026/09/14/11_52_13`, `review/code/2026/09/10/16_26_57` 등 **날짜 포함 전체 경로** 형태(§2 표의 "권장" 등급)만 사용한다. bare `hh_mm_ss` 형태(예: 단독 `11_27_40`)는 diff 전체에서 0건 — grep 으로 직접 확인했다. §2 가 명시적으로 금지하는 패턴을 도입하지 않았다.
- **`secret-store.md` §R4 (Trigger FK 미설정)와의 정합**: `trigger-workflow-ref.e2e-spec.ts` 의 신규 `afterAll` 주석은 "이것은 테스트 인프라 한정 판단이고 `secret-store.md §R4` 와 충돌하지 않는다 — R4 가 요구하는 explicit cleanup 은 프로덕션 삭제 경로(`remove()` → `deleteByPrefix`)이고 그 경로는 R4 대로 동작한다"고 명시한다. `spec/conventions/secret-store.md` R4 본문과 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 실제 `remove()`(852행 부근) → `secrets.deleteByPrefix(...)` 호출을 대조한 결과, 이 서술은 정확하다. R4 자체가 이 diff 로 바뀌지 않았고, diff 는 R4 의 의미를 정확히 인용해 자신의 테스트 인프라 판단 범위를 R4 의 "프로덕션 삭제 경로" 범위와 명시적으로 분리했다 — 오히려 §R4 소비 사례로 적합하다.
  - (참고, 이 PR 범위 밖) `secret-store.md` R4 본문 자체는 "`TriggersService.delete()` 가 진다"라고 메서드명을 적고 있으나 실제 코드 메서드명은 `remove()` 다(`git blame` 확인 결과 R4 문장은 2026-05-29 커밋 — 이 브랜치보다 훨씬 이전부터 존재하는 기존 drift). 이번 diff 가 만든 문제가 아니며, 이번 diff 의 신규 주석은 오히려 정확한 메서드명(`remove()`)을 쓰고 있어 이 drift 를 악화시키지 않는다. 정정이 필요하면 별도 `project-planner` 턴에서 `secret-store.md` 를 좁게 고치는 편이 적절하다 — 이번 diff 의 결함으로 보고하지 않는다.
- **문서 구조/API 문서 규약**: 이번 diff 는 신규 API endpoint·DTO·audit action·error code 를 하나도 추가하지 않는다(순수 테스트/정적 가드 추가 + 기존 e2e 케이스 보강). 따라서 `swagger.md`(DTO/데코레이터 명명), `audit-actions.md`, `error-codes.md`, `node-output.md` 등 출력 포맷 계열 conventions 가 규율하는 표면에 변경이 없다 — 위반 가능 표면 자체가 이번 diff 에 없다.

## 요약

이번 브랜치의 `spec/conventions/**` 델타는 0이며, 실제 코드 변경(6파일)은 트리거 비밀 컬럼 3중 사본 정합을 지키는 정적 AST 가드 신설과 `TriggerDto.workflow` e2e 커버리지 보강, 관련 주석 정리에 국한된다. 신규 가드의 명명·구현 방식(정밀 파서, `-guard.ts`/`.spec.ts` 페어링)은 저장소의 기존 repo-guards 관례와 일치하고, 코드 주석의 리뷰 인용은 `review-citations.md` §2 가 요구하는 날짜 포함 형식만 사용했으며, `secret_store` 정리 책임에 대한 신규 주석은 `secret-store.md §R4` 를 정확히 인용해 스코프를 분리했다. 새 API 표면이 없어 출력 포맷·API 문서 계열 규약이 적용될 지점도 없다. 부수적으로 `secret-store.md` R4 의 메서드명 표기(`delete()` vs 실제 `remove()`)가 이 브랜치 이전부터 존재하는 drift 임을 확인했으나, 이번 diff 의 책임 범위 밖이라 판단해 CRITICAL/WARNING 으로 올리지 않았다.

## 위험도
NONE
