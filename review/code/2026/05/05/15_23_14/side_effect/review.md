## 발견사항

### [INFO] `categoryDefSchema.name` / `.description` 의 기본값 추가로 파싱 유연성 변경

- **위치**: `text-classifier.schema.ts`, `name: z.string().default('')`, `description: z.string().default('')`
- **상세**: 이전에는 `name`이 required field였으므로 `categoryDefSchema.parse({})` 는 Zod 오류를 던졌다. 변경 후에는 `{ name: '', description: '' }` 로 성공적으로 파싱되어, 스키마 레이어의 검증 역할이 imperative `validateTextClassifierConfig`로 완전히 위임된다. API 레이어에서 스키마만 통과해도 name이 비어있는 카테고리가 DB까지 도달할 수 있는 얇은 창문이 생긴다.
- **제안**: 현재 `validateTextClassifierConfig`가 `!cat.name` 체크를 유지하므로 handler 레벨에서는 막힌다. 하지만 스키마 레이어를 통과하는 다른 진입점(예: 직접 API 호출, 테스트 픽스처 생성 등)이 있다면 명시적으로 문서화할 것을 권장한다. 현 구조상 즉각적인 결함은 없으나 의존 관계가 암묵적이다.

---

### [WARNING] Handler `.trim()` vs Resolver 비트림 불일치 — 경계 케이스에서 포트 ID 불일치 발생 가능

- **위치**: `text-classifier.handler.ts` `buildCategoryPortIds`, `resolve-dynamic-ports.ts` `classifierCategoriesPorts`
- **상세**: 두 곳의 fallback 로직이 동일한 의도로 작성되었지만 미세하게 다르다.
  - Resolver: `c.id.trim().length > 0 ? c.id : ...` → 원본값(`c.id`) 그대로 포트 id로 emit
  - Handler: `c.id.trim().length > 0 ? c.id.trim() : ...` → trim된 값으로 라우팅

  스키마 regex `/^[a-zA-Z0-9_-]+$/`가 공백을 허용하지 않으므로 UI 정상 경로에서는 두 값이 항상 일치한다. 그러나 스키마 검증을 우회한 데이터(예: 직접 DB 주입, 마이그레이션 스크립트, 테스트 픽스처)에 선행/후행 공백이 있다면 resolver가 emit하는 포트 ID와 handler가 라우팅하는 포트 ID가 달라져 엣지 연결이 끊어진다.
- **제안**: 두 구현 중 하나로 통일한다. Resolver도 `c.id.trim()`을 쓰거나, handler도 trim 없이 `c.id`를 그대로 사용한다. 스키마 제약이 공백을 방지하므로 handler의 `.trim()` 호출은 방어적 코드로서 가치가 있다면 resolver에도 동일하게 적용하는 것이 일관성 측면에서 더 안전하다.

---

### [INFO] `buildCategoryPortIds`와 `classifierCategoriesPorts`의 로직 이중화

- **위치**: `text-classifier.handler.ts:18-26`, `resolve-dynamic-ports.ts:84-96`
- **상세**: 파일 상단 주석에서 "Mirrors the resolver fallback"이라고 명시하고 있으나, 두 복사본이 별도로 존재한다. 향후 fallback 패턴이 변경될 때(예: `class_` 접두사가 `cat_` 로 바뀌는 경우) 한 곳만 수정되면 조용한 불일치가 발생한다.
- **제안**: 현 상태로도 `resolve-dynamic-ports.spec.ts`가 두 구현을 동시에 커버한다고 코드 주석에 언급되어 있으므로 테스트로 일치 보장이 되어 있다면 허용 가능하다. 다만 공유 유틸로 추출할 수 있는 기회가 있다면 장기적으로 단일 소스가 안전하다.

---

### [INFO] `categoryDefSchema` export 추가

- **위치**: `text-classifier.schema.ts:9`, `export const categoryDefSchema`
- **상세**: 이전에는 모듈 내부 상수였으나 이번에 공개 API로 승격되었다. 테스트와 external consumer가 직접 import하게 된다. 향후 이 스키마를 변경할 때 공개 API 호환성을 고려해야 한다는 점이 새로운 제약으로 추가된다.
- **제안**: 문제는 없으나 의도된 설계임을 확인하는 수준의 INFO.

---

### [INFO] `information_extractor` 의 sub-entry id 없음 명시 — 기존 동작과 일치 확인 필요

- **위치**: `system-prompt.ts` 마지막 추가 라인
- **상세**: 프롬프트에 `information_extractor`가 mode-based system port만 발행하며 sub-entry id가 없다는 설명을 추가했다. 이 설명이 실제 `infoExtractorModePorts` 구현과 일치하는지 확인했을 때, 해당 함수는 실제로 고정 포트(`completed`, `user_ended`, `max_turns`, `error` 또는 `out`, `error`)만 반환하므로 설명과 구현이 일치한다.
- **제안**: 일치 확인됨. 추가 조치 불필요.

---

## 요약

이번 변경은 `text_classifier` 노드의 카테고리별 안정 포트 ID(`category.id`) 도입을 일관되게 구현한 것으로, resolver/handler/schema/spec/system-prompt가 전체적으로 연동되어 있다. 주된 부작용 위험은 두 가지다. 첫째, `categoryDefSchema.name`의 default 추가로 스키마 레이어가 빈 이름을 통과시키게 되어 imperative validator에 대한 암묵적 의존이 강화되었다. 둘째, resolver는 `c.id` 원본을, handler는 `c.id.trim()`을 사용하는 미세한 불일치가 있어 공백 포함 ID(스키마로는 방지되지만)에서 포트 라우팅 불일치가 발생할 수 있다. 기존 워크플로우(`category.id` 미설정)는 `class_${i}` fallback으로 완전히 하위 호환되며 신규 기능은 opt-in이므로 즉각적인 회귀 위험은 낮다.

## 위험도

**LOW**