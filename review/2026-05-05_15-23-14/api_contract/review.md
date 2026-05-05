## 발견사항

- **[WARNING]** `category.id` 중복 허용으로 인한 포트 ID 충돌 가능성
  - 위치: `text-classifier.schema.ts` — `categoryDefSchema.id`, `text-classifier.handler.ts` — `buildCategoryPortIds`
  - 상세: `categoryDefSchema`에 `id` 유일성 검증이 없다. 두 카테고리가 동일한 `id`(예: `cat_x`)를 가지면, `resolve-dynamic-ports.ts`의 `dedupeById`가 두 번째 포트를 조용히 제거하여 resolver 출력 포트 수 < handler가 라우팅 가능한 포트 수가 되는 불일치가 발생한다. 캔버스에서는 포트가 하나만 보이지만 두 카테고리 모두 같은 포트 ID로 라우팅된다.
  - 제안: `validateTextClassifierConfig`에 ID 중복 검사를 추가하거나, `categoryDefSchema` 배열 레벨에서 `.superRefine`으로 uniqueness를 강제한다.

- **[WARNING]** 기존 워크플로우의 엣지 파단 — 포트 ID 계약 변경
  - 위치: `text-classifier.handler.ts:buildCategoryPortIds`, `resolve-dynamic-ports.ts:classifierCategoriesPorts`
  - 상세: 기존에 `class_0`, `class_1` 포트 ID로 저장된 엣지(`source_port: "class_0"`)가 있는 워크플로우에서, 카테고리에 `id`를 추가하면 포트 ID가 새 값으로 바뀌어 기존 엣지가 dangling 상태가 된다. 이는 소비자 입장에서 silent breaking change다.
  - 제안: spec과 system-prompt에 "기존 `class_${i}` 엣지가 연결된 카테고리에 `id`를 추가하면 해당 엣지를 수동 재연결해야 한다"는 마이그레이션 주의 문구를 명시한다(현재 `4-ai-assistant.md` 업데이트에는 포함되지 않음).

- **[INFO]** `name`, `description`에 `.default('')` 추가 — 유효성 검증 레이어 이원화
  - 위치: `text-classifier.schema.ts` — `categoryDefSchema`
  - 상세: `categoryDefSchema.parse({})` 가 이제 `{ name: '', description: '' }`을 반환하여 schema 레벨 파싱은 성공한다. 실제 빈 이름 차단은 `validateTextClassifierConfig`의 명령형 검사에만 의존한다. 두 레이어의 역할이 분리되어 있으나, schema만 통과시키는 경로(예: DB에서 직접 로드된 레거시 데이터)에서는 빈 이름이 실행 단계까지 도달할 수 있다.
  - 제안: 현재 구조로 충분하나, schema 레벨에도 `.min(1)` 가드를 추가하면 방어 깊이가 늘어난다.

- **[INFO]** `categoryDefSchema` public 노출 — 소비자 API 계약 확장
  - 위치: `text-classifier.schema.ts:1` (`export const categoryDefSchema`)
  - 상세: 기존에 unexported였던 `categoryDefSchema`가 `export`로 변경됨. `text-classifier.schema.spec.ts`가 직접 import하여 사용한다. 추가적 노출이므로 breaking change는 아니나, 외부에서 이 타입을 구체적으로 참조하기 시작하면 이후 수정 시 고려 대상이 된다.
  - 제안: 현행 유지 가능. 필요 시 `export type`으로 한정하는 방안 검토.

- **[INFO]** `buildCategoryPortIds`의 `.trim()` 처리와 schema regex 간 이중 방어
  - 위치: `text-classifier.handler.ts:buildCategoryPortIds`, `text-classifier.schema.ts` regex `/^[a-zA-Z0-9_-]+$/`
  - 상세: schema regex가 공백을 포함한 ID를 이미 거부하므로 handler의 `.trim()` fallback은 실제로 발동될 경로가 없다. 그러나 schema 우회 경로(DB 직접 주입 등)에 대한 방어적 코드이므로 오류는 아니다. resolver도 동일 trim 로직을 사용하여 일관성이 유지된다.

---

## 요약

이번 변경은 `text_classifier` 노드의 `CategoryDef`에 선택적 `id` 필드를 도입하여, 출력 포트 ID를 index 기반 `class_${i}`에서 사용자 정의 slug로 안정화하는 작업이다. `id` 필드가 optional이고 fallback이 보존되므로 신규 데이터 기준 하위 호환성은 유지된다. 그러나 **기존 워크플로우에서 카테고리에 `id`를 추가하면 포트 ID가 변경되어 저장된 엣지가 파단**되는 런타임 계약 변경이 존재하며, 이에 대한 마이그레이션 안내가 문서에 누락되어 있다. 또한 배열 내 `id` 중복에 대한 서버 측 유효성 검증이 없어 resolver/handler 불일치로 이어질 수 있는 방어 공백이 존재한다.

## 위험도

**LOW**