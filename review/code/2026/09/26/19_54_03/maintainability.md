# 유지보수성(Maintainability) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** Swagger 리플렉션 메타데이터 키 상수가 형제 가드 파일과 문자 그대로 중복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:16-18` (`SWAGGER_API_PARAMETERS` · `SWAGGER_EXCLUDE_ENDPOINT` · `SWAGGER_EXCLUDE_CONTROLLER`)
  - 상세: 같은 값의 `SWAGGER_EXCLUDE_ENDPOINT` · `SWAGGER_EXCLUDE_CONTROLLER` 가 `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes-guard.ts:27-28` 에도 그대로 있다(확인함). 파일 헤더 주석(`request-body-advertised-guard.ts:11-15`)이 "패키지가 `dist/constants` 를 `exports` 로 열지 않아 값을 옮겨 적었다 … 형제 가드와 같은 사정" 이라고 의도를 명시하고 있어 이번 PR 의 실수가 아니라 저장소가 채택한 "가드별 독립 안전망" 패턴이다. 직전 라운드(`review/code/2026/09/26/19_32_47/maintainability.md`)에서 이미 INFO 로 지적됐고 이번 라운드의 조치 대상(`RESOLUTION.md`)에도 없어 상태 변화가 없다.
  - 제안: 지금 추출을 요구하지 않는다. 세 번째 가드가 같은 키를 필요로 하는 시점에 공유 모듈로 추출 검토.

- **[INFO]** `'design:paramtypes'` 리플렉션 키 문자열이 3곳에서 반복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:83`, `codebase/backend/src/shared/testing/swagger-probe.ts:158`(변수 재사용 전 `bodyParamDesignType` 내부), `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` 의 기존 소비처
  - 상세: 오타가 나면 조용히 `undefined` 를 반환하는 실패 모드지만, 두 주 소비처(`swagger-probe.ts:163-166`, `request-body-advertised-guard.ts` 는 `types?.[index]` 로 비검증 취급)가 각각 안전망을 갖고 있어 위험은 낮다. 직전 라운드에서 이미 INFO 로 지적됐고 이번 라운드에서 변화 없음.
  - 제안: 조치 불요. 4번째 소비처가 생기면 공유 상수 검토.

- **[INFO]** `isUnschematized` 의 `unknown[]` 캐스팅은 우회적이나 안전한 방향이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts:42-47` (`(UNVALIDATED_METATYPES as readonly unknown[]).includes(designType)`)
  - 상세: `UNVALIDATED_METATYPES` 가 `readonly Function[]` 이고 `designType: unknown` 이라 `.includes` 비교 시 타입이 어긋나 배열 쪽을 넓혀 캐스팅했다. 값이 아닌 컨테이너 타입만 넓히는 안전한 선택이고 JSDoc(같은 함수 바로 위)이 이유를 설명한다. 직전 라운드와 동일 상태.
  - 제안: 조치 불요.

## 이번 라운드에서 개선된 점 (직전 라운드 지적의 해소)

- 직전 라운드(19_32_47) WARNING #1(`UNVALIDATED_METATYPES` 가 export 된 전역 가변 목록)을 `Object.freeze` 로 해소 — `codebase/backend/src/common/pipes/validation.pipe.ts:18-24`. 파이프 spec 에 "얼려 있다"(`validation.pipe.spec.ts:118-120`)와 "목록의 설계 타입이면 값을 그대로 넘긴다"(`:123-131`)를 직접 단언으로 고정해, 이 상수를 다시 가변으로 되돌리는 회귀를 테스트가 잡는다.
- 직전 라운드 WARNING #2(`Number`·`Boolean`·`Array` 가 대조군에서 개별 관측되지 않음)를 대조군 라우트 3개(`numberBody` · `booleanBody` · `arrayBody`, `request-body-advertised.spec.ts:124-134`)로 해소 — 목록에서 하나가 빠지면 해당 위반이 대조군 단언(`:172-187`)에서 사라져 RED 가 된다.
- 직전 라운드 INFO(정렬 1차 키가 대조군에서 순서를 가르지 않음)를 `AlphaBodyFixtureController.zInline`(`request-body-advertised.spec.ts:150-154`)으로 해소 — 컨트롤러명이 앞서고 핸들러명은 뒤로 가게 설계해 1차 키(`controller.localeCompare`)가 실제로 순서를 가르는지 단언(`:178`)이 검증한다.
- 직전 라운드 INFO(`bodyArgIndexes` 의 다중 키 오름차순 동작이 전용 테스트로 검증되지 않음)를 `swagger-probe.spec.ts:100-105` 의 직접 단언으로 해소.

## 양호한 점 (참고)

- `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`: `isUnschematized`/`isExcluded`/`advertisesBody`/`scanRequestBodyAdvertised` 로 단일 책임 분리, early-`continue` 로 중첩 2단계 이내, 네이밍이 술어형(`is-`/`advertises-`)으로 일관적이다.
- `codebase/backend/src/shared/testing/swagger-probe.ts`: `bodyParamDesignType` 내부 로직을 `bodyArgIndexes` 로 추출해 가드와 헬퍼가 같은 함수를 공유 — 진짜 중복 제거.
- `codebase/backend/src/common/pipes/validation.pipe.ts`: 지역 배열을 `export const UNVALIDATED_METATYPES` 로 승격해 파이프와 가드가 **동일 소스**를 참조 — 두 곳이 갈리는 오류 클래스를 원천 차단.
- `plan/in-progress/request-body-guard.md`, `spec/conventions/swagger.md`, `CHANGELOG.md`: 순수 문서/프로세스 산출물이라 코드 유지보수성 관점 발견사항 없음. `review/code/2026/09/26/19_32_47/**` 는 이전 라운드 산출물로 이번 라운드의 코드 변경 대상이 아니다.

## 요약

이번 라운드는 직전 `/ai-review` 1R 의 Warning 2건(전역 가변 상수·대조군 커버리지 공백)과 INFO 2건(정렬 1차 키·다중 `@Body()` 오름차순 미검증)을 정확히 지목된 지점에서 해소한 조치 커밋이다. 함수는 여전히 짧고 단일 책임이며, 파이프-가드 간 판정 축을 하나의 export 상수로 공유하는 설계가 `Object.freeze` 로 한층 견고해졌고, 새 테스트들이 회귀를 구조적으로 방지한다. 남는 것은 형제 가드 파일과 겹치는 Swagger 메타데이터 키 상수 2개, `'design:paramtypes'` 문자열 3중 반복, 우회적이지만 안전한 타입 캐스팅 1건뿐이며 모두 직전 라운드에서 이미 INFO 로 확인·수용된 상태로 변화가 없다. 가독성·네이밍·함수 길이·중첩·순환 복잡도·기존 스타일 일관성 어느 축에서도 CRITICAL/WARNING 급 문제는 없다.

## 위험도

NONE
