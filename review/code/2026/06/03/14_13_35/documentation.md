# Documentation Review

## 발견사항

### [INFO] spec/conventions/interaction-type-registry.md — AST 가드 설명 정확도 개선
- 위치: 파일 1, 규칙 3 및 `system_error` 매트릭스 행
- 상세: 기존 "모든 enum 값이 각 처리 위치에 명시적으로 등장" 이라는 일반적 설명이 "등록된 grep 대상 파일에 string literal로 등장"으로 구체화되었고, `REGISTRY_SITES` 4개 파일 목록과 grep 미대상 파일(f 항목)을 명시했다. `system_error` 행도 `SOURCE_REGISTRY_SITES` 와의 관계를 세부 기술했다. 정확도가 높아졌으나, 이 설명이 매우 길어져 단일 셀 안에서 가독성이 떨어진다.
- 제안: `system_error` 행의 파이프-구분 셀 내용이 3~4줄 분량이 되었다. 별도 subsection (§2.2 등)으로 분리해 테이블은 요약만 유지하면 가독성이 개선된다. 현재 형태도 정보는 충분하나 유지보수 시 혼동 여지 있음.

### [INFO] spec/conventions/migrations.md — violation 메시지 prefix 및 정규식 허용 범위 명시
- 위치: 파일 2, §5 표 + 설명자 규칙
- 상세: `[migration-guard]` prefix 추가와 `SQL_NAME_RE`/`SQL_RE` 각 정규식의 실제 허용 문자셋 차이가 명시되었다. 새로 code: 항목으로 `scripts/check-migration-versions.py`, `.github/workflows/migration-check.yml` 등 4개 파일이 추가되었다. README §4→§5 섹션 번호 수정도 포함된다.
- 제안: 일관성 관점에서 정규식 허용 집합 차이는 명시되었으나, "일관성은 본 컨벤션으로 보장" 이라는 결론이 명확하다. 추가 문서화 필요 없음. 단, `migrations/README.md §5` 의 실제 내용이 수정된 섹션 번호와 일치하는지 이 리뷰에서는 확인 불가 — 교차 검증 권장.

### [WARNING] spec/conventions/node-cancellation.md — 섹션 제목 변경이 기존 cross-ref 무효화 가능
- 위치: 파일 3, `## 6. 본 PR 범위 / 후속` → `## 6. 구현 현황 / 후속`
- 상세: 섹션 제목 변경으로 앵커 URL이 바뀐다(`#6-본-pr-범위--후속` → `#6-구현-현황--후속`). 다른 spec 문서에서 이 섹션을 링크하고 있다면 dead link 가 발생한다. 현재 diff 범위에서 다른 파일의 `node-cancellation.md#6` 링크를 확인하기 어렵다.
- 제안: 리포 내 모든 `.md` 파일에서 `node-cancellation.md#6-본-pr` 또는 유사 앵커 참조를 grep 해 dead link 여부를 확인하고, 발견 시 함께 업데이트한다.

### [INFO] spec/conventions/node-cancellation.md — 구현 현황 표의 정확도와 코드 위치 근거
- 위치: 파일 3, §6 구현 현황 표
- 상세: `✓ / 🚧 / —` 상태가 실제 파일명(예: `parallel-executor.ts`, `ai-agent.handler.ts`)으로 근거가 제시되어 있어 추적성이 크게 향상되었다. 기존 "후속 PR" 표현이 구체적 상태 설명으로 대체되었다. 문서화 품질이 높다.
- 제안: `🚧` 항목의 "사전 abort 체크만" 패턴에 대해 향후 구현 시 spec 갱신을 잊지 않도록 `pending_plans` frontmatter를 통한 추적을 유지하면 충분하다. 현재 `plan/in-progress/node-cancellation-infrastructure.md` 가 이미 등재되어 있다.

### [INFO] spec/conventions/node-output.md — baseline 패턴 설명 분리
- 위치: 파일 4, §credential leak 정책
- 상세: 기존 "baseline 패턴: `background.handler.ts:64-68` + `background.handler.spec.ts:84-103` 의 `apiKey` 가드 테스트" 라는 단일 문장이 구현 의도(명시 키 enumeration)와 강제 수단(테스트)을 분리해 서술했다. 이해도가 개선되었다.
- 제안: 충분함. 추가 문서화 불필요.

