# 유지보수성(Maintainability) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** Swagger 리플렉션 메타데이터 키 상수가 형제 가드 파일과 문자 그대로 중복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:17-18` (`SWAGGER_EXCLUDE_ENDPOINT`, `SWAGGER_EXCLUDE_CONTROLLER`)
  - 상세: 같은 이름·같은 값의 상수가 `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:27-28` 에도 그대로 존재한다(`grep` 로 확인). 파일 헤더 주석이 "형제 가드와 같은 사정"이라고 명시하며 의도적 선택임을 밝히고 있어 이번 PR 의 실수는 아니다 — 각 가드가 독립적으로 안전망을 갖도록 하는 기존 설계 패턴을 그대로 따른 것이다. 다만 두 파일째 반복되는 시점이라, 세 번째 가드가 같은 키를 또 필요로 하면 공유 상수 모듈(`swagger-metadata-keys.ts` 류)로 추출할 시점이 됐다는 신호로 남겨 둘 만하다.
  - 제안: 지금 당장 추출을 요구하지 않는다(이 저장소는 "4번째 유사 사례가 생기면 공유 헬퍼로 추출" 관행을 이미 `swagger-probe.ts` 헤더 주석에서 명문화하고 있다 — 같은 기준을 적용하면 된다). 세 번째 소비처가 생기는 시점에 재검토 권장.

- **[INFO]** `'design:paramtypes'` 리플렉션 키 문자열이 3곳에서 반복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:83`, `codebase/backend/src/shared/testing/swagger-probe.ts:159`, `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:30`
  - 상세: TypeScript `emitDecoratorMetadata` 의 표준 리플렉션 키라 저장소 밖에서도 흔히 쓰이는 상수라 위험도는 낮지만, 문자열이 어긋나면(오타) 조용히 `undefined` 를 반환해 판정이 항상 통과하는 방향으로 실패한다(`design:paramtypes` 없으면 두 소비처 모두 명시적으로 throw 하므로 실제로는 안전망이 있다 — `swagger-probe.ts:163`, 그리고 `request-body-advertised-guard.ts` 는 `types?.[index]` 로 `undefined` 를 그대로 비검증으로 처리해 이 역시 파이프와 같은 축이라 의도된 동작이다).
  - 제안: 이번 PR 범위에서 조치 불요. 새 소비처가 하나 더 생기면(4번째) 공유 상수로 추출 검토.

- **[INFO]** `isUnschematized` 의 타입 캐스팅이 다소 우회적이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:42-47` (`(UNVALIDATED_METATYPES as readonly unknown[]).includes(designType)`)
  - 상세: `UNVALIDATED_METATYPES` 가 `readonly Function[]` 로 export 되어 있어 `unknown` 타입의 `designType` 과 `.includes` 비교가 타입 불일치를 일으키므로 배열 쪽을 `unknown[]` 로 넓혀 캐스팅했다. 안전한 방향(값이 아니라 컨테이너 타입을 넓힘)이라 실질적 위험은 없고, 함수 자체에 캐스팅 이유를 설명하는 JSDoc 이 붙어 있어 읽는 사람이 헤매지 않는다.
  - 제안: 조치 불요 — 현재 방식이 `designType as Function` 캐스팅(불안전한 값 단언)보다 안전하다.

## 양호한 점 (참고)

- `codebase/backend/src/common/pipes/validation.pipe.ts`: 인라인 배열 리터럴이었던 비검증 타입 목록을 `export const UNVALIDATED_METATYPES` 로 승격해 가드와 파이프가 **동일한 소스**를 참조하게 만들었다 — 두 곳이 갈리는 오류 클래스를 원천 차단하는 좋은 리팩터링이며, JSDoc 이 "가드가 이 상수를 그대로 쓴다"는 계약을 명시해 다음 사람이 실수로 갈라 적을 위험을 줄인다.
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`: 함수들(`isUnschematized`/`isExcluded`/`advertisesBody`/`scanRequestBodyAdvertised`)이 각각 단일 책임으로 짧게 분리되어 있고, 메인 순회 함수도 early-continue 로 중첩을 2단계 이내로 억제했다. 순환 복잡도가 낮고 네이밍이 전부 술어형(is-/advertises-)으로 일관적이다.
- `codebase/backend/src/shared/testing/swagger-probe.ts`: `bodyParamDesignType` 안에 인라인돼 있던 `@Body()` 자리 탐색 로직을 `bodyArgIndexes` 로 추출해 가드와 헬퍼가 같은 함수를 공유하게 만든 것은 중복 제거의 모범 사례다(추출 전: 가드 쪽에 같은 로직이 새로 복붙될 뻔한 지점).
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised.spec.ts`: 헤더 JSDoc 이 "왜 이 가드인가/무엇을 대조하나/왜 AST 가 아닌가/못 보는 것/베이스라인" 을 표와 함께 정리해 의도가 매우 명확하다. 대조군 컨트롤러의 각 핸들러에 한 줄 주석으로 "무엇을 테스트하는지 + 위반/통과 여부"를 달아 가독성이 높고, `checked`/`unschematized` floor 로 vacuous 테스트를 방지하는 구조도 갖췄다.
- 명명·구조·frontmatter 삽입 위치가 형제 가드(`forbidden-response-codes-guard.ts`, `http-status-advertised-guard.ts`)의 기존 패턴을 그대로 모사해 코드베이스 스타일 일관성이 높다(병렬 consistency-check 리포트의 `naming_collision`/`convention_compliance` 결과와도 부합).

- `review/consistency/2026/09/26/{18_59_58,19_09_17}/**`, `plan/in-progress/*.md`, `spec/conventions/swagger.md`, `CHANGELOG.md`: 순수 문서/프로세스 산출물이라 함수 길이·중첩·순환 복잡도 등 코드 유지보수성 관점의 발견사항 없음. 형식(frontmatter, 표, 날짜순 append)이 기존 관행과 일치한다.

## 요약

이번 변경은 함수를 작고 단일 책임으로 유지하고, 파이프와 가드 사이의 판정 축을 하나의 export 상수(`UNVALIDATED_METATYPES`)로 공유하도록 리팩터링했으며, 헬퍼 중복 로직(`bodyArgIndexes`)을 추출해 실질적인 중복 제거를 이뤘다. 테스트 파일은 의도·대조 기준·베이스라인을 JSDoc 표로 명시하고 각 대조군 케이스에 위반/통과 사유를 주석으로 달아 가독성이 매우 높다. 유일하게 남는 것은 형제 가드 파일과 문자 그대로 겹치는 Swagger 메타데이터 키 상수 2개인데, 이는 이번 PR 의 실수가 아니라 저장소가 이미 채택한 "가드별 독립 안전망" 설계를 그대로 따른 것이고 헤더 주석에도 그 사정이 명시돼 있어 지금 추출을 강제할 근거는 약하다. 전반적으로 가독성·네이밍·함수 길이·중첩·복잡도·기존 스타일 일관성 모든 축에서 CRITICAL/WARNING 급 문제는 없다.

## 위험도

NONE
