# 유지보수성(Maintainability) 리뷰

## 개요

`origin/main...HEAD` 의 실제 코드 변경분(`codebase/**`, 20개 파일)을 대상으로 분석했다.
나머지 다수의 리뷰 대상 파일(`review/**`, `plan/**`, `CHANGELOG.md`)은 이전 9차례
`/ai-review`·`/consistency-check` 라운드의 산출물이며 코드가 아니므로 이 관점에서는
직접 다루지 않았다.

이 브랜치는 `User` 엔티티 컬럼 노출을 잡는 검출 3축(`user-entity-exposure-guard.ts`
구조 축, `dto-jsdoc-citation-guard.ts` JSDoc 인용 축, `user-secret-absence.ts` 값 축)과
그 소비 지점(`WorkflowVersionsService.findOne` 실유출 수정, `TriggersService` 의
`endpoint_path` UNIQUE 충돌 계약 구현, 여러 e2e)으로 구성된다. 이미 9차례 라운드를 거치며
가독성·네이밍·중첩 깊이·매직 넘버·복잡도 면에서 상당히 다듬어져 있고, 이전 라운드가 지적한
항목(e2e 라벨 충돌, fixture 경로 인라인 중복, 미사용 `line` 필드, JSDoc orphan 블록)은
직접 코드를 열어 확인한 결과 전부 해소되어 있었다 — 재발 없음.

새로 찾은 것은 아래 두 건이며, 둘 다 가장 최근 커밋(`0fd4d2f29`, `pg-error.ts` SoT 로
`isEndpointPathUniqueViolation` 을 재작성한 라운드)에서 생겼다.

## 발견사항

- **[WARNING]** 두 spec 파일이 "PG 에러의 두 wrap 표면" 을 만드는 테스트 헬퍼를 각자 손으로 재작성했다
  - 위치: `codebase/backend/src/common/db/pg-error.spec.ts:15-21`(`wrapped`/`flat` 헬퍼) vs `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2801-2817`(`uniqueViolation` 헬퍼)
  - 상세: 두 함수는 정확히 같은 개념 — `QueryFailedError`(`driverError.code`/`driverError.constraint` 표면)와 평평한 `Error`(`code`/`constraint` 최상위 표면)를 만들어 "두 wrap 표면을 각각 태운다" — 을 구현한다. `triggers.service.spec.ts` 의 JSDoc 은 이 헬퍼가 존재하는 이유를 `pg-error.spec.ts` 와 **같은 문장**으로 설명한다("TypeORM 은 호출 경로에 따라 `err.code` 로 올리기도 하고 `err.driverError.code` 로 올리기도 한다"). 이 PR 자신이 프로덕션 코드에서 정확히 이 문제("SQLSTATE·인덱스명 추출을 손으로 다시 짜서 4번째 사본이 됐다")를 지적하고 `common/db/pg-error.ts` 를 SoT 로 세웠는데, 그 SoT 의 **테스트 픽스처 생성 로직**은 같은 패턴으로 두 곳에 복제됐다. 다음에 TypeORM 이 wrap 형태를 한 번 더 바꾸면(예: 세 번째 표면이 생기면) 두 파일을 각각 찾아 고쳐야 하고, 하나만 고치면 그 파일의 "두 표면 각각 태운다" 는 전제가 조용히 반쪽이 된다 — 이 PR 이 프로덕션 코드에서 막으려 한 것과 같은 결함 클래스다.
  - 제안: `common/db/__test-utils__/pg-error-fixtures.ts`(저장소에 이미 있는 `common/__test-utils__/` 명명 관례를 그대로 따름)에 `makePgUniqueViolation(constraint, surface)` 형태로 한 번만 선언하고, 두 spec 이 그것을 import 해서 쓰도록 통합한다.

- **[WARNING]** 새 JSDoc 블록과 그것이 설명하는 함수 선언 사이에 빈 줄이 끼어 있어, 파일 전체의 확립된 관례(JSDoc 은 대상 선언에 바로 붙는다)에서 벗어난다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:215-223` — JSDoc 블록(`215`~`221` "`SQLSTATE·인덱스명 추출은 ... SoT 다`")과 `export function isEndpointPathUniqueViolation`(`223`) 사이에 빈 줄 하나(`222`)가 있다.
  - 상세: 이 파일의 다른 모든 JSDoc(예: 바로 위 `narrowWorkflowRef`, `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 등)은 대상 선언 바로 위에 빈 줄 없이 붙어 있다. `awk` 로 이번 diff 가 건드린 6개 파일을 전수 확인한 결과 이 패턴(JSDoc 닫는 `*/` 다음에 빈 줄, 그다음 `export`)은 이 한 자리뿐이다. TypeScript 의 `ts.getJSDocCommentsAndTags` 는 빈 줄 하나를 사이에 둬도 여전히 이 JSDoc 을 해당 함수에 귀속시키므로(직접 `ts.createSourceFile` 로 재현해 확인) 기능적 결함은 아니지만, 이 PR 이 반복해서 겪은 "JSDoc 블록이 시각적으로 엉뚱한 자리에 붙어 헷갈렸다" 는 결함 클래스(`review/code/2026/09/06/11_55_36` 문서화 WARNING — `findEagerUserRelations`/`collectUserRelationNames` orphan JSDoc)와 같은 성격의 사소한 재발이다. 사람이 눈으로 훑을 때는 빈 줄이 "이 주석은 위 상수에 대한 후기이거나 독립 코멘트" 라는 인상을 줄 수 있다.
  - 제안: `222` 번 빈 줄을 지워 JSDoc 을 `isEndpointPathUniqueViolation` 선언에 바로 붙인다.

## 요약

핵심 프로덕션 변경(`WorkflowVersionsService` 의 `creator` 투영 통일, `TriggersService` 의 `endpoint_path` UNIQUE 충돌 계약, `User` 노출 방어 3축 가드)은 함수가 단일 책임을 유지하고, 네이밍이 역할을 정확히 드러내며(`ProjectedCreator`/`CREATOR_PROJECTION`/`isPostgresUniqueViolation`/`findUserSecretLeaks` 등), 각 결정의 "왜" 를 실측과 함께 남겨 이미 상당히 다듬어진 상태다. 이전 8차례 라운드가 지적한 결함(e2e 라벨 충돌, fixture 경로 인라인 중복, 미사용 필드, JSDoc 위치 오류)은 직접 코드를 열어 확인한 결과 전부 재발 없이 해소돼 있었다. 이번 라운드에서 새로 찾은 것은 가장 최근 커밋이 만든 국소적인 두 건뿐이다 — 테스트 헬퍼 하나가 SoT 추출을 둘러싼 프로덕션 원칙(출처를 하나로)을 정작 자기 테스트 픽스처에는 적용하지 못한 것(WARNING), 그리고 JSDoc 하나가 관례에서 벗어난 빈 줄로 대상과 분리된 것(WARNING, 기능 영향 없음). 둘 다 국소적이고 수정 비용이 낮다.

## 위험도

LOW
