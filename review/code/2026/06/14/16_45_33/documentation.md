# Documentation Review

## 발견사항

### 파일 1: codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts

- **[INFO]** `AuthConfigUsagePeriodCountsDto` 필드 TSDoc 주석 추가 — 긍정적 개선
  - 위치: `last24h` (line 35), `last7d` (line 44), `last30d` (line 53)
  - 상세: 각 필드에 `/** ... */` 블록 주석이 새로 추가되었다. `type: Number` 명시와 한국어 `description` 동기화도 함께 이루어졌다. TSDoc 주석(`/** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */`)과 `@ApiProperty` description(`'최근 24시간 롤링 윈도 호출 건수.'`) 사이에 "캘린더 일 경계 아님" 문구 유무의 경미한 불일치가 존재한다. OpenAPI 소비자가 주석보다 `description` 을 보므로 해당 문구가 누락되어 있다.
  - 제안: `last24h` 의 `@ApiProperty.description` 에 "(캘린더 일 경계 아님)" 추가하여 TSDoc 과 일치시킨다. 또는 클래스 레벨 JSDoc(`/** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d) 호출 건수 (캘린더 버킷 아님) */`)에서 이미 서술하므로 의도적 축약이라면 현행 유지도 무방하다. 단, 두 위치의 소스 분리는 장기 유지보수 부담이다.

- **[INFO]** `sourceIp` `@ApiProperty` 에 `type: String` 추가 — Swagger nullable 필드 정합성 개선
  - 위치: line 67
  - 상세: `nullable: true` 필드에 `type: String` 을 명시하면 일부 Swagger 버전의 스키마 추론 오류를 예방한다. 기존 누락의 정정이며 긍정적 수정이다.
  - 제안: 추가 조치 불필요.

- **[INFO]** `AuthConfigUsageCallDto.responseCode` — `type: String` 미명시 (인접 필드와 패턴 불일치)
  - 위치: lines 178-183 (`@ApiProperty` 블록)
  - 상세: 이번 diff 에서 `sourceIp` 에는 `type: String` 이 추가되었으나 동일 DTO 의 `responseCode` 에는 여전히 `type` 이 없다. OpenAPI 스키마 생성기 관점에서 일관성이 미완이다. 기존 RESOLUTION(16_34_50)의 I-3 항목으로 이미 조치 완료된 내용이나, 이번 diff 에서는 해당 필드의 `type: String` 이 포함되어 있지 않아 확인이 필요하다.
  - 제안: `@ApiProperty` 에 `type: String` 추가. RESOLUTION 의 I-3 조치가 이 리뷰 시점 diff 에는 반영되지 않은 경우, 누락 여부를 재확인할 것.

---

### 파일 2: spec/1-data-model.md

- **[INFO]** `idx_execution_trigger_started` partial 인덱스 행 추가 — 문서화 완전성 향상
  - 위치: 인덱스 테이블 신규 행 (line 888 diff 기준)
  - 상세: `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` partial 인덱스가 spec 인덱스 테이블에 추가되었다. V096 마이그레이션 식별자, cross-spec 링크(`config §A.3`), 인덱스 이름(`idx_execution_trigger_started`), partial 조건 설계 근거(schedule/manual 행 제외)가 단일 셀에 모두 기술되어 있어 추적성은 충분하다.
  - 제안: 추가 조치 불필요. 다만 동일 테이블 내 V095 NodeExecution 행에는 `CONCURRENTLY` 명시가 있으나 V096 행에는 없다. 스타일 일관성 관점에서 `CONCURRENTLY` 여부를 명시하거나 ("CONCURRENTLY, V096") 마이그레이션 SQL 에만 위임한다면 그 의도를 인라인 설명에 추가하는 것이 좋다.

---

### 파일 3: spec/5-system/12-webhook.md