### [INFO] spec/conventions/secret-store.md — DB CHECK 제약 SQL 예시 추가
- 위치: 파일 5, DDL 블록 및 §6 `TriggersService` 메서드명 수정
- 상세: `chk_secret_store_ref_format` 제약 SQL이 spec 문서에 inline 추가되었다. `TriggersService.delete()` → `TriggersService.remove()` + `deleteByPrefix` 방식으로 실제 구현을 반영했다.
- 제안: DDL 예시를 spec에 인라인으로 두는 패턴은 구현이 바뀔 때 sync 비용이 있다. 이 패턴이 이 문서에서 처음 사용된다면 일관성 측면에서 "구현 경로를 `code:` 항목으로만 기재하고 DDL은 마이그레이션 파일 참조" 방식도 고려할 수 있다. 현재 기재는 가독성에 유리하므로 CRITICAL 사항은 아님.

### [INFO] spec/conventions/spec-impl-evidence.md — `pending_plans` 경로 완화 및 `backlog` 가드 세부화
- 위치: 파일 6, §2.1 표 + §3 표 + R-3
- 상세: `pending_plans` 가 `plan/in-progress/` 에만 실존해야 한다는 규칙이 `plan/complete/`(in-progress→complete 치환)도 허용하도록 완화되었다. `backlog` 가드가 "§6.3 항목" 한정에서 "0-overview.md 본문 전체 텍스트"로 넓혀졌고, 이 변화의 근거가 R-3에 명시적으로 기술되었다. 내부적으로 일관성이 있다.
- 제안: `spec-pending-plan-existence.test.ts`와 `spec-status-lifecycle.test.ts` 가드 설명이 표 안에서 갱신되었지만, 해당 테스트 파일 자체가 이 spec 변화에 맞게 이미 수정되었는지 확인이 필요하다(이 리뷰 범위 밖).

### [INFO] spec/conventions/swagger.md — `interaction-token` Bearer scheme 및 `ApiOkWrappedOneOfResponse` 추가
- 위치: 파일 7, §2-1 + 헬퍼 표
- 상세: `interaction-token` scheme 추가와 `ApiOkWrappedOneOfResponse` 헬퍼가 표에 등재되었다. 새 Bearer scheme에 대한 사용처(External Interaction API, 토큰 형식)와 `wrapOneOfDataSchema` 내부 구현 참조가 함께 기재되어 충분히 문서화되어 있다.
- 제안: `ApiOkWrappedOneOfResponse` 행에 `discriminator` 파라미터에 대한 설명이 간략하다("예: OAuth begin 분기 응답"). 다른 헬퍼들과 같은 수준의 예시 코드(또는 단순 사용 예)를 추가하면 개발자 가이드 역할을 더 잘 할 수 있다.

### [INFO] spec/conventions/user-guide-evidence.md — 구현 현황 정정 및 `pending_plans` 추가
- 위치: 파일 8, frontmatter status + §1.3 + §2 가드 표 + R-1
- 상세: status가 `implemented` → `partial`로 낮아지고 `pending_plans` 가 추가된 것은 실제 구현 갭을 솔직하게 반영한 개선이다. `impl-anchor.tsx`의 `return null` 구현(DOM 미출력)이 이전의 "hidden(`display: none`)" 기술을 교정한 것은 **주석 정확성** 관점에서 중요한 수정이다. `chatChannelCheckbox` → `chatChannelProvider` symbol 수정도 실제 코드와의 정합성을 높인다.
- 제안: `findGuiFlowSections()` 의 "두 신호 OR" 로직이 처음 명시되었다. 향후 이 함수가 변경될 때 spec 갱신을 보장하는 방법이 없다. 테스트 파일의 함수 자체에 JSDoc 주석으로 spec 문서 참조(`// see spec/conventions/user-guide-evidence.md §2`)를 추가하는 것을 고려할 수 있다.

