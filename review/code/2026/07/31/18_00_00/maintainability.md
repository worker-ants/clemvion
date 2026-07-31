# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 대상
- `codebase/backend/src/modules/workflows/workflows.controller.ts`
- `codebase/backend/src/modules/workflows/workflows.service.spec.ts`
- `codebase/backend/src/modules/workflows/workflows.service.ts`
- `plan/in-progress/review-info-followups.md`

### 발견사항

- **[INFO]** Swagger `description` 배열+`join(' ')` 포맷이 이 엔드포인트 하나에만 적용되어, 같은 파일의 더 긴 description 들과 스타일이 갈린다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:214-220` (`@Post(':id/duplicate')` 의 `@ApiOperation`)
  - 상세: `duplicate` 엔드포인트의 237자 description 만 `[...].join(' ')` 배열 형태로 나눴다. 같은 파일에서 이보다 길거나 비슷한 description 들 — `graphWarnings`(약 400자, 122-123행), `executeNode`의 노드 실행(약 309자, 346-347행), `findAll`(약 265자, 86-87행), `saveCanvas`(약 215자, 440-441행) — 은 이 diff 이후에도 여전히 개행 없는 단일 문자열 그대로다. "장문 description 은 배열로 쪼갠다"는 패턴이 파일 전체에 일관 적용되지 않고 이번에 손댄 한 곳에만 존재한다. (join 결과를 원문과 문자 단위로 대조해 내용 변경이 없음은 확인했다 — 이 항목은 순수 포맷 일관성 문제다.)
  - 제안: 이 포맷을 새 컨벤션으로 채택할 것이면 파일 내 다른 장문 description 에도 동일하게 적용하거나 기준(예: N자 이상)을 정해 문서화한다. 아니라면 "이번에 지적된 항목만 국소 개선했다"는 의도를 남겨 다음 편집자가 패턴 불일치를 결함으로 오인하지 않게 한다. 블로킹 사유는 아니다.

- **[INFO]** `mockTransactionManager.find` 커스텀 override 보일러플레이트가 `duplicate` describe 블록 내 4곳에서 사실상 동일하게 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.spec.ts` — `beforeEach`(약 502-506행), 이번에 추가된 "노드만 있고 엣지가 0건이면 Node insert 만 호출한다"(678-683행), 기존 "노드가 사라져 endpoint 를 못 찾는 엣지는 skip 한다"(703-711행), "노드가 사라져 엣지의 source 를 못 찾는 경우도 skip 한다"(724-734행)
  - 상세: 네 곳 모두 `mockTransactionManager.find = jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity === Node ? <nodes> : <edges>))` 형태를 그대로 복붙한다. 이번 diff 가 이 패턴에 1건(678-683행)을 더 추가해 반복 수가 3→4로 늘었다. 기존 파일 스타일을 그대로 따른 것이라 새로 만든 문제는 아니지만, 누적되는 중복이다.
  - 제안: `const setFindResult = (nodes: unknown[], edges: unknown[]) => { mockTransactionManager.find = jest.fn().mockImplementation((entity) => Promise.resolve(entity === Node ? nodes : edges)); };` 같은 로컬 헬퍼로 추출하면 4곳의 중복을 없애고, nodes/edges 인자를 실수로 바꿔 넣는 것도 방지된다. 지금 당장 블로킹할 정도는 아니며 이 describe 블록을 다음에 만질 때 함께 정리해도 무방하다.

### 요약

이번 변경은 `#1033` 리뷰가 "필수 아님"으로 보류했던 INFO 10건 중 실제 가치가 있는 4건(엣지 `condition` 참조 격리 버그 수정, 엣지 0건 조합 회귀 테스트 추가, `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` 네이밍 통일, Swagger description 가독성 개선)만 선별해 처리한 소규모·저위험 정비 PR이다. 네이밍 리네임은 grep 으로 확인한 결과 코드·주석 전역에서 빠짐없이 완료됐고(`nodeEntities`/`edgeEntities` 잔존 0건), 새 이름은 코드베이스 전반에서 이미 쓰이는 `*Rows` 관례(`cappedRows`, `completedRows`, `pageRows`, `entRows`, `countRows`, `emailRows` 등)와도 일치해 로컬 일관성뿐 아니라 프로젝트 전체 네이밍 컨벤션에도 부합한다. `edge.condition` 얕은 복사 수정은 바로 위 `node.config` 처리와 대칭을 이루고, 새 단언 2건은 mutation 테스트(가드 제거 시 RED)로 non-vacuous 함이 검증됐다. Swagger 설명 분리는 `join(' ')` 결과가 원문과 문자 단위로 동일함을 직접 대조해 내용 변경이 없음을 확인했다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 관점에서 이 diff 가 새로 만든 문제는 없으며, TypeORM 타입 우회로 인한 "3중 필드 집합 중복"(Node/Edge 컬럼을 `duplicate`/`importWorkflow`/`syncNodes·syncEdges` 세 곳에 손으로 맞춰야 하는 구조)은 이 PR 이전부터 존재하고 코드 주석으로 이미 명시적으로 추적되는 기존 리스크이며, 이번 diff 는 그 주석의 상호참조를 오히려 정확하게 고쳤을 뿐 새로 악화시키지 않았다. 발견된 두 건은 모두 INFO 수준의 사소한 일관성/중복 관찰로 병합을 막을 이유가 되지 않는다. `plan/in-progress/review-info-followups.md` 의 처분 근거 서술(조치 4건/보류 6건의 내용과 실측 수치)도 실제 diff 와 정확히 일치함을 확인했다.

### 위험도
LOW
