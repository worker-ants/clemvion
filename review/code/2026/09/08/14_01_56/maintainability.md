# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` 의 `select` 투영 필드 목록과 이후 `.map()` 반환 객체 필드 목록이 컴파일러 강제 없이 손으로 동기화돼야 한다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:225-231`(`select: { id, userId, role, joinedAt, user: { id, email, name } }`) 및 `:233-240`(`return members.map((m) => ({ id, userId, email, name, role, joinedAt }))`)
  - 상세: 이번 B-4 변경이 의도한 대로 `select` 로 로드 컬럼을 좁힌 것은 방어 강화로 옳다. 다만 그 결과 같은 필드 집합(`id`/`userId`/`role`/`joinedAt`/`user.{id,email,name}`)이 **두 자리**(쿼리 옵션의 `select` 객체와 반환 매핑의 객체 리터럴)에 각각 리터럴로 적혀 있고, 둘을 잇는 타입 강제가 없다. 나중에 응답에 필드를 하나 추가하는 사람이 `.map()` 쪽에만 `m.someNewField` 를 적고 `select` 에 추가하는 것을 잊으면, TypeORM 은 에러를 던지지 않고 조용히 `undefined` 를 반환한다(런타임 예외 없음). 새로 추가된 테스트(`workspaces.service.spec.ts` — `쿼리가 user 관계를 select 로 좁혀 요청한다`)는 `select.user` 서브셀렉트 3필드만 단언하고 top-level 필드(`id`/`userId`/`role`/`joinedAt`)의 존재는 단언하지 않아, 이 특정 드리프트 방향을 완전히 막지는 못한다.
  - 제안: 지금 당장 리팩터링이 필요할 정도는 아니다(필드 6개, 변경 빈도 낮음). 다음에 이 메서드에 필드를 추가할 기회가 있으면 `select` 키 목록을 `.map()` 이 참조하는 소스로 삼거나(예: 상수 배열에서 두 형태를 파생), 최소한 위 테스트의 단언 범위를 top-level `select` 키까지 넓히는 것을 고려할 만하다.

- **[INFO]** 이번 diff에서 손댄 여러 파일의 JSDoc 분량이 실제 선언부 대비 5~6배로, "무엇이 현재 계약인가"를 찾기 전에 이력을 먼저 읽어야 하는 진입 비용이 누적되고 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:46-69`(JSDoc 24줄) vs `:70-73`(실제 타입 선언 4줄). 같은 패턴이 `codebase/backend/src/modules/workspaces/workspaces.service.ts:216-224`(주석 9줄, 코드는 아래 `select` 6줄), `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` 상단 표 블록, `codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail` 헤더에도 반복된다.
  - 상세: 이 저장소는 "결정 근거를 코드 옆에 남긴다"는 확립된 관례를 갖고 있고(리뷰 대조 결과 인용된 근거 자체는 모두 정확했다), 이번 변경도 그 관례를 성실히 따른 것뿐이라 새로운 결함은 아니다. 다만 한 타입/메서드당 역사적 배경 문단이 계속 누적되면, 그 파일을 처음 여는 사람이 "지금 유효한 계약"을 찾기까지 스크롤해야 하는 문서:코드 비율이 커진다. 이번 PR 만으로 문제가 되는 수준은 아니고 추세를 기록해 둔다.
  - 제안: 지금 조치 불요. 다음에 이 타입들을 다시 만질 기회에, 역사적 배경(왜 개명/전환했는가, 과거 리뷰 인용)은 `plan/`·`review/**` 링크 한 줄로 축약하고 "현재 유효한 계약"만 JSDoc 최상단에 남기는 방향을 고려할 만하다.

## 관측된 저장소 상태 이상 (내가 만든 변경 아님)

리뷰 도중 `git status --short` 로 확인한 결과, `codebase/backend/src/common/__test-utils__/source-scan.ts` 에
**커밋되지 않은 수정**이 이미 존재했다(내가 시작하기 전부터 있었고, 나는 이 파일에 아무 것도 쓰지 않았다):

```diff
-      const isFn =
-        cur.initializer !== undefined &&
-        (ts.isArrowFunction(cur.initializer) ||
-          ts.isFunctionExpression(cur.initializer));
+      const isFn = false; // MUTATION: disable functionVar branch
```

`enclosingScopeName` 의 `functionVar` 분기를 강제로 비활성화하는 뮤테이션 테스트 흔적으로 보이며, 다른 병렬
리뷰어가 가설 검증 후 원복을 아직 못 한 것으로 추정된다. **이 리뷰는 그 파일을 건드리지 않았고, 원복도 시도하지
않았다** — 다른 리뷰어의 미완료 작업일 수 있어 `git checkout`/`restore` 를 쓰지 않았다. 오케스트레이터는 이
잔여 뮤테이션이 실제 diff 로 오인되거나 다른 리뷰어의 판정을 오염시키지 않았는지 확인이 필요하다.

## 요약

이번 배치(B-1~B-8)는 대체로 유지보수성을 개선하는 방향의 변경이다 — `enclosingName`/`enclosingMethodName` 두 형제 AST 가드에 각자 존재하던 거의 동일한 스코프-이름 판정 로직을 `common/__test-utils__/source-scan.ts` 의 `enclosingScopeName` 단일 함수로 합쳤고(`user-entity-exposure-guard.ts`·`endpoint-path-conflict-wrap-guard.ts` 양쪽에서 재사용), `integration-oauth.service.ts` 의 손-작성 `constraint` 추출 중복 두 곳을 `pgErrorConstraint()` 헬퍼 호출로 교체했으며, `http-exception.filter.ts` 의 로컬 `isUniqueViolation`(QueryFailedError 전제)을 제거하고 SoT `isPostgresUniqueViolation` 로 통합했다. `production-build-devdep.spec.ts` 는 반복되던 손-복제 `it()` 블록을 `it.each` 로 파라미터화하고 `resolveBuildFileNames()` 재계산을 `describe` 최상단 1회로 캐싱했다. 신설 AST 가드(`endpoint-path-conflict-wrap-guard.ts`)는 함수 길이·중첩 깊이·네이밍이 형제 가드와 일관되고, 판정 로직이 정확 프로퍼티 매칭(부분 문자열 아님)·호출식 검출(텍스트 포함 아님)로 좁게 설계돼 있다. 실질적으로 남는 것은 두 건의 INFO 뿐이다 — `listMembers` 의 `select`/`.map()` 필드 목록 간 비강제 동기화(드리프트 시 무음 실패 가능성)와, 여러 파일에 누적되는 JSDoc-대-코드 비율 상승 추세. 둘 다 이번 PR 범위에서 즉시 조치가 필요한 수준은 아니며, CRITICAL/WARNING 급 가독성·네이밍·중첩·매직넘버·중복·복잡도·일관성 결함은 발견되지 않았다.

## 위험도

LOW