### [INFO] spec/data-flow/0-overview.md — PostgreSQL 버전 불일치 명시 및 큐 등록 방식 갱신
- 위치: 파일 9, Primary DB 항목 + 큐 카탈로그 표
- 상세: `docker-compose.yml`(pg18) vs `k8s/overlays/local/infra-postgres.yaml`(pg16) 불일치가 처음 문서화되었다. 이 불일치 자체가 기술 부채를 나타내며 spec에 등재된 것은 좋다. 큐 3개(schedule-execution, alerts-evaluator, integration-expiry-scanner)의 producer 방식이 "cron sweep" → "BullMQ repeatable scheduler, upsertJobScheduler"로 갱신되었다.
- 제안: pg18 vs pg16 불일치는 spec 문서의 주석으로 처리되었지만, 이것이 실질적인 호환성 이슈(pgvector extension 버전 차이 등)를 유발하는지 별도 plan 항목 생성이 필요한지 검토가 권장된다.

### [INFO] spec/data-flow/1-audit.md — 메서드명 수정 및 `login_history.event` DB CHECK 추가 문서화
- 위치: 파일 10, 코드 진입점 + event 종류 + Rationale
- 상세: `findByWorkspace` → `findAll`, `findMyHistory` → `findForUser` 메서드명 수정과 `webauthn_failed` 이벤트 추가가 반영되었다. DB CHECK 제약(`chk_login_history_event`)과 자유문자열 `audit_log.action`의 대비가 Rationale 섹션에 명확히 설명되어 있다.
- 제안: 충분함. 코드 진입점 메서드명과 DB CHECK가 모두 갱신되었다.

### [INFO] spec/data-flow/10-triggers.md — Schedule 아키텍처 전환 (cron sweep → BullMQ repeatable) 완전 갱신
- 위치: 파일 11, §1.3 Schedule 발사 + §1.4 동기화 + §1.5 신규 + §2 스키마 + §3.2
- 상세: 이번 변경에서 가장 광범위한 문서 갱신이다. `ScheduleRunnerService` 의 DB polling/sweep 방식이 BullMQ job scheduler로 전환된 것이 시퀀스 다이어그램, 스키마 표, 큐 카탈로그, 상태 설명 전반에 걸쳐 일관되게 반영되었다. `next_run_at` 이 발사 트리거가 아닌 "UI 표시용 정보성 컬럼"임을 명시한 것이 중요하다. §1.5 Webhook → Chat Channel inbound 분기가 신규 섹션으로 추가되었다.
- 제안: §1.5가 처음 등재되는 섹션인 만큼, data-flow 개요(`0-overview.md`)의 해당 도메인 요약에도 chat channel 분기 언급이 있는지 확인이 권장된다.

### [WARNING] spec/data-flow/11-workflow.md — 삭제된 `role='tool'` persist 로직과 시퀀스 다이어그램 내 주석
- 위치: 파일 12, §1.1 캔버스 저장 + §1.3 Assistant 스트리밍 + §2.1 스키마 표
- 상세: `POST /api/workflows/:id/run` → `POST /api/workflows/:id/execute` API 경로 변경과 `NodesService`/`EdgesService` 개별 CRUD가 아닌 bulk save 흐름이 반영되었다. `role='tool'` row 가 DB에 기록되지 않는다는 사실이 §2.1 표와 §3.3에서 명시되었다. Assistant SSE 직접 송출(WebSocket 미경유) 변경이 반영되었다.
- 제안: 기존 `POST /api/workflows/:id/run` 에서 `POST /api/workflows/:id/execute` 로의 경로 변경은 API 사용자에게 breaking change이다. 이 변경이 클라이언트 코드 전반에 적용되었는지 확인이 필요하다. spec 문서에 "구 경로 deprecated/제거" 명시 또는 changelog 항목 추가를 권장한다.

### [INFO] spec/data-flow/12-workspace.md — `X-Workspace-Id` 헤더 우선 정책 반전 문서화
- 위치: 파일 13, Overview + Rationale
- 상세: 기존 "X-Workspace-Id 를 받지 않는다" 설명이 "X-Workspace-Id 헤더 > JWT workspaceId 우선" 으로 완전히 반전되었다. 기존 Rationale 제목도 바뀌었다. 변경 이유(워크스페이스 전환이 미구현이므로 헤더가 현재 유일한 전환 수단)가 명확히 기술되어 있다.
- 제안: 이 변경은 보안 계약의 변화로, 이전 spec에서 "헤더로 받으면 공격 경로가 생긴다"고 적시했던 내용이 삭제되었다. 현재 spec은 "RBAC가 각 핸들러에서 검증된다는 전제"를 명시하고 있으나, 이 전제가 실제로 모든 엔드포인트에서 보장되는지에 대한 검증 근거(테스트 또는 코드 참조)를 추가하면 향후 감사(audit) 시 도움이 된다.

