# 신규 식별자 충돌 검토 — spec/7-channel-web-chat/ + 연관 변경

## 발견사항

### **[WARNING]** `§R6` 국소 레이블이 같은 영역 내 세 파일에서 독립 사용
- **target 신규 식별자**: `### R6. 토큰 저장 — sessionStorage (vs localStorage)` — `spec/7-channel-web-chat/3-auth-session.md` 에 신규 추가
- **기존 사용처**:
  - `spec/7-channel-web-chat/1-widget-app.md:122` — `### R6. 워크플로우 시작 — 패널 open 시(eager)` (기존)
  - `spec/7-channel-web-chat/5-admin-console.md:276` — `### R6. 위젯 동봉(co-deploy) + same-origin 미리보기` (기존)
- **상세**: `R6` 는 각 spec 파일 내부에서만 앵커 역할을 하므로 파일 간 충돌은 아니다. 그러나 `4-security.md` 에서 `[3-auth-session §R6]` 로 링크할 때, `1-widget-app.md` 에도 `§R6`(eager-start)가 있어 독자가 "어느 파일의 R6인가"를 문맥으로 구분해야 한다. 현 링크 형식 `[3-auth-session §R6](./3-auth-session.md)` 은 파일명을 명시해 혼동 가능성을 제한하지만, 세 파일이 모두 `§R6` 를 쓰는 상황이 지속적으로 누적되면 Rationale 참조 혼동 위험이 높아진다.
- **제안**: 각 파일 내 로컬 레이블이라 기술적 충돌은 아니므로 강제 변경은 불필요. 단, 향후 `3-auth-session.md` 에 Rationale 가 추가될 때 `R7+` 를 부여해 번호 팽창을 억제한다.

---

