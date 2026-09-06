# 테스트(Testing) 리뷰

## 검증 방법

정적 리뷰 외에 다음을 실제로 실행해 확인했다 (저장소 트리는 뮤테이션 후 `cp` 로 즉시 원복,
`git status --short` 로 clean 확인 완료):

- `npx jest src/repo-guards/__tests__/user-entity-exposure.spec.ts src/shared/testing/user-secret-absence.spec.ts` → **16/16 통과**
- `grep -rn "relations: \['user'\]\|leftJoinAndSelect\|innerJoinAndSelect" src/modules` → 베이스라인 3곳(`auth.service.ts` x2, `workspaces.service.ts` x1) + `joinAndSelect` 0곳, `EXPECTED_USER_RELATION_LOADS` 와 정확히 일치 확인
- 뮤테이션: `isUserRelationPath` 의 `.toLowerCase()` 를 제거 → **가드 spec 7/7 여전히 통과** (아래 발견사항 참조)
- `npx tsc --noEmit` — 신규/변경 파일 타입 오류 없음

## 발견사항

- **[WARNING]** `isUserRelationPath` 의 대소문자 무시 동작이 어떤 fixture/테스트로도 검증되지 않는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:33` (`isUserRelationPath`) — 문서화된 계약은 같은 파일 `:32`("`'user'` 또는 `'x.user'` (대소문자 무시)")
  - 상세: `return last.toLowerCase() === 'user';` 의 `.toLowerCase()` 를 제거하는 뮤테이션을 넣고
    `user-entity-exposure.spec.ts` 를 돌려도 **7/7 그대로 통과**했다(실측, 위 "검증 방법" 참조).
    `user-relation-load.fixture.ts` 의 위반 5종·준수 3종 어디에도 대문자가 섞인 관계 이름
    (`'User'` 등)이 없다 — 전부 소문자 리터럴이다. 이 가드는 "구조가 생기는 순간 잡는" 마지막
    방어선이라고 스스로 규정하는데, 그 방어선 안에 문서화된 분기 하나가 어떤 테스트로도
    관측되지 않는 사각지대로 남아 있다.
  - 제안: `user-relation-load.fixture.ts` 에 `relations: ['User']` (또는 `'Member.User'`)
    형태의 위반 케이스를 하나 추가해 이 축을 관측 가능하게 만든다.

- **[WARNING]** e2e 파일에 테스트 라벨 `F.` 가 중복되고, 새 테스트가 기존 알파벳 순서를 깬다
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — 신규 `it('F. GET /:id/members — …')`
    (D 다음·E 앞에 삽입됨) vs 기존 `it('F. sole owner 는 leave 불가 — …')` (E 다음)
  - 상세: 이 파일은 테스트를 `A`~`I` 알파벳 라벨로 서로 참조하는 관행을 쓴다 — 예컨대
    `I.` 테스트의 주석은 명시적으로 "위 테스트 A 는 …" 라고 라벨로 지목한다. 신규 테스트가
    기존 `F.`(sole owner leave 불가)와 같은 라벨을 재사용했고, 삽입 위치도 `D → [새 F] → E → [기존 F] → G` 순으로
    기존 알파벳 순서를 깬다. 동작에는 영향 없으나(Jest 는 `it` 이름으로 실행 순서를 정하지
    않음), 이 파일 특유의 "라벨로 테스트를 지칭" 하는 가독성 관행을 이 PR 이 스스로 깬다 —
    다음 사람이 "테스트 F" 를 언급하면 어느 것인지 모호해진다.
  - 제안: 신규 테스트를 `J.` 로 재명명하고 파일 끝(또는 논리적 위치)으로 옮기거나, 기존 라벨을
    유지한 채 순서를 재정렬한다.

- **[INFO]** `findUserSecretLeaks` 의 재귀 walker 에 순환 참조 가드가 없다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts` 의 `walk` 함수 (`findUserSecretLeaks` 내부)
  - 상세: 현재 유일한 소비처(`res.body`)는 `supertest`/`JSON.parse` 를 거치므로 순환이 생길 수
    없어 실질 위험은 낮다. 다만 이 헬퍼는 `export` 돼 있고 독스트링이 "응답 본문 어디에도"
    라고 일반적으로 규정하므로, 향후 누군가 lazy relation 을 가진 raw 엔티티(TypeORM 순환
    참조 가능)에 직접 재사용하면 스택 오버플로/무한루프로 이어질 수 있다. 테스트에 순환
    입력 케이스가 없다.
  - 제안: 우선순위는 낮음. 재사용 범위를 넓힐 계획이 있다면 `WeakSet` 기반 방문 추적을
    추가하고 회귀 테스트 한 건을 붙인다.

