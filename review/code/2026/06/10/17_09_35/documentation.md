# Documentation Review

## 발견사항

### **[INFO]** spec/data-flow/10-triggers.md — execute() 흐름 설명 추가
- 위치: §Overview, §2.2 Redis 테이블
- 상세: `execute()` 가 `status=pending` INSERT → `execution-run` 큐 발행 → executionId 즉시 반환하는 흐름이 Overview 에 명확히 기술됨. 트리거 타입별 job priority 3-tier 계층도 §2.2 에 기재됨. 단, priority 값(manual=1, webhook=2, schedule=3)이 현재 코드에서는 `executedBy` 유무 이분 임시 구현임을 "의도된 임시" 로 표기 — 독자가 priority 3-tier 구현이 완료된 것으로 오해할 여지가 있다.
- 제안: "현재는 2-tier; 완전한 3-tier threading 은 follow-up" 을 더 전면에 표기하거나 `> 주의` 블록으로 격상.

### **[WARNING]** spec/data-flow/10-triggers.md — §1.4 구현 갭 `Trigger→Schedule` 역방향 동기화 부재 기술
- 위치: §1.4 동기화 테이블, 이하 `> 구현 갭` 블록
- 상세: spec 에 `PATCH /api/triggers/:id { isActive }` 가 `schedule.is_active` 와 BullMQ job 을 갱신하지 않아 "트리거 쪽 비활성화로는 schedule 발사가 멈추지 않는다"는 치명적 동작 불일치가 기술됨. `DELETE /api/triggers/:id` 의 BullMQ 잔존(Redis 누수 + 로그 노이즈)도 기술됨. 그러나 이 구현 갭에 대한 **plan(수정 task)** 링크가 없어 독자가 수정 여부·일정을 추적하기 어렵다.
- 제안: 구현 갭 callout 에 "수정 plan: `plan/in-progress/<이름>.md`" 형식의 참조를 추가. 없으면 plan 파일 생성 또는 `TODO` 태그를 명시.

### **[WARNING]** spec/data-flow/11-workflow.md — §1.5 복제·내보내기·가져오기 신규 섹션
- 위치: §1.5 (신규 추가)
- 상세: `POST /api/workflows/:id/duplicate` 가 "nodes/edges 를 복제하지 않는다"는 사실이 문서화됨. 이는 사용자·개발자 모두에게 중요한 동작이지만 이 문서 외에 어디서도 이 제약이 기술되는지(예: `spec/3-workflow-editor/` 하위)가 언급되지 않는다.
- 제안: 워크플로우 편집기 spec(`spec/3-workflow-editor/`) 에 duplicate 동작 정의가 있다면 cross-ref 추가. 없다면 이 data-flow 섹션이 SoT 임을 명시.

### **[INFO]** spec/data-flow/11-workflow.md — auto-save 없음 명시
- 위치: §1.4
- 상세: 이전 문서에서 "auto-save debounce" 로 서술하던 것을 "500ms debounce 는 저장이 아니라 graph-warning 사전 평가용" 으로 정정. 정확도가 향상되었으며 오해를 방지하는 중요한 정정.
- 제안: 없음 (적절히 처리됨).

### **[INFO]** spec/data-flow/11-workflow.md — 버전 스냅샷 contents 수정
- 위치: §Rationale "버전 스냅샷 = JSONB"
- 상세: `workflow.settings` 가 스냅샷에 포함되지 않는다는 사실을 이전의 "nodes + edges + settings" 서술에서 "name + description + nodes + edges" 로 정정. 의미 있는 수정.

### **[WARNING]** spec/data-flow/12-workspace.md — §1.8/§1.9/§1.10 신규 API 섹션 추가
- 위치: §1.8 초대 재발송/취소, §1.9 멤버 직접 추가, §1.10 삭제/나가기
- 상세: 세 섹션 모두 API 동작, 권한, 에러 코드를 기술함. 그러나 §1.9 `POST /api/workspaces/:id/members` 는 "직접 추가" 경로인데, 기존 §1.2 의 초대 흐름과의 차이(이메일 발송 없음, 즉시 가입)만 기술하고 **어느 spec 이 이 엔드포인트의 SoT 인지** 명시가 없다.
- 제안: §1.9 에 "이 경로의 API 계약 단일 진실: `spec/5-system/...`" 형식 링크 또는 이 data-flow 문서 자체가 SoT 임을 표기.

### **[INFO]** spec/data-flow/12-workspace.md — `pruneExpired` 호출자 없음 명시
- 위치: §3.1 상태 다이어그램 이하
- 상세: "만료 row 정리용 `WorkspaceInvitationsService.pruneExpired` 가 존재하나 현재 프로덕션 호출자가 없어 만료 row 는 영구 잔존"하는 사실이 기술됨. 이는 운영상 주의 사항이나 plan 참조가 없다.
- 제안: 정리 job 연결 미구현 이슈에 대한 plan 링크 또는 `TODO: periodic job 연결 필요` 태그 추가.

