# Documentation Review

## 발견사항

### 발견사항 1
- **[INFO]** `testConnection` 반환 타입 변경에 대한 JSDoc 없음
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts`, `testConnection` 메서드 (line ~1513)
  - 상세: `testConnection`의 반환 타입이 `{ success: boolean; error?: string }` 에서 `{ success: boolean; error?: string; dimension?: number }` 로 확장됐으나, 메서드에 JSDoc이 없다. `embed`, `hasDefaultLlmConfig`, `isLlmRateLimit`, `extractRetryAfterMs` 는 모두 JSDoc을 보유하는데, `testConnection` / `listModels` 만 누락돼 일관성이 깨진다.
  - 제안: `testConnection`에 JSDoc 추가. 최소한 `@returns` 에 `dimension` 필드가 embedding kind일 때만 반환되며 probe embed에서 감지됨을 명시.

### 발견사항 2
- **[INFO]** `ModelTestConnectionResultDto` 의 `dimension` 필드 설명이 백엔드 DTO에만 있고 프론트엔드 API 클라이언트 타입 내에는 인라인 주석으로만 처리됨
  - 위치: `codebase/frontend/src/lib/api/model-configs.ts`, `testConnection` 응답 인라인 타입 (line ~1272)
  - 상세: 현재 프론트엔드 API 클라이언트의 응답 타입이 인라인 익명 객체 타입으로 선언돼 있어, 공유 named type이 없다. 인라인 주석(`// kind=embedding 연결 테스트 시 probe embed 로 감지한 임베딩 차원.`)은 존재하지만, 재사용 가능한 named interface로 분리돼 있지 않아 다른 소비자가 타입을 참조하기 어렵다.
  - 제안: 즉각 수정 필수는 아니나, 향후 `TestConnectionResult` 같은 named interface로 추출 권장. 현재 주석 수준은 최소 충족.

### 발견사항 3
- **[INFO]** `model-config-manager.tsx`의 `testMutation` `onSuccess` 내 embedding 차원 자동저장 로직에 인라인 주석 존재하나, 실패 catch 블록 빈 주석이 문서화 관점에서 경계선
  - 위치: `codebase/frontend/src/components/models/model-config-manager.tsx`, `testMutation.onSuccess` (line ~2958)
  - 상세: `catch { /* dimension 자동 저장 실패는 연결 성공 안내를 막지 않는다. */ }` 패턴은 의도적 silent catch임을 명시하므로 적절하다. 단, 저장 실패 시 사용자에게 어떤 피드백도 없다는 점이 주석에서만 드러나며 스펙 참조 링크가 없다.
  - 제안: 현 상태로 수용 가능. 필요 시 스펙 섹션 참조 추가(`// spec/3-models.md §X.X` 등).

### 발견사항 4
- **[INFO]** `ModelConfigFormDialog`의 `dimensionAutoDetected` 관련 인라인 주석 품질 양호하나 i18n 키 `dimensionAutoHint` / `dimensionManualHint` 에 JSDoc 없음
  - 위치: `codebase/frontend/src/lib/i18n/dict/en/models.ts`, `codebase/frontend/src/lib/i18n/dict/ko/models.ts`
  - 상세: i18n 딕셔너리는 `as const` 객체라 JSDoc이 표준적으로 적용되지 않는다. 신규 추가된 키들(`dimensionAutoHint`, `dimensionManualHint`, `connectionSucceededDim`)은 용도가 직관적이고 컨텍스트가 충분하다. 이슈 없음.
  - 제안: 해당 없음.

