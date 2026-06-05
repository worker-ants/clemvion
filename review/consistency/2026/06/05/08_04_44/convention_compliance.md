# 정식 규약 준수 검토 — plan/in-progress/exec-park-durable-resume.md

검토 모드: `--plan` (plan draft)
대상: `plan/in-progress/exec-park-durable-resume.md`
기준 규약: `spec/conventions/**` (특히 conversation-thread.md, error-codes.md, migrations.md, node-output.md, spec-impl-evidence.md) + CLAUDE.md / plan-lifecycle.md 문서 구조 규약

## 종합 판정: **BLOCK 아님 (PASS, with Warnings)**

본 plan 은 신규 surface 를 거의 도입하지 않고 기존 spec/conventions 의 어휘(`RESUME_*` 에러 코드, `_resumeCheckpoint`, conversationThread)를 재사용한다. 정식 규약과의 직접 충돌(Critical)은 없다. 다만 **conversation-thread.md "신규 DB 컬럼 없음" 정책 변경**과 **마이그레이션 명명/spec-impl evidence cross-link** 의무를 plan 본문이 한 번 더 명시해 두는 것이 안전하다 (Warning 2건, Info 3건).

---

## 점검 결과 (관점별)

### 1. 명명 규약 — PASS

- **에러 코드** (`spec/conventions/error-codes.md`): plan 이 거론하는 `RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE` 는 신규가 아니라 이미 spec(`3-error-handling.md §1`, `4-execution-engine.md §7.5`, `1-data-model.md`)과 backend 코드/테스트에 존재하는 코드다. plan 은 이를 그대로 인용만 하며 rename/신설하지 않는다 → error-codes.md §2(rename=breaking) 및 §1(의미 기반 명명) 위반 없음. plan B 가 fast-path 를 제거해도 이 코드들의 *의미*(checkpoint 부재/schema drift)는 불변이므로 §2 "의미가 갈라질 때만 신설" 원칙과도 정합.
- **마이그레이션 파일명** (A1 D1 의 "JSONB 컬럼 추가" 또는 "별도 테이블" 선택 시): 현 main 의 max 는 `V082__knowledge_base_rerank.sql`. 신규 컬럼은 `V083__<snake_case>.sql` (단조 증가, gap 금지)로 명명해야 한다. plan 본문에 V번호가 적혀 있지 않은 것은 정상(작성 시점 rebase 후 확정).
- **plan 파일명/worktree slug**: `exec-park-durable-resume` — kebab slug, frontmatter `worktree` 와 일치. 규약 부합.

### 2. 출력 포맷 규약 — PASS

- plan 은 새 API 응답/이벤트 페이로드/에러 envelope 형식을 도입하지 않는다. 재개 실패 시 surface 하는 `execution.cancelled` + `error.code` 경로는 기존 `4-execution-engine.md §7.5` / `6-websocket-protocol.md §4.2` 의 형식을 그대로 따른다(plan 이 형식 변경을 제안하지 않음).
- B2 의 "동일 turn 이중 실행 0 / continuation 유실 0 / 멱등" 불변식은 출력 포맷이 아니라 동작 invariant 라 본 관점 대상 외.

### 3. 문서 구조 규약 — PASS

- **frontmatter**: `worktree` / `started` / `owner` 3개 필수 필드 모두 존재 (`plan-lifecycle.md §frontmatter`, build guard `plan-frontmatter.test.ts` 강제 대상). in-progress 단계라 `spec_impact`(Gate C 완료 시점 필드)는 의무 아님.
- **본문 구성**: 목표/Rationale → Phase A/B → Spec 변경 → PR 분해 → 리스크 → 미해결 결정 → 진행 메모. plan 문서로서 자족적이고 SoT 링크(`4-execution-engine.md §4.x/§7.4/§7.5`, `execution-engine-residual-gaps.md`)를 명시. CLAUDE.md 의 `0-`/`_product-overview.md` prefix 규약은 spec 문서 대상이라 plan 에는 비적용.

### 4. API 문서 규약 (swagger/DTO) — N/A

- plan 은 신규 REST endpoint·DTO·Swagger 데코레이터를 추가하지 않는다(실행 엔진 내부 코루틴/영속 구조 변경). `swagger.md` 적용 대상 아님.

### 5. 금지 항목 — PASS (외부 LLM 호출/마커 금지 등 해당 없음)

- conversation-thread.md §1.6 의 "금지된 inline marker 도입 금지"·"§9.4 raw content 노출 금지" 위반 가능성: plan A1 은 conversationThread 를 **있는 그대로 직렬화/복원**하는 것이지 새 inline marker 나 UI raw 노출을 도입하지 않으므로 금지 항목 저촉 없음. (단 Warning W1 참조 — 직렬화/복원 시 `[user-input]…[/user-input]` 보안 마커가 turn.text 안에 그대로 보존돼야 한다는 §1.6 "영속 형태" 계약을 구현 단계에서 깨지 않도록 주의.)

---

## Warnings (구현 전 처리 권장, 차단 아님)

### W1 — conversation-thread.md "신규 DB 컬럼 없음" 정책은 *정식 규약 본문*이라 변경에 planner Rationale 명문화가 의무 (plan 이 이미 인지하나 강조)

