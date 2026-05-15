## 발견사항

---

**[WARNING] `preview-llm-models.dto.ts` — 클래스 수준 JSDoc 미작성**
- 위치: `preview-llm-models.dto.ts:14` 클래스 선언부
- 상세: 이전 배치 1·2 문서화 리뷰에서 I-2로 지적되었으나 아직 반영되지 않음. 개별 프로퍼티에는 `@ApiProperty` 설명이 있으나, 클래스의 목적("저장 전 1회성 자격증명으로 모델 목록 조회")과 apiKey 비저장 불변식은 클래스 진입점에서 읽히지 않음.
- 제안: `/** 저장 전 폼 자격증명으로 모델 목록을 미리 조회한다. apiKey는 이 요청 스코프에서만 사용되며 저장·로그·캐시에 기록되지 않는다. */`

---

**[WARNING] `preview-llm-models.dto.ts` — `baseUrl` Swagger 설명에 SSRF 방어 목적 누락**
- 위치: `preview-llm-models.dto.ts:30` `@ApiPropertyOptional` description
- 상세: 현재 설명은 `"http/https 만 허용"`으로 제약 자체는 명시하나, 이것이 SSRF 방어 목적임을 알 수 없다. 동일 사항이 배치 2 문서화 리뷰에서도 WARNING으로 지적됨.
- 제안: `"http/https 스킴만 허용 (SSRF 방어). file://, gopher:// 등 내부 리소스 접근 차단."`

---

**[INFO] `preview-llm-models.dto.spec.ts` — DTO 검증 범위와 서비스 검증 범위 경계 미명시**
- 위치: `preview-llm-models.dto.spec.ts:21` `describe('PreviewLlmModelsDto', ...)`
- 상세: `non-local 프로바이더에서 빈 apiKey 거부`는 DTO가 아닌 서비스 레이어에서 처리된다. 이 파일은 DTO 유효성 검사만 커버하지만 그 경계가 명시되지 않아, 독자가 "왜 openai + apiKey=''에 대한 DTO 거부 케이스가 없지?"라고 의문을 가질 수 있음.
- 제안: describe 블록 상단에 `// DTO 레벨 구조 검증만 커버. non-local 프로바이더의 빈 apiKey 거부는 서비스 레이어(llm.service.spec.ts)에서 검증.` 1줄 주석.

---

**[INFO] `llm-config.controller.spec.ts` — `ServiceMethods`/`ConfigMethods` 타입 별칭이 의존성을 명시적으로 문서화**
- 위치: `llm-config.controller.spec.ts:5-13`
- 상세: `Pick<LlmService, 'testConnection' | 'listModels' | ...>`와 `Pick<LlmConfigService, 'findAll' | ...>` 타입 별칭이 컨트롤러가 실제로 사용하는 메서드를 목록화한다. 이는 별도 주석 없이 의존성 명세 역할을 함. 파일 상단 범위 주석(`// Covers only previewModels...`)과 함께 코드베이스 내 spec 파일의 모범 사례.

---

**[INFO] `llm-config.controller.spec.ts` — 보안 불변식 WHY 주석**
- 위치: `llm-config.controller.spec.ts:51`
- 상세: `// preview 는 캐시에 클라이언트를 넣지 않으므로 cache clear 도 호출되지 않아야 한다.` — 단순한 동작 설명이 아니라 설계 불변식(preview는 캐시에 기록하지 않는다)을 테스트 가드로 고정하는 의미 있는 WHY 주석. 이 패턴이 다른 보안 관련 불변식 테스트에도 적용될 만함.

---

**[INFO] `llm-configs.test.ts` — 임시 계약이 명확하게 표시됨**
- 위치: `llm-configs.test.ts:34-39`
- 상세: `// TODO: response envelope 중앙화(axios 인터셉터) 적용 시 이 fallback 계약은 제거한다.` 주석과 `"(interim dual-shape contract)"` 테스트명이 이 패턴의 임시성을 이중으로 문서화함. 아키텍처/유지보수성 리뷰에서 "fallback을 계약으로 고착한다"는 우려가 있었으나, 실제로는 제거 조건까지 명시되어 있어 추후 인터셉터 중앙화 시 삭제 대상을 찾기 쉬운 구조.

---

### 요약

`preview-llm-models.dto.ts`의 클래스 수준 JSDoc 누락과 `baseUrl` SSRF 방어 목적 미언급은 이전 두 배치 리뷰에서 반복 지적된 사항으로 여전히 미조치 상태다. 이 두 항목이 이 배치에서 가장 즉각적으로 수정 가능한 문서화 공백이다. 반면 `llm-config.controller.spec.ts`의 파일 범위 주석 + 타입 별칭 의존성 명세 패턴, `llm-configs.test.ts`의 임시 계약 이중 표시(TODO + 테스트명)는 코드베이스 내 문서화 관례의 긍정적 선례로 평가된다.

### 위험도
**LOW**