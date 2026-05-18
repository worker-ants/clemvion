# 보안(Security) 코드 리뷰

## 발견사항

### [INFO] 테스트 코드의 하드코딩된 식별자 값
- 위치: `execution-engine.service.spec.ts` — `workflowId = 'workflow-1'`, `executionId = 'execution-1'`
- 상세: 테스트 고정값이 단순한 추측 가능한 문자열('workflow-1', 'execution-1')로 설정되어 있다. 이는 테스트 코드에서만 사용되며 프로덕션 코드가 아니므로 실제 취약점은 아니다. 다만 테스트 환경에서 접근 제어 검증 시 현실적인 UUID 형태의 값을 사용하면 실제 인증/인가 우회 시나리오에 대한 검증 신뢰도가 높아진다.
- 제안: 보안 관련 테스트에서는 UUID v4 형식의 식별자 사용을 권장. 현재 기능 테스트 목적에서는 실질적 위험 없음.

### [INFO] `breakCondition` 표현식의 런타임 평가 신뢰
- 위치: `loop.schema.ts` — `breakCondition` 필드 (`z.string().optional()`, 예시: `{{ $loop.index >= 5 }}`)
- 상세: Loop 노드의 `breakCondition` 은 사용자가 자유 형식 표현식을 입력할 수 있다. 현재 변경 범위는 `count` 필드의 기본값·warningRule 정비에 집중하며 `breakCondition` 검증 로직은 변경하지 않았다. `breakCondition` 의 표현식 평가(인젝션 방어, 샌드박스 여부)는 `ExpressionResolverService` 에서 담당하므로 본 변경 범위 외이다. 단, 스키마 레벨에서 `breakCondition` 에 대한 형식 검증(예: `{{ ... }}` 패턴 여부)이 없어 임의 문자열이 저장될 수 있다는 점은 `ExpressionResolverService` 에서 방어해야 한다.
- 제안: `breakCondition` 의 런타임 평가 인젝션 방어가 `ExpressionResolverService` 레벨에 존재하는지 별도 확인 권장. 본 변경 범위에서는 조치 불필요.

### [INFO] `validateLoopConfig` 에서 `count` 미제공 시 검증 미적용
- 위치: `loop.schema.ts` — `validateLoopConfig` 함수 (`count !== undefined && count !== null && count !== ''` 조건)
- 상세: `count` 가 없는(undefined) 경우 검증을 전혀 수행하지 않는다. 이는 의도된 설계로, zod `default('1')` 이 스토리지 레이어에서 빈 값을 채우므로 validator 가 `undefined` count 를 만나는 경로는 레거시 데이터나 직접 DB 쓰기뿐이다. 이 경우 에러 대신 런타임에서 `INVALID_CONTAINER_PARAM` 을 throw 하는 이중 방어 구조가 명시적으로 선택된 설계임이 주석으로 문서화되어 있다.
- 제안: 현재 설계에서는 문제 없음. 다만 레거시 데이터나 직접 DB 쓰기를 통해 `undefined` count 가 들어올 경우의 에러 핸들링이 사용자에게 명확한 에러 메시지를 전달하는지 별도로 확인 권장.

### [INFO] `loopParseNumeric` 에서 무한·NaN 숫자 처리
- 위치: `loop.schema.ts:805` — `loopParseNumeric` 함수
- 상세: `typeof value === 'number' && Number.isFinite(value)` 조건으로 `Infinity`, `-Infinity`, `NaN` 을 올바르게 필터링한다. 문자열 파싱 후에도 `Number.isFinite(n)` 으로 검증하여 `NaN` 반환 경로를 차단한다. 보안상 문제 없음을 확인.
- 제안: 없음.

## 요약

이번 변경은 Loop 노드의 `count` 필드에 대한 zod `default('1')` 정책 명문화와 이에 따른 dead warningRule(`loop:no-count`) 제거, 그리고 관련 테스트·i18n 매핑 정비를 다룬다. 보안 관점에서 변경된 코드 전반을 검토한 결과, 인젝션 취약점·하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·민감 정보 노출 등 OWASP Top 10 해당 취약점은 발견되지 않았다. `validateLoopConfig` 의 숫자 파싱 로직은 `Number.isFinite` 를 통해 NaN/Infinity 를 적절히 방어하며, 입력 검증 범위(0 이하, maxIterations 초과 등)도 명확하다. `breakCondition` 자유 형식 표현식에 대한 인젝션 방어는 `ExpressionResolverService` 레이어의 책임이며 본 변경 범위 외이다. 전체적으로 보안 리스크가 없는 안전한 변경이다.

## 위험도

NONE
