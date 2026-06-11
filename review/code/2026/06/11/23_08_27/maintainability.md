# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] 테스트 픽스처 객체 3중 중복 — llm.service.spec.ts
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` — 신규 추가된 3개 embedding testConnection 케이스 각각
- 상세: `{ id: 'emb-1', kind: 'embedding', provider: 'openai', defaultModel: 'text-embedding-3-small', apiKey: 'encrypted' }` 객체가 세 케이스 모두에서 `mockModelConfigService.findEntity.mockResolvedValue(...)` 인자로 동일하게 반복된다. 기존 파일 내 `retryConfig` / `retryParams` 패턴처럼 describe 스코프 상단에 공유 상수 하나로 선언하지 않았다. 필드 하나(예: `defaultModel`)가 바뀌면 3곳을 모두 수정해야 하는 유지보수 부채다.
- 제안: `describe('testConnection')` 스코프 상단에 `const EMBEDDING_CONFIG_FIXTURE = { id: 'emb-1', kind: 'embedding' as const, provider: 'openai', defaultModel: 'text-embedding-3-small', apiKey: 'encrypted' }` 를 선언해 3개 케이스에서 공유한다.

### [INFO] 매직 리터럴 `1536` 산발적 등장 — llm.service.spec.ts, model-config-manager.test.tsx
- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` (`new Array(1536).fill(0)`) 및 `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` (복수 등장)
- 상세: `1536`은 `text-embedding-3-small`의 기본 출력 차원이다. 문맥을 알면 추론 가능하지만, 코드 자체에 의미가 표현되지 않는다. 두 파일에 걸쳐 5회 이상 등장해 값 변경 시 여러 곳을 수정해야 한다. `3072` 역시 model-config-manager.test.tsx에 등장하나 `text-embedding-3-large` 차원임을 코드에서 알 수 없다.
- 제안: 각 파일 상단 또는 공유 픽스처 모듈에 `const OPENAI_SMALL_DIM = 1536` / `const OPENAI_LARGE_DIM = 3072` 로컬 상수를 선언하거나, 최소한 `// text-embedding-3-small default dim` 인라인 주석으로 근거를 명시한다.

### [INFO] `onSuccess` async 핸들러의 묵시적 오류 소멸 — model-config-manager.tsx
- 위치: `codebase/frontend/src/components/models/model-config-manager.tsx` L80 `onSuccess: async (result, config) => { ... }`
- 상세: TanStack Query의 `onSuccess`는 반환 Promise를 무시한다. `async` 핸들러 내부에서 `await` 가 예상치 못한 위치에서 throw 하면(예: `invalidate()` 호출 경로) React Query 오류 경계에 포착되지 않고 조용히 사라진다. 현재는 `dimension` 저장 실패를 명시적 `catch`로 소화하고 있어 의도된 동작이지만, 이후 개발자가 `onSuccess` 내부에 `catch` 없이 `await` 를 추가하면 오류가 소멸될 위험이 있다.
- 제안: 핸들러 상단에 주석 `// onSuccess의 반환 Promise는 무시됨 — await 실패는 catch로 반드시 처리할 것` 을 추가하거나, 차원 저장 로직을 `persistDetectedDimension(config, dim)` 등의 명명 함수로 추출해 의도를 명확히 한다.

### [INFO] 인라인 Tailwind arbitrary HSL 클래스 반복 — model-config-form-dialog.tsx
- 위치: `codebase/frontend/src/components/models/model-config-form-dialog.tsx` — `dimensionAutoDetected` 분기의 `className` 및 `<p>` 태그
- 상세: `"bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"` 와 `"text-[hsl(var(--muted-foreground))]"` 가 하드코딩 arbitrary 값으로 삽입됐다. 이 패턴은 기존 코드베이스에서도 이미 사용 중이므로 이번 변경이 새로 도입한 것은 아니다. 다만 CSS 변수명이 변경되면 여러 파일을 찾아 수정해야 한다.
- 제안: 이번 PR 범위에서는 기존 패턴 준수이므로 허용 수준. 별도 리팩터링 이슈로 `cn()` 헬퍼 + 공통 클래스 상수 추출을 검토 등록 권장.

