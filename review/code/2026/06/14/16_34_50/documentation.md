# Documentation Review

## 발견사항

### 파일 1: auth-config-response.dto.ts

- **[INFO]** `AuthConfigUsagePeriodCountsDto` 필드에 TSDoc 주석 추가 — 긍정적 변경
  - 위치: 라인 35, 44, 53 (각 필드 상단)
  - 상세: `last24h`, `last7d`, `last30d` 각 필드에 `/** ... */` 블록 주석이 추가되었고, `@ApiProperty` 의 `type: Number` 명시와 한국어 description 동기화도 함께 이루어졌다. 주석과 Swagger description 이 동일 내용을 중복 서술하지만, 코드 내 가독성과 OpenAPI 문서 노출 양쪽을 별도로 챙기는 패턴은 이 코드베이스의 기존 관례(`AuthConfigUsageCallDto` 의 `sourceIp`, `responseCode` 필드)와 일치한다.
  - 제안: 현행 방식 유지. 다만 `/** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */` 와 `description: '최근 24시간 롤링 윈도 호출 건수.'` 가 의미 차이가 있다 — 주석에는 "캘린더 일 경계 아님" 이라는 보조 설명이 있는 반면 description 에서는 누락되어 있다. OpenAPI 소비자를 위해 description 에도 "(캘린더 일 경계 아님)" 을 포함하거나, 또는 클래스 레벨 JSDoc 인 `/** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d) 호출 건수 (캘린더 버킷 아님) */` 로 충분하다 판단해 의도적으로 축약한 것이라면 description 에서의 생략을 그대로 유지해도 무방하다.

- **[INFO]** `sourceIp` `@ApiProperty` 에 `type: String` 추가 — 일관성 개선
  - 위치: 라인 67
  - 상세: nullable 필드에 `type` 을 명시하는 것은 Swagger 스키마 생성기가 `nullable: true` 를 올바르게 처리하도록 돕는다. 기존 누락이었으므로 긍정적 수정이다.
  - 제안: 추가 조치 불필요.

---

### 파일 2: spec/1-data-model.md

- **[INFO]** `idx_execution_trigger_started` 인덱스 항목 추가 — 문서화 완전성 향상
  - 위치: 인덱스 테이블 "Execution | (trigger_id, started_at DESC) WHERE ..." 신규 행
  - 상세: `GET /api/auth-configs/:id/usage` 쿼리 가속을 위한 partial 인덱스가 spec 데이터 모델 인덱스 테이블에 추가되었다. migration 번호(`V096`) 및 cross-spec 링크(`config §A.3`)가 명시되어 있어 추적성이 확보된다. `spec/2-navigation/6-config.md §A.3` 와의 양방향 참조 일관성도 유지된다.
  - 제안: 추가 조치 불필요. `WHERE trigger_id IS NOT NULL` 조건에 대한 partial 인덱스 설계 근거가 인라인 설명에 충분히 기술되어 있다.

---

### 파일 3: spec/5-system/12-webhook.md

- **[INFO]** 처리 흐름 §7 chat channel 분기 step e 와 §8 기존 경로 step b 에 `sourceIp`·`responseCode` 인자 전달 명문화
  - 위치: diff 라인 983, 989-991
  - 상세: `ExecutionEngineService.execute()` 의 3번째 인자에 `sourceIp` 와 `responseCode: '202'` 가 추가되는 흐름이 spec 에 명시되었다. 두 곳 모두 `([config §A.3](../2-navigation/6-config.md), R-6)` 와 `[WH-MG-05](#3-요구사항)` cross-link 를 통해 요구사항 추적성이 확보된다.
  - 제안: 추가 조치 불필요. 단, 아키텍처 개요 다이어그램(§1의 ASCII 박스 "5. executionEngine.execute() 호출")에는 `sourceIp`/`responseCode` 가 반영되지 않았다. 다이어그램은 추상 수준 개요라 세부 인자 나열이 필수는 아니지만, 지속 유지 관리를 위해 주석 또는 각주로 "§7·§8 에서 sourceIp/responseCode 추가 전달" 임을 참조하는 것이 유용할 수 있다.

- **[INFO]** `responseCode` 설명에서 step 8b 의 폴백 behavior 표현 일관성
  - 위치: diff 라인 990-991
  - 상세: step 8b 의 인라인 설명 "성공 경로의 실제 HTTP 코드 `202`" 는 비-HTTP 트리거(schedule)에서 `response_code` 가 NULL 이 되는 케이스를 다루지 않는다. 하지만 §8 은 webhook(HTTP) 경로에만 해당하므로 scope 내에서는 문서가 올바르다. `spec/1-data-model.md §2.13` 의 `response_code` 컬럼 설명에서 비-HTTP 폴백이 별도 서술되어 있으므로 중복 필요 없다.
  - 제안: 추가 조치 불필요.

---

## 요약

이번 변경은 모두 기존 문서화 품질을 향상시키는 방향이다. `AuthConfigUsagePeriodCountsDto` 에 누락되어 있던 필드 레벨 TSDoc 과 `@ApiProperty type` 명시가 추가되었고, 데이터 모델 spec 에 신규 partial 인덱스 항목이 적절한 cross-link 와 함께 등록되었으며, webhook 처리 흐름 spec 에 `sourceIp`/`responseCode` 인자 전달이 요구사항 ID 참조와 함께 명문화되었다. `last24h` 필드의 TSDoc 주석과 `@ApiProperty description` 사이에 "캘린더 일 경계 아님" 문구 유무의 경미한 불일치가 존재하나, 클래스 레벨 주석에서 이미 롤링 윈도 의미가 서술되어 있으므로 즉각 수정이 필요한 수준은 아니다. README 업데이트, CHANGELOG, API 문서 변경 필요성은 없다 — 이번 변경은 기존 동작의 spec 동기화·문서 보완이며 신규 공개 API 추가에 해당하지 않는다.

## 위험도

NONE
