## 발견사항

### 파일 1: external-interaction.module.ts

- **[INFO]** JSDoc 의존성 목록 갱신 — 코드와 주석 일치
  - 위치: 라인 50-55 (diff)
  - 상세: `TypeOrmModule.forFeature` 배열과 JSDoc 의존성 목록이 이제 동기화됨. 기존 JSDoc 이 `NodeExecution`, `ExecutionToken` 을 누락하고 있었던 유지보수 부채가 해소됨.
  - 제안: 현 상태 적절. 별도 조치 불필요.

---

### 파일 2: interaction.service.ts

- **[INFO]** `SSE_SEQ_PLACEHOLDER` 명명 상수 추출 — 매직 넘버 제거
  - 위치: 라인 179, 226
  - 상세: `seq: 0` 하드코딩이 설명적인 상수와 JSDoc 으로 교체됨. 상수 이름이 목적(placeholder, REST 단발 응답에서 real seq 에 접근 불가)을 명확히 표현. 파일 최상단 모듈 스코프 선언으로 가시성 양호.
  - 제안: 현 상태 적절.

- **[INFO]** `rawInteractionType` 변수 의미 명확화 (기존 `it`)
  - 위치: 라인 208-215
  - 상세: 단일 알파벳 `it` 는 `interactionType` 과의 구분이 불명확했음. `rawInteractionType` 으로 변경해 "검증 전 원시값" 의미를 독자가 바로 파악할 수 있게 됨. 3-way `===` 비교를 위한 멀티라인 전개도 가독성에 긍정적.
  - 제안: 현 상태 적절.

- **[INFO]** `getStatus` 메서드 JSDoc 보안 제약 명기
  - 위치: 라인 188-199 (diff)
  - 상세: `outputData` 가 공개 EIA 표면으로 흐르는 사실과 허용 데이터 범위를 JSDoc 에 기술. 향후 노드 핸들러 구현자가 민감 데이터를 잘못 기록하는 실수를 예방하는 유지보수 guard 역할. 교차 참조(`node-execution.entity.ts @Index JSDoc`)로 문서 연결도 일관됨.
  - 제안: 현 상태 적절.

- **[WARNING]** `getStatus` 메서드 길이
  - 위치: 라인 200-552 (전체 파일)
  - 상세: `getStatus` 자체는 약 85줄(내부 조건 포함)로 단일 메서드로서 상당히 길다. `waiting_for_input` 분기 내 `buttons` 와 `form/ai_conversation` 케이스를 별도 헬퍼(`buildButtonsContext`, `buildNodeOutputContext`)로 분리하면 `getStatus` 의 관심사(상태 조회)와 context 조립 로직이 분리되어 단위 테스트 가능성도 높아진다.
  - 제안: 리팩터링 우선순위는 낮으나, `buildWaitingContext(nodeExec): ExecutionStatusDto['context']` 형태의 private 헬퍼 추출을 고려.

---

### 파일 3: node-execution.entity.ts

- **[INFO]** `@Index(['executionId', 'status'])` 추가 — TypeORM 스키마 인식
  - 위치: 라인 704
  - 상세: JSDoc 이 "실제 DB 인덱스는 Flyway V095 가 담당, 이 데코레이터는 TypeORM 인식 전용" 임을 명시해 중복 마이그레이션 생성 혼동을 방지. `outputData` 보안 제약 교차 참조도 포함되어 엔티티 레벨에서 사용 제약이 가시화됨.
  - 제안: 현 상태 적절.

---

### 파일 4: use-widget.ts

- **[INFO]** `seedWaitingFromStatus` JSDoc 블록 추가
  - 위치: 라인 849-867 (diff)
  - 상세: 기존 인라인 주석 4줄이 구조화된 JSDoc 으로 교체됨. 호출 시점, 실패 정책, 파싱 재사용 근거, `deps []` 이유를 각 항목으로 분리해 독자가 함수의 설계 의도를 빠르게 파악할 수 있음. `useCallback` 의 빈 deps 배열은 흔히 lint 경고 대상이므로 이유를 명기한 것은 유지보수 부채 방지에 효과적.
  - 제안: 현 상태 적절.

- **[WARNING]** `useWidget` 훅 전체 길이 (~435줄)
  - 위치: 라인 966-1400
  - 상세: 이번 변경 범위 밖이나 리뷰 맥락으로 언급. 마운트 `useEffect` 내부에 `scheduleRefresh`, `applyConfig` 가 로컬 함수로 정의되고, bridge 설정, fallback 부팅까지 모두 포함되어 단일 훅이 435줄에 달함. 현재 변경 자체는 유지보수성을 개선하지만, 훅 전체 분해는 별도 리팩터링 과제.
  - 제안: 이번 변경 범위에서는 지적 불필요. 중장기 리팩터링 고려.

---

### 파일 5: spec/5-system/14-external-interaction-api.md

- **[INFO]** EIA-IN-07 `?lastEventId=0` 동작 명기
  - 위치: 라인 1442 (diff)
  - 상세: "첫 연결 시 `?lastEventId=0` 으로 seq≥1 전체 replay" 동작이 코드에는 이미 구현되어 있었으나 spec 에 미기술 상태였음. spec-drift 해소. 구현과 문서가 동기화됨.
  - 제안: 현 상태 적절.

---

## 요약

이번 변경은 순수 유지보수성 개선 커밋으로, 신규 기능 없이 ① `seq: 0` 매직 넘버를 명명 상수(`SSE_SEQ_PLACEHOLDER`)로 추출, ② 단일 알파벳 변수 `it` 를 `rawInteractionType` 으로 의미 명확화, ③ 각 파일에 목적·제약·호출 규약을 기술한 JSDoc 추가, ④ module JSDoc 의존성 목록 코드 동기화의 네 가지 개선으로 구성된다. 변경 범위 내 코드는 전반적으로 읽기 쉽고, 기존 코드베이스 스타일(한국어 JSDoc, spec 섹션 참조 태그)을 일관되게 따른다. `getStatus` 메서드와 `useWidget` 훅의 길이는 이번 변경 이전부터 존재하던 부채이며 이번 커밋의 문제가 아니다. 전반적으로 매직 넘버, 불명확 네이밍, 주석-코드 불일치를 제거하는 정방향 변경이다.

## 위험도

LOW
