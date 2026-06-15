# Scope Review — Workflow Test Dataset (exec-test-dataset)

## 발견사항

### 파일 21: plan/complete/form-validation-minmax-pattern.md
- **[WARNING]** 무관한 파일 수정 — 현재 PR(§2.2 테스트 데이터셋) 과 관련 없는 완료 plan 파일에 `spec_impact` frontmatter 가 추가됨
  - 위치: `/plan/complete/form-validation-minmax-pattern.md` — frontmatter 에 `spec_impact` 3줄 추가
  - 상세: `form-validation-minmax-pattern-81db34` worktree 에서 완료된 A-1 plan 파일이다. 이번 변경의 의도(exec-test-dataset §2.2 구현)와 완전히 무관하다. 해당 필드가 이전 PR 에서 누락되었다면 그 PR 의 후속 커밋이나 별도 패치로 처리되어야 한다.
  - 제안: 이 파일의 변경을 이번 PR 에서 제거하고, 필요 시 별도 fix 커밋으로 분리한다.

---

이 외 나머지 23개 파일(파일 1~20, 22~24)은 아래와 같이 모두 이번 작업 범위(§2.2 테스트 데이터셋 저장·재사용 기능 구현) 에 정확히 귀속된다.

| 그룹 | 파일 | 범위 판단 |
|------|------|-----------|
| DB 마이그레이션 | V097__workflow_test_dataset.sql | 범위 내 |
| NestJS 모듈 | entity / DTO / service / controller / module | 범위 내 |
| App 등록 | app.module.ts / root-entities.ts / app.module.spec.ts | 범위 내 (신규 엔티티 등록 의무) |
| 단위 테스트 | workflow-test-datasets.service.spec.ts | 범위 내 |
| e2e 테스트 | workflow-test-dataset.e2e-spec.ts | 범위 내 |
| Frontend API 클라이언트 | workflow-test-datasets.ts | 범위 내 |
| Frontend UI | editor-toolbar.tsx / editor-toolbar-run-input.test.tsx | 범위 내 |
| i18n | dict/ko/editor.ts / dict/en/editor.ts | 범위 내 |
| 문서 | running-a-workflow.mdx / running-a-workflow.en.mdx | 범위 내 |
| Spec 동기화 | spec/1-data-model.md / spec/3-workflow-editor/3-execution.md | 범위 내 |
| Plan 추적 | plan/in-progress/spec-sync-execution-gaps.md | 범위 내 (§2.2 완료 체크) |

포맷팅·주석·임포트 변경은 모두 신규 파일 또는 신규 기능 코드와 직접 연관되어 있으며 불필요한 스타일 변경은 발견되지 않았다.

## 요약

이번 변경은 spec/3-workflow-editor/3-execution.md §2.2(테스트 데이터셋 저장·이름 지정)의 전체 스택 구현으로, DB 마이그레이션부터 백엔드 모듈, 프론트엔드 UI·API 클라이언트·i18n, 문서·spec 동기화까지 일관되게 해당 기능 범위 안에 머문다. 단 한 건의 이탈이 확인된다: `plan/complete/form-validation-minmax-pattern.md` 에 `spec_impact` frontmatter 가 추가되었는데, 이 파일은 이미 완료된 별개 작업(A-1 form validation)의 산출물이며 이번 PR 과 무관하다.

## 위험도

LOW