`conversation-thread.md §4` 본문은 **"v1 은 ConversationThread 본문에 신규 DB 컬럼 도입 없음"** 을 명시하고, §7 v2 로드맵에서 `Execution.conversation_thread jsonb` 를 *향후 검토* 항목으로만 둔다. plan A1 의 D1(=JSONB 컬럼/별도 테이블/checkpoint 포함)은 이 정책을 **정면으로 번복**한다.

- plan 은 A1 마지막 체크박스와 "Spec 변경" 절에서 이를 인지하고 있으나(`conversation-thread.md "신규 DB 컬럼 없음" 정책 재검토 → Rationale 명문화 (planner)`), 규약 관점에서 이는 **선택이 아니라 의무**다: §4 본문 + §7 로드맵 + §8 Rationale 세 곳이 일관되게 "v1 미도입"을 말하므로, 정책 flip 시 (a) §4 본문 문구 갱신, (b) §7 로드맵 항목 상태 변경, (c) §8 또는 해당 spec Rationale 에 번복 근거 — 세 곳 모두 동기 갱신해야 한다. 한 곳만 고치면 자기모순 spec 이 된다.
- 또한 §2.5 / §4 의 `nextSeq` 원자성·rehydration 복원 서술(자동메모리 `runningSummary` 는 ExecutionContext 경유 복원, "별도 DB 컬럼 안 만듦")과 새 컬럼 정책의 경계도 함께 정리 필요 — 어느 것이 ExecutionContext rehydration 으로 복원되고 어느 것이 신규 컬럼으로 가는지 충돌 없이 기술해야 한다.
- **조치**: planner 가 `consistency-check --spec` 의무 이행 시 위 3곳 + §2.5/§4 경계를 한 PR 로 갱신. plan 의 "Spec 변경" 절에 conversation-thread.md §4·§7·§8 세 앵커를 모두 열거하도록 보강 권장.

### W2 — A1 영속 매체 결정 전이라도, "JSONB 컬럼" 채택 시 migrations.md 절차를 PR-A1 작업 항목에 명시

`migrations.md §5` 는 새 마이그레이션 추가 시 ① `rebase origin/main`, ② max V 확인, ③ `V<max+1>__<descriptor>.sql`, ④ `check-migration-versions.py --base origin/main`, ⑤ `make e2e-test` dry-run, ⑥ PR CI 를 절차로 규정한다. plan PR-A1 항목은 "durable 영속 + rehydration 복원"만 적고 마이그레이션 추가 절차를 명시하지 않는다. D1 이 컬럼/테이블로 결정되면 이 6단계가 PR-A1 의 일부가 된다.

- **조치**: D1 결정 후 PR-A1 체크리스트에 "V083 마이그레이션 작성 + migration-guard 통과"를 추가. (D1 이 `_resumeCheckpoint 포함`으로 결정되면 신규 컬럼 불필요 → 본 Warning 무효.)

---

## Info (참고, 조치 선택)

- **I1 — spec-impl-evidence pending_plans cross-link**: `conversation-thread.md` frontmatter 는 이미 `pending_plans: [ai-context-memory-followup-v2.md]` 를 갖는다. 본 plan 이 conversation-thread.md 본문 정책을 바꾸므로, `spec-impl-evidence.md §2` 관례상 본 plan(`exec-park-durable-resume.md`)도 conversation-thread.md(및 `4-execution-engine.md`)의 `pending_plans:` 에 등록하는 것이 정합. planner spec write 시점에 처리.
- **I2 — information_extractor checkpoint 확장(A2)의 spec 정합**: plan A2 는 information_extractor 멀티턴 checkpoint 저장을 "확인 후 확장"한다. 현 spec(`4-execution-engine.md §112`, `3-information-extractor.md §357`, `1-ai-agent.md §703`)은 명시적으로 **"information_extractor 는 `_resumeCheckpoint` 미적용 → graceful reset(`RESUME_INCOMPATIBLE_STATE`)"** 으로 규약화돼 있다. A2 가 이를 확장하면 이 세 spec 위치도 동기 갱신 대상(현행은 "후속 작업"으로 명시) — plan "Spec 변경" 절에 §112 등을 추가하거나, A2 를 범위 밖으로 분리할지 결정 필요.
- **I3 — 기존 spec 의 "현 구현 메모" 대체**: `4-execution-engine.md §403` 의 "현재 재개 경로와 알려진 한계"(fast-path / pendingContinuations 서술)와 §1151~§1243 의 Durable Continuation Rationale 은 plan B 가 구현 모델을 바꾸면 갱신/대체 대상이다. plan "Spec 변경" 절(§4.x)이 이를 포괄하나, §403·§902~§908 표·§1215 routing-context 재등록 서술까지 명시적으로 열거해 두면 drift 방지에 유리.

---

## 결론

정식 규약(`spec/conventions/**`)과의 **Critical 충돌 없음 → 구현 착수 차단 아님**. 핵심 유의점은 conversation-thread.md "신규 DB 컬럼 없음"이 *정식 규약 본문*이라는 점(W1) — 이 정책 번복은 planner 의 `consistency-check --spec` 단계에서 conversation-thread.md §4/§7/§8 + 관련 execution-engine spec 을 한 묶음으로 동기 갱신해야 자기모순을 피한다. 마이그레이션 채택 시 migrations.md §5 절차 준수(W2). 모두 구현/spec-write 단계의 후속 작업으로 흡수 가능.

STATUS: PASS (Critical 0, Warning 2, Info 3) — 구현 착수 가능, planner spec write 시 W1 의무 이행
