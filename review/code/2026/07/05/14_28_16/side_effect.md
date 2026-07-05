# 부작용(Side Effect) Review — V-04 folder depth/cycle guard

## 발견사항

- **[INFO]** `update()` 의 동작 변경 — 시그니처는 동일, 런타임 부작용(추가 쿼리·예외)만 추가
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `update()` (L787-801)
  - 상세: `update(id, workspaceId, data)` 의 파라미터/반환 타입(`Promise<Folder>`)은 변경되지 않아 컨트롤러(`folders.controller.ts` `PATCH :id`)를 포함한 기존 호출자 코드는 컴파일/런타임 모두 영향 없음. 다만 `parentId` 를 포함한 PATCH 요청에서 종전에는 성공(200)하던 일부 케이스(다른 워크스페이스 parent 지정, cycle 유발, 깊이 초과)가 이제 `400 VALIDATION_ERROR` 로 실패하는 **동작 변경**이 발생한다. 이는 의도된 버그 수정(V-04)이며 컨트롤러 Swagger 설명(`@ApiBadRequestResponse`, `description`)도 함께 갱신되어 문서-동작 정합이 유지된다.
  - 제안: 현재 상태로 문제없음. 배포 시 기존에 (버그로 인해) 성공하던 부모 변경 요청이 클라이언트 관점에서 갑자기 400을 받을 수 있다는 점만 릴리스 노트/체인지로그에 남기면 좋음(회귀처럼 보일 수 있는 동작 변경이므로).

- **[INFO]** `update()` 부작용 추가 — parentId 변경 시 DB 읽기(SELECT) 쿼리 수 증가
  - 위치: `folders.service.ts` L622-624 (`validateParentChange` 호출), `validateParentChange` L652-691, `collectSubtree` L697-721
  - 상세: 종전 `update()` 는 `findById` 1회 조회 후 바로 `save`. 이제 `parentId` 가 실제로 바뀌는 요청에 한해 (a) parent 존재 확인 `findOne` 1회, (b) `collectSubtree` BFS (`find` 0~N회, `MAX_NESTING_DEPTH+1` 상한), (c) `getDepth` 체인 조회(`findOne` 0~`MAX_NESTING_DEPTH+2`회)가 추가된다. DB write 부작용(트랜잭션 범위, save 대상)은 그대로이며 순수 read-only 추가 쿼리이므로 데이터 상태 변경 부작용은 없다. 다만 요청당 쿼리 수 증가는 성능 특성 변화이며, 세 조회가 하나의 트랜잭션으로 묶이지 않아(각각 독립 `findOne`/`find` 호출) 검증-이후 `save` 사이에 이론적으로 동시 변경(TOCTOU) 여지가 있다.
  - 제안: 현재 규모(관리용 CRUD, 낮은 동시성 리소스)에서는 수용 가능. 동시성이 중요해지면 트랜잭션/락 고려. 정보 제공 목적으로만 기록.

- **[INFO]** `getDepth()` 내부 로직 변경(가드 추가) — 시그니처·반환값 의미 불변, private 메서드라 외부 영향 없음
  - 위치: `folders.service.ts` L808-829
  - 상세: `visited` Set 과 `depth > MAX_NESTING_DEPTH + 1` 상한을 추가해 손상된(cycle) 데이터에서도 종료를 보장한다. `private` 메서드이므로 클래스 외부 호출자는 없다(테스트 spec 에서도 `create`/`update` 경유로만 간접 호출). 정상 데이터 경로에서는 결과값(depth)이 기존과 동일하게 계산되므로 `create()` 의 기존 깊이 검증 동작에 회귀 없음. 새로 도입된 것은 "무한루프 대신 종료" 라는 방어적 부작용 뿐으로, 의도한 변경이다.
  - 제안: 없음(양호).

- **[INFO]** 전역 상태·환경 변수·파일시스템·네트워크 부작용 없음
  - 위치: 전체 diff(`folders.controller.ts`, `folders.service.ts`, `folders.service.spec.ts`)
  - 상세: 신규/수정 코드는 클래스 인스턴스 멤버나 모듈 스코프 변수를 전혀 도입하지 않는다(`MAX_NESTING_DEPTH` 상수는 기존 그대로, 새 전역 없음). 파일시스템 접근, `process.env` 참조, `fetch`/`http` 등 외부 네트워크 호출도 없다. `visited`/`ids`/`frontier` 는 모두 메서드 로컬 변수로 요청 간 공유되지 않는다.
  - 제안: 없음.

