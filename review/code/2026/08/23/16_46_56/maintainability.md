# 유지보수성(Maintainability) 리뷰

### 발견사항

- **[WARNING]** 새 free function 의 JSDoc 이 기존 클래스 JSDoc 과 클래스 선언 사이에 끼어들어 두 문서 블록의 소속이 헷갈린다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:53`~`114` (`redactAssistantFields` 함수 및 그 doc comment)
  - 상세: 53~66번 줄은 원래 `ExploreToolsService` 클래스를 설명하는 JSDoc(`Read-only "Clarify" 도구들...`)이고, 클래스 선언(`@Injectable() export class ExploreToolsService`, 114~115번 줄) 바로 앞에 있어야 그 관계가 명확하다. 이번 diff 가 그 사이에 `redactAssistantFields` 함수와 30줄짜리 별도 JSDoc(67~96번 줄)을 끼워 넣으면서, 클래스 doc 의 닫는 `*/`(66번 줄) 바로 다음 줄(67번 줄)에 공백 한 줄 없이 새 `/**` 가 시작한다. 에디터에서 클래스 위에 커서를 올리면(hover/quick-info) 실제로는 무관한 `redactAssistantFields` 문서가 먼저 보이거나, 두 블록이 시각적으로 한 덩어리처럼 읽혀 어느 주석이 무엇을 설명하는지 순간적으로 헷갈린다. 코드베이스 전반에서 클래스 doc 은 클래스 선언 바로 위에 붙는 패턴을 지키고 있어(예: 이 파일의 다른 메서드들), 이 배치만 예외가 된다.
  - 제안: `redactAssistantFields` (와 그 doc comment)를 클래스 doc comment **위쪽**(예: import 문 바로 아래, 상수 선언부 근처)으로 옮기거나, 클래스 선언 **아래**(파일 하단, `clampLimit`/`normalizeStatusFilter` 같은 다른 module-level 헬퍼들이 이미 모여 있는 자리)로 옮겨 클래스 doc 과 클래스 선언이 다시 인접하도록 정리.

- **[INFO]** 내부 컴포즈 함수 이름 `both` 가 무엇을 합성하는지 이름만으로 드러나지 않는다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:106` (`redactAssistantFields` 내부 `const both = ...`)
  - 상세: `both(v: unknown) => deepRedactSecrets(maskSensitiveFields(v))` 는 바깥 함수의 30줄짜리 doc comment 가 "왜 두 겹인가"를 상세히 설명해 주기 때문에 지금은 이해 가능하지만, 이름 `both` 자체는 "무엇의 양쪽"인지 문맥 없이는 알 수 없다. 이 함수만 따로 인용되거나(IDE go-to-definition 등) 주석과 떨어져 읽히는 경우 의도 파악이 늦어진다.
  - 제안: `redactValue`, `applyBothMaskingLayers`, `redactLayered` 등 "키+값 이중 마스킹"을 암시하는 이름으로 변경.

- **[INFO]** 동일한 "키 축 / 값 축 이중 마스킹, `***` 로 힌트 손실" 설명이 소스 주석·plan 문서 두 곳에 거의 같은 내용으로 반복된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:67`-`96` (함수 doc) 및 `plan/in-progress/assistant-mask-leak.md` (동일 트레이드오프 서술)
  - 상세: 코드 자체의 유지보수성에는 영향이 없지만, 같은 근거가 spec(§4.1.1 Rationale 예정)·plan·소스 주석 세 곳에 흩어지면 이후 결정이 한 번 더 바뀔 때(예: 마스킹 우선순위 재조정) 세 곳 중 하나만 갱신되고 나머지가 stale 해질 위험이 구조적으로 존재한다. 이 저장소가 반복적으로 겪은 "SoT 한쪽만 갱신" 패턴과 같은 종류다.
  - 제안: 지금 당장 조치가 필요한 수준은 아니며, 소스 주석은 "왜 이 순서/조합인가"라는 구현 근접 설명으로 유지하고 상세 트레이드오프 서술은 spec `## Rationale` 을 정본으로 삼아 소스 주석에서는 `@see` 형태로 링크만 남기는 정도의 경량화를 고려할 수 있음.

### 요약

이번 변경은 두 개의 독립적인 마스킹 갭(값 축·키 축)을 닫는 작업으로, 신규 코드(`redactAssistantFields` 헬퍼, `DEFAULT_SENSITIVE_KEYS` 확장)는 함수 길이·중첩·매직 넘버·중복 측면에서 문제가 없고, 기존 6곳의 중복 마스킹 호출을 헬퍼 하나로 통합해 오히려 중복을 줄였다. 테스트 추가분(`it.each` 캐너리, 값 축/키 축 캐너리 2건)도 기존 테스트 헬퍼(`mockExecution`/`makeQueryBuilder`/`makeService`)를 그대로 재사용하고 네이밍·주석 스타일이 기존 스위트와 일관돼 있다. 유일한 실질적 지적은 새 free function 과 그 JSDoc 이 기존 클래스 JSDoc 과 클래스 선언 사이에 끼어들어 두 문서 블록의 소속이 시각적으로 헷갈리는 배치 문제이며, 이는 이동 한 번으로 해소 가능한 경미한 구조적 결함이다. 나머지는 이름 선택·문서 중복에 대한 참고용 INFO 로, 전체적으로 유지보수성 리스크는 낮다.

### 위험도
LOW
