파일 쓰기 권한이 필요합니다. 허용해 주시면 `review/2026-04-16_12-43-33/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

아래는 작성된 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Condition id 자동생성 누락으로 인한 런타임 오류, 순환 의존성, Carousel 데이터 손실 회귀, 테스트 커버리지 전무 등 즉각적인 조치가 필요한 이슈 다수 존재

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / testing | **Condition `id` 자동생성 누락** — `conditionDefSchema.id`는 `z.string()` (필수)이지만 `FieldArrayWidget`이 새 항목 추가 시 `itemDefault`가 없어 `id: undefined` 상태로 삽입 → AI Agent Conditions 기능 전체 사용 불가 | `ai-agent.schema.ts` + `widgets.tsx` | `conditions` 필드 `itemDefault`에 `{ id: crypto.randomUUID(), label: '', prompt: '' }` 추가 |
| 2 | architecture / side_effect | **`widgets.tsx` ↔ `widget-registry.ts` 순환 의존성** — SSR 환경 또는 모듈 초기화 순서에 따라 `WIDGET_REGISTRY`가 `undefined`로 평가될 수 있음 | `widgets.tsx:14`, `widget-registry.ts:14-17` | `pickItemFieldWidget` 로직을 `pick-widget.ts`로 분리 |
| 3 | testing | **핵심 로직 단위 테스트 전무** — `isFieldVisible`(3가지 규칙), `groupEntries`, `countGroupValues`, `TableGridWidget` 컬럼-행 동기화, 백엔드 스키마 default값 파싱 전혀 미검증 | `visibility.ts`, `schema-form.tsx`, `table-grid-widget.tsx` 등 | 순수 함수 export 후 단위 테스트 추가 |
| 4 | security | **표현식 인젝션 / SSTI 위험** — `systemPrompt`, `userPrompt`의 `{{ expression }}`이 서버 평가 시 SSTI 및 프롬프트 인젝션 가능 | `ai-agent.schema.ts` (`widget: 'expression'`) | 샌드박스 환경 사용, 허용 변수 화이트리스트 적용 |
| 5 | security | **`.passthrough()`로 인한 임의 필드 주입** — 미정의 필드가 유효성 검사 없이 실행 컨텍스트에 유입 | `ai-agent.schema.ts:283`, `carousel.schema.ts`, `table.schema.ts` 등 | `.passthrough()` 대신 `.strip()` 사용 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | **Carousel `clearFields` 데이터 손실 회귀** — static→dynamic→static 시 슬라이드 `items` 전체 소실 | `carousel.schema.ts` `mode.clearFields` | `clearFields`에서 `items` 제거 또는 Carousel을 override로 유지 |
| 2 | architecture | **`TableGridWidget` 계약 불일치** — `{ columns, rows, mode }` 번들 `value` 기대하나 스키마에서 세 필드는 개별 최상위 필드 | `table-grid-widget.tsx:30-33` | 위젯 재설계 또는 제거 |
| 3 | scope | **`CarouselConfig` dead code 잔존** — override-registry에서 제거되었으나 약 150줄 잔류 | `presentation-configs.tsx` | `CarouselConfig`, `CarouselItem`, `ItemButtonsConfig`, `carouselItemId` 전체 삭제 |
| 4 | architecture | **`pickWidget` / `humanize` 중복 정의** — 동일 로직이 `widgets.tsx`, `schema-form.tsx` 양쪽에 존재 | `widgets.tsx:155-188`, `schema-form.tsx:31-68` | `auto-form/utils.ts`로 추출 공유 |
| 5 | requirement | **`countGroupValues` 숨겨진 필드도 집계** — 숨겨진 필드 값도 배지 카운트에 포함 | `schema-form.tsx:99-109` | `isFieldVisible` 조건으로 필터링 후 집계 |
| 6 | scope | **`AiAgentConfig` dead code 추정** — override-registry에서 import 제거되었으나 정의 잔존 가능성 | `ai-configs.tsx` | 정의 삭제 여부 확인 후 제거 |
| 7 | security | **`clearFields` 프로토타입 오염 가능성** — `__proto__`, `constructor` 등 예약 키 삭제 시도 가능 | `schema-form.tsx:174-179` | 필드명 정규식 검증 후 삭제 |
| 8 | security | **JSON 비검증 파싱** — textarea 입력 JSON을 무제한 파싱, `.passthrough()`와 결합 시 위험 | `widgets.tsx` `FieldArrayWidget` | 파싱 후 스키마 재검증 또는 크기 제한 |
| 9 | security | **`jsonSchema` 임의 스키마 주입** — 재귀 `$ref`, 과도한 중첩으로 ReDoS/메모리 과부하 가능 | `ai-agent.schema.ts` `jsonSchema` | 깊이/크기 제한, 외부 `$ref` 금지 |
| 10 | testing | **`clearFields`, `FieldArrayWidget`, `TableGridWidget`, 백엔드 스키마 테스트 누락** | 다수 파일 | 각 로직별 단위/통합 테스트 추가 |
| 11 | architecture | **`collapsible` 필드-레벨/그룹-레벨 혼재** — SRP 위반 및 혼합 시나리오 의도 불명확 | `schema-form.tsx:79-93` | 그룹 수준 메타데이터로 분리 |
| 12 | architecture | **`clearFields` 백엔드 DSL 선언 — 레이어 책임 혼재** | `carousel.schema.ts:96-109` | 프론트엔드 전용 config로 이동 |
| 13 | performance | **`StructuredItemForm` 매 렌더마다 정렬 재계산** | `widgets.tsx` `StructuredItemForm` | `useMemo`로 메모이제이션 |
| 14 | performance | **`groupEntries` 이중/삼중 순회** | `schema-form.tsx` | 단일 순회로 통합 |
| 15 | scope | **`selector-widgets.tsx` stale 주석** — 구현 완료 후에도 "placeholder", "UnsupportedWidget" 주석 잔존 | `selector-widgets.tsx:19-30` | 주석 업데이트 또는 제거 |
| 16 | concurrency | **`setExpanded(!expanded)` stale closure** | `schema-form.tsx` `CollapsibleSection` | `setExpanded(prev => !prev)` 로 변경 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | documentation | `table-grid-widget.tsx` JSDoc `value` 형식 설명 부정확 | `table-grid-widget.tsx:22-26` |
| 2 | documentation | `override-registry.ts` `ai_agent` 마이그레이션 이유 미기술 | `override-registry.ts:66-67` |
| 3 | documentation | 백엔드/프론트엔드 `UiHint` JSDoc 미동기화 | `types.ts:47-55` |
| 4 | dependency | `selector-widgets.tsx` 파일명과 역할 불일치 | `selector-widgets.tsx` |
| 5 | security | `as` 타입 단언으로 런타임 검증 우회 | `selector-widgets.tsx:9`, `table-grid-widget.tsx:27-30` |
| 6 | security | `key={i}` 배열 인덱스 사용으로 항목 재정렬 시 상태 오매핑 | `widgets.tsx:255` |
| 7 | requirement | `conditionDefSchema.prompt` `textarea`→`text` 변경 의도 불분명 | `ai-agent.schema.ts` |
| 8 | requirement | `CollapsibleSection` 초기 상태 항상 expanded | `schema-form.tsx:119` |
| 9 | architecture | `visibleWhen` DSL 복합 조건(AND/OR) 미지원 | `visibility.ts` |
| 10 | concurrency | `clearFields`에서 `delete` 대신 선언적 접근 권장 | `schema-form.tsx:174-179` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | HIGH | SSTI/표현식 인젝션, `.passthrough()` 임의 필드 주입, `clearFields` 프로토타입 오염 |
| testing | HIGH | 핵심 로직 단위 테스트 전무, 백엔드 스키마 역호환성 미검증 |
| architecture | HIGH | `widgets.tsx` ↔ `widget-registry.ts` 순환 의존성, `TableGridWidget` 계약 불일치 |
| requirement | HIGH | Condition `id` 자동생성 누락으로 AI Agent Conditions 기능 전체 불가 |
| side_effect | MEDIUM | Carousel 모드 전환 시 `items` 데이터 손실 회귀, 순환 임포트 |
| scope | LOW | `CarouselConfig`/`AiAgentConfig` dead code, `TableGridWidget` 미연결 등록 |
| maintainability | LOW | `pickWidget`/`humanize` 중복, stale 주석 |
| performance | LOW | 매 렌더 정렬 재계산, 이중 순회 |
| documentation | LOW | stale 주석, JSDoc 동기화 누락 |
| concurrency | LOW | stale closure 패턴 |
| dependency | LOW | `TableGridWidget` 계약 불일치, 파일명 불일치 |
| api_contract | LOW | `visibleWhen` DSL additive 확장 (하위 호환 유지) |
| database | NONE | 해당 없음 |

---

## 발견 없는 에이전트

| 에이전트 | 사유 |
|----------|------|
| database | 변경사항이 전부 UI 스키마 메타데이터 및 프론트엔드 위젯으로 DB 관련 코드 없음 |

---

## 권장 조치사항

**즉시 (기능 오류 및 데이터 손실)**
1. **Condition `id` 자동생성 누락 수정** — AI Agent Conditions 기능 복구
2. **Carousel `clearFields` 데이터 손실 회귀 수정** — `items` 보존
3. **순환 의존성 해소** — `pick-widget.ts` 분리

**단기 (코드 품질 및 보안)**
4. **핵심 로직 단위 테스트 추가** — `isFieldVisible`, `groupEntries`, 백엔드 스키마 파싱 등
5. **Dead code 제거** — `CarouselConfig`, `AiAgentConfig`
6. **`countGroupValues` 숨겨진 필드 집계 수정**
7. **stale 주석 정리** — `selector-widgets.tsx`
8. **`clearFields` 필드명 검증** — 프로토타입 오염 방어

**중기 (아키텍처 개선)**
9. **`pickWidget`/`humanize` 중복 제거** — `auto-form/utils.ts`로 통합
10. **`collapsible` DSL 그룹 레벨로 재설계**
11. **`setExpanded(prev => !prev)` 함수형 업데이트 적용**
12. **`conditionDefSchema.prompt` 위젯 복원 검토**