- **[INFO]** 이벤트/콜백 변경 없음
  - 위치: 전체 diff
  - 상세: 폴더 생성/수정/삭제에 대한 이벤트 emitter, 콜백, 알림(Notification) 등의 트리거가 diff 범위 내 어디에도 없다. `update()` 는 여전히 `save()` 만 호출하며 별도 이벤트 발행 로직 추가는 없다.
  - 제안: 없음.

- **[INFO]** 문서(spec)·리뷰 산출물 변경은 코드 실행 부작용과 무관
  - 위치: `spec/1-data-model.md`, `review/consistency/2026/07/05/14_08_56/**`
  - 상세: 이 파일들은 정적 문서/리뷰 아티팩트이며 애플리케이션 런타임 부작용과는 무관하다. `spec/1-data-model.md` 는 §2.5 제약조건에 "같은 워크스페이스"·"비순환" 명시를 추가해 구현과의 문서 정합을 맞췄을 뿐이다.
  - 제안: 없음.

- **[INFO]** 테스트 파일(`folders.service.spec.ts`)의 `mockRepository.findOne.mockReset()`/`mockRepository.find.mockReset()`
  - 위치: `folders.service.spec.ts` L450-454 (신규 `describe` 블록 내부 `beforeEach`)
  - 상세: 이 `mockReset()` 은 Jest mock 객체(테스트 전용 공유 fixture)의 호출 이력/구현을 초기화하는 것으로, 프로덕션 상태나 실제 DB에 영향을 주지 않는다. 다만 최상위 `describe('FoldersService')` 는 최상위 `beforeEach` 에서 매번 새 `TestingModule` 을 만들지만 `mockRepository` 객체 자체(및 그 안의 `jest.fn()`)는 파일 스코프에서 한 번만 생성되어 전체 테스트 스위트가 공유한다. 새로 추가된 `describe('update — parentId 재검증 (V-04)')` 블록은 자체 `beforeEach` 로 `findOne`/`find` 를 reset 하지만, 이전 `describe` 블록들(`create`, `findById` 등)이 남긴 `mockResolvedValue`(non-Once) 설정이나 `mockImplementation` 이 이 reset 으로 완전히 제거되는지 실행 순서에 의존한다. 실제로 `create` 의 `should enforce max nesting depth` 테스트가 `mockImplementation` 을 설정해두는데, 신규 블록의 `beforeEach` 가 `mockReset()` 으로 이를 지우므로 교차 오염 위험은 낮다. Jest 는 `describe` 블록 등록 순서대로 실행되고 각 `it` 앞에 모든 상위-계층 `beforeEach` 가 순서대로 실행되므로 문제는 없어 보이나, 공유 mock 객체 특성상 향후 새 `it`/`describe` 추가 시 순서에 따라 오염 가능성이 잠재한다는 점만 기록.
  - 제안: 현재 diff 자체에는 문제 없음(각 신규 `it` 앞에 `mockReset` 이 실행되어 격리됨). 향후 이 파일에 테스트를 추가할 때는 `mockRepository` 를 `beforeEach` 에서 새로 생성하거나 전역 reset 을 고려하면 더 안전.

## 요약

이번 변경은 `FoldersService.update()` 에 `parentId` 변경 시의 계층 무결성 검증(같은 워크스페이스·비순환·최대 깊이 5)을 추가하고 `getDepth()` 에 방문-집합/상한 가드를 넣어 손상 데이터의 무한루프를 방지하는 순수 방어적 강화다. 공개 메서드 시그니처(`update`, 컨트롤러 라우트)는 전혀 변경되지 않았고, 전역 변수·환경 변수·파일시스템·네트워크·이벤트 콜백에 대한 부작용은 도입되지 않았다. 유일한 실질적 "부작용"은 (a) `parentId` 가 실제로 바뀌는 PATCH 요청에서 읽기 쿼리가 늘어나는 성능 특성 변화와 (b) 종전에는 버그로 통과하던 일부 부모-변경 요청이 이제 의도적으로 400 오류를 반환하게 되는 동작 변경(문서화됨, Swagger description 갱신으로 정합 유지)이며 둘 다 이번 작업의 의도된 목적과 일치한다. Critical/Warning 급 부작용은 발견되지 않았다.

## 위험도

NONE
