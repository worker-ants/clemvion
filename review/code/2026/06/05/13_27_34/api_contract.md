# API 계약(API Contract) 리뷰 결과

리뷰 일시: 2026-06-05
대상: rag-rerank-followup 변경 (spec 문서 다수)

---

## 발견사항

### [INFO] Rerank Config API — 페이지네이션 응답 형식 참조가 명시적
- **위치**: `spec/2-navigation/6-config.md` +628 `GET /api/rerank-configs`
- **상세**: `GET /api/rerank-configs` 의 페이지네이션 응답 형식을 "[API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수" 로 명시하고 있어 API 일관성 선언이 명확하다. LLMConfig API 와 동일 패턴의 sibling 리소스로 설계되어 하위 호환성 문제가 없다.
- **제안**: 특이사항 없음. 확인 차원의 INFO.

---

### [INFO] Agent Memory 관리 API — `DELETE /agent-memories?scopeKey=` 응답 코드 204 적절
- **위치**: `spec/5-system/17-agent-memory.md` §6 메모리 관리 API
- **상세**: 단건 삭제(`DELETE /agent-memories/:id`)와 scope 전체 삭제(`DELETE /agent-memories?scopeKey=`) 모두 204 No Content 반환. 목록 조회(`GET /agent-memories/scopes`, `GET /agent-memories`) 는 페이지네이션(`limit`/`offset`)을 지원하며 `created_at` 내림차순 정렬을 명시한다. 인증은 조회 viewer+, 삭제 editor+ 로 분리 — 적절하다.
- **제안**: 특이사항 없음.

---

### [INFO] `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드 — 외부 API 응답 스키마에 추가됨
- **위치**: `spec/5-system/14-external-interaction-api.md` +894
- **상세**: 외부 인터랙션 API 의 `error.code` 어휘에 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 명시적으로 추가됐다. 기존 `EXECUTION_TIMEOUT` 이 Code 노드 스크립트 타임아웃 전용이고, 새 코드가 엔진 레벨 active-running 누적 타임아웃 전용임이 인라인 주석으로 명확히 구분된다. 기존 클라이언트는 `EXECUTION_TIMEOUT` 을 그대로 처리하면 되고 새 코드는 **추가**이므로 하위 호환성이 유지된다.
- **제안**: 특이사항 없음. 신규 에러 코드를 처리하지 않는 기존 클라이언트는 fallback(`executionFailedInternal`) 으로 자연 처리됨을 확인.

---

### [INFO] `error.code` 소문자 historic artifact 등재 — 초대 API
- **위치**: `spec/conventions/error-codes.md` +1479, `spec/5-system/1-auth.md` +852
- **상세**: `invitation_not_found` 등 `lower_snake_case` 에러 코드들이 historical-artifact 레지스트리에 명시적으로 등재됐다. rename 이 breaking change 임을 인식하고 의도적으로 유지하는 것으로 API 계약 관점에서 정책이 명확하다. 신규 코드는 `UPPER_SNAKE_CASE` 를 유지한다는 원칙도 재확인됐다.
- **제안**: 특이사항 없음.

---

### [INFO] AI Agent `summaryModel` / `extractionModel` 신규 필드 — 하위 호환성 확보
- **위치**: `spec/4-nodes/3-ai/1-ai-agent.md` +715~716 (파라미터 테이블), +748 (config echo 정책)
- **상세**: 두 필드 모두 optional 이고 미설정 시 `model → llmConfig.defaultModel` fallback 체인이 명시되어 기존 동작이 100% 보존된다. config echo 정책(`output.config`)에도 두 필드가 추가됐으며 "default/미설정과 일치하면 생략" 규약을 따라 기존 클라이언트의 응답 파싱에 영향 없음. Node 파라미터가 증가했지만 모두 optional 이므로 breaking change 아님.
- **제안**: 특이사항 없음.

---

### [INFO] `Execution.conversation_thread` 신규 DB 컬럼(V084) — API 응답 노출 여부 확인 권장
- **위치**: `spec/1-data-model.md` +351, `spec/conventions/conversation-thread.md` §8.4
- **상세**: `Execution.conversation_thread jsonb NULL` 컬럼이 park 스냅샷 용도로 신설됐다. 이 컬럼은 durable resume 용 내부 매체이며, "실행 이력 화면 SoT 는 NodeExecution 분산 저장" 임을 명시해 소비처가 분리된다. 그러나 Execution 목록/상세 API 응답 스키마(`GET /api/executions/:id` 등)에서 이 컬럼이 **의도치 않게 노출될 위험**이 있다. `conversation_thread` 는 대용량 JSONB 이므로 목록 API 에 직렬화되면 페이로드가 크게 증가한다.
- **제안**: `GET /api/executions` 목록 및 `GET /api/executions/:id` 상세 응답에서 `conversation_thread` 컬럼을 명시적으로 제외(`SELECT` 제한 또는 DTO 필드 배제)하는지 구현 레벨에서 확인 권장. spec 에도 "API 응답에서 제외" 명시를 추가하면 구현 가이드가 명확해진다.