### **[WARNING]** `memoryState.lastExtractionTurnSeq` vs `lastExtractionTurnSeq` (평면 키) 이중 동시 존재
- **target 신규 식별자**: `_resumeState.memoryState.lastExtractionTurnSeq` — `spec/5-system/17-agent-memory.md` 에서 기존 `_resumeState.lastExtractionTurnSeq` 평면 키를 `memoryState` sub-namespace 로 이동(I12 결정)
- **기존 사용처**:
  - `spec/5-system/_product-overview.md` AGM-08 행: `멀티턴 \`lastExtractionTurnSeq\` watermark` — 아직 구 표기 유지
  - `spec/4-nodes/3-ai/1-ai-agent.md` §2.7: `_resumeState.lastExtractionTurnSeq watermark 초과 turn 만 snapshot` — 아직 구 표기
  - `spec/data-flow/13-agent-memory.md`: `watermark(lastExtractionTurnSeq)` — 아직 구 표기
  - 코드: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2729` — 구 평면 키 `lastExtractionTurnSeq` 를 `memoryState` 로 래핑하는 중간 단계
- **상세**: `spec/5-system/17-agent-memory.md` 와 `spec/4-nodes/3-ai/3-information-extractor.md` 는 신 키명(`memoryState.lastExtractionTurnSeq`)으로 업데이트됐지만, `spec/5-system/_product-overview.md` AGM-08 행, `spec/4-nodes/3-ai/1-ai-agent.md` §2.7, `spec/data-flow/13-agent-memory.md` 는 아직 구 평면 키 이름(`lastExtractionTurnSeq`)을 그대로 쓴다. 동일 워터마크 식별자가 spec 내에서 두 가지 형태로 혼용돼 독자가 동일 개념인지 혼란을 겪을 수 있다. 코드의 폴백(구 평면 키 읽기 지원)은 올바르게 구현됐으나 spec 텍스트 정합이 아직 반 완료 상태다.
- **제안**: `spec/5-system/_product-overview.md` AGM-08 행, `spec/4-nodes/3-ai/1-ai-agent.md` §2.7 의 `lastExtractionTurnSeq` 참조를 `memoryState.lastExtractionTurnSeq`(구 평면 키 폴백 언급 포함)로 정렬 업데이트한다. `spec/data-flow/13-agent-memory.md` 시퀀스 다이어그램의 watermark 라벨도 동기화한다.

---

### **[INFO]** `workspace_type_mismatch`/`already_a_member` — lowercase 초대 모듈 버전과 UPPER_SNAKE 직접추가 버전 동시 등재
- **target 신규 식별자**: `workspace_type_mismatch`, `already_a_member`, `invitation_already_pending`, `invitation_already_accepted`, `workspace_not_found`, `user_not_found`, `admin_required` — `spec/conventions/error-codes.md §3` 에 새로 등재
- **기존 사용처**: `WORKSPACE_TYPE_MISMATCH`, `ALREADY_A_MEMBER`, `USER_NOT_FOUND`(`UPPER_SNAKE_CASE`) 는 `workspaces.service.ts` 가 발행, `spec/data-flow/12-workspace.md §1.9` 에 기존 기재
- **상세**: 동일 에러 의미가 lowercase(초대 모듈)와 UPPER_SNAKE(직접 추가 모듈)로 두 wire 코드로 존재한다는 점이 신규 등재로 인해 처음으로 spec 에 명시됐다. 등재 자체는 충돌이 아니며, `error-codes.md §3` 이 두 케이스 컨벤션이 **의도적으로 분리**됐음을 명문화하고 있다. 단, 동일 의미의 코드를 알파벳 검색으로 찾는 독자가 두 행을 별개로 볼 수 있도록 cross-ref 가 충분히 있는지 확인이 필요하다.
- **제안**: 현 등재 내용은 충분히 명확하다. 향후 두 경로 중 하나가 통합될 경우 §3 해제 → §5(은퇴 이력)로 이동한다.

---

### **[INFO]** 신규 BullMQ 큐 이름 `workspace-invitations-pruner`
- **target 신규 식별자**: BullMQ 큐 이름 `workspace-invitations-pruner`, 서비스 클래스 `WorkspaceInvitationsPrunerService`
- **기존 사용처**: 기존 16개 큐 목록(`spec/data-flow/0-overview.md §4`) 에 없는 신규. 가장 근접한 이름은 `login-history-pruner`(패턴 동일)
- **상세**: 이름 충돌 없음. `login-history-pruner` 와 `-pruner` 접미사 패턴을 공유하며 용도가 명확히 다르다(초대 vs 로그인 이력). `spec/data-flow/0-overview.md` 큐 카탈로그가 16→17개로 업데이트됐고 내부 정합이 유지된다.
- **제안**: 없음. 신규 식별자 패턴이 기존 컨벤션과 일치한다.

---

### **[INFO]** 신규 Rationale 섹션 `3-auth-session.md §R6` — 기존 `5-admin-console §R6` 과 파일-외 동일 레이블
- 위 첫 번째 WARNING 항목과 동일 내용. 이 INFO 는 `4-security.md` 가 `[3-auth-session §R6]` 로 링크하여 명시적으로 파일을 지정하므로 실제 혼동 위험이 낮음을 재확인하는 보조 항목이다.

---

## 요약

이번 변경셋(webchat `sessionStorage` 마이그레이션 + agent-memory `memoryState` sub-namespace + 초대 에러 코드 등재 + `workspace-invitations-pruner` 큐 신설)에서 실제 충돌하는 식별자는 발견되지 않는다. 유의미한 리스크는 두 가지다. 첫째, `3-auth-session §R6` 신설로 `7-channel-web-chat/` 영역에서 세 파일이 모두 `§R6` 레이블을 쓰게 됐다 — 각 파일 내 로컬 앵커라 기술적 충돌은 아니지만, 독자가 링크 파일명을 반드시 확인해야 하는 부담이 생긴다(WARNING). 둘째, `memoryState.lastExtractionTurnSeq` (신 형식)가 일부 spec 파일(`_product-overview.md`, `1-ai-agent.md §2.7`, `data-flow/13-agent-memory.md`)에서 아직 구 평면 키 형태로 남아 spec 내 동일 개념이 두 표기로 혼용된다(WARNING). 나머지 신규 식별자(`workspace-invitations-pruner` 큐, 초대 에러 코드군)는 기존 네임스페이스와 충돌 없이 도입됐다.

## 위험도

LOW

STATUS: SUCCESS
