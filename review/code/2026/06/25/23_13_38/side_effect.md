# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] PRESENTATION_KINDS — 새 모듈-스코프 변수 도입
- 위치: `codebase/channel-web-chat/src/lib/presentation.ts` L101
- 상세: `const PRESENTATION_KINDS = new Set<PresentationKind>(...)` 가 모듈 최상위에 선언됐다. 사실상 상수이고 외부에 export 되지 않으며 수정되지 않는다. 부작용 없음.
- 제안: 없음. 패턴은 같은 파일의 `CAROUSEL_LAYOUTS`, `CHART_TYPES` 와 동일.

### [INFO] asEnvelope — 새 내부 함수, 외부 노출 없음
- 위치: L110–120
- 상세: `function asEnvelope` 는 `export` 없이 모듈 내부로만 노출. 기존 `asRecord`/`asArray`/`asButtons` 와 동일한 패턴이고 상태 변경 없음. 인자 `p` 를 변이하지 않으며 항상 새 객체를 반환한다.
- 제안: 없음.

### [INFO] asEnvelope — config와 output이 동일 참조 공유 (PresentationPayload 경로)
- 위치: L117 `return { config: payload, output: payload };`
- 상세: PresentationPayload 경로에서 `config` 와 `output` 이 동일한 `payload` 객체를 참조한다. 호출자(`toCarousel`, `toTable`, `toChart`, `toTemplate`)는 두 참조 중 하나라도 쓰기하지 않으므로 실질적 부작용 없음. 단, 미래 코드가 `config` 또는 `output` 을 직접 변이할 경우 두 쪽이 동시 오염되는 잠재적 취약점이 있다.
- 제안: 명시적으로 `{ config: { ...payload }, output: { ...payload } }` 로 shallow-copy 해두면 잠재적 aliasing 버그를 예방할 수 있다. 현재 코드에서는 직접적 문제가 없으므로 INFO 수준 유지.

### [INFO] toCarousel — itemButtons 병합으로 인한 동작 변경 (기존 노드 카루셀에도 적용)
- 위치: L157–162
- 상세: `itemButtons = asButtons(config.itemButtons)` 를 각 item 의 buttons 에 병합한다. 기존 standalone 노드 카루셀의 envelope 에는 `itemButtons` 키가 없었으므로 `asButtons(undefined)` → 빈 배열이 된다. 즉 기존 동작에 부작용 없음. 단, 노드 카루셀 config 에 `itemButtons` 필드가 실제로 존재하는 케이스가 있다면 새 버튼이 의도치 않게 추가될 수 있다.
- 제안: 노드 카루셀 spec(4-nodes/6-presentation/carousel) 에 `itemButtons` 필드가 정의돼 있는지 확인 필요. 정의되지 않은 필드라면 현재 코드는 안전하다. 정의된다면 의도된 개선이므로 INFO 유지.

### [INFO] toTemplate — rendered 폴백 로직 추가 (`output.content`)
- 위치: L233–238
- 상세: 기존에는 `output.rendered` 가 string 이 아니면 `""` 를 반환했다. 이제 `output.content` 도 폴백으로 확인한다. 기존 standalone 노드 envelope 의 `output` 에 `content` 키가 우연히 존재하는 경우 이전에는 `""` 였던 값이 이제 해당 `content` 로 렌더된다. 실운영 노드 template 이 `output.content` 를 별도 용도로 사용하는지 확인 필요.
- 제안: 이 변경이 기존 standalone 노드 template 에 영향 없는지 노드 template spec(4-nodes/6-presentation/template) 에서 `output.content` 사용 여부 검증 권장. 현재 기존 테스트(`toTemplate — rendered + 기본 html`)는 `output.rendered` 경로만 다루며 `output.content` 폴백의 standalone 노드 회귀 케이스는 없다.

### [INFO] 공개 API(export) 시그니처 — 변경 없음
- 위치: 모든 export 선언
- 상세: `PresentationKind`, `PresentationButton`, `CarouselItem`, `CarouselData`, `TableColumn`, `TableData`, `ChartPoint`, `ChartData`, `TemplateData`, `isSafeUrl`, `classifyPresentation`, `toCarousel`, `toTable`, `toChart`, `toTemplate` — 시그니처, 반환 타입, export 여부 모두 변경 없음. 호출자 파괴적 변경 없음.
- 제안: 없음.

### [INFO] 삭제된 내부 타입 Envelope
- 위치: 기존 L62–65 (삭제됨)
- 상세: `type Envelope = { config?: ...; output?: ...; }` 가 제거됐다. 이 타입은 파일 내부에서만 사용됐으며(export 없음) `asEnvelope` 함수로 책임이 이전됐다. 외부 사용자에게 영향 없음.
- 제안: 없음.

### [INFO] 네트워크·파일시스템·환경 변수·이벤트 — 변경 없음
- 상세: 이번 변경은 순수 데이터 변환 함수(presentation.ts) 및 테스트 추가(presentation.test.ts)로 한정. 네트워크 호출, 파일시스템 접근, 환경 변수 읽기/쓰기, 이벤트 발행/구독 코드가 없다.

---

## 요약

이번 변경은 `codebase/channel-web-chat/src/lib/presentation.ts` 의 순수 변환 함수군을 리팩터링하고, 새로운 `PresentationPayload` shape(AI render_* 도구)을 처리하기 위한 `asEnvelope` 헬퍼와 `PRESENTATION_KINDS` 상수를 추가한 것이다. 모든 공개 함수의 시그니처·반환 타입은 그대로 유지되어 기존 호출자에 파괴적 변경이 없고, 신규 변수는 모두 모듈 내부로만 노출된다. 주목할 잠재적 지점은 두 가지다: (1) `asEnvelope` 의 PresentationPayload 경로에서 `config`와 `output`이 동일 객체를 참조하는 aliasing(현재 호출자들이 변이를 수행하지 않아 실질적 문제 없음), (2) 기존 standalone 노드 template envelope 에 `output.content` 키가 존재하면 이전에는 빈 문자열이었던 `rendered` 가 해당 값으로 채워지는 동작 변화(spec에서 `output.content` 미사용이 확인되면 무해). 두 항목 모두 현재 코드·테스트 범위 내에서는 부작용을 발생시키지 않으나 미래 확장 시 주의가 필요한 INFO 수준이다.

## 위험도

LOW
