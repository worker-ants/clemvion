# Cross-Spec 일관성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)

실제 변경 대상 spec:
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/2-navigation/10-auth-flow.md` — proxy §7.1 에 `/_widget` 경로 면제 추가
- `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/spec/7-channel-web-chat/0-architecture.md` — §4.1 에 "동봉 서빙의 frontend 라우팅 전제" bullet 추가

---

## 발견사항

### 발견사항 없음

모든 6개 검토 관점에서 충돌이 확인되지 않았다. 아래는 각 관점별 검토 근거다.

---

#### 1. 데이터 모델 충돌

`spec/2-navigation/` 의 모든 화면 spec 이 참조하는 엔티티 정의가 `spec/1-data-model.md` 와 일치함을 확인했다.

- **Execution.status enum (6종)**: `0-dashboard.md §5` 가 "DTO 의 status enum 은 pending·running·completed·failed·cancelled·waiting_for_input — 6종, SoT [데이터 모델 §2.13]" 으로 명기. 데이터 모델 §2.13 line 462 가 동일 6종을 정의. 일치.
- **executionPath 빈 배열**: `14-execution-history.md §5` JSON 샘플의 `"executionPath": []` 는 목록 API 에서 의도적 빈 배열이며, 데이터 모델 §2.13 주석("목록 응답에서는 항상 빈 배열")이 이를 명시. 충돌 없음.
- **re_run_of / chain_id / dry_run**: `14-execution-history.md §3.7` 의 Re-run chain badge 모델이 데이터 모델 §2.13 의 `re_run_of`(UUID?, ON DELETE SET NULL) / `chain_id`(NULLABLE) / `dry_run`(Boolean NOT NULL) 정의와 일치.
- **Trigger.type**: `2-trigger-list.md` 의 webhook/schedule/manual 3종이 데이터 모델 §2.8 Trigger.type enum 과 일치. chat-channel 은 webhook 의 `config.chatChannel` 변형이며 별도 type 이 아님 — 양쪽 모두 동일하게 기술.
- **AgentMemory API 경로**: `16-agent-memory.md` 와 `spec/5-system/17-agent-memory.md` 모두 `/agent-memories/scopes`, `/agent-memories`, `/agent-memories/:id` 경로를 사용. 일치.

#### 2. API 계약 충돌

- **auth-flow §8 API 목록**: `spec/5-system/1-auth.md §5` 의 `POST /api/auth/check-email`, `GET /api/auth/oauth/providers`, `POST /api/auth/verify-email` 등 endpoint 가 `10-auth-flow.md §8` 기술과 일치.
- **execution-history 목록 API sort 기본값**: `14-execution-history.md §5` 의 기본 정렬 `started_at` 이 `spec/5-system/2-api-convention.md §4.1` 의 기본값(`created_at`)과 다르지만, 해당 spec 은 "도메인 오버라이드" 로 명시적으로 설명. 모순이 아닌 의도된 예외.
- **페이지네이션 형식**: `14-execution-history.md §5` 응답 샘플의 `{ data: [...], pagination: { page, limit, totalItems, totalPages } }` 가 `spec/5-system/2-api-convention.md §5.2` 목록 응답 형식과 일치.
- **proxy.ts 공개 경로 면제 목록**: `10-auth-flow.md §7.1` 의 신규 `/_widget` 추가가 `spec/7-channel-web-chat/0-architecture.md §4.1` 의 "(1) 인증 미들웨어(`proxy.ts`) 예외: `/_widget/**` 는 공개 정적 번들이므로 인증 redirect 대상에서 prefix 로 제외" 와 정합. 두 spec 이 동일 변경 집합에 포함되어 있으며 교차 참조도 올바르게 연결됨.
- **EH-LIST-02 triggerSource 5종**: `14-execution-history.md §2.4` 의 subworkflow/manual/schedule/webhook/unknown 5종이 데이터 모델의 Trigger.type(webhook/schedule/manual) + parent_execution_id 판정 조합으로 정확히 도출 가능. Rationale R-2 도 엔진 내부 마커(3종)와의 명시적 구분을 기술하여 혼동 여지를 차단.

#### 3. 요구사항 ID 충돌

- `14-execution-history.md` 의 EH-LIST-01~08, EH-DETAIL-01~11, EH-NAV-01~04 ID가 다른 영역 spec 과 중복 또는 재정의된 흔적 없음.
- `16-agent-memory.md` 의 NAV-AM-01~06 이 `_product-overview.md §3.13` 에 위임되어 있고 다른 영역 ID와 충돌하지 않음.

#### 4. 상태 전이 충돌

- Execution.status(6종)의 상태 머신이 `spec/2-navigation/0-dashboard.md`, `14-execution-history.md`, `spec/1-data-model.md`, `spec/5-system/4-execution-engine.md` 참조 간 일관됨.
- `14-execution-history.md §2.3` 의 필터 옵션(pending 제외 설명 포함)이 데이터 모델 상태 정의와 모순 없음.

#### 5. 권한·RBAC 모델 충돌

- `16-agent-memory.md` 의 "조회는 viewer+, 삭제는 editor+" 정책이 `spec/5-system/17-agent-memory.md §6` 의 동일 정책과 일치.
- `10-auth-flow.md` 의 워크스페이스 자동 생성 로직(초대 토큰 가입 시 개인 워크스페이스 미생성)이 `spec/5-system/1-auth.md §1.5.2` 의 "단일 트랜잭션 (User 생성 + WorkspaceMember 추가)" 정책과 일치.

#### 6. 계층 책임 충돌

- `spec/7-channel-web-chat/0-architecture.md §4.1` 의 신규 bullet 이 "인증 미들웨어 예외" 와 "next.config rewrites" 두 조건을 frontend 계층 책임으로 명시. `10-auth-flow.md §7.1` 도 이를 "서버 proxy" 계층에 한정해 기술. 책임 범위가 명확히 구분됨.
- `5-admin-console.md` 는 `0-architecture §4.1` 을 교차 참조(`[0-architecture §4.1](./0-architecture.md)`)하고 있으므로, `0-architecture.md §4.1` 에 신규 추가된 라우팅 전제 설명이 admin-console 관점에서도 자동으로 커버됨.

---

## 요약

`spec/2-navigation/` 영역의 이번 변경(10-auth-flow.md 의 `/_widget` proxy 면제 추가)은 `spec/7-channel-web-chat/0-architecture.md §4.1` 과 쌍으로 일관되게 갱신되어 있다. 두 파일은 동일 변경 집합에 포함되어 있고 교차 참조가 정확히 연결된다. `spec/5-system/1-auth.md` 는 proxy 면제 목록을 별도 기술하지 않으므로 해당 범위의 동기화 이슈도 없다. `spec/2-navigation/` 전체 spec 의 데이터 모델 참조, API 계약, 요구사항 ID, 상태 전이, RBAC, 계층 책임 각 관점에서 기존 `spec/**` 의 다른 영역과 직접 모순하는 사항이 발견되지 않았다.

---

## 위험도

NONE
