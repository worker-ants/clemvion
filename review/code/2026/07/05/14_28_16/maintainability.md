# 유지보수성(Maintainability) 코드 리뷰

리뷰 대상: `codebase/backend/src/modules/folders/folders.controller.ts`,
`codebase/backend/src/modules/folders/folders.service.ts`,
`codebase/backend/src/modules/folders/folders.service.spec.ts`
(V-04: 폴더 `update()` parentId 재검증 — 깊이·cycle·타 workspace 가드)

## 발견사항

- **[INFO]** `getDepth()` 의 상한 가드 `depth > MAX_NESTING_DEPTH + 1` 에 `+1` 매직 오프셋
  - 위치: `folders.service.ts:92`
  - 상세: `MAX_NESTING_DEPTH` 는 5로 명확히 명명된 상수이나, 가드 조건에 등장하는 `+ 1` 은 왜 정확히 1을 더 허용하는지(정상 트리의 최대 깊이 대비 손상 데이터 tolerance 여유분) 코드만 봐서는 즉시 이해되지 않는다. 바로 위 주석("정상 트리는 상한에 닿지 않는다")이 있어 완전히 불명확하지는 않지만, 왜 `MAX_NESTING_DEPTH` 자체가 아니라 `+1` 인지에 대한 근거는 없다.
  - 제안: 주석에 "정상 트리는 depth ≤ MAX_NESTING_DEPTH 이므로, 상한을 정확히 MAX_NESTING_DEPTH 로 두면 정상 최대 깊이 케이스가 오탐될 수 있어 +1 여유를 둔다" 정도로 오프셋의 근거를 한 줄 보강하면 향후 유지보수자가 이 값을 실수로 지울 위험을 줄인다.

- **[INFO]** `VALIDATION_ERROR` BadRequestException 구성 블록이 4곳에서 반복
  - 위치: `folders.service.ts:45-49`, `116-119`, `125-128`, `136-139`, `143-146`
  - 상세: `throw new BadRequestException({ code: 'VALIDATION_ERROR', message: ... })` 패턴이 `create()`·`validateParentChange()` 안에서 5회 반복된다. 각각 message 만 다르고 구조는 동일하다. 기존 `findById()` 의 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })` 도 같은 패턴이라 이는 이 서비스 전반의 기존 스타일과 일관되며(신규 도입 아님), 코드베이스 관행을 따른 것으로 보인다.
  - 제안: 현재 규모(같은 파일 내 5회)에서는 헬퍼 추출이 과도할 수 있으나, 향후 `VALIDATION_ERROR` throw 지점이 더 늘어나면 `private throwValidationError(message: string)` 같은 소형 헬퍼로 통합해 메시지 문자열 외의 보일러플레이트를 줄이는 것을 고려할 만하다. 지금 단계에서는 CRITICAL/WARNING 사유는 아님.

- **[INFO]** `create()` 의 depth 검사와 `validateParentChange()` 의 depth 검사가 조건식이 미묘하게 다름 (`>=` vs `+ height >`)
  - 위치: `folders.service.ts:45` (`depth >= MAX_NESTING_DEPTH`) vs `folders.service.ts:142` (`parentDepth + height > MAX_NESTING_DEPTH`)
  - 상세: 두 곳 모두 "최대 깊이 5 초과 금지"라는 동일 불변식을 검증하지만, `create()` 는 리프 1개를 추가하는 경우만 고려해 `depth >= MAX`(즉 depth+1 > MAX 와 동치)로 단순 비교하고, `update()` 경로는 서브트리 전체 이동을 고려해 `parentDepth + height > MAX` 로 비교한다. 두 로직이 실제로는 일관된 규칙("최종 깊이가 MAX 를 넘으면 안 됨")의 다른 표현이지만, 코드만 봐서는 두 함수의 부등호 방향과 피연산자가 달라 대응 관계를 파악하는 데 노력이 든다.
  - 제안: 이미 있는 주석("parent 가 5단계(depth 5) + leaf(height 1) 이동 → 6 > 5" 등은 테스트 쪽에만 존재)을 서비스 코드 쪽에도 한 줄 보강하거나, `create()` 쪽 조건도 `depth + 1 > MAX_NESTING_DEPTH` 형태로 표현을 맞추면(height=1인 특수케이스) 두 검사가 동일 공식의 인스턴스임이 더 명확해진다. 선택 사항.

- **[INFO]** `validateParentChange` 함수가 여러 책임(자기참조 검사·workspace 검사·cycle 검사·깊이 검사)을 순차 수행
  - 위치: `folders.service.ts:109-148`
  - 상세: 함수 길이 자체는 40줄 이내로 과도하지 않으나, 4가지 서로 다른 검증 규칙(self-parent, workspace 소속, 자손-cycle, 깊이 초과)을 한 함수 안에 순차 배치했다. 각 단계가 순서에 의존하고(자기참조를 먼저 걸러야 이후 조회가 안전) 주석으로 잘 설명되어 있어 가독성 저하는 크지 않다. 다만 순환 복잡도가 이 파일에서 가장 높은 함수이므로 향후 규칙이 추가되면(예: 워크플로우 포함 여부 등) 조기에 리팩터링 검토가 필요할 수 있다.
  - 제안: 현재는 문제 없음. 규칙이 5개 이상으로 늘어날 경우 각 검증을 별도 private 메서드(`assertNotSelfParent`, `assertSameWorkspace` 등)로 분리하는 것을 권장.

- **[INFO]** `collectSubtree` 의 `frontier.map((pid) => ({ parentId: pid, workspaceId }))` — OR 조건 배열을 매 반복 재구성
  - 위치: `folders.service.ts:164-166`
  - 상세: TypeORM 의 `where` 배열(OR) 패턴을 사용해 BFS 각 레벨에서 여러 부모 ID 를 한 번에 조회하는 것은 N+1 쿼리를 피하는 합리적 설계다. 다만 `frontier` 가 빈 배열이 될 수 없는 상황(while 조건이 `frontier.length > 0` 이므로 진입 시 항상 비어있지 않음)이라 안전하지만, `find({ where: [] })` 가 TypeORM 에서 어떻게 동작하는지 아는 사람이 적어 조건 위치를 눈으로 재확인해야 하는 인지 비용이 있다.
  - 제안: 현행 유지 가능. 원한다면 while 조건과의 불변식을 주석 한 줄로 명시("frontier 는 항상 비어있지 않은 상태로 진입 — where: [] 방지")하면 추후 리팩터링 시 실수를 예방한다.

- **[INFO]** 테스트 파일의 mock 체이닝(`mockResolvedValueOnce` 다회 연쇄)이 호출 순서에 강하게 결합
  - 위치: `folders.service.spec.ts:481-538` (예: `rejects parent in another workspace`, `rejects when resulting depth exceeds max`)
  - 상세: `mockRepository.findOne` 에 `mockResolvedValueOnce` 를 여러 번 체이닝해 "findById → parent lookup → getDepth 체인" 순서를 그대로 흉내낸다. 각 테스트에 순서를 설명하는 주석(`// findById`, `// parent lookup` 등)이 붙어 있어 가독성은 확보되어 있으나, 서비스 내부 구현이 호출 순서를 바꾸면(예: `validateParentChange` 안에서 parent 조회 전에 다른 조회를 추가) 이 테스트들은 실제 버그 없이도 깨지기 쉬운 화이트박스 테스트다.
  - 제안: 현 상태로 문제 없음(구현 세부사항이 이미 안정적이고 주석으로 순서가 문서화됨). 다만 향후 `validateParentChange` 내부 호출 순서를 리팩터링할 계획이 있다면, `mockImplementation` 기반 id-매칭 방식(파일 마지막 `getDepth terminates on cyclic parent chain` 테스트가 이미 사용 중인 패턴)으로 점진 전환하면 순서 결합도를 낮출 수 있다.