### **[INFO]** spec/data-flow/13-agent-memory.md — 신규 파일 전체
- 위치: 전체 파일 (269줄, 신규)
- 상세: Overview, System role, Source→Sink, Schema 매핑, 상태/라이프사이클, 외부 의존, Rationale 모두 체계적으로 기술됨. 코드 진입점(파일 경로)이 정확히 명시되어 있고, hot path 비차단 불변식·scope 단위 직렬화·TTL 정책 등 운영상 중요한 세부사항이 inline 주석과 callout 으로 설명됨. 문서 구조가 일관됨.
- 제안: 없음 (우수한 문서화).

### **[WARNING]** spec/data-flow/14-chat-channel.md — §1.1 구현 갭 `rateLimitPerMinute` 미적용 기술
- 위치: §1.1 이하 `> 구현 갭 — inbound rate limit` callout
- 상세: `config.chatChannel.rateLimitPerMinute` (CCH-NF-03) 가 DTO/타입에만 존재하고 inbound hot path 에 적용되지 않는다는 갭이 기술됨. 그러나 이 구현 갭에 대한 plan 참조가 없다.
- 제안: 구현 갭 callout 에 plan 참조 또는 `TODO` 태그 추가.

### **[INFO]** spec/data-flow/14-chat-channel.md — 신규 파일, Redis 단독 대화 상태 설명
- 위치: Overview "중요한 저장 모델 사실" 박스
- 상세: ChannelConversation 이 Postgres 테이블이 아니라 Redis 키-값임을 Overview 에서 선제적으로 강조. Redis 미가용 시 graceful degradation 동작도 명시. 독자가 아키텍처를 빠르게 파악하는 데 도움이 됨.
- 제안: 없음 (적절히 처리됨).

### **[WARNING]** spec/data-flow/15-external-interaction.md — §1.5 구현 갭 `secretRef` 우선순위 충돌
- 위치: §1.5 `> 구현 갭 주의` callout
- 상세: notification secret 승격 경로에서 `secretRef` 우선으로 인해 승격된 평문이 미사용되는 버그가 상세히 기술됨. 코드 주석과 실제 코드의 불일치, 보안 운영 영향까지 기술됨. §Rationale 에서 "developer plan 으로 추진" 을 언급하지만 실제 plan 파일 링크가 없다.
- 제안: "developer plan 으로 추진" 뒤에 `plan/in-progress/<name>.md` 링크 추가.

### **[INFO]** spec/data-flow/2-auth.md — 신규 §1.6 로그아웃, §1.7 비밀번호 재설정 섹션
- 위치: §1.6, §1.7 (신규 추가)
- 상세: 로그아웃의 family 전체 revoke, 비밀번호 재설정의 refresh_token 전체 revoke, resend-verification, check-email 흐름이 새로 추가됨. Rate limit 표도 신규 추가됨. 기존에 누락되었던 엔드포인트들이 문서화되어 API 완성도가 향상됨.

### **[INFO]** spec/data-flow/2-auth.md — `resolveWorkspaceForToken` → `resolveTokenWorkspaceContext` 함수명 수정
- 위치: §1.4 invite 수락 각주
- 상세: 함수명이 실제 코드와 일치하도록 수정됨. 주석 정확성 향상.

### **[INFO]** spec/data-flow/2-auth.md — Redis §2.2 in-memory throttle 실제 현황 기술
- 위치: §2.2 Redis
- 상세: "Redis 카운터를 사용할 후보" 서술이 실제 `@nestjs/throttler` in-memory 구현 현황으로 교체됨. 엔드포인트별 rate limit 표 신규 추가. credential stuffing vs 분산 IP 공격의 이중 방어 설명도 추가됨.

### **[WARNING]** spec/data-flow/3-execution.md — 코드 블록 잘림 (`codebase` 절단됨)
- 위치: §Overview 코드 진입점 목록 (diff 마지막 줄)
- 상세: 프롬프트 페이로드 잘림으로 background-execution.processor.ts 코드 진입점 줄이 `codeb` 에서 잘려 있다. 실제 파일에서 확인이 필요하나, diff truncation 특성상 파일 자체는 정상일 가능성이 높다.
- 제안: 파일 직접 확인 필요 (리뷰어 한계 — 페이로드 truncation).

