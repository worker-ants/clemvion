### 발견사항

- **[WARNING]** `config` 응답 필드의 의미론적 계약 전환 (Semantic Contract Break)
  - 위치: 전체 파일 (31개 핸들러)
  - 상세: 변경 전 `config` 필드는 "실제 실행에 사용된 평가된 값"을 반환했으나, 변경 후 "사용자가 입력한 원본 템플릿 문자열(`{{ ... }}`)"을 반환한다. 이 `config` 필드를 읽어 실제 실행 설정값(예: 해석된 모델명, 평가된 조건값)을 참조하는 클라이언트가 있다면 동작이 변경된다.
  - 제안: 이 `config` 필드의 소비자가 프론트엔드 또는 다른 서비스에 있는지 grep으로 확인 필요. 변경 사항을 API 계약 문서에 명시.

- **[WARNING]** `loop.handler.ts` — `config.count` 타입이 `number`에서 `string | number`로 변경
  - 위치: `loop.handler.ts`, 테스트 `expect(result.config).toEqual({ count: '10', maxIterations: 1000 })` (기존 `count: 10`)
  - 상세: `rawConfig.count`는 사용자 입력 그대로이므로 숫자 문자열 `'10'`이 반환될 수 있다. 기존 소비자가 `config.count`를 산술 연산에 사용했다면 `NaN`이 발생한다.
  - 제안: `count` 필드의 타입이 `string | number`임을 응답 DTO/타입에 명시적으로 선언.

- **[WARNING]** `table.handler.ts` — `config.columns`와 `output.columns` 의미 분리
  - 위치: `table.handler.ts`, configEcho와 payload 변경 부분
  - 상세: 변경 전 해석된(label 포함) 컬럼 정의가 `config.columns`에 있었으나, 변경 후 `config.columns`는 raw 정의, `output.columns`는 해석된 정의로 나뉜다. 기존에 `config.columns`로 렌더링 레이블을 읽던 프론트엔드 코드는 빈 label 등 미해석 상태를 볼 수 있다.
  - 제안: 프론트엔드의 `config.columns` 참조 지점을 `output.columns`로 마이그레이션하거나, 이전 동작을 명시적으로 deprecation 처리.

- **[WARNING]** `parallel.handler.ts` — `maxConcurrency` echo에서 클램핑 제거
  - 위치: `parallel.schema.spec.ts` 기대값 변경 (`16 → 100`, `0 → -3`)
  - 상세: 변경 전 `config.maxConcurrency`는 실제 적용된 0..16 범위의 값을 반환했으나, 변경 후 사용자가 입력한 원본값(예: `100`, `-3`)을 반환한다. 이 값으로 실제 동시성 제한을 추론하던 소비자가 잘못된 정보를 얻는다.
  - 제안: 실제 적용된 클램핑 값이 필요한 경우 `output` 또는 `meta`에 별도 필드로 제공 검토.

- **[INFO]** `code.handler.ts` — `config.code` 소스코드 응답 포함
  - 위치: `code.handler.ts` return 블록
  - 상세: 변경 전 응답에 포함되지 않던 `code` 필드(사용자 작성 코드 전체)가 추가된다. 실행 이력 API를 통해 해당 응답이 외부에 노출되는 경우 의도치 않은 소스코드 노출이 발생할 수 있다.
  - 제안: 실행 이력 조회 API의 응답 마스킹 정책에 `code` 필드 포함 여부를 명시적으로 검토.

- **[INFO]** `workflow.handler.ts` — `buildSubWorkflowError` 오류 응답 구조 확장
  - 위치: `workflow.handler.ts`, `buildSubWorkflowError` 시그니처 및 `details` 블록
  - 상세: 오류 응답의 `details`는 여전히 `{ workflowId, mode }`만 포함하여 하위 호환성을 유지하나, `config` 객체는 `workflowName`, `inputMapping`, `timeout`이 추가되어 넓어진다. 이는 가산적(additive) 변경으로 일반적으로 안전하다.

- **[INFO]** `ai-agent.handler.ts` — multi-turn `waitingResult.config` 필드 대폭 확장
  - 위치: `ai-agent.handler.ts`, `waitingResult` 반환 부분 (두 곳)
  - 상세: 기존 `{ mode, maxTurns, maxToolCalls }`에서 `model`, `systemPrompt`, `knowledgeBases`, `conditions`가 추가된다. 가산적 변경이나, `systemPrompt`는 내부 프롬프트를 포함할 수 있어 실행 이력 API 노출 시 데이터 보안 검토 필요.

---

### 요약

이번 변경은 모든 노드 핸들러에서 `config` 응답 필드의 의미를 "실행에 사용된 평가값"에서 "사용자가 입력한 원본 템플릿값"으로 일괄 전환한다. 내부 엔진 설계(Principle 7)의 일관성을 높이는 의도는 타당하나, `config` 필드를 소비하는 외부 클라이언트(프론트엔드, API 소비자)에게는 조용한 의미론적 breaking change로 작용할 수 있다. 특히 `loop.handler`의 `count` 타입 변화(number→string), `table.handler`의 `columns` 위치 이동, `parallel.handler`의 클램핑 값 제거는 구체적인 동작 변경이므로 프론트엔드 참조 지점을 grep으로 확인하고 필요시 마이그레이션 가이드를 제공하는 것이 권장된다. 문서화된 API 계약 관점에서는 `context.rawConfig ?? config` 폴백이 일관되게 적용되어 엔진 없이 단독 호출하는 테스트 환경에서 기존 동작이 유지되므로 급격한 붕괴 위험은 낮다.

### 위험도
**MEDIUM**