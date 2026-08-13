# Cross-Spec 일관성 검토 — cross_spec

## 조사 방법 메모

`_prompts/cross_spec.md` 는 컨텍스트 예산 초과로 `spec/5-system/14-external-interaction-api.md`·
`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md` 등 핵심 후보 파일과
`<git diff origin/main...HEAD -- code_areas>` 본문이 모두 생략되어 있었다. "여기 없다는 사실을
'내용 없음' 의 근거로 삼지 말 것" 지시에 따라 HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)를 절대경로로 직접 열어 diff·spec 원문을 재확인했다.

**실제 diff 범위**: `git diff origin/main...HEAD` 는 `spec/**` 를 1줄도 바꾸지 않는다. 변경은
전부 `codebase/backend/**`(백엔드 버그 수정 + 테스트) 와 `plan/**`·`review/**` 다. 즉 이번
target(`spec/5-system/`)에 대한 실제 "draft" 는 없고, impl-done 모드로 **최근 병합된 코드**를
기존 `spec/**` 전영역과 대조하는 것이 실질 과업이다.

핵심 변경: TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 `[rows, rowCount]`
튜플을 반환하는데(행 배열이 아님), 8개 소비 지점이 이를 행 배열로 오인해 처리해 온 결함을
`updateReturningRows` 공용 헬퍼로 수정한다. 영향 지점: `execution-engine.service.ts`
(admission gate, `updateExecutionStatus` persisted 판정), `knowledge-base.service.ts`
(reEmbedAll/reExtractAll CAS 락, 재큐 문서 ID), `auth-oauth.service.ts`(OAuth state 소비).

## 대조 결과 — 기존 spec 각 영역과의 정합성

세 갈래 모두 **"코드가 스펙이 이미 문서화한 원자적 보장을 실제로는 지키지 못하고 있었다" →
"이번 fix 가 코드를 그 문서화된 보장에 맞춘다"** 형태다. spec 문서 자체는 변경되지 않았고,
아래에서 대조한 여러 문서가 서로 모순 없이 같은 보장을 기술하고 있었다 — 즉 이번 변경이
**새로운 cross-spec 충돌을 만들지 않는다.**

1. **실행 admission cap** — `spec/5-system/4-execution-engine.md` §8 (`admission gate 원자성
   (TOCTOU)`, L.1138)이 advisory-lock + 조건부 UPDATE 로 cap 을 강제한다고 기술한다. 수정 전
   코드는 `rows.length === 1` 로 판정했는데 실측 shape 은 항상 길이 2 라 `admitted` 가 **영원히
   false** 였다(§Rationale 참조 불요 — diff 자체 주석·`plan/in-progress/update-returning-tuple-shape.md`
   실측 로그로 확인). 결과적으로 매 실행이 §7.1 stalled-재배달 경로로 우회 구동되어 결과(완료)는
   맞았지만 `EXECUTION_STARTED` 이벤트·`recordRunningSegmentStart` 가 4개월간 미발화했다. 이
   fix 이후에야 §8 admission 경로가 문서대로 직접 작동한다. `6-websocket-protocol.md`
   (`execution.started` 페이로드 `{ executionId, workflowId, mode, startedAt }`) ·
   `data-flow/3-execution.md` 의 시퀀스도 이 fix 와 모순되지 않는다(둘 다 "정상 admission 시
   emit" 을 전제로 서술되어 있었을 뿐 실제로 그 경로가 죽어 있었다는 사실은 어느 문서에도
   반영돼 있지 않았다).

2. **KB 재임베딩/재추출 CAS 락 409** — `spec/5-system/8-embedding-pipeline.md` §7.3.2 ·
   `spec/5-system/10-graph-rag.md` §5.1 · `spec/5-system/3-error-handling.md` (`KB_REEMBED_IN_PROGRESS`/
   `KB_REEXTRACT_IN_PROGRESS`, 409) 세 문서가 서로 정합하게 "0행이면 409" 를 기술한다. 수정
   전 코드는 `acquired.length === 0` 이 영원히 거짓이라 동시 재임베딩/재추출을 **거절하지
   못했다.** fix 는 이 세 문서가 이미 합의한 계약을 코드에 되살릴 뿐 문서 간 새 충돌은 없다.

3. **OAuth state 소비** — `spec/data-flow/2-auth.md` L.127-128 이 "row 없으면(미존재·만료·
   이미 소비) 400 `OAUTH_STATE_MISMATCH`. `row.provider ≠ :provider` 도 거부" 를 명시한다.
   수정 전 코드는 튜플을 행으로 오인해 `consumed[0].provider` 가 항상 `undefined` 가 되어
   **모든 정상 콜백까지 `OAUTH_STATE_MISMATCH` 로 실패**했다(소셜 로그인 상시 불가).
   `spec/5-system/1-auth.md` §1.2(OAuth 소셜 로그인)는 이 상태 코드 자체를 다루지 않아 두
   문서가 서로 모순되지는 않는다. fix 는 `data-flow/2-auth.md` 가 이미 기술한 계약을
   회복한다.

