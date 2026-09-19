# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `UNDECLARED_COLUMNS` 의 두 값이 문자 그대로 동일한 문자열을 반복
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:44-52` (`UNDECLARED_COLUMNS` Map 정의)
  - 상세: `'`vector` — TypeORM 이 모르는 타입이라 원시 SQL 로만 다룬다'` 라는 동일한 이유 문자열이 `document_chunk.embedding` · `agent_memory.embedding` 두 항목에 그대로 중복된다. 지금은 두 항목뿐이라 문제는 작지만, 향후 `vector` 컬럼이 늘어나면 이유 문구가 각자 따로 갱신되며 drift 날 여지가 있다.
  - 제안: 우선순위 낮음 — 세 번째 항목이 추가될 때 `const VECTOR_REASON = ...` 같은 공용 상수로 뽑아도 되고, 지금 상태로 둬도 무방하다.

- **[INFO]** `COLUMN_LEVEL` 상수명이 값의 타입(정규식 배열)을 드러내지 않음
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:60` (`const COLUMN_LEVEL: ReadonlyArray<RegExp> = [...]`)
  - 상세: 바로 아래 `COLUMN_LEVEL_SAMPLES`(표본 데이터)와 이름이 대구를 이루긴 하지만, `COLUMN_LEVEL` 만 보면 "컬럼 층 여부를 뜻하는 값"인지 "컬럼 층을 판별하는 정규식 목록"인지 이름만으로는 약간 모호하다. 주석(55-59행)이 즉시 의미를 보완해 실질적 혼동 위험은 낮다.
  - 제안: `COLUMN_LEVEL_PATTERNS` 로 개명하면 `isColumnLevel` 함수와의 관계가 더 명확해진다. 필수는 아님.

## 관찰 (문제 아님, 참고용)

- 엔티티 8개 파일(`alert-rule`·`edge`·`integration-usage-log`·`llm-usage-log`·`model-config`·`node`·`workflow-assistant-session`·`workspace-invitation`)의 변경은 각각 `@Column` 옵션에 `type: 'uuid'` / `enumName` / `default` 한두 개를 추가하는 최소 diff로, 기존 파일의 데코레이터 스타일(옵션 키 순서, 이름 규칙)과 완전히 일치한다. 새로운 매직 넘버·중복·중첩도 없다.
- `entity-schema-declarations.e2e-spec.ts`의 새 로직(`UNDECLARED_COLUMNS`, `COLUMN_LEVEL`, `COLUMN_LEVEL_SAMPLES`, `isColumnLevel`)은 파일 상단 doc-comment(9-29행)가 "인덱스·제약 층은 단방향" vs "컬럼 층은 양방향"이라는 설계 의도를 먼저 서술하고, 각 상수/함수 바로 위에 그 존재 이유를 설명하는 주석을 붙여 가독성이 높다. 함수 `isColumnLevel`은 순수 함수로 `db` 클로저가 필요 없어 기존 관례(클로저가 필요 없는 헬퍼는 `describe` 밖, 필요한 헬퍼는 안)를 그대로 따른다.
- 신규 `it()` 두 블록(507행, 520행)은 각각 단일 책임(패턴 판별력 대조군 / 실사용 비교기 결과 검증)을 가지며 중첩 깊이도 얕다. `COLUMN_LEVEL_SAMPLES`에 담긴 14개 SQL 문자열 리터럴은 매직 스트링이 아니라 회귀 고정용 픽스처이고, 왜 필요한지(74-71행 주석 — "이 표본이 없으면 다섯 패턴 중 어느 것이 깨져도 라이브 테스트는 계속 GREEN")가 명시돼 있어 정당화된다.
- `default: () => 'now()'`(workflow-assistant-session.entity.ts) 같은 TypeORM 함수형 기본값 문법은 코드베이스에 처음 등장하는 패턴이지만 자기 설명적이며 별도 문서화가 필요할 정도로 난해하지 않다.

## 요약

이번 변경은 엔티티 8개의 `@Column` 옵션 한두 개 추가와, 그 드리프트를 잡는 e2e 가드에 "컬럼 층" 판별 로직(정규식 5종 + 예외 목록 + 판별력 대조 테스트)을 확장한 것이다. 신규 로직은 각 상수·함수 위에 존재 이유를 설명하는 주석을 붙이고, 표본 데이터로 정규식이 실사용 문장을 잡고 흘리는지 대조군 테스트까지 마련해 유지보수성 측면에서 모범적이다. 발견한 두 건은 모두 INFO 수준(이유 문자열의 사소한 중복, 상수명이 타입을 완전히 드러내지 않음)으로 즉시 조치가 필요하지 않다.

## 위험도

LOW