- **[INFO]** 컨트롤러 Swagger `description` 문자열 길이 증가 — 가독성 영향 미미
  - 위치: `folders.controller.ts:143-144`
  - 상세: 변경분은 Swagger 문서 설명 문자열 확장뿐이며 로직 변경이 없다. 문자열이 길어졌지만 이미 프로젝트 전반에 걸쳐(예: 파일 내 다른 `@ApiOperation` description들) 유사하게 상세한 한국어 설명을 다는 관행이 있어 일관성 있다.
  - 제안: 없음.

## 요약

이번 변경은 `FoldersService.update()` 의 parentId 재검증(깊이·cycle·타 workspace) 로직을 새 private 메서드(`validateParentChange`, `collectSubtree`)로 명확히 분리해 추가했고, 기존 `getDepth()` 에는 방문 집합(`visited`) 과 상한 가드를 더해 손상 데이터로 인한 무한루프를 방지했다. `MAX_NESTING_DEPTH` 상수 재사용, `VALIDATION_ERROR` 에러 코드 재사용(신규 cycle 전용 코드 도입 회피) 등 기존 코드베이스 관행과 잘 정합되며, 각 함수에는 "왜"를 설명하는 한국어 JSDoc/인라인 주석이 충실히 달려 있어 향후 유지보수자가 V-04 배경(consistency-check 근거)을 추적하기 쉽다. 테스트(`folders.service.spec.ts`)도 정상/cycle/타 workspace/깊이초과/방어적 종료 케이스를 빠짐없이 다루고 각 mock 체이닝에 호출 순서 주석을 남겨 가독성을 확보했다. 발견된 사항은 모두 INFO 수준으로, `MAX_NESTING_DEPTH + 1` 오프셋의 근거 설명 보강, `create()`/`update()` 두 깊이 검사식의 표현 통일, `validateParentChange` 내 다중 책임의 향후 확장 시 분리 검토 등 사소한 가독성 개선 여지만 존재한다. CRITICAL/WARNING 급 이슈는 없다.

## 위험도

LOW