4. **`node-cancellation.md` §2.4 terminal 가드** — `updateExecutionStatus` 의 `persisted`
   판정(`updated.length > 0`)도 같은 튜플 버그로 항상 참이었다. `spec/conventions/node-cancellation.md`
   §2.4("확인 없이 쓰면 턴 진행 중 도착한 Stop 이 덮여 취소가 소실된다" / "조건부 UPDATE 가
   0행이면 저장·종결 이벤트 발행을 모두 skip")가 이미 이 가드를 전제로 서술하고 있었고, fix
   가 코드를 그 전제에 맞춘다. 이 문서와 `4-execution-engine.md` §1.1 전이표·§Rationale 사이에
   새 모순은 없다.

이상 4개 대조 모두 **CRITICAL/WARNING 급 cross-spec 충돌 없음**으로 판정한다.

### 발견사항

- **[INFO]** `spec_impact` 5개 파일의 "spec 각주" 미반영 (착수 전 상태)
  - target 위치: `plan/in-progress/update-returning-tuple-shape.md` frontmatter `spec_impact`
    (`spec/5-system/4-execution-engine.md`, `spec/5-system/8-embedding-pipeline.md`,
    `spec/5-system/10-graph-rag.md`, `spec/data-flow/2-auth.md`,
    `spec/conventions/node-cancellation.md`)
  - 충돌 대상: 위 5개 spec 파일 자체(현재는 모두 "원자적 보장이 정상 동작한다" 로만 기술되어
    있고, 4개월간 실제로는 깨져 있었다는 이력이 어디에도 없다)
  - 상세: 모순은 아니다 — 5개 문서는 서로 정합하며 이번 fix 와도 정합한다. 다만 plan 본문이
    "project-planner 위임으로 spec 각주 5건을 스스로 명시" 예정이라 적어 두었고 완료 처리
    전제조건으로 걸어 두었다. 이 5개 파일이 정확히 본 cross-spec 검토의 대조 표면과 겹치므로,
    각주가 누락된 채 다음 draft 가 이 영역을 건드리면 "언제부터 정상이었는가" 판단 근거가
    사라진다.
  - 제안: 새 finding 은 아니며 plan 이 이미 추적 중이다(`rationale_continuity`/`plan_coherence`
    검토자 소관에 더 가깝다). project-planner 턴에서 5개 파일에 짧은 Rationale 각주를 추가할
    때, 정확히 위 4갈래(admission/CAS 락/OAuth state/node-cancellation persisted)를 각 문서에
    1곳씩 배치하면 이번 대조에서 확인한 문서 간 정합성이 그대로 보존된다.

- **[INFO]** `OAUTH_STATE_MISMATCH` 가 중앙 에러 카탈로그에 미등재
  - target 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts`(400 발생 지점) ·
    `spec/data-flow/2-auth.md` L.128(유일한 문서 출처)
  - 충돌 대상: `spec/5-system/3-error-handling.md` — 자매 코드인 `KB_REEMBED_IN_PROGRESS`/
    `KB_REEXTRACT_IN_PROGRESS` 는 이 카탈로그에 등재·상호링크돼 있으나(L.196-197)
    `OAUTH_STATE_MISMATCH` 는 등재가 없다.
  - 상세: 이 diff 가 만든 결함은 아니다(기존 상태, 이번 PR 은 로직만 고쳤다). 다만 수정 전에는
    이 코드가 **모든** 콜백에서 발생해 왔고, 수정 후에는 실제 만료/재사용/state 불일치 시에만
    발생하도록 **의미가 되살아난다** — 카탈로그 완결성의 실질 중요도가 높아졌다.
  - 제안: `spec/5-system/3-error-handling.md` 의 인증 관련 에러 코드 절(또는 §1.x 해당 표)에
    `OAUTH_STATE_MISMATCH`(400) 한 줄과 `data-flow/2-auth.md` 로의 상호링크를 추가할 것을
    project-planner 에게 권고. CRITICAL/WARNING 은 아님 — 문서 간 직접 모순이 아니라 카탈로그
    누락(명명·완결성) 이슈.

## 요약

이번 diff 는 `spec/5-system/` 를 포함해 `spec/**` 를 전혀 변경하지 않는 순수 백엔드 버그
수정(TypeORM `UPDATE`/`DELETE ... RETURNING` 튜플 shape 오인 8곳 수정)이다. 영향받는 세 도메인
(실행 admission cap·EXECUTION_STARTED, KB 재임베딩/재추출 CAS 락 409, OAuth state 소비)을 각각
`4-execution-engine.md`·`8-embedding-pipeline.md`·`10-graph-rag.md`·`3-error-handling.md`·
`data-flow/2-auth.md`·`conventions/node-cancellation.md` 여섯 문서와 대조했고, 모두 **fix 이전
코드가 이미 존재하던 문서화된 원자적 보장을 지키지 못했을 뿐, 문서 자체는 서로 모순 없이
일관됐다.** 따라서 이번 변경은 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층
책임 충돌을 만들지 않는다. 두 개의 INFO 사항(미반영 spec 각주 5건 추적, `OAUTH_STATE_MISMATCH`
카탈로그 누락)만 위생 차원에서 남긴다.

## 위험도

LOW
