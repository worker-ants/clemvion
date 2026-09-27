# 테스트(Testing) 리뷰 — patch-omit-undefined (머지 후 재검토)

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Grep` 으로 실제 파일을 열어 diff 게이트 번호와 대조했다. 대상은 실제 코드·테스트 변경(파일 1~11)이며, `review/code/2026/09/27/13_50_41/*`·`review/consistency/2026/09/27/13_11_33/*`(파일 14~33)는 이전 리뷰 라운드의 산출물(마크다운/JSON)이라 테스트 관점 검증 대상이 아니다 — 다만 그 안의 이전 `testing.md`(파일 25)를 읽어 이번 라운드에서 지적했던 갭이 실제로 해소됐는지 대조했다.

- `codebase/backend/src/common/utils/omit-undefined.ts`·`.spec.ts`, `workflows.service.ts`·`.spec.ts`, `nodes.service.ts`·`.spec.ts`, `auth-configs.service.ts`·`.spec.ts`, `test/patch-partial-body.e2e-spec.ts` 를 전문 대조.
- `RESOLUTION.md`(파일 14)의 조치 표와 실제 커밋 결과물을 대조 — SUMMARY #1(Critical, `settings: null` 500 회귀) · INFO 4(`toolOwnerId` 미가르는 fixture) · INFO 5(명시적 null 캐너리)가 코드에 실제로 반영됐는지 확인.

## 발견사항

- **[INFO]** §5.4 tri-state "명시적 `null` → 값 지움" 회귀 캐너리가 `workflows` 한 곳에만 추가되고 `nodes`·`auth-configs` 는 미해결로 남음 — 이전 라운드 INFO 5 의 부분 해소
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts:492`(`it('명시적 null 은 로드한 값을 지운다', …)`, 신규) 대비 `codebase/backend/src/modules/nodes/nodes.service.spec.ts`(191번째 줄 근방 describe 블록 전체) · `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:355`(`describe('update — 보내지 않은 필드', …)`)에는 대응하는 케이스 없음(파일 전체 `grep "명시적 null"` 0건).
  - 상세: 이전 라운드(`review/code/2026/09/27/13_50_41/testing.md` INFO #2)가 "이번 세 표면(workflows·nodes·auth-configs) 어디에도 명시적 `null` 로 지우는 경로가 테스트되지 않는다"고 지적했고, `RESOLUTION.md`(파일 14, INFO 5행)는 "명시적 null → 값 지움(§5.4 tri-state) 캐너리를 **워크플로 단위**에 추가"라고만 적었다 — 실제로도 `workflows.service.spec.ts`에만 `description: null, folderId: null` 케이스가 생겼다. 그런데 이번 PR 의 CHANGELOG 가 명시한 회귀 대상 nullable 필드는 워크플로의 `description`/`folderId`뿐 아니라 **노드의 `description`/`containerId`**, **인증 설정의 `ipWhitelist`**도 포함한다 — 이 두 표면은 여전히 "보내지 않은 필드(undefined)로 로드한 값을 덮지 않는다"(undefined-보존) 케이스만 있고, "명시적으로 `null` 을 보내면 실제로 지워진다"(null-초기화) 케이스는 없다. `omitUndefined` 헬퍼 자체는 `null` 보존을 이미 `omit-undefined.spec.ts:4`에서 일반적으로 검증하므로 기능적 결함일 가능성은 낮지만, 세 서비스가 동일 헬퍼를 각자 호출하는 배선(`Object.assign(node, omitUndefined(dto))`, `Object.assign(config, omitUndefined(rest))`)이 향후 `?? {}`류 방어 코드나 조건 추가로 `null` 까지 걸러내도록 바뀌는 회귀는 nodes·auth-configs 쪽에서 어느 테스트도 잡지 못한다 — 정확히 CHANGELOG 가 "null 로 실렸다"고 적은 그 필드들이다.
  - 제안: `nodes.service.spec.ts`·`auth-configs.service.spec.ts` 각각에 workflows 와 대칭인 "명시적 null 은 로드한 값을 지운다"(예: `description: null`/`containerId: null`, `ipWhitelist: null`) 캐너리 1개씩 추가.

- **[INFO]** e2e·단위 모두 실제 DTO 인스턴스(`useDefineForClassFields`)로 재현해 회귀 형태를 정확히 고정 — 양성 확인
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts:191`(`Object.assign(new UpdateNodeDto(), { label: 'API Call' })`), `codebase/backend/src/modules/workflows/workflows.service.spec.ts:465`·`428`·`447`, `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts:358`~`382`
  - 상세: 세 서비스 전부 plain object 리터럴이 아니라 `new XxxDto()` 인스턴스에 `Object.assign` 한 값을 넘겨 "보내지 않은 optional 필드가 `undefined` own property 로 존재"하는 실제 프로덕션 조건을 그대로 재현한다. `nodes.service.ts`는 서비스 시그니처가 `UpdateNodeDto`를 직접 받아 캐스트 없이 넘기고, `workflows`/`auth-configs`는 서비스가 `Partial<Entity>`를 받아 `as Partial<AuthConfig>` 캐스트가 붙는데 이는 실제 서비스 시그니처(`auth-configs.service.ts:228` `data: Partial<AuthConfig>`)와 일치하는 정상적인 타입 정합이지 회피용 캐스트가 아니다.
  - 제안: 없음(양성 확인).

- **[INFO]** `nodes.service.spec.ts:220`의 "응답에 IDOR 검사용 workflow 관계를 싣지 않는다" 테스트가 실제로 discriminating — mock fixture 확인
  - 위치: `codebase/backend/src/modules/nodes/nodes.service.spec.ts`(`makeNode` 헬퍼가 `node.workflow = makeWorkflow(...)` 를 항상 채움) + 신규 테스트 `it('응답에 IDOR 검사용 workflow 관계를 싣지 않는다', …)`
  - 상세: 이전 라운드가 뮤턴트 N1(`Omit<Node,'workflow'>` 스트립 제거)로 RED 를 실측했다고 기록했는데, `makeNode`가 `workflow` 필드를 항상 채우는 fixture라 이 단언이 "우연히 workflow 가 없어서 통과"하는 vacuous 케이스가 아님을 코드 대조로 확인했다.
  - 제안: 없음(양성 확인, 중복 지적 방지 목적).

- **[INFO]** `omit-undefined.spec.ts`의 배열 캐너리(`@ts-expect-error`)는 jest 실행 단계에서 게이트 기능이 없고 build 타입체크 ratchet에 전적으로 의존 — 주석이 스스로 정확히 명시
  - 위치: `codebase/backend/src/common/utils/omit-undefined.spec.ts:49`~`58`
  - 상세: `it('배열은 받지 않는다 …')` 테스트 자체는 런타임에 `omitUndefined([1, undefined])`를 실제로 호출해 `{0:1}`이 되는 런타임 동작만 확인하고, "배열을 막는다"는 타입 계약은 `@ts-expect-error`가 사라지면(TS2578) build 단계에서만 잡힌다. 이는 프로젝트 관례(`typecheck ratchet 은 build 안에서 돈다`)와 일치하고 주석도 정확히 그렇게 적어 오독 위험이 낮다 — 새 지적 아님, 정확성만 기록.
  - 제안: 없음(양성 확인).

## 점검 관점별 요약

1. **테스트 존재 여부**: `omitUndefined` 신규 동작(빈 객체/전체 undefined DTO, 배열 가드) + 3개 서비스(workflows·nodes·auth-configs)의 "보내지 않은 필드" 회귀 + 신규 e2e 4케이스(A~D) 모두 대응하는 테스트가 존재.
2. **커버리지 갭**: 위 INFO 1건 — 명시적 `null` 초기화 경로가 nodes·auth-configs 에는 없음(workflows 만 해소).
3. **엣지 케이스**: 빈 객체 · 전체-undefined DTO · `settings: null` · `settings: {}` · 배열 가드 모두 커버.
4. **Mock 적절성**: `auth-configs`는 in-memory Map 기반 fake(`save`가 실제 저장), `workflows`/`nodes`는 save-identity mock — 둘 다 실제 동작과 괴리가 낮다.
5. **테스트 격리**: `beforeEach`로 mock 재설정, 각 `it` 가 자체 fixture를 구성해 순서 의존 없음.
6. **테스트 가독성**: 각 테스트 주석이 "무엇을·왜·어느 e2e/헬퍼가 고정하는지"를 명시해 의도가 명확.
7. **회귀 테스트**: 이전 라운드가 실측한 뮤턴트(P1: workflows `rest` 병합 원복, N1: nodes `workflow` 스트립 제거)가 신규 테스트로 KILLED 됨을 코드/fixture 대조로 재확인.
8. **테스트 용이성**: 세 서비스 모두 `Object.assign(entity, omitUndefined(x))` 형태로 일관 배선돼 있어 헬퍼 단위 테스트가 서비스 레이어 신뢰도를 높이는 구조 — 의존성 주입 문제 없음.

## 요약

핵심 회귀(워크플로 `settings: null` 500, 세 PATCH 응답의 거짓 null/키 부재, 노드 응답의 `workflow` 유출)는 단위·e2e 양쪽에서 실제 DTO 인스턴스 기반으로 정확히 재현·고정됐고, 이전 라운드가 지적한 갭(`toolOwnerId` 미가르는 fixture, `NotArray<T>` JSDoc)도 이번 커밋에서 해소가 확인된다. 다만 이전 라운드가 "세 표면 모두에 명시적 `null` 초기화 캐너리가 없다"고 지적한 항목은 `RESOLUTION.md`상 "워크플로 단위에 추가"로 1/3만 해소됐고, CHANGELOG 가 명시한 nodes(`description`/`containerId`)·auth-configs(`ipWhitelist`)의 null-초기화 경로는 여전히 미검증 상태로 남아 있다 — 기능적으로는 공용 헬퍼가 이미 `null` 을 보존하므로 현재 버그일 가능성은 낮지만, 두 서비스 배선에 대한 회귀 방지막은 비어 있다. 그 외 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
