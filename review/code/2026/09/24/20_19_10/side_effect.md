# 부작용(Side Effect) 리뷰

## 발견사항

없음.

## 상세 확인 내역

- **신규 순수 함수 `isPendingPlanPath`** (`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-105`) — 입력을 받아 `boolean` 을 반환하는 순수 술어다. 전역/모듈 스코프 상태를 읽거나 쓰지 않고(`PENDING_PLAN_DIRS` 는 파일 내부 `const` 배열이며 외부에 노출되지 않음), 파일시스템·네트워크·환경변수에 접근하지 않는다. `path.posix.normalize` 호출만 있고 이는 순수 문자열 연산이다.
- **시그니처/인터페이스 영향** — 기존 export(`isApplicable`, `collectApplicableSpecs`, `repoRoot`, `globMatchesAny` 등)의 시그니처는 변경되지 않았다. `isPendingPlanPath` 는 완전히 새로운 export 이며, 저장소 전체에서 `spec-frontmatter-parse` 를 import 하는 파일은 전부 테스트/가드 파일뿐(`grep` 로 12개 확인)이라 기존 호출자에 영향이 없다.
- **테스트 파일의 부작용** — `spec-pending-plan-existence.test.ts` 에 추가된 두 신규 `it` 블록은 `isPendingPlanPath` 호출과 `expect` 단언뿐이며, 기존 "path resolves" 단언(파일 존재 여부 `fs.existsSync` 읽기 전용)과 마찬가지로 파일시스템에 쓰기·삭제를 하지 않는다.
- **파일시스템 부작용(신규 파일 생성)** — 이번 diff 는 `plan/in-progress/pending-plan-is-plan.md` 신설과 `review/code/2026/09/24/19_57_00/**`, `review/consistency/2026/09/24/19_35_41/**` 하위 다수의 신규 파일(20+ 개) 생성을 포함한다. 이들은 코드 실행이 아니라 이전 리뷰/컨시스턴시 체크 세션의 산출물이 커밋에 포함된 것이며, `CLAUDE.md` "정보 저장 위치" 표의 `review/code/**`·`review/consistency/**` 관례와 일치한다. 런타임 코드가 예상치 못하게 파일을 생성하는 부작용이 아니라 워크플로 산출물의 정상 커밋이다.
- **CHANGELOG.md / plan 문서 변경** — 순수 텍스트 추가로, 실행 동작에 영향 없음.
- **환경변수·네트워크·이벤트/콜백** — 해당 관점의 코드 변화 없음(신규 코드는 `path` 모듈 문자열 연산과 `typeof` 체크뿐).
- **테스트 스위트에 대한 행동 변화(의도된 것)** — 가드가 이제 기존 `pending_plans:` 항목에 대해 "plan 인가" 를 추가로 검사하므로, 향후 비-plan 경로가 들어오면 CI 를 RED 로 만드는 새 강제가 생긴다. 이는 이 변경의 목적 자체(방어 강화)이며 의도치 않은 부작용이 아니다. 현재 코퍼스(27개 spec) 는 plan doc(§C)에 따라 0건 위반으로 확인되어, 이번 diff 만으로 기존 CI 가 깨지지 않는다.

## 검증용 뮤테이션 관련

이번 리뷰에서는 저장소 파일을 수정하지 않고 `Read`/`Grep` 만으로 검증했다(뮤테이션 불필요). `git status --short` 상 이 리뷰로 인한 잔여물 없음.

## 요약

핵심 코드 변경은 `isPendingPlanPath` 라는 새 순수 함수 하나와 그것을 사용하는 테스트 단언 추가뿐이며, 전역 상태·환경변수·네트워크·파일 쓰기·기존 함수 시그니처에 어떤 부작용도 만들지 않는다. diff 에 포함된 다수의 `review/**` 신규 파일은 런타임 부작용이 아니라 프로젝트 관례상 저장되는 리뷰 세션 산출물이다. 부작용 관점에서 우려할 사항이 없다.

## 위험도

NONE
