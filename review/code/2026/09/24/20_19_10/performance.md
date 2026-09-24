# 성능(Performance) 리뷰

## 발견사항

없음.

이번 변경의 실질 코드는 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`에
추가된 순수 함수 하나뿐이다.

```ts
const PENDING_PLAN_DIRS = ["plan/in-progress/", "plan/complete/"];

export function isPendingPlanPath(relPath: unknown): boolean {
  if (typeof relPath !== "string") return false;
  const norm = path.posix.normalize(relPath);
  if (!norm.endsWith(".md")) return false;
  return PENDING_PLAN_DIRS.some((dir) => norm.startsWith(dir));
}
```

(위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:97-105`)

점검 관점별로 확인한 내용:

- **알고리즘 복잡도**: `typeof` 체크 → `path.posix.normalize`(경로 길이에 선형) → 길이 2 배열에
  대한 `startsWith` 선형 탐색. 입력 1건당 O(경로 길이)로 상수에 가깝다. 비효율적 알고리즘 없음.
- **N+1 호출**: 이 함수를 호출하는 `spec-pending-plan-existence.test.ts:46-70`은 `for (const spec
  of specsWithPending) { for (const planRel of pending) { isPendingPlanPath(planRel); fs.existsSync
  (...) x2; } }` 이중 루프이지만, `isPendingPlanPath` 자체는 메모리 내 문자열 연산만 하고 어떤
  I/O·DB·API 도 호출하지 않는다. `fs.existsSync` 호출은 이번 diff 가 추가한 것이 아니라 기존
  `pending_plan path resolves` 테스트에 이미 있던 것이고, 대상 코퍼스도 spec 27개 × pending 항목
  소수 건이라 build-time 테스트 스위트 규모에서 문제 되지 않는다.
- **메모리 할당**: 함수 호출마다 `norm` 문자열 하나만 생성. 대규모 데이터 적재·누수 요인 없음.
- **캐싱**: 호출 빈도가 낮고(가드 실행 시 스펙 개수만큼) 계산 비용도 미미해 캐싱이 필요한
  지점이 아니다.
- **블로킹 I/O**: 이 함수 자체는 I/O 를 하지 않는다. 같은 파일의 `fs.readFileSync`
  (`parseSpecFile`)·`fs.existsSync`·`fs.readdirSync`(`globMatchesAny`)는 이번 diff 이전부터
  있던 동기 호출이며, vitest 로 로컬/CI 에서만 도는 문서 가드이므로 동기 I/O 가 허용 가능한
  컨텍스트다. 이번 변경이 새로 도입한 블로킹 지점은 없다.
- **불필요한 연산**: 중복 계산이나 O(n²) 문자열 누적 없음. `PENDING_PLAN_DIRS.some(...)`은
  원소 2개 고정 배열이라 사실상 상수 시간.
- **데이터 구조**: 허용 디렉터리 목록에 배열(길이 2, `Array.prototype.some` 선형 탐색)을
  쓴 것은 원소 수가 극소(2개)이므로 적절한 선택이다. `Set` 등으로 바꿔도 이득이 없다.
- **지연 로딩**: 해당 없음 — 이 변경에 선행 로딩할 무거운 리소스가 없다.

CHANGELOG.md·`plan/in-progress/*.md`·`review/code/**`·`review/consistency/**` 는 순수 문서/리뷰
산출물이며 실행 경로가 없어 성능 관점 검토 대상이 아니다.

**뮤테이션 검증**: 저장소 파일을 고쳐 재현할 성능 가설이 없어 뮤테이션을 수행하지 않았다.
저장소에 어떤 파일도 쓰거나 고치지 않았다(`git status --short` 로 확인할 변경 없음).

## 요약

이번 PR 의 실질 코드 변경은 순수 동기 문자열 술어 함수 `isPendingPlanPath` 하나와 그것을
호출하는 두 테스트 파일의 신규 단언들로, 전부 build-time(vitest) 문서 정합성 가드에 국한된다.
시간/공간 복잡도는 입력 크기(spec 개수 27, 경로 문자열 길이)에 비해 사실상 상수이고, DB·외부
API 호출·네트워크 I/O·캐싱이 필요한 반복 계산이 전혀 없다. 기존 `fs.existsSync` 동기 호출도
이번 diff 가 새로 만든 것이 아니라 이미 있던 패턴을 그대로 재사용한다. 성능 관점에서 지적할
사항이 없다.

## 위험도

NONE