- **[INFO]** step 7e — chat-channel 분기 `ExecutionEngineService.execute()` 인자 현행화
  - 위치: §7 처리 흐름 step 7e (diff line +170)
  - 상세: `{ triggerId: trigger.id, sourceIp, responseCode: '202' }` 전달이 명문화되었고, `[config §A.3](../2-navigation/6-config.md)` 및 `[R-6](../2-navigation/6-config.md#rationale)` cross-link 가 추가되어 요구사항 추적성이 확보된다. schedule/manual 트리거의 optional 처리도 같은 문장에 명시되어 하위 호환성 우려가 해소되었다.
  - 제안: 추가 조치 불필요. `[R-6](../2-navigation/6-config.md#rationale)` 링크가 실제 앵커를 가리키는지 확인 권장 (Rationale 섹션에 `#rationale` 앵커 미존재 시 딥링크 불가).

- **[INFO]** step 8b — 기존 webhook 경로 `sourceIp`·`responseCode` 설명 추가
  - 위치: §7 처리 흐름 step 8b (diff lines +176-178)
  - 상세: `sourceIp`·`responseCode` 전달 및 Execution 컬럼 영속 경로, 그리고 optional 선언으로 기존 호출자 호환성 보장이 bullet 2개로 기술된다. `[config §A.3]`, `[R-6]`, `[WH-MG-05]` cross-link 가 모두 포함되어 있다.
  - 제안: step 7e 와 step 8b 의 서술 밀도 차이가 있다 (7e 는 인라인 1문장, 8b 는 bullet 2개). 두 경로가 동일 인자를 사용하므로 장기 유지보수 관점에서 서술 구조를 통일하거나 공통 옵션 테이블로 추출하면 중복 설명 부담을 줄일 수 있다. 즉각 차단 수준은 아님.

- **[INFO]** `[R-6](../2-navigation/6-config.md#rationale)` 앵커 링크 유효성
  - 위치: step 7e (line 170), step 8b (line 178)
  - 상세: 두 위치 모두 `R-6` 를 `../2-navigation/6-config.md#rationale` 앵커 링크로 교체했다. 이전 diff(16_34_50) 에서 지적된 "앵커 없는 텍스트 참조" 문제가 링크로 전환된 것이다. `6-config.md` 의 `Rationale` 섹션에 `#rationale` 앵커가 실제로 존재해야 링크가 유효하다.
  - 제안: `spec/2-navigation/6-config.md` 의 Rationale 섹션 헤딩(`## Rationale` 또는 `## rationale`)이 `#rationale` 앵커를 생성하는지 확인. 앵커가 없다면 `R-6` 앵커 명시(`## Rationale {#rationale}` 형식 또는 표준 헤딩 ID) 추가 필요.

---

## 요약

이번 변경은 전체적으로 문서화 품질을 향상시키는 방향이다. `auth-config-response.dto.ts` 에서는 `AuthConfigUsagePeriodCountsDto` 필드 3개에 TSDoc 주석과 `type: Number` 가 추가되었고 `sourceIp` 의 `type: String` 도 보강되었다. `spec/1-data-model.md` 에는 V096 partial 인덱스 항목이 cross-spec 링크와 함께 등록되었으며, `spec/5-system/12-webhook.md` 에는 `sourceIp`·`responseCode` 인자 전달 및 optional 처리 방침이 요구사항 ID 참조와 함께 명문화되었다. 문서화 관점의 핵심 잔여 우려는 두 가지다: (1) `last24h` TSDoc 주석과 `@ApiProperty.description` 간 "캘린더 일 경계 아님" 문구 불일치(INFO — 즉각 차단 아님), (2) `R-6` 앵커 링크의 실제 유효성 확인 필요(INFO — 딥링크 불통 시 참조 가치 저하). README 업데이트, CHANGELOG, 신규 공개 API 문서 추가 필요성은 없다 — 이번 변경은 기존 구현의 spec 동기화·메타데이터 정합이다.

## 위험도

NONE

STATUS=success ISSUES=0
