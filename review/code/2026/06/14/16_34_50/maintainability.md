# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

- **[INFO]** JSDoc 주석과 `@ApiProperty.description` 이 중복 기재됨
  - 위치: `AuthConfigUsagePeriodCountsDto` 의 `last24h`, `last7d`, `last30d` 필드 (변경 후 전체 파일 기준 line 120–142)
  - 상세: 각 필드에 `/** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */` 형태의 TSDoc 주석이 추가되었고, 동시에 `@ApiProperty({ description: '최근 24시간 롤링 윈도 호출 건수.' })` 도 존재한다. TSDoc 주석은 IDE/타입 도구 소비용, `description`은 OpenAPI 문서 소비용으로 목적이 다르지만 내용이 거의 동일하여 향후 한쪽만 갱신할 때 불일치가 발생할 수 있다. 현재는 주석 쪽이 `(캘린더 일 경계 아님)` 보충 문구를 포함하고 있어 이미 미묘하게 다르다.
  - 제안: 두 가지 선택지 중 하나를 일관되게 선택한다. (a) 팀 코드베이스가 TSDoc 주석을 SoT 로 두는 컨벤션이라면 `description`을 TSDoc에서 자동 생성하는 방식을 도입하거나, (b) `description` 을 SoT 로 두고 TSDoc 주석은 제거한다. 현재 `AuthConfigUsageCallDto` 의 `sourceIp`, `responseCode` 필드는 TSDoc 주석은 있지만 `description`은 없거나 다른 패턴을 따르고 있어 클래스 내 일관성도 검토 필요.

- **[INFO]** `type: Number` / `type: String` 의 명시적 추가 — 파일 내 일관성 여전히 미완
  - 위치: `AuthConfigUsagePeriodCountsDto` 세 필드 및 `sourceIp` (변경 diff 전체)
  - 상세: 이번 변경에서 `@ApiProperty({ type: Number })`, `@ApiProperty({ type: String })` 을 추가해 Swagger 스키마 추론 신뢰성을 높였다. 그러나 같은 파일의 `AuthConfigDto` 필드들(`id`, `name`, `isActive` 등)과 `AuthConfigUsageDto`의 `totalCalls` 등은 여전히 `type` 없이 타입 추론에 의존하고 있다. 변경의 의도가 타입 명시 강화라면 나머지 필드도 동일한 패턴을 적용해야 일관성이 유지된다.
  - 제안: 파일 전체에 걸쳐 primitive 타입 필드에는 `type` 명시를 통일하거나, 또는 현재처럼 추론에 맡기는 방식으로 파일 전체 컨벤션을 통일한다. 절충안으로 신규 추가 필드와 수정 대상 필드에만 명시하는 방식은 장기적으로 파일 내 불일관을 누적시킨다.

- **[INFO]** `AuthConfigUsageCallDto.responseCode` — `description` 이 길고 `type` 미지정
  - 위치: line 170–175 (변경 없는 기존 코드, 맥락 확인용)
  - 상세: `responseCode` 필드의 `@ApiProperty.description` 은 3줄에 걸친 긴 인라인 문자열 연결(`"webhook 실제 HTTP 응답 코드 (...) non-null."`)로 작성되어 가독성이 낮다. 또한 이 필드에는 `type` 도 지정되지 않았다. 이번 변경이 인접 필드에 `type: String` 을 추가한 컨텍스트와 맞지 않는다.
  - 제안: `description` 을 JSDoc 주석으로 이동하거나 줄을 나누고, `type: String` 을 추가해 인접 필드와 패턴을 맞춘다.

---

### 파일 2: `spec/1-data-model.md`

