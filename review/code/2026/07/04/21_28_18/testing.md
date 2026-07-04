# 테스트(Testing) 리뷰 — workflow cap validated write DTO (fresh re-review)

- 대상: `UpdateWorkflowDto.settings` → `WorkflowSettingsDto` nested 검증 전환, `workflows.service.update` spread-merge, 관련 unit/e2e 테스트
- 이전 세션(21_11_10) INFO "경계값·커버리지" 조치 확인: `@Min(1)` 경계값 `1` accept 케이스(`workflow-dto-validation.spec.ts` L216-222)가 이번 diff에 실제로 추가됨을 확인. 재발 findings 없음.

## 발견사항

- **[INFO]** `settings: null` 명시적 리셋 경로 무테스트
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` L450-457, `workflows.service.spec.ts` L376-425
  - 상세: 서비스 merge 로직은 `settings !== undefined` 만 체크하므로 클라이언트가 `{ settings: null }` 을 보내면 (DTO 상 `@IsOptional` 이라 `null` 이 유효값으로 통과하는지 여부는 별개로) no-op 이 된다. 이전 리뷰에서 "미조치 기록 INFO"로 남긴 항목과 동일하며, 실제 동작(`settings: null`이 whitelist 검증을 통과하는지, 통과 시 서비스가 이를 무시하는지)을 확인하는 테스트가 unit/e2e 어디에도 없다. 의도된 gray-area라는 설계 판단은 문서화되어 있으나(plan L674), 테스트로 그 의도를 고정(lock-in)하지 않으면 향후 회귀 시 조용히 동작이 바뀔 수 있다.
  - 제안: `workflow-dto-validation.spec.ts` 에 `mk(null)` 케이스 하나(현재 동작이 accept 인지 reject 인지 명시적으로 assert)를 추가하면 향후 리팩터링 시 회귀를 잡을 수 있다. 우선순위는 낮음(low-value edge case, 실사용 경로 아님).

- **[INFO]** e2e B2 케이스가 `@Min(1)` 경계(1) 및 소수(1.5)·문자열 케이스를 커버하지 않음
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` L480-518
  - 상세: e2e는 `0`(비양수) 거부, 미지 키 거부, `5`(정상) 저장+영속 3가지만 검증한다. unit(`workflow-dto-validation.spec.ts`)에서는 `it.each([0, -1, 1.5])` 와 non-numeric 케이스까지 세밀하게 커버하므로 e2e에서 전부 반복할 필요는 없다 — 이는 계층 분리상 합리적인 선택이며 결함이 아니다. 다만 e2e가 "HTTP 계층에서 전역 pipe가 실제로 걸리는지"를 검증하는 목적이라면 최소 1개의 `IsInt` 위반(예: 1.5) 케이스를 추가해 "서비스 레이어 mock이 아닌 실제 pipe 파이프라인에서 타입 위반도 400"임을 한 번은 실증하는 편이 더 견고하다. 현재도 `bogusKey`가 `forbidNonWhitelisted` 를 검증하므로 파이프 자체는 이미 e2e로 실증됨 — 이 항목은 보강 여지 수준의 낮은 우선순위 제안.
  - 제안: 선택적. 현재 커버리지로도 위험 낮음.

- **[INFO]** service unit 테스트가 `Object.assign(rest)` 경로에서 `settings` 를 분리(destructure)하는지 직접 검증하지 않음
  - 위치: `workflows.service.spec.ts` L376-425, `workflows.service.ts` L449-457
  - 상세: 3개 테스트(merge/preserve/init-null)는 `settings` 최종 값만 assert하고 있어 회귀 감지 목적은 충분하다. 다만 `rest`(name 등 나머지 필드)가 `Object.assign` 으로 정상 반영되는지는 두 번째 테스트(`leaves settings untouched`)에서 `name: 'renamed'` 를 함께 assert하여 실질적으로 커버되고 있음 — 별도 결함 아님, 확인 차 기록.

## 커버리지 평가 (참고, findings 아님)

- DTO validation 계층(unit): accept(정상값·경계값 1·빈 객체·omitted) + reject(0/-1/1.5/non-numeric/unknown-key) — 8케이스, `it.each` 활용으로 가독성·중복 방지 양호.
- Service 계층(unit): merge/preserve-on-omit/init-from-null 3케이스로 spread-merge 핵심 분기 커버.
- e2e 계층: 검증 실패(0) → 400, 미지 키 → 400, 정상 저장 → 200 + GET 영속 확인까지 end-to-end 왕복 검증. `whitelist+forbidNonWhitelisted` 전역 pipe가 실제 HTTP 스택에서 동작함을 실증.
- Mock 사용: `mockRepository.findOne`/`save` 를 통한 표준 NestJS 테스트 패턴, 실제 TypeORM 동작과의 괴리 없음(단순 property merge라 스텁 신뢰도 높음).
- 테스트 격리: 각 `it`가 독립된 `mockResolvedValueOnce` 를 사용해 서로 간섭 없음. e2e는 `uniqueName('wf-cap')` 으로 신규 workflow 생성 후 순차 PATCH — 동일 워크플로우에 3개 요청이 순서 의존적이나 각 요청이 독립적으로 상태를 검증하므로 문제없음(마지막 GET만 최종 상태 의존, 의도된 순서).
- 회귀: 기존 `settings?: Record<string, unknown>` 관련 테스트가 없었으므로(옵션 C) 회귀 리스크 없음. `UpdateWorkflowDto` 의 다른 필드(name/isActive/tags/folderId) 테스트는 변경되지 않았고 diff와 무관.
- 테스트 용이성: DTO/서비스 모두 순수 검증 로직 + 단순 merge라 테스트하기 쉬운 구조. 의존성 주입 구조 변경 없음.

## 요약

이전 세션(21_11_10) testing INFO였던 "@Min(1) 경계값=1 accept 테스트 미비"는 이번 diff에서 실제로 추가되어 해소됨을 확인했다. DTO validation(8케이스, boundary 포함)·service spread-merge(3케이스)·e2e 왕복 검증(1케이스, 3-step) 3계층이 핵심 분기를 고르게 커버하며, mock 사용과 테스트 격리 모두 적절하다. 남은 항목은 `settings: null` 명시적 리셋 경로 미검증과 e2e에서의 `@IsInt` 위반 실증 부재뿐이며 둘 다 낮은 우선순위의 INFO 수준으로, 실사용 경로에 대한 커버리지 갭이 아니다.

## 위험도

LOW

STATUS: SUCCESS