### 발견사항 5
- **[INFO]** `llm.module.ts`의 `forwardRef` 순환 의존 주석 — 방향 설명은 있으나 왜 forwardRef가 양방향으로 필요한지 배경 근거가 빠짐
  - 위치: `codebase/backend/src/modules/llm/llm.module.ts`, lines 43-46
  - 상세: 주석 `ModelConfigModule↔LlmModule 은 상호 forwardRef 로 순환을 해소한다`는 사실은 기술하지만, 구체적으로 어떤 서비스가 어떤 서비스를 주입해 순환이 형성되는지 설명이 없다. 유지보수 시 순환 제거 시도 실수를 막으려면 좀 더 구체적인 설명이 유용하다.
  - 제안: `// LlmService → ModelConfigService (testConnection/listModels 에서 주입), ModelConfigService → LlmService (??)`와 같이 양방향 의존 경로를 명시하거나, ModelConfigModule 쪽에도 대응 주석을 추가.

### 발견사항 6
- **[INFO]** spec 문서 업데이트 여부 불명확 — `testConnection` API 응답 스키마 변경
  - 위치: 변경된 파일 전반 (spec 파일은 diff에 포함되지 않음)
  - 상세: `testConnection` 응답에 `dimension` 필드가 추가됐고, embedding kind에 대한 probe embed 연결 검증 로직이 신규 도입됐다. 이는 외부에서 관찰 가능한 API 행동 변경이므로 관련 spec(예: `spec/3-models.md` 또는 해당 LLM/모델 설정 스펙)에 반영돼야 한다. 그러나 이번 diff에 spec 변경이 없어 누락 여부를 확인할 수 없다.
  - 제안: 관련 spec 섹션(모델 설정 연결 테스트 응답 스키마, embedding probe embed 동작)에 `dimension` 반환 조건 명시 여부를 확인. 미갱신이면 프로젝트 규약(`spec/` 변경 → `project-planner`)에 따라 별도 처리 필요.

### 발견사항 7
- **[INFO]** `llm.service.spec.ts`의 신규 테스트 케이스 설명 품질 양호
  - 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts`
  - 상세: `resolves config kind-agnostically via ModelConfigService (embedding regression)` 케이스는 인라인 주석(`// 회귀 방지: embedding 설정도 조회돼야 한다...`)으로 버그 재발 방지 의도를 명확히 설명한다. `returns success without dimension when probe embed yields empty vector`, `returns sanitized failure when embedding probe embed throws`도 케이스명이 자기설명적이다. 문서화 관점에서 충분하다.
  - 제안: 해당 없음.

### 발견사항 8
- **[INFO]** `ModelTestConnectionResultDto`의 `dimension` 필드 설명 언어 일관성
  - 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts`
  - 상세: `@ApiPropertyOptional.description`이 한국어(`kind=embedding 연결 테스트 시 probe embed 로 감지한 임베딩 차원. 감지 실패 시 생략.`)로 작성됐다. 동일 DTO의 다른 필드들은 영어(`masked API Key`, `null = 자가호스팅 키 미설정` 혼용)로 일관성이 완전하지 않다. Swagger 스펙은 외부 소비자에게 노출될 수 있으므로 영어 기술이 권장된다.
  - 제안: `description: 'Detected embedding dimension via probe embed when kind=embedding. Omitted if detection fails.'`로 변경 권장. 당장 Critical 수준은 아니나 API 문서 품질 개선에 유효하다.

---

## 요약

이번 변경은 embedding 설정의 연결 테스트에서 `dimension` 자동 감지를 도입하는 기능으로, 전반적으로 문서화 품질이 양호하다. 인라인 주석이 핵심 결정(kind-agnostic 조회, forwardRef 순환, probe embed 방식, silent catch 의도)을 명시적으로 기술하고 있으며, i18n 키도 양 언어 모두 추가돼 있다. 백엔드 DTO에 `@ApiPropertyOptional`이 추가돼 Swagger 문서도 갱신됐다. 주요 미흡점은 `testConnection` 메서드 자체에 JSDoc이 없고, Swagger description이 한국어로 작성된 점, 그리고 spec 파일 업데이트 여부가 이번 diff에서 확인되지 않는 점이다. 모두 INFO 수준으로 기능 안전성에는 영향 없다.

## 위험도
LOW

STATUS: SUCCESS