### [INFO] spec/data-flow/2-auth.md — 2단계 회원가입 흐름 및 OAuth 콜백 변경 반영
- 위치: 파일 14, §1.1 + §1.3 + §1.5 + §3.2
- 상세: 회원가입이 단일 트랜잭션이 아닌 register→verify-email 2단계로 정정되었다. OAuth 콜백에서 access token을 URL에 싣지 않고 refresh token 쿠키 + `/callback` redirect 방식을 채택한 결정(2026-05-31)이 명시되었다. 세션 revoke API가 DELETE → POST로 변경된 이유(CDN 프록시 DELETE 바디 제거)가 Rationale에 해당하는 주석으로 설명되었다.
- 제안: 이러한 결정들이 별도 Rationale 섹션보다 현재처럼 blockquote 주석으로 처리된 것은 문서 분량 관리상 이해되지만, 중요도가 높은 보안 결정(OAuth token 노출 방지)은 Rationale 섹션에 공식 항목으로 승격하는 것을 고려할 수 있다.

### [INFO] spec/data-flow/3-execution.md — 재개 진입 표면 및 상태 전이 갱신
- 위치: 파일 15, §1.3 + §3.1 상태 다이어그램
- 상세: 재개 진입이 REST와 WebSocket 두 표면임이 명확히 구분되었다. `waiting_for_input → failed` 전이(AI Agent 멀티턴 오류)와 `failed → running` 비표준 전이(`allowRetryReentry`)가 상태 다이어그램에 추가되었다. 이 전이들이 일반 테이블 밖의 opt-in 경로임을 명시한 것이 중요하다.
- 제안: `execution.entity.ts:97` 처럼 라인 번호를 참조하는 패턴은 코드가 변경될 때마다 stale해진다. 이 리뷰 범위의 여러 파일에서 동일 패턴이 사용된다. 라인 번호 대신 심볼명(함수명·클래스명)으로 참조하는 것이 더 내구성 있는 문서화 방식이다.

### [WARNING] spec/data-flow/3-execution.md 외 다수 — 라인 번호 기반 코드 참조의 stale 위험
- 위치: 파일 15(`execution.entity.ts:97`), 파일 16(`knowledge-base.service.ts:644-658`, `755-759`), 파일 17(`integration.entity.ts:112~117`), 파일 20(`health.service.ts:53-88`, `alerts-evaluator.service.ts:197-225`, `:192-195` 등)
- 상세: 이번 변경에서 다수의 spec 문서가 구체적인 라인 번호 참조를 추가했다. 라인 번호는 코드 변경마다 쉽게 stale해지며, stale된 라인 참조는 독자를 혼란시키거나 잘못된 코드를 참조하게 만든다.
- 제안: 라인 번호 참조는 함수/메서드명 참조로 대체한다(예: `knowledge-base.service.ts` `remove()` 메서드 내). 라인 번호 참조가 필요한 경우 코드 리뷰 시 해당 라인이 변경될 때마다 spec도 함께 업데이트하는 체크리스트 항목을 PR 템플릿에 추가한다.

### [INFO] spec/data-flow/4-file-storage.md — KB 삭제 S3 cleanup 구현 확인 및 presigned URL 미구현 명시
- 위치: 파일 16, §3 라이프사이클 + Rationale
- 상세: "현재는 S3 에 orphan 가능" → "소속 document 전체 조회 후 각 key DELETE (best-effort)" 로 수정된 것은 실제 구현을 반영한 중요한 정정이다. presigned URL 미구현(Planned) 명시가 추가되어 클라이언트 다운로드 경로에 대한 기대치를 조정한다.
- 제안: 충분함.