- **[INFO]** `snakeCase` 축은 7개 비밀 키 중 1개(`passwordHash`)만 대표로 검증된다
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.spec.ts` — "snake_case 로 나가는 형태도 막는다" 테스트
  - 상세: `USER_SECRET_KEYS` 전체를 도는 루프 테스트는 camelCase 축만 검증하고, snake_case
    축은 `password_hash` 하나만 직접 단언한다. `FORBIDDEN` Set 은 `USER_SECRET_KEYS.map(snakeCase)`
    로 나머지 6개도 기계적으로 포함하므로 실질 위험은 낮지만(단순 정규식 치환이라 키별로
    갈릴 소지가 적음), camelCase 축과 동일한 밀도의 회귀 보장은 아니다.
  - 제안: 선택적. `for (const key of USER_SECRET_KEYS)` 루프를 snake_case 값에도 적용해
    대칭을 맞출 수 있다.

- **[INFO]** 가드는 관계 이름이 문자열 리터럴인 경우만 검출한다 (설계상 알려진 한계)
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `visit` 내부
    `ts.isStringLiteralLike(el)` / `ts.isStringLiteralLike(first)` 조건
  - 상세: `relations: [SOME_CONST]` 처럼 식별자를 통해 간접 참조하면 이 가드는 놓친다.
    저장소의 자매 가드들(`swagger-dto-contract-guard.ts` 등)도 같은 정적 리터럴 스캔
    철학을 공유하므로 이 자체는 새로운 결함이 아니라 알려진 트레이드오프지만, 이 가드는
    "감사 로그 유출을 놓친 선언 기반 검증자를 보완하는 마지막 방어선" 이라는 강한 주장을
    하므로 한계를 CHANGELOG/spec 어딘가에 한 줄로 명시해 두면 다음 사람이 "왜 이 형태는
    안 잡히지" 라는 재조사를 반복하지 않는다.
  - 제안: 선택적, 문서화만으로 충분.

## 좋았던 점 (참고용)

- `user-entity-exposure-guard.ts`/`user-entity-exposure.spec.ts` 는 양방향 래칫(새로 생겨도
  실패·투영으로 없애도 실패)과 양성 대조군 fixture(`user-relation-load.fixture.ts`)를 분리해,
  "fixture 없는 래칫은 술어가 죽어도 그린" 이라는 이 저장소의 기존 교훈을 정확히 반영했다.
  실제로 베이스라인 3곳/0곳을 실측 grep 으로 재현했고 일치했다.
- 두 검출 축(구조 기반 가드 vs 이름 기반 부재 단언)을 **의도적으로 서로 다른 실패 사유로
  분리**하고, `workspace-rbac.e2e-spec.ts` 의 새 테스트가 `expectNoUserSecrets` 를
  `assertMatchesContract` **앞에** 배치해 "선언 대조가 먼저 던지면 이름 축이 실행조차
  안 된다" 는 실제 관측(주석에 기록됨)을 코드 순서로 반영한 점은 테스트 설계로서 견고하다.
- `user-secret-absence.spec.ts` 는 헬퍼 자신의 회귀 가드를 갖추고, 통과 경로뿐 아니라 실패
  해야 하는 경로(각 비밀 키·중첩·배열·snake_case·null 값·유사 이름 오탐 방지·원시값 방어)를
  개별적으로 확인해 "헬퍼가 무르게 바뀌면 모든 e2e 가 동시에 조용히 통과한다" 는 위험을
  정면으로 다뤘다.
- 신규 e2e(`GET /:id/members`)가 실제로 미선언 필드(`joinedAt`)를 찾아낸 것은 테스트
  용이성·회귀 발견 능력을 보여주는 구체적 증거다.
- 회귀 대상 파일(`audit-logs.e2e-spec.ts`, `workspace-rbac.e2e-spec.ts`) 변경은 기존 단언을
  보존한 채 세 번째 축만 추가하는 형태라 기존 테스트의 유효성을 해치지 않는다.

## 요약

핵심 로직(`findUserRelationLoads`/`findUserSecretLeaks`)은 실제 저장소 코드로 재현 가능한
숫자(3곳/0곳)를 정확히 잡아내고, 두 검출 축을 서로 독립적으로 관측 가능하게 설계했으며,
헬퍼 자체의 회귀 가드까지 갖춘 보기 드물게 탄탄한 테스트 스위트다. 다만 뮤테이션 검증 결과
문서화된 대소문자 무시 분기(`isUserRelationPath`)가 어떤 테스트로도 관측되지 않는 사각지대가
실제로 확인됐고(WARNING), 신규 e2e 가 파일 고유의 라벨 참조 관행(알파벳 단일 문자)을 깨는
중복 라벨을 만들었다(WARNING). 둘 다 국소적이며 런타임 위험은 없다 — 전자는 검출 커버리지
갭, 후자는 가독성/유지보수성 문제다. 나머지는 INFO 수준의 선택적 보강이다.

## 위험도

LOW