### **[INFO]** spec/data-flow/4-file-storage.md — 업로드 검증 게이트 상세 추가
- 위치: §1.1
- 상세: S3 PUT 전 `decodeMulterFilename`, 확장자 화이트리스트, `CONTENT_TYPE_MAP` 검증 단계가 신규 기술됨. 코드 위치도 line number 에서 함수명 기준으로 교체되어 리팩토링 내성이 향상됨.

### **[INFO]** spec/data-flow/7-llm-usage.md — embed usage 미적재 및 attribution 갭 명시
- 위치: §1.2, §1.3, §Rationale
- 상세: `embed` 가 usage_log 에 적재되지 않는 이유(provider API 미반환)가 명시됨. AI 노드 3종이 `LlmCallContext` 를 전달하지 않아 workflow/execution/node 컨텍스트가 NULL 인 "attribution 갭"이 callout 으로 가시화됨. 이전 문서의 "AI 노드는 세 ID 를 모두 채운다" 서술이 실제와 달라 정정됨.
- 제안: attribution 갭 해소가 plan 으로 관리될 때 plan 링크 추가 권장.

### **[WARNING]** spec/data-flow/7-llm-usage.md — `is_default` partial UNIQUE 인덱스 DB 미생성
- 위치: §2.1 Postgres, §Rationale "`is_default` partial UNIQUE — 의도 vs 현행"
- 상세: `llm_config_workspace_default_unique` 인덱스가 entity 선언만 있고 실제 DB 마이그레이션이 없어 DB 단 강제가 없다는 사실이 처음 기술됨. 이는 데이터 정합성 위험이지만 plan 참조가 없다.
- 제안: "llm_config 도 동일한 보완 마이그레이션 추가 여부가 결정 대상" 이라고만 기재했는데, 결정·실행을 추적할 plan 링크 또는 `TODO` 태그가 필요함.

### **[INFO]** spec/data-flow/8-notifications.md — `integration_expired` 임계 3단계 및 claim 메커니즘 상세화
- 위치: §1.1 type 별 source 테이블
- 상세: 이전의 단순한 행을 "7일/3일/당일 3단계 임계" + `classifyThreshold` + `integration_expiry_dispatch` claim 방지 메커니즘으로 대폭 확장. 독자가 실제 동작을 정확히 이해할 수 있게 됨.

### **[INFO]** spec/data-flow/8-notifications.md — `notification_preferences.integrationExpiryEmail` default 정정
- 위치: §Rationale
- 상세: 이전 "누락된 키는 default true 로 해석" 서술이 실제 코드의 "strict `=== true` 비교, 누락 시 false (이메일 OFF)" 로 정정됨. 사용자가 이메일 알림을 받지 못하는 버그를 추적할 때 중요한 정보.

### **[INFO]** spec/data-flow/9-observability.md — SystemStatusService `getFailed()` 신규 기술
- 위치: §1.4, §2.2
- 상세: `SystemStatusService` 가 `getFailed()` 로 최근 실패 수를 계산하는 로직과 env 튜닝 변수(`SYSTEM_STATUS_FAILED_WINDOW_MINUTES` 등)가 신규 기술됨.

### **[WARNING]** spec/data-flow/9-observability.md — Alerts evaluator `window` ISO 8601 파싱 fallback 기술
- 위치: §1.3, §Rationale
- 상세: `parseIso8601Duration` 파싱 실패 시 PT1H 로 묵묵히 fallback 하는 동작이 기술됨. DTO 가 `@IsString` 만 검증하므로 임의 문자열이 저장될 수 있어 silent fallback 이 예기치 않은 동작을 유발할 수 있음. "DTO 단 검증 plan 은 별도"로만 언급됨.
- 제안: fallback 동작이 운영자에게 가시적이지 않을 수 있으므로 경고 로그 발생 여부를 문서에 추가 명시. DTO 검증 plan 링크 추가.

---

## 요약

전체 변경은 14개 spec/data-flow 문서에 대한 광범위한 정확도 향상 작업으로, 구현과 spec 사이의 실질적 갭(Schedule←Trigger 역방향 동기화 부재, LLM attribution 갭, is_default partial UNIQUE 미생성, notification_preferences default 오류 등)을 spec 본문에 가시화했다는 점에서 문서화 품질이 상당히 향상되었다. 신규 파일(13-agent-memory.md, 14-chat-channel.md, 15-external-interaction.md) 은 Overview·System role·Rationale 구조를 체계적으로 갖추고 있으며 코드 진입점도 함수명 기준으로 충실히 기술되었다. 다만 여러 구현 갭 callout 과 미구현 섹션이 plan 파일로의 연결 없이 "별도 plan" 으로만 언급되어 있어, 수정 일정과 책임 추적이 어렵다. 이 점이 전반적으로 개선이 필요한 단일 패턴이다.

## 위험도

LOW
