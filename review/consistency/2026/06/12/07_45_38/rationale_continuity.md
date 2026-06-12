## 발견사항

- **[INFO]** `DB_HOST_BLOCKED` chat-channel 분류 근거가 `EMAIL_HOST_BLOCKED` 분석 방식과 상이
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §Rationale "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설"
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` §Rationale "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" — "chat-channel 분류표 영향 없음: `EMAIL_HOST_BLOCKED` 는 … `ERROR_PORT_FALLBACK` 이 되므로 분류표 행 추가 불필요"
  - 상세: `EMAIL_HOST_BLOCKED`의 chat-channel 무영향 분석은 "send_email 실패가 워크플로 종료로 격상되면 execution 레벨 error.code 는 ERROR_PORT_FALLBACK" 이라는 실행 엔진 격상 경로에 근거한다. 반면 DB_HOST_BLOCKED 의 Rationale 은 "DB_* 매핑에 포함돼 executionFailedInternal 로 분류된다"고 서술하는데, 이는 노드 레벨 output.error.code 가 chat-channel-adapter 분류표의 DB_* wildcard(line 388)에 직접 매핑된다는 주장이다. 두 설명은 서로 다른 격상 경로를 가정하고 있다(ERROR_PORT_FALLBACK 경유 vs DB_* wildcard 직접 매핑). 노드 output.error.code 가 execution 레벨 error.code 로 직접 전파되는지 여부는 두 Rationale 간 가정이 충돌하므로 하나가 오기재일 가능성이 있다.
  - 제안: 2-database-query.md §Rationale 에 EMAIL_HOST_BLOCKED 분석과 동일 방식으로 "노드 레벨 → execution 레벨 격상 경로" 를 명시하거나, chat-channel-adapter spec 분류표의 DB_* wildcard 가 노드 레벨 코드를 직접 커버한다는 근거를 인용 추가.

- **[INFO]** DB_HOST_BLOCKED Rationale 에 error-handling.md §1.4 "enum 확장 시 분류표 검토 의무" 참조 누락
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` §Rationale "`DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설"
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` line 88 — "본 enum 확장 … 시 분류 표 행 추가 검토 의무"
  - 상세: DB_HOST_BLOCKED 는 신규 error.code enum 확장이다. error-handling.md 는 enum 확장 시 chat-channel-adapter 분류표 행 추가를 검토하도록 의무화한다. EMAIL_HOST_BLOCKED 의 Rationale(4-integration.md)은 이 의무를 명시적으로 이행("error-handling §1.4 의 검토 의무를 검토한 결과 분류표 행 추가는 불필요하다")했지만, DB_HOST_BLOCKED 의 Rationale 은 이 프로세스를 언급하지 않고 DB_* wildcard 커버만 결론으로 제시한다. 검토 자체는 이루어졌을 수 있으나 Rationale 에 기록되지 않아 연속성 추적이 불가하다.
  - 제안: 2-database-query.md §Rationale 에 "error-handling §1.4 검토 의무 이행: DB_* wildcard 가 이미 분류표 line 388 에 존재해 신규 행 추가 불필요" 문장 추가.

- **[INFO]** 0-common.md §7 출력 구조 색인 — database_query 에러 케이스 설명이 DB_HOST_BLOCKED 미반영
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §7 표의 database_query 행
  - 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md` §Rationale — DB_HOST_BLOCKED 신설 및 SSRF 차단 전용 코드 분리 결정
  - 상세: 0-common.md §7 표에서 database_query 에러 케이스는 "driver 에러 + integration resolve 실패 + 자격증명 누락 + invalid parameters 모두 통합" 으로 기술되어 있어 SSRF 차단(DB_HOST_BLOCKED) 경로가 누락되어 있다. HTTP Request 에러 케이스는 "SSRF 차단 모두 통합"이 명시되어 있어 비대칭이다.
  - 제안: 0-common.md §7 database_query 행의 에러 케이스 설명에 "+ SSRF 차단(DB_HOST_BLOCKED)" 추가.

## 요약

target 문서(spec/4-nodes/4-integration/ 전체)는 Rationale 의 핵심 원칙들을 잘 준수하고 있다. DB_HOST_BLOCKED 신설 결정은 HTTP/Email 의 SSRF 가드 통일 결정(기각된 "별도 플래그 신설" 대안 불채택 포함)과 일관되게 ALLOW_PRIVATE_HOST_TARGETS 재사용·전용 코드 신설·기본 차단 원칙을 따른다. D4 결정(모든 IntegrationError → port: error 라우팅)도 올바르게 유지된다. 다만 chat-channel 분류 근거의 서술 방식이 EMAIL_HOST_BLOCKED Rationale 과 달리 error-handling §1.4 의무 이행을 명시적으로 언급하지 않고 있어 추적성이 낮으며, 0-common.md §7 색인 표에 SSRF 차단 경로가 누락된 문서 일관성 갭이 있다. 기각된 대안 재도입이나 합의 원칙 위반에 해당하는 항목은 발견되지 않았다.

## 위험도

LOW
