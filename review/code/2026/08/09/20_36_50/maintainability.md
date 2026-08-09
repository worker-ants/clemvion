## 유지보수성(Maintainability) 리뷰

### 발견사항

- **[INFO]** `workspace-reflection-canary.ts` 모듈 JSDoc 이 실제 로직 대비 매우 길다(주석:코드 비율 역전)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:5-49` (특히 이번 diff 로 늘어난 26-34줄 — "73건 vs 142건" 비교 블록)
  - 상세: 파일 본문(실제 함수 로직)은 약 40줄(`countWorkspaceIdConsumingRoutes` + `assertWorkspaceIdReflectionWorks`)인데, 그 앞에 붙는 module-level JSDoc 은 45줄에 달한다(설계 배경 + "73건 vs 142건" 포함관계 정정까지). 결정 이력·rationale 을 코드 옆에 두는 것은 이 프로젝트가 이미 확립한 관행(메모리 `feedback_documented_guarantee_wider_than_built` 등)과 일치하고, 실제로 내용도 정확하며 유용하다 — 결함이 아니라 트레이드오프 기록이다.
  - 제안: 지금 형태를 굳이 바꿀 필요는 없다. 다만 이런 "수치 정정" 성격의 항목이 한 번 더 쌓이면(예: 다음 라우트 카운트 변경) 주석이 더 길어지므로, 그 시점엔 상세 배경을 `plan/complete/` 로 옮기고 코드 주석에는 "정본 수치는 부팅 로그, 상세 이력은 plan/... 참고" 한 줄 포인터만 남기는 것을 고려할 수 있다.

- **[INFO]** 부팅 로그 실측치("142건")가 주석에 하드코딩돼 있어 향후 라우트 추가/삭제 시 조용히 stale 해질 수 있다
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:26` (`* 0 이면 throw** 한다. 이 저장소에는 그런 라우트가 다수 있으므로(2026-08-09 실측 **142건**`)
  - 상세: 이 값은 어서션 로직(`count === 0`)에는 전혀 쓰이지 않는 순수 문서용 스냅샷이라 코드 정합성에 영향은 없다. 다만 이 프로젝트가 정확히 이 자리에서 "73건" 수치가 stale 해진 이력(이번 diff 가 고친 그 문제)을 이미 한 번 겪었다는 점에서, 같은 클래스의 drift 가 재발할 수 있다는 점만 기록해 둔다.
  - 제안: 조치 불요(문서적 한계로 이미 명시돼 있고, 실제 방어는 `count === 0` 판정이 담당). 향후 대규모 컨트롤러 추가/삭제 PR 리뷰 시 이 숫자도 함께 갱신 대상인지 체크리스트에 넣으면 좋다.

이 외에 가독성·네이밍·함수 길이·중첩·매직넘버·중복·복잡도·일관성 관점에서 CRITICAL/WARNING 급 문제는 발견하지 못했다. 특히:

- `common/__test-utils__/workspace-id-fixtures.ts` 신설로 `workspace.decorator.spec.ts`/`roles.guard.spec.ts`/`workspace-context.util.spec.ts` 세 파일에 흩어져 있던, 같은 값에 다른 이름·다른 값에 같은 이름(`DECOY_WS`)이 섞였던 진짜 중복(이름=역할, 값=불투명 원칙 위반)을 정확히 해소했다. 각 상수에 붙은 JSDoc 이 "왜 이 이름인가/어디서 쓰이는가"를 명확히 서술해 네이밍 컨벤션 일관성도 좋다.
- `secret-resolver.service.spec.ts` 의 `createInMemoryRepository` 확장(`LastDeleteQuery` 관측점 추가, `where()` 파라미터를 `_condition`→`condition` 으로 실사용 전환)은 기존 구조를 깨지 않고 최소 변경으로 새 관측점을 추가한 형태라 함수 길이·중첩 증가가 없다.
- `http-request.handler.spec.ts` 에서 죽은 `fetchPromise`/`addEventListener` 블록 삭제는 순수 사거리 축소(가독성 개선)이고, 대체된 주석이 왜 그 블록이 죽은 코드였는지(옵셔널 체이닝이 항상 no-op) 명확히 설명한다.
- 신규 e2e `test/secret-store-like-prefix.e2e-spec.ts` 는 `deleteByLikePattern`/`survivingRefs` 두 헬퍼로 반복되는 삭제·조회 쿼리를 추출해 3개 `it` 블록의 중복을 피했고, 네임스페이스 격리(`uniqueName('like')`)로 테스트 간 간섭도 차단했다. 중첩 깊이·매직넘버 문제 없음.
- README.md 변경은 기존 인용문(`>`) 블록을 `##`/`###` 절 구조로 승격해 정보 계층이 명확해졌고, 두 부팅 검사(환경변수 축 vs 구조 불변식 축)를 시각적으로 분리한 점이 가독성을 높인다.

### 요약

이번 변경분은 신규 기능 추가가 아니라 이전 라운드(#1108/#1109/#1111)에서 미룬 위생 항목(README 구조화, 테스트 픽스처 중복 제거, 죽은 코드 삭제, 부정확한 주석 수치 정정, 가드 근거를 실행 가능한 e2e 로 고정)을 정리하는 후속 PR이다. 실제 프로덕션 로직 변경은 없고 테스트/문서/주석만 건드렸다. 특히 중복 코드 제거(3파일 → 1개 공용 fixture 모듈)와 죽은 코드 삭제는 유지보수성을 명확히 개선하며, 새로 추가된 테스트들(e2e + mock 자기-전제 단언)도 헬퍼로 잘 추출돼 있어 함수 길이·중첩·복잡도 문제가 없다. 발견된 두 건은 모두 INFO 수준(주석 길이 트레이드오프, 스냅샷 수치의 잠재적 staleness)이며 코드 동작이나 향후 수정 난이도에 실질적 악영향을 주지 않는다.

### 위험도

NONE