### [INFO] `testConnection` 분기 — kind별 probe 전략 확장 가능성 부재
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L263–271
- 상세: `config.kind === 'embedding'` 단일 분기가 early-return 패턴으로 삽입되어 있다. 현재는 분기가 embedding 하나뿐이라 복잡도 문제는 없다. 그러나 `rerank` 전용 probe가 추가될 경우 동일 메서드에 `else if` 가 누적되는 구조다. 아키텍처 리뷰에서도 동일 지적이 있어 백로그(plan/in-progress/unified-model-management.md §7 W4)로 추적 중이다.
- 제안: 이번 변경 범위에서는 허용 수준. kind 분기가 3개 이상이 되면 `LLMClient` 인터페이스에 `probeConnection(): Promise<{ dimension?: number }>` 를 추가하고 서비스 레이어의 분기를 제거하는 리팩터링 기준점으로 삼는다.

### [INFO] `EMBEDDING_CONFIG_NO_DIM` 픽스처 스코프 — model-config-manager.test.tsx
- 위치: `codebase/frontend/src/components/models/__tests__/model-config-manager.test.tsx` — 신규 `describe("ModelConfigManager — embedding connection test dimension auto-detect", ...)` 블록 내 `EMBEDDING_CONFIG_NO_DIM` 상수
- 상세: `EMBEDDING_CONFIG_NO_DIM` 을 describe 블록 내부에 선언한 것은 스코프를 좁게 유지하는 좋은 패턴이다. 다만 이 describe 직전에 이미 존재하는 `describe("ModelConfigManager — embedding dimension payload", ...)` 블록도 유사한 구조의 픽스처를 별도 선언하고 있어, 두 describe에 걸친 픽스처 공유 가능성을 검토할 여지가 있다.
- 제안: 두 describe 간 픽스처 구조가 충분히 유사하다면 파일 상단 공유 상수로 추출하고 각 describe에서 필요한 필드만 override(`{ ...BASE_EMBEDDING_CONFIG, dimension: null }`)하는 패턴 적용을 고려한다. 현재 상태는 허용 수준.

### [INFO] `ModelTestConnectionResultDto.dimension` Swagger description 언어 불일치
- 위치: `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts` — 새로 추가된 `@ApiPropertyOptional.description`
- 상세: `description: 'kind=embedding 연결 테스트 시 probe embed 로 감지한 임베딩 차원. 감지 실패 시 생략.'` 이 한국어로 작성됐다. 같은 DTO 내 다른 필드의 description은 영어(`masked API Key`)로 작성돼 있어 문서 언어가 혼재한다. Swagger 스펙은 외부(또는 미래 팀원)에게 노출되므로 일관성 있는 영어 기술이 권장된다.
- 제안: `'Detected embedding dimension via probe embed when kind=embedding. Omitted if detection fails.'` 로 영문 변경 권장. 낮은 우선순위.

## 요약

이번 변경은 embedding 연결 테스트 회귀 수정 + 차원 자동 감지 기능 추가로, 서비스·DTO·API 클라이언트·컴포넌트·i18n이 계층별로 일관되게 변경되어 전체적인 코드 의도가 명확하다. 인라인 주석(kind-agnostic 조회 배경, probe embed 목적, silent catch 의도)이 결정 근거를 충분히 설명하고 있어 가독성은 양호하다. 주요 유지보수성 우려 사항은 3가지다: (1) llm.service.spec.ts의 embedding 픽스처 객체 삼중 중복 — 상수 하나로 통합 가능, (2) `1536`/`3072` 매직 리터럴이 백엔드·프론트엔드 테스트 양쪽에 산재 — 명명 상수 또는 주석으로 의미 명시 필요, (3) `onSuccess` async 핸들러의 오류 소멸 위험 — 주석 또는 함수 추출로 경계 명시 권장. CSS arbitrary 클래스 반복과 Swagger description 언어 혼재는 기존 패턴 답습 또는 낮은 영향도이므로 별도 이슈로 추적하면 충분하다. 전체적으로 실질적인 유지보수 위험은 낮으며, 지적 사항들은 향후 테스트 수정 시 병행 정리 가능한 수준이다.

## 위험도

LOW

STATUS: SUCCESS