### [INFO] spec/data-flow/5-integration.md — OAuth begin 엔드포인트 및 큐명 수정
- 위치: 파일 17, §1.2 시퀀스 + §1.4 섹션명 + 큐 카탈로그
- 상세: `GET /oauth/:service/start` → `POST /oauth/begin { service, mode }` 변경과 `integration-expiry` → `integration-expiry-scanner` 큐명 수정이 전반에 걸쳐 일관되게 반영되었다. Cafe24 Private 분기 설명도 갱신된 엔드포인트와 정합성을 맞췄다.
- 제안: 충분함.

### [INFO] spec/data-flow/7-llm-usage.md — `LlmService` API 분리 및 `thinking_tokens` 비용 계산 정정
- 위치: 파일 18, §1.2 시퀀스 + §3.1
- 상세: `resolveConfig`와 `chat` 가 분리 호출됨을 시퀀스 다이어그램이 정확히 반영했다. `thinking_tokens` 가 `cost_usd` 계산에 포함되지 않는다는 사실이 기존 "output 단가에 합산" 설명을 **교정**했다 — 주석 정확성 관점에서 중요한 수정이다.
- 제안: 충분함.

### [INFO] spec/data-flow/8-notifications.md — 구현 현황 명시 및 미구현(Planned) 표시 대규모 추가
- 위치: 파일 19, Overview + §1 + §1.1 type 표
- 상세: 기존 "to-be 설계를 구현된 것처럼" 기술하던 문제가 "구현 현황 주의" 블록과 단계별 표로 대거 수정되었다. 특히 단일 `notify()` 표면 미구현, WS emit 미구현, 이메일 발송 미구현이 명시되었다. `integration_action_required` 신규 type과 `alert_<rule.type>` 동적 type(V052 CHECK 외부)이 처음 등재되었다.
- 제안: `alert_<rule.type>` 이 V052 CHECK 제약 목록 밖이라는 점은 잠재적 DB 정합성 문제이므로, "별도 추적" 언급 외에 구체적인 plan 파일 참조가 있으면 추적성이 높아진다.

### [INFO] spec/data-flow/9-observability.md — Health check 응답 구조 및 Alerts evaluator 아키텍처 갱신
- 위치: 파일 20, §1.1 + §1.3 + §3 + Rationale
- 상세: Health check 응답이 `{ status, version, uptime, checks: { database, redis } }` 로 구체화되고 S3 ping 미구현이 명시되었다. Alerts evaluator 가 per-rule 큐잉에서 단일 repeatable job으로 바뀐 아키텍처가 시퀀스 다이어그램, 큐 카탈로그, Rationale에서 일관되게 반영되었다. `audit_log` 기록이 없다는 사실도 명시되었다.
- 제안: `alert_rule.is_enabled` → `alert_rule.enabled` 컬럼명 변경이 데이터 모델(`spec/1-data-model.md`)에도 반영되었는지 교차 확인이 필요하다.

---

## 요약

이번 변경은 20개의 spec 문서 전반에 걸쳐 spec-impl 갭을 줄이는 "실제 코드 대조 갱신" 성격이 강하다. 문서화 품질 면에서 전반적으로 우수하다 — 특히 구현 미완료 항목을 "미구현 (Planned)"으로 명시한 것, 메서드명/API 경로/큐명 수정이 여러 파일에 걸쳐 일관되게 반영된 것, `thinking_tokens` 비용 계산 오류나 `display: none` vs `return null` 같은 기술적으로 부정확한 주석이 교정된 것이 긍정적이다. 주요 개선 여지는 두 가지다: (1) 다수 파일에 라인 번호 기반 코드 참조가 새로 추가되었는데, 이는 코드 변경마다 stale해지는 취약한 참조 방식이며 함수/메서드명 참조로 대체가 권장된다; (2) `spec/data-flow/11-workflow.md`의 API 경로 변경(`/run` → `/execute`)과 `spec/data-flow/12-workspace.md`의 `X-Workspace-Id` 헤더 우선 정책 반전은 각각 클라이언트 계약과 보안 모델에 영향을 주는 변경으로, 관련 코드·테스트와의 동기화 여부를 추가 확인하면 좋다.

## 위험도

LOW