- **[INFO]** 인덱스 테이블 행 내용 밀도가 높아 가독성이 낮아지는 경향
  - 위치: 추가된 인덱스 행 (`idx_execution_trigger_started`, line 215)
  - 상세: 단일 테이블 셀에 "집계 경로·인덱스 이름·partial 조건·마이그레이션 버전·cross-spec 링크" 가 모두 담겨 있다. 이는 기존 인덱스 행들의 서술 방식과 동일한 패턴이므로 새 추가분이 특별히 더 나쁜 것은 아니지만, 새 행은 특히 `trigger_id IN (...)` SQL 단편을 description 컬럼에 삽입해 셀 밀도가 가장 높다.
  - 제안: 변경 자체는 기존 컨벤션을 따르므로 즉각 조치는 불필요하다. 중장기적으로는 인덱스 테이블 행의 description 필드에 구현 메모(SQL 단편·집계 설명)와 참조 링크를 분리하는 컨벤션 수립을 고려할 수 있다.

---

### 파일 3: `spec/5-system/12-webhook.md`

- **[INFO]** 처리 흐름 step 7e와 8b의 함수 시그니처 기술 방식이 비대칭
  - 위치: step 7e (line 983)와 step 8b (line 989–991)
  - 상세: step 7e 는 `ExecutionEngineService.execute(workflowId, input, { triggerId: trigger.id, sourceIp, responseCode: '202' })` 를 인라인 코드 블록으로 기술한다. step 8b 는 `ExecutionEngineService.execute(trigger.workflowId, { parameters, body, headers, query, method }, { triggerId: trigger.id, sourceIp, responseCode: '202' })` 로 기술하면서, 아래에 두 개의 bullet 설명이 따라온다. 두 호출의 구조가 거의 동일(세 번째 인자 `{ triggerId, sourceIp, responseCode }` 패턴)하지만 서술 밀도와 강조 방식이 다르다. step 7e 는 후속 bullet 없이 설명이 인라인에 집중되어 있어 독자가 두 경로의 차이를 비교하기 어렵다.
  - 제안: 두 분기 모두 동일한 서술 구조(코드 블록 + bullet 설명)를 따르도록 통일하거나, 공통 옵션 객체를 spec 문서 내 별도 테이블로 추출해 양쪽 step 에서 참조하는 방식을 채택한다.

- **[INFO]** step 8b 주석 내 R-6 참조가 두 번 등장하나 대상 링크가 동일
  - 위치: step 8b 두 번째 bullet (line 991)
  - 상세: `([config §A.3](../2-navigation/6-config.md), R-6; [WH-MG-05](#3-요구사항))` 에서 `R-6` 는 앵커 없이 텍스트로만 언급된다. step 7e (line 983)에도 동일하게 `([config §A.3](../2-navigation/6-config.md), R-6)` 가 등장하는데 R-6 가 현재 파일 내 Rationale 섹션에 실제로 존재하는지 또는 6-config.md 내 앵커인지 확인이 필요하다. 현재 Rationale 섹션은 numbered heading 없이 제목만 있어 `R-6` 앵커가 없을 수 있다.
  - 제안: `R-6` 를 해당 Rationale 섹션의 실제 앵커 링크로 교체하거나, 앵커가 없다면 추가한다. 그러면 두 위치에서 일관된 딥링크 참조가 가능하다.

---

## 요약

이번 변경은 전반적으로 작고 명확한 문서·DTO 보강 작업이다. `auth-config-response.dto.ts` 는 `type` 명시 추가와 한국어 description 전환으로 Swagger 문서 품질이 개선되었으나, 파일 내 다른 필드와의 일관성이 아직 절반 정도만 달성된 상태이며 TSDoc 주석과 `description` 의 미묘한 내용 이중화가 잠재적 유지보수 부담이다. spec 파일 두 건은 구현 경로와 인덱스 근거를 추가로 명문화한 개선이며, 처리 흐름 서술의 비대칭성과 앵커 없는 Rationale 참조 정도가 장기 가독성 관점에서 보완할 여지로 남는다. 전체적으로 유지보수성에 즉각적인 위험을 초래하는 변경은 없다.

## 위험도

LOW
