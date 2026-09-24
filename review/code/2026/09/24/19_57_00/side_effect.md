# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — 신규 순수 술어 `isPendingPlanPath` + 상수 `PENDING_PLAN_DIRS` 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` — 위 함수의 단위 테스트 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — 가드에 「plan 인가」 단언 추가
- `plan/in-progress/pending-plan-is-plan.md` (신규) — 작업 plan 문서
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커에 항목 1건 추가
- `review/consistency/2026/09/24/19_35_41/*` (신규 8개 파일) — `/consistency-check --impl-prep` 산출물

뮤테이션(실제 코드 수정)은 수행하지 않았고, 저장소에는 쓰기를 하지 않았다(`git status --short` 로 확인, 변경분 없음 — 세션 초기의 untracked `review/code/2026/09/24/19_57_00/` 만 존재).

## 발견사항

없음 — 이번 diff 는 부작용 관점에서 위험 신호가 관측되지 않았다. 점검한 8개 관점 각각에 대한 근거:

- **의도치 않은 상태 변경 / 전역 변수**: 신규 `isPendingPlanPath`(`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-101`)는 인자만으로 결과를 계산하는 순수 함수이고, `PENDING_PLAN_DIRS`(같은 파일 `:95`)는 module-scope `const` 배열로 export 되지 않으며 어디서도 mutate 하지 않는다. `global`/`globalThis`/모듈 캐시를 건드리는 코드는 없다.
- **파일시스템 부작용**: 해당 함수 자체는 `fs` 를 호출하지 않는다(문자열 연산만). `spec-pending-plan-existence.test.ts` 의 기존 `fs.existsSync` 호출부는 이번 diff 가 손대지 않았다. 새로 추가된 `plan/in-progress/pending-plan-is-plan.md` 와 `review/consistency/2026/09/24/19_35_41/**` 는 코드 실행이 만든 부작용이 아니라 이번 커밋이 의도적으로 포함한 작업 산출물이다(CLAUDE.md 저장 위치 규약과 일치 — plan 은 `plan/in-progress/`, consistency 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`).
- **시그니처 변경**: 기존 함수(`isApplicable`, `collectApplicableSpecs` 등) 시그니처는 그대로다. `isPendingPlanPath` 는 신규 추가이므로 기존 호출자에 영향이 없다.
- **인터페이스 변경**: `spec-frontmatter-parse.ts` 의 export 표면이 넓어졌지만(순추가), 이 파일은 `__tests__/` 아래의 테스트 전용 헬퍼라 외부 공개 API 가 아니다. 새 export 를 소비하는 곳은 `spec-frontmatter-parse.test.ts` 와 `spec-pending-plan-existence.test.ts` 뿐이며, 두 곳 모두 이번 diff 에 포함돼 있다.
- **환경 변수**: 읽기/쓰기 없음(`process.env` 참조 없음).
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음 — 새 코드는 이벤트 발행이나 콜백 등록을 하지 않는다.

## 참고 (부작용은 아니지만 기록)

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 추가된 항목(id 유일성 가드 부재)은 이번 PR 의 코드 변경과 직접 관련 없는 **별도 트래커 등재**다. 코드 실행 부작용이 아니라 plan 문서 편집이므로 이 리뷰 관점에서는 지적 대상이 아니다.
- 신규 함수가 `path.posix.normalize` 를 사용해 정규화 후 접두 검사를 하도록 바뀐 것은 동작(정합성) 변경이지만, 순수 함수 내부 로직 변경이라 외부 상태·부작용에는 영향이 없다.

## 요약

이번 변경은 부작용이 없는 순수 술어 함수(`isPendingPlanPath`)와 그 단위/통합 테스트, 그리고 작업 관례상 필요한 plan·consistency-check 산출물 파일 추가로 구성돼 있다. 전역 상태·환경 변수·네트워크·파일시스템·공개 인터페이스 어느 축에서도 의도치 않은 부작용이나 기존 호출자에 영향을 주는 변경은 발견되지 않았다.

## 위험도

NONE
