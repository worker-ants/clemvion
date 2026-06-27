# Maintainability Review

## 발견사항

### 파일 1: `llm-model-config.controller.ts`

- **[INFO]** `@ApiTooManyRequestsResponse` 설명 문자열 반복
  - 위치: 전체 파일 내 3개 핸들러 (previewModels·testConnection·listModels)
  - 상세: `'요청 빈도 초과 (분당 10회)'` 문자열 리터럴이 3곳에 그대로 복사됨. 이번 diff 에서 도입된 것이 아닌 pre-existing 이슈지만, 스로틀 상수(`PROVIDER_PROBE_THROTTLE`) 를 공통화한 것과 일관성이 없다. 숫자/단위가 바뀌면 3곳을 동시에 수정해야 한다.
  - 제안: `PROVIDER_PROBE_THROTTLE` 상수 정의 근처에 `PROVIDER_PROBE_THROTTLE_DESCRIPTION = '요청 빈도 초과 (분당 10회)'` 상수를 선언하거나, description 을 `throttle.ts` SOT 에서 파생하는 헬퍼를 두어 DRY 확보. 단, 규모가 작아 우선순위는 낮음.

- **[INFO]** 변경된 두 `@ApiOkWrappedArrayResponse` 데코레이터 내용이 동일
  - 위치: line 158-160, 212-214
  - 상세: `previewModels`·`listModels` 두 핸들러 모두 동일한 `description: '사용 가능한 모델 목록'` 을 사용. 엔드포인트가 서로 다른 경로/메서드를 가지므로 반복 자체는 적절하다. 다만 description 차이가 없어 Swagger UI 에서 구분이 어렵다.
  - 제안: `previewModels` 는 `'저장되지 않은 자격증명으로 조회한 모델 목록'`, `listModels` 는 `'저장된 자격증명으로 조회한 모델 목록'` 등으로 구체화하면 Swagger 가독성이 개선된다 (필수 수정은 아님).

### 파일 2: `model-config-response.dto.ts`

- **[INFO]** JSDoc 에 cross-file 절대 경로 참조
  - 위치: `ModelInfoDto` JSDoc (`llm/interfaces/llm-client.interface.ts`)
  - 상세: 파일 이동·리팩터 시 주석이 stale 될 수 있다. 이 코드베이스 내 다른 DTO 는 동일 패턴을 사용하므로 위반은 아니다.
  - 제안: 현 코드베이스 관례와 동일하므로 변경 불필요. 필요 시 경로 대신 인터페이스 명(`ModelInfo` in `llm-client.interface.ts`)만 언급하는 형식으로 수정 가능.

- **[INFO]** JSDoc 내 구현 역사(폐기 이유) 기술
  - 위치: `ModelInfoDto` 클래스 JSDoc (5줄 분량 역사 설명)
  - 상세: `ModelListDto` 폐기 배경을 클래스 주석에 포함한다. 이번 변경 직후에는 맥락 전달에 유용하나, 장기적으로는 쓸모없는 역사 정보가 됨.
  - 제안: 역사 설명(`종전 ModelListDto ... 폐기했다.` 문장)은 git 커밋 메시지로 이전하고, JSDoc 은 현재 wire shape 설명만 남겨두는 것이 클래스를 처음 읽는 사람에게 더 깔끔하다. 비강제 권고.

- **[NONE/긍정]** `ModelItemDto` + `ModelListDto` 두 클래스를 `ModelInfoDto` 하나로 통합
  - `name?: string` + `meta?: Record<string, unknown>` 를 제거하고 실제 wire shape(`{ id, name, type }`)에 맞게 정확히 기술. 이번 변경의 핵심 유지보수성 개선이다.

- **[NONE/긍정]** `type: ModelTypeFilter` SOT 패턴
  - `enum: Object.values(MODEL_TYPE_ENUM)` + TS 타입 `ModelTypeFilter` 조합이 이미 이 코드베이스에서 확립된 패턴과 일치한다. 중복 없음.

### 파일 3 & 4: 플랜 문서 (`.md`)

- **[INFO]** pre-existing `mc-config-polish.md` 에 `spec_impact` frontmatter 누락 → 이번 diff 에서 추가
  - 위치: `plan/complete/mc-config-polish.md` 상단 frontmatter
  - 상세: unit 테스트 가드가 `spec_impact` 필드를 검사하는데, PR merge 시점에 누락 상태로 이동했다. 이번 diff 에서 4개 spec 파일을 선언해 해소. 관리 프로세스 갭을 정확히 식별해 수정한 점은 긍정적.
  - 제안: 향후 `plan-complete` 이동 체크리스트에 `spec_impact` 선언 확인 항목 명시를 권장.

---

## 요약

이번 변경은 Swagger 어노테이션(`ModelListDto` wrapper 객체)이 실제 wire shape(bare `ModelInfo[]` → `{ data: ModelInfo[] }`)와 불일치하던 pre-existing 버그를 최소 범위로 수정한다. `ModelInfoDto` 도입으로 불필요한 `ModelItemDto`/`ModelListDto` 이중 클래스가 제거되고, `@ApiOkWrappedArrayResponse` 사용으로 배열 응답 의미가 데코레이터 수준에서 명확해졌다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 이상 없으며 기존 코드베이스 패턴을 일관되게 따른다. 발견된 사항은 전부 pre-existing 또는 비강제 권고 수준의 INFO 이며, 이번 diff 가 도입한 유지보수성 문제는 없다.

## 위험도

NONE
