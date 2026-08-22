# Consistency Check 통합 보고서

**BLOCK: YES** — `naming_collision` checker 가 CRITICAL 로 판정한 "redact 깊이 경계(depth boundary)" 명명 충돌 위험이 있어 호출자가 차단해야 함

> **주의**: target 문서 본문이 `(없음)`(순수 `--impl-prep` 사전 점검, diff 없음)이라 전 checker 가
> 공통으로 겪은 절차상 제약이다. 5개 checker 전원의 전문은 인라인으로 확보돼 "재시도 필요" 항목은
> 없다. 다만 아래 CRITICAL 항목은 **실제 diff 가 아니라 브랜치명(`backend-redact-depth-boundary`)과
> `plan/in-progress/masked-marker-shared-package.md` 의 미해결 follow-up 항목으로부터의 추정**에
> 근거한 예방적 판정임을 감안해 읽을 것 — 그렇다고 등급을 낮추지는 않았다(하향 금지 원칙).

## 전체 위험도
**CRITICAL** — 착수 예정 영역(`codebase/backend/src/shared/utils/`, redact 깊이 경계)에 이미
의도적으로 분리된 3개의 depth-cap 식별자 계열(`MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`/
`stripExternalOnlyFields maxDepth`)이 존재해, 신규 코드/테스트가 이를 혼동하면 잘못된 불변식을
고정하거나 4번째 유사 이름을 만들 위험이 크다. 단, 근본 원인은 developer 권한 내에서 해소 가능
(기존 식별자 재사용 확인 후 착수)하며 spec/ drift 는 아니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (cross_spec 의 관련 WARNING 병합) | "redact 깊이 경계" 개념이 scope 안에 이미 3개의 독립되고 **의도적으로 분리된** depth-cap 계열로 존재 — 신규 명명/신규 테스트가 좌표계를 혼동하면 (a) 기존 계열과 개념이 겹쳐 사실상 재구현이 되거나 (b) 잘못된 상수·연산자·마커를 겨냥한 "정밀 고정" 테스트가 만들어질 위험 | (착수 예정) `codebase/backend/src/shared/utils/sanitize-error-message.ts`, 신설 예정 `sanitize-error-message.spec.ts` | ① `MAX_REDACT_DEPTH`(=`MAX_MASK_DEPTH` 지역 별칭, `sanitize-error-message.ts:128`, 비교 `depth >= MAX_REDACT_DEPTH`, 깊이초과 시 `VALUE_MASK_MARKER`=`'***'` 반환) ② `MAX_SANITIZE_DEPTH`(`websocket.service.ts:80`, 비교 `depth > MAX_SANITIZE_DEPTH`, WS 전용 별개 불변식으로 의도적 비통합) ③ `stripExternalOnlyFields` 의 `maxDepth` 파라미터(`strip-external-only-fields.ts:96-101`, 비교 `depth > maxDepth`, 제3의 독립 상한) ④ SoT `MAX_MASK_DEPTH=10`(`codebase/packages/masked-markers/src/index.ts:81`) | 착수 전 위 3계열의 JSDoc 주석(`sanitize-error-message.ts:124-126`, `masked-markers/src/index.ts:73-79`, `strip-external-only-fields.ts` 경계연산자 절)을 반드시 먼저 읽고 이번 작업이 신규 4번째 불변식이 아니라 **`MAX_REDACT_DEPTH`(`>=`) 단독의 기존 경계 확장/테스트**임을 확정할 것. 신규 프로덕션 식별자를 만들 필요는 없어 보인다(plan 상 요구사항은 테스트 추가뿐). 테스트는 `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER`(`'***'`)를 명시적으로 import·주석 처리해 `MAX_SANITIZE_DEPTH`(WS)·`DEPTH_MASK_MARKER`와 다른 불변식임을 캐너리 주석으로 고정. `strip-external-only-fields.ts`/`websocket.service.ts` 의 `>` 경계는 손대지 말 것(이미 닫힌 결정 번복 금지). |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 의 근본 원인은 spec/ drift 가 아니라 "기존 식별자 재사용 확인 후 올바른
불변식을 겨냥해 착수"하는 문제로, developer 권한 내에서 해소 가능하다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | egress 마스킹의 마커 집합·깊이 상한·경계 연산자 불변식이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 산문에만 흩어져 있음(`error-codes.md`/`audit-actions.md` 가 스스로 경고한 "산문 규약 표류" 패턴과 동형, 이미 마커 이름 불일치로 1회 실측 발생 이력) | `codebase/backend/src/shared/utils/sanitize-error-message.ts`, `strip-external-only-fields.ts` | `codebase/packages/masked-markers/src/index.ts`(JSDoc SoT), `spec/5-system/14-external-interaction-api.md` §R17(산문 SoT) | 착수 전 `spec/conventions/egress-masking.md`(가칭) 신설 여부를 project-planner 에게 확인 — 마커 3종 의미, `MAX_MASK_DEPTH`/로컬 별칭 목록, 소비자별 경계 연산자(`>` vs `>=`)와 근거, 재마스킹 금지 규칙을 단일 문서로 승격 |
| 2 | plan_coherence | target 작업(추정: backend `deepRedactSecrets` 깊이 경계 테스트)을 추적하는 plan 문서가 없음 — `plan/in-progress/**` 에 `worktree: backend-redact-depth-boundary-af6b93` 로 연결된 문서 0건, push-gate 의 plan 연결 자동 강제가 무력화됨 | `codebase/backend/src/shared/utils/` (diff 없음) | `plan/in-progress/masked-marker-shared-package.md` §"후속 (이 PR 밖)" L192-199 (정확히 일치하는 미해결 follow-up 항목) | PR 내에서 `masked-marker-shared-package.md` L192 항목을 `[x]` 로 갱신 + "완료(날짜, `backend-redact-depth-boundary`)" 근거 남길 것. plan 이동은 불필요, 항목만 닫으면 됨 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `deepRedactSecrets` 의 depth-cutoff 마커는 `VALUE_MASK_MARKER`(`'***'`)이며 `DEPTH_MASK_MARKER`(`'[REDACTED_DEPTH]'`)가 아님(의도된 동작이나 이름만 보면 오해 소지) | `sanitize-error-message.ts` `deepRedactCore` | 신규 테스트는 `'***'`을 명시적 기대값으로 적어 "REST 경로는 `DEPTH_MASK_MARKER` 를 쓰지 않는다"를 캐너리로 고정. `DEPTH_MASK_MARKER` 로 바꾸는 변경은 별도 결정(spec R17 갱신 포함) 필요 |
| 2 | cross_spec | `redact-stored-error.spec.ts` 에 별도 depth 경계 테스트를 중복 생성하지 말 것(`redactStoredError*` 는 `deepRedactSecrets` 로의 얇은 위임) | `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` | depth 경계 정본 캐너리는 `sanitize-error-message.spec.ts` 단일 장소에 유지, `redact-stored-error.spec.ts` 는 위임 사실만 검증 |
| 3 | rationale_continuity | scope 내 기존 Rationale-loaded invariant 3건 확인(정보 제공, 위반 아님): ① 깊이 상수 SoT는 `@workflow/masked-markers`(로컬 재정의 기각 이력) ② `MAX_REDACT_DEPTH`≠`MAX_SANITIZE_DEPTH`(별개 불변식, 통합 금지 명시) ③ 깊이초과 시 `VALUE_MASK_MARKER` 사용(이미 마스킹된 leaf 재마스킹 금지) | `sanitize-error-message.ts` 인라인 문서, `spec/5-system/14-external-interaction-api.md` §R17 | 향후 diff 가 이 세 결정 중 하나를 뒤집으면 새 Rationale 서술 동반 필수 |
| 4 | convention_compliance | 마스킹 invariant 를 다루는 파일들의 JSDoc 상호 참조가 코드 주석에만 존재해 `grep spec/conventions` 로 발견 불가 | 해당 없음(문서화 위치 이슈) | WARNING #1 의 conventions 문서 신설 시 `spec-impl-evidence.md` 패턴대로 frontmatter `code:` 에 관련 파일 등재 |
| 5 | plan_coherence | `masked-marker-shared-package.md` L137 `- [ ] /ai-review` 체크박스가 stale(해당 PR #1190 은 이미 main 병합, `/ai-review` 는 강제 의무이므로 실질 완료 추정) | `plan/in-progress/masked-marker-shared-package.md` L137 | WARNING #2 의 L192 편집과 같은 커밋에서 L137 도 `[x]` 로 정정(또는 별도 확인 후) |
| 6 | naming_collision | 최근 완료 PR 4건(#1188~#1191, `b677564e0`/`4287cdd5b`/`3f8543eae`/`7b0e65aa8`)이 정확히 "redact 마스킹 깊이 상한 + 마커 공유 계약" 주제를 이미 다룸. 현재 worktree 는 `origin/main` 대비 diff 0(미착수) | 해당 없음(정보성) | 착수 전 "이 depth-boundary 작업이 이미 병합된 마커 계약과 어떤 차이가 있는가" 1차 확인 — 델타 0 이면 신규 작업 자체가 불필요할 수 있음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 깊이 10 을 쓰는 두 상수(`MAX_REDACT_DEPTH` `>=` vs `MAX_SANITIZE_DEPTH` `>`)가 서로 다른 불변식 — 신규 테스트가 좌표계 혼동 위험 |
| rationale_continuity | NONE | target 부재로 판정 대상 없음. scope 내 기존 결정 3건 정보 제공만 |
| convention_compliance | LOW | egress 마스킹 invariant 가 conventions 문서 없이 코드 JSDoc 에만 존재(직접 위반은 없음) |
| plan_coherence | LOW | target 작업을 추적하는 plan 문서 부재로 push-gate 무력화 위험. 선행조건은 이미 해소됨 확인 |
| naming_collision | MEDIUM (CRITICAL 1건 포함) | "redact 깊이 경계" 개념이 이미 3계열 존재 — 신규 명명 시 충돌·혼동 고위험(CRITICAL) |

## 권장 조치사항
1. **(BLOCK 해소 우선)** 착수 전 `sanitize-error-message.ts`(`MAX_REDACT_DEPTH`/`DEPTH_MASK_MARKER` 주석), `codebase/packages/masked-markers/src/index.ts`, `websocket.service.ts`(`MAX_SANITIZE_DEPTH`)의 JSDoc 을 읽고 이번 작업이 신규 4번째 불변식이 아니라 `MAX_REDACT_DEPTH`(`>=`) 단독의 기존 경계 테스트 확장임을 확정. 신규 프로덕션 식별자를 만들지 말고 기존 상수를 그대로 재사용.
2. 신규 테스트(`sanitize-error-message.spec.ts`)는 `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER`(`'***'`)를 명시적으로 겨냥하고, `MAX_SANITIZE_DEPTH`(WS, `>`)·`DEPTH_MASK_MARKER` 와 다른 불변식임을 주석으로 고정.
3. `redact-stored-error.spec.ts` 에는 depth 경계 테스트를 중복 생성하지 않는다 — `sanitize-error-message.spec.ts` 단일화.
4. `strip-external-only-fields.ts`/`websocket.service.ts` 의 `>` 경계 연산자는 손대지 않는다(이미 닫힌 결정).
5. `plan/in-progress/masked-marker-shared-package.md` L192(및 stale L137)를 이번 PR 에서 갱신해 plan 연결 갭을 해소.
6. 착수 전 최근 PR #1188~#1191 과의 델타를 1차 확인 — 델타 0 이면 작업 자체 재검토.
7. (선택, project-planner 판단) `spec/conventions/egress-masking.md` 신설 여부 검토.

---

## 호출자(developer) 처분 — BLOCK 해소 (2026-08-22, 착수 전 기록)

CRITICAL 1건은 **diff 가 없는 상태에서 브랜치명으로부터 추정한 예방적 판정**이며, 요구한 조치가
전부 "착수 전 확인" 성격이다. 아래를 **착수 전에 실제로 수행**해 해소한다.

| 조치 | 수행 결과 |
| --- | --- |
| ① 3계열 JSDoc 정독 | `sanitize-error-message.ts:118-128`(`MAX_REDACT_DEPTH` = `MAX_MASK_DEPTH` 별칭, `>=`), `packages/masked-markers/src/index.ts:62-81`(SoT + WS 비통합 근거), `strip-external-only-fields.ts:31·96-101`(제3 상한, `>`), `websocket.service.ts:119`(`depth > MAX_SANITIZE_DEPTH` → `DEPTH_MASK_MARKER`) 전부 확인 |
| ② 신규 프로덕션 식별자 0개 | 이번 변경은 **spec 파일 1개(테스트)만** 건드린다. 새 상수·새 함수 도입 없음 |
| ③ 기존 상수 재사용 | 테스트가 `MAX_REDACT_DEPTH`·`VALUE_MASK_MARKER` 를 `./sanitize-error-message` 에서 import 한다 (리터럴 `10`·`'***'` 하드코딩 금지 — 상한이 바뀌면 테스트가 따라온다) |
| ④ `>` 경계 불변 | `strip-external-only-fields.ts`·`websocket.service.ts` 는 **읽기만** 했고 수정하지 않는다 |
| ⑤ INFO-1 캐너리 | depth-cutoff 가 `VALUE_MASK_MARKER` 이지 `DEPTH_MASK_MARKER` 가 아님을 테스트 JSDoc 에 명시 |
| ⑥ INFO-2 단일화 | `redact-stored-error.spec.ts` 는 손대지 않는다 |
| ⑦ INFO-6 델타 실측 | **델타 0 아님.** 무수정 프로브로 실측: 기존 `caps recursion depth` 테스트는 `not.toThrow()` 만 보고, backend 스위트 전체에 **상한 값을 판별하는 단언이 0건**이다(`grep MAX_REDACT_DEPTH` → `strip-external-only-fields.spec.ts`(strip 상한 sweep)·`reject-masked-resubmission.spec.ts`(스캐너 경계)뿐, **마스커 자신의 경계는 없음**). 즉 마스커의 상한을 10→9 로 바꿔도 backend 는 GREEN |
| ⑧ WARNING #2·INFO-5 | 같은 PR 에서 집행 — plan L192 `[x]` + L137 `[x]` 정정 (사용자 §2 요청과 동일) |

WARNING #1(`spec/conventions/egress-masking.md` 신설)은 **planner 권한**이라 이 PR 밖이다 —
정본 트래커에 등재한다.
