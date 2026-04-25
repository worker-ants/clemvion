### 발견사항

- **[INFO]** `@workflow/expression-engine` 워크스페이스 패키지 의존성
  - 위치: `system-prompt.ts:1` (`import { getAllFunctionNames } from '@workflow/expression-engine'`)
  - 상세: 모노레포 내부 워크스페이스 패키지로, 외부 npm 패키지가 아님. 모듈 레벨 캐시(`expressionReferenceCache`)로 래핑되어 있어 매 호출마다 재계산하지 않는 구조. 테스트 격리를 위한 `resetExpressionCacheForTesting()` export도 적절히 제공됨.
  - 제안: 이상 없음. 캐시 TTL 만료 없이 프로세스 수명 동안 고정 캐시를 쓰는 설계가 의도적임을 주석이 명시하고 있어 향후 유지보수자도 혼동 없을 것.

- **[INFO]** `sanitizeLlmProvidedString` cross-concern import
  - 위치: `review-workflow.ts:4` (`import { ShadowSnapshot, sanitizeLlmProvidedString } from './shadow-workflow'`)
  - 상세: `shadow-workflow` 모듈은 의미상 워크플로우 상태 관리 담당인데, 문자열 sanitization 유틸리티까지 제공하고 있음. `review-workflow.ts`가 이 유틸리티를 재사용하므로 `shadow-workflow`의 변경이 `review-workflow`에 전파될 표면이 생김. 순환 의존성(circular dependency)은 없음.
  - 제안: 기능 자체는 문제없으나, `sanitizeLlmProvidedString`을 별도 `utils/sanitize.ts`로 분리하면 두 모듈의 책임 경계가 명확해짐. 현 규모에서는 선택 사항.

- **[INFO]** `resolveEffectiveOutputPorts` 새 내부 의존 추가
  - 위치: `review-workflow.ts:5` (`import { resolveEffectiveOutputPorts } from './resolve-dynamic-ports'`)
  - 상세: `DANGLING_OUTPUT_PORTS` 검사를 위해 포트 해석 로직을 `resolve-dynamic-ports` 모듈에서 주입받는 구조. 의존 방향이 단방향이며 역참조 없음.
  - 제안: 이상 없음. 포트 해석 로직을 직접 인라인하지 않고 전담 모듈에서 가져오는 설계가 적절함.

- **[INFO]** `import type` 활용
  - 위치: `system-prompt.ts:5`, `review-workflow.ts:7`
  - 상세: `ActivePlanContext`, `NodeDefinitionView` 모두 `import type`으로 선언되어 런타임 번들에 포함되지 않음. 순환 의존성 위험을 최소화하는 올바른 패턴.
  - 제안: 이상 없음.

---

### 요약

5개 파일 모두 새 외부 npm 패키지를 추가하지 않았으며, 모든 import는 모노레포 내부 워크스페이스 패키지(`@workflow/expression-engine`) 또는 상대경로 내부 모듈로만 구성되어 있다. 버전 충돌·라이선스·보안 취약점 리스크는 없다. 유일한 설계 수준 관찰점은 `shadow-workflow`가 문자열 sanitization 유틸리티도 export한다는 cross-concern 결합이지만, 현재 규모에서 즉각적인 문제는 아니다.

### 위험도

**NONE**