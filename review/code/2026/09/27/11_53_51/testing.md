# 테스트(Testing) 리뷰 — folders-contract-e2e

## 발견사항

- **[INFO]** `defined` 필터가 `null` 값을 보존하는지를 단위 테스트가 값으로 직접 확인하지 않는다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts` — `allows moving to root (parentId null)` 테스트(207~219줄, 이 PR 의 diff 밖 · 기존 테스트)
  - 상세: 이번 PR 의 핵심 수정은 `Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))` — "`undefined` 는 걸러내고 `null` 은 통과시킨다"는 분기다. 새로 추가된 테스트(117~135줄)는 "걸러냄" 쪽(undefined 보존 안 함)만 값으로 검증하고, "통과" 쪽(`parentId: null` 이 실제로 엔티티에 반영되는지)은 이 기존 테스트가 `expect(result).toBeDefined()` 로만 확인해 사실상 값을 보지 않는다. 이 분기의 값 검증은 e2e C(`folder-crud.e2e-spec.ts` 121줄 `parentId` null 단언)에만 있다.
  - 제안: 같은 PR 에서 `update()` 의 필터 로직을 건드렸으니, `allows moving to root` 테스트도 `expect(result.parentId).toBeNull()` 로 강화하면 단위 계층만으로 이 분기의 회귀를 잡을 수 있다. (e2e 가 이미 잡고 있어 차단 사유는 아님.)

- **[INFO]** PATCH 본문이 완전히 빈 객체(`{}`)인 경계 케이스가 단위·e2e 어디에도 없다
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` — `update()` (72~80줄, `defined` 필터 신설 구간)
  - 상세: `Object.entries({}).filter(...)` → `{}` → `Object.assign(folder, {})` 는 no-op 이 되어 로드된 엔티티를 그대로 저장·반환할 것으로 보이는데, 이 경로를 명시적으로 확인하는 테스트가 없다. 컨트롤러/DTO 유효성 검사가 빈 PATCH 본문을 막고 있다면 사실상 도달 불가능한 경로일 수 있으나, 그 전제 자체가 이 diff 안에서 검증되지 않는다.
  - 제안: 도달 가능하다면 `update(id, ws, {})` 가 기존 값을 그대로 반환하는 단위 테스트 1개 추가를 고려. 컨트롤러 DTO 검증(`class-validator` 등)이 빈 본문을 막는다면 그 사실을 주석으로 남기는 것으로 충분.

- **[INFO]** e2e 신설 스코프가 "응답 형태" 로 의도적으로 좁혀져 있고, 그 경계가 문서화되어 있다
  - 위치: `codebase/backend/test/folder-crud.e2e-spec.ts` 14~25줄(파일 상단 JSDoc)
  - 상세: 계층 무결성(깊이·순환·타 워크스페이스 부모)과 역할(Roles) 강제는 이 e2e 에 없다. 확인 결과 이 저장소는 `RolesGuard` 를 `codebase/backend/src/common/guards/roles.guard.spec.ts` 단위 테스트로 한 번만 검증하고 개별 모듈 e2e 에서 역할별 403 을 반복 검증하지 않는 패턴이 이미 확립돼 있고(다른 컨트롤러들도 동일), 계층 무결성은 `folders.service.spec.ts` 의 V-04 테스트군이 촘촘히 덮는다. 스코프 축소가 근거 있게 문서화돼 있어 커버리지 갭이라기보다 의도된 계층 분리로 판단된다.

- **[INFO]** `folders.service.spec.ts` 신규 테스트는 실제 결함 재현 형태(own-property `undefined`)를 정확히 모사한다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts` 117~135줄
  - 상세: 프로덕션에서는 DTO 인스턴스(`useDefineForClassFields`)가 보내지 않은 optional 필드도 own property `undefined` 로 갖는데, 이 테스트는 plain 객체 리터럴에 `parentId: undefined, sortOrder: undefined` 를 명시해 같은 모양(own key + undefined 값)을 재현한다. `Object.assign` 은 소스의 enumerable own property 를 값과 무관하게 복사하므로 이 모사는 유효하고, 되돌린 코드(`Object.assign(folder, data)`)에서는 `mockRepository.save` 의 스프레드(`{ id: 'new-id', ...data }`)가 `undefined` 키를 그대로 보존해 검증이 실패한다 — 플랜 문서의 뮤턴트 표(M5, 단위 KILLED 1)와 일치한다. Mock 적절성 관점에서 결함을 정확히 가른다.

- **[INFO]** `folder-response.dto.spec.ts` 는 래칫·e2e 가 못 잡는 축(선언이 넓어지는 회귀)을 정확히 겨냥한다
  - 위치: `codebase/backend/src/modules/folders/dto/responses/folder-response.dto.spec.ts` 19~28줄
  - 상세: `toStrictEqual({ type: 'string', format: 'uuid', nullable: true })` 로 스키마 속성 전체를 고정해, `@ApiPropertyOptional()` 로의 회귀나 `type` 누락(→ `string | null` 이 플러그인 없는 스키마에서 `type: object` 로 새는 문제, 프로젝트 메모의 기존 실측 사례와 동일 클래스)을 모두 커버한다. 플랜의 뮤턴트 M2~M4 가 이 테스트로 KILLED 됨을 실측했다고 기록돼 있어 뮤테이션 검증까지 마쳤다.

## 요약

핵심 변경(PATCH 부분 본문 응답 결함 수정)에 대해 단위(`folders.service.spec.ts`)와 e2e(`folder-crud.e2e-spec.ts` C·E) 양쪽에서 결함 재현 형태를 정확히 모사한 회귀 테스트가 추가됐고, DTO 선언 자체의 회귀(`folder-response.dto.spec.ts`)까지 별도 계층으로 가드를 세워 "래칫은 좁은 축만, e2e 는 값만, 선언 캐너리는 선언만" 이라는 역할 분리가 명확하다. 플랜 문서에 실제 뮤턴트를 코드에 적용해 각 테스트가 어떤 뮤턴트를 죽였는지 표로 남긴 점은 이 리뷰 기준으로 보아도 이례적으로 견고한 증거다(전제 반증으로 POST 쪽 불필요한 변경을 스스로 되돌린 이력 포함). 남은 갭은 "moving to root" 기존 단위 테스트가 값을 검증하지 않는 점과 빈 PATCH 본문 경계값 정도로, 둘 다 차단 사유가 아닌 강화 여지에 해당한다. 역할(Roles) 검증 부재는 저장소 전반의 기존 테스트 피라미드 관행과 일치해 갭으로 보지 않았다.

## 위험도

LOW
