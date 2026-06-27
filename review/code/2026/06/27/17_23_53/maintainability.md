# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `workspaces.controller.ts` — `const INVITATION_THROTTLE` 선언이 import 문 사이에 삽입됨
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.controller.ts` (전체 파일 컨텍스트 기준 `import { SENSITIVE_ACTION_THROTTLE }` 다음, `import { WorkspacesService }` 앞)
  - 상세: `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 선언이 import 블록 중간에 끼어 있다. ES 모듈에서 `import` 선언은 호이스팅되므로 런타임에는 동작하지만, TypeScript 커뮤니티 컨벤션과 ESLint `import/order` 규칙 모두 "모든 import 이후에 모듈 레벨 코드를 위치"하도록 요구한다. 동일 변경 세트의 `llm-model-config.controller.ts` 는 모든 import 이후에 `const PROVIDER_PROBE_THROTTLE` 를 배치해 올바른 패턴을 따르고 있으며, `workspaces.controller.ts` 만 불일치한다.
  - 제안: `const INVITATION_THROTTLE = SENSITIVE_ACTION_THROTTLE;` 선언을 모든 import 문 블록 이후로 이동한다. 원래 코드에서도 const 가 import 중간에 위치하던 레거시 문제를 이번 리팩터링에서 함께 정리했으면 더 좋았을 것이다.

### 발견사항 2
- **[INFO]** `list-models-cap.spec.ts` — 빈 배열 경우의 어서션 스타일 불일치
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/list-models-cap.spec.ts`, `expect(capModelList([])).toEqual([])` 행
  - 상세: 같은 `it` 블록 내에서 `under`·`exact` 케이스는 `toBe`(참조 동일성)로 "원본 배열을 그대로 반환"을 검증하는데, 빈 배열 케이스만 `toEqual([])` 을 사용한다. `capModelList([])` 는 입력 참조를 그대로 반환하므로 `const empty = []; expect(capModelList(empty)).toBe(empty)` 패턴으로 나머지 케이스와 일관성을 맞출 수 있다. 현재 코드는 의미상 정확하지만, 동일 블록 내 스타일이 혼재되어 "왜 이 케이스만 다른가" 라는 의문을 남긴다.
  - 제안: 빈 배열 케이스도 `const empty: ModelInfo[] = []; expect(capModelList(empty)).toBe(empty);` 패턴으로 통일하거나, 또는 세 케이스 모두 `toHaveLength` + 첫 원소 확인으로 통일한다.

### 발견사항 3
- **[INFO]** `list-models-cap.ts` — `MAX_MODEL_LIST_SIZE` 위치가 모듈 로컬이라 전역 정책 발견 가능성 낮음
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/list-models-cap.ts`
  - 상세: `SENSITIVE_ACTION_THROTTLE` 는 `common/constants/throttle.ts` 에 두어 크로스-커팅 정책 상수로 발견하기 쉽게 했으나, 동일한 방어 계층(throttle·timeout·cap 동렬로 plan 메모에도 명시)인 `MAX_MODEL_LIST_SIZE` 는 llm 모듈 내부에 위치한다. 현재는 두 경로(`LlmService`, `LlmPreviewService`)만 소비하므로 모듈 로컬이 적절하며, JSDoc 의 소비자 목록이 충분히 문서화한다. 향후 다른 모듈이 이 값에 의존해야 하면 `common/constants` 로 이동을 고려한다.
  - 제안: 현재 스코프에서는 변경 불필요. 소비처가 추가될 시 이동 리팩터링 트리거로 삼는다.

---

## 긍정적 사항

- `SENSITIVE_ACTION_THROTTLE` 상수 추출: 두 컨트롤러에 흩어진 `{ default: { ttl: 60_000, limit: 10 } }` 리터럴을 단일 소스로 통합하고, 각 호출부는 의미 있는 별칭(`PROVIDER_PROBE_THROTTLE`, `INVITATION_THROTTLE`)으로 참조한다. 정책 변경 시 한 곳만 수정하면 되는 SoT 확보.
- `MODEL_TYPE_ENUM` / `ModelTypeFilter` 를 `model-config/dto/model-type.ts` 로 추출: 런타임 파이프 검증과 정적 타입이 동일 소스에서 파생되어 허용값 목록 관리가 단순화됐다.
- `capModelList` 의 단일 책임: 28줄짜리 순수 함수로 슬라이스 + 경고 로그 두 가지만 한다. optional `logger` 매개변수로 테스트 가능성이 높다.
- 테스트가 `MAX_MODEL_LIST_SIZE` 상수를 직접 임포트하여 하드코딩 500 없이 경계값을 검증한다. 상수 값이 바뀌어도 테스트가 자동으로 따라간다.
- `LlmService.listModels` opts.type 시그니처가 `'chat' | 'embedding'` 인라인 리터럴에서 `ModelTypeFilter` named type 으로 교체됐다. 컨트롤러·서비스 사이 타입 계약이 단일 소스로 수렴.

---

## 요약

변경 세트 전반은 유지보수성 측면에서 개선 방향이 명확하고 올바르게 실행됐다. 스로틀 정책·타입 필터·모델 목록 캡이라는 세 가지 관심사를 각각 단일 출처 파일로 분리하고, 소비자는 의미 있는 별칭으로 참조하는 패턴은 코드 중복 제거와 변경 범위 최소화에 모두 기여한다. 주의해야 할 점은 `workspaces.controller.ts` 에서 const 선언이 import 문 중간에 끼어 있다는 레이아웃 불일치 하나다. 이는 동일 변경 세트 내 `llm-model-config.controller.ts` 와 상반된 패턴이라 혼란을 줄 수 있으며, ESLint/import-order 규칙에 따라 향후 lint 오류로 표면화될 수 있다. 나머지 발견사항은 정보 수준이며 기능·안전성에는 영향이 없다.

## 위험도

LOW