---

### [INFO] Agent Memory `GET /agent-memories` — `scopeKey` 필수 파라미터 처리 명세
- **위치**: `spec/5-system/17-agent-memory.md` §6 테이블
- **상세**: `GET /agent-memories` 는 `scopeKey` 가 "필수" 라고 명시돼 있다. 그러나 `scopeKey` 누락 시의 에러 응답(HTTP 상태 코드, 에러 코드)이 spec 에 기술되지 않았다.
- **제안**: 향후 spec 보강 수준 — `scopeKey` 누락 시 400 Bad Request + 적절한 에러 코드(`MISSING_REQUIRED_PARAMETER` 등)를 반환하는 것이 표준이다. 현행 spec 만으로도 구현 추론이 가능하므로 차단 사유는 아님.

---

### [INFO] Rerank Config `set-default` 엔드포인트 — PATCH 동사 적절성
- **위치**: `spec/2-navigation/6-config.md` +632 `PATCH /api/rerank-configs/:id/set-default`
- **상세**: 기본 리랭커 설정은 리소스의 부분 변경이므로 PATCH 동사는 RESTful 관점에서 허용 범위 내다. 동일 패턴의 LLMConfig set-default 가 이미 존재한다면 일관성 측면에서도 문제 없다. 전용 POST action 보다 PATCH 가 더 적절한 경우도 있음 — 현 설계가 LLMConfig 와 동일 패턴이라면 일관성 유지로 평가한다.
- **제안**: LLMConfig 의 set-default 엔드포인트가 동일 PATCH 동사를 쓰는지 확인 권장 (spec 7-llm-client.md 또는 6-config.md Part B). 일치한다면 정상.

---

### [WARNING] `RESUME_INCOMPATIBLE_STATE` 에러 코드 의미 확장 — 기존 클라이언트 처리 확인
- **위치**: `spec/5-system/3-error-handling.md` +1035, `spec/5-system/6-websocket-protocol.md` +1226, `spec/5-system/4-execution-engine.md` §7.5
- **상세**: `RESUME_INCOMPATIBLE_STATE` 에 새 발생 케이스가 추가됐다 — `schemaVersion` 이 현재 코드 버전 초과(롤링 배포 중 구 인스턴스가 신 포맷 checkpoint pickup). 기존 코드는 "부재·손상" 케이스만 인지했으나 "미래 버전" 케이스가 추가되어 에러 코드의 **의미 범위가 확장**됐다. 에러 코드 자체는 동일하므로 클라이언트가 이 코드를 "graceful 세션 만료 안내"로 처리하고 있다면 새 케이스도 올바르게 처리된다. 그러나 클라이언트가 특정 케이스를 추가 분기(예: "구현 배포 이전 row" 와 "버전 불일치" 를 다르게 안내)하기를 원한다면 에러 코드만으로는 구별이 불가능하다.
- **위험도 근거**: 하위 호환적 확장(동일 코드, 추가 케이스)이라 breaking change 는 아님. 다만 클라이언트의 "버전 불일치" 구분 요구가 있을 경우 별도 서브코드 없이 처리가 불가하므로 WARNING.
- **제안**: 현재 설계대로 클라이언트가 `RESUME_INCOMPATIBLE_STATE` 를 단일 "세션 만료" 처리한다면 문제 없음. 향후 "롤링 배포 중 일시 오류" 와 "영구 상태 손상" 을 UX 레벨에서 구분해야 하는 요구가 생기면 에러 객체에 `reason` 서브필드(`'missing' | 'corrupted' | 'future_version'`) 추가를 검토한다. 현재는 spec 에서 그 구분 요구가 없으므로 현행 유지 가능.

---

## 요약

이번 변경의 주요 API 관련 추가는 세 가지다. (1) Rerank Config REST API(`/api/rerank-configs`) 신설 — LLMConfig 와 동일 패턴의 sibling 리소스로 페이지네이션 규약 준수가 명시됐다. (2) Agent Memory 관리 API(`GET /agent-memories/scopes`, `GET /agent-memories`, `DELETE` 두 종) 신설 — 인증/인가(viewer+/editor+)·workspace 격리·hard delete 정책이 명확하다. (3) `EXECUTION_TIME_LIMIT_EXCEEDED` 에러 코드가 외부 API 응답 스키마에 추가 — 기존 `EXECUTION_TIMEOUT` 과 의미 분리가 적절하다. `summaryModel`/`extractionModel` 신규 필드는 optional 이고 fallback 체인이 완비되어 기존 API 클라이언트에 영향이 없다. `RESUME_INCOMPATIBLE_STATE` 의 의미 범위가 확장됐으나 동일 코드·하위 호환적 추가이므로 breaking change 가 아니다. INFO 6건은 확인 권장·향후 보강 수준이며 API 계약 차단 사유가 없다.

---

## 위험도

LOW
