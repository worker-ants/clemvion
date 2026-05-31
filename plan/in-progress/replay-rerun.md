# Re-run (워크플로 재실행) 도입

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> **PR1 (PRD+Spec) — 2026-05-13 작업 완료, 머지 대기. 본 plan 은 PR2 (구현) 머지 후 closure.**
> PR1 산출물: [`spec/5-system/13-replay-rerun.md`](../../spec/5-system/13-replay-rerun.md) (신규) + 4건의 cross-link 갱신 (4-execution-engine §6.3, 14-execution-history §3.7 + EH-DETAIL-10/11, 3-execution §10.14, 4-ai-assistant §4.1.2).

## 배경

[Spec 실행 엔진 §6.3](../../spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) 의 Replay 정책 표가 View / Re-run / Multi-turn resume 세 모드를 정의했으나 **Re-run** 만 미구현이었다. PR1 에서 신규 [Spec Re-run](../../spec/5-system/13-replay-rerun.md) 으로 정책 (A~G) · API · 데이터 모델 · UI · 권한 · AI Assistant 관계를 모두 확정했다. PR2 에서 Backend·Frontend·e2e 구현.

## 결정 사항 (사용자 확정 — PR1 에서 spec 으로 흡수)

| 항목 | 결정 | 정책 ID |
| --- | --- | --- |
| A. 외부 부수효과 안전장치 | A5 — 확인 모달 + dry-run 토글 | [RR-PL-01](../../spec/5-system/13-replay-rerun.md#rr-pl-01--외부-부수효과-안전장치-a5) |
| B. 입력 데이터 모드 | B2 — 원본 미리보기 + 사용자 편집 | [RR-PL-02](../../spec/5-system/13-replay-rerun.md#rr-pl-02--입력-데이터-모드-b2) |
| C. 부분 Re-run | C1 — v1 은 전체 워크플로만 | [RR-PL-03](../../spec/5-system/13-replay-rerun.md#rr-pl-03--부분-re-run-미지원-c1) |
| D. Multi-turn 노드 처리 | D1 — 사용자 새로 입력 | [RR-PL-04](../../spec/5-system/13-replay-rerun.md#rr-pl-04--multi-turn-노드-ux-d1) |
| E. Chain 추적 모델 | E3 — `re_run_of` self-FK + `chain_id` UUID + 깊이 32 | [RR-PL-05](../../spec/5-system/13-replay-rerun.md#rr-pl-05--chain-추적-모델-e3) |
| F. 권한 | 원본 시작자 + 워크스페이스 Editor+ | [RR-PL-06](../../spec/5-system/13-replay-rerun.md#rr-pl-06--권한-f) |
| G. AI Assistant | G1 — Re-run 트리거 불가 | [RR-PL-07](../../spec/5-system/13-replay-rerun.md#rr-pl-07--ai-assistant-비트리거-g1) |
| H. PR 분할 | H2 — PR1 (PRD+Spec, 본 plan) + PR2 (구현, 후속) | — |

## 관련 문서

- [Spec Re-run (신규 통합 spec)](../../spec/5-system/13-replay-rerun.md) — 정책·API·UI·데이터 모델·Rationale 의 single source of truth
- [Spec 실행 엔진 §6.3](../../spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) — 본 PR 에서 Re-run 행 + 외부 부수효과 가드 cross-link 갱신
- [Spec 실행 내역 §3.7 + EH-DETAIL-10/11](../../spec/2-navigation/14-execution-history.md#37-re-run-액션) — UI 진입점
- [Spec 워크플로 실행/디버깅 §10.14](../../spec/3-workflow-editor/3-execution.md#1014-re-run-진입점) — Run Results 드로어 진입점
- [Spec AI Assistant §4.1.2](../../spec/3-workflow-editor/4-ai-assistant.md#412-re-run-비트리거-정책) — RR-PL-07 적용
- [`plan/complete/engine-raw-config-exposure.md`](../complete/engine-raw-config-exposure.md) — raw config echo 정책, Re-run 의 핵심 전제
- [Spec Re-run §14.3](../../spec/5-system/13-replay-rerun.md) retry 직교성 — `retry_last_turn` 과의 경계는 §14.3 끝 retry 직교성 단락 + Rationale 끝 "`execution.retry_last_turn` 과의 경계 (§14.3 보강)" 단락에 이미 명문화되어 main 에 머지됨 (retry-handler-followup plan, 2026-05-31 완료·제거). 후속 spec 갱신 시 §14.3 / §Rationale 현 상태를 base 로 한다.

## 작업 단위

### 1. PRD 작성 — ✅ 완료 (PR1)

- [x] PRD 신규 문서 작성 — [`spec/5-system/13-replay-rerun.md`](../../spec/5-system/13-replay-rerun.md). 옛 `prd/` 트리는 docs-consolidation 으로 spec 에 흡수되어 본 신규 PRD 도 spec/ 안에 두었다. 다음 항목 모두 포함:
  - View vs. Re-run 의 분리 → §Overview + §14 기존 정책과의 관계
  - Re-run 의 입력 데이터 → RR-PL-02
  - 권한 → RR-PL-06
  - Re-run 결과의 추적 → RR-PL-05 + §9 데이터 모델
  - 실패 분기 → RR-PL-03 (v1 미지원, §15 향후 확장 에 C2 reference)
  - Multi-turn / Form / Buttons → RR-PL-04

### 2. Spec 작성 — ✅ 완료 (PR1)

- [x] [Spec 실행 엔진 §6.3](../../spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) Replay 정책 표 갱신 — Re-run 행 "🚧 → ✅ 정의됨" + 외부 부수효과 가드 cross-link
- [x] [Spec 실행 내역](../../spec/2-navigation/14-execution-history.md) — Overview 표에 EH-DETAIL-10/11 신설, §3.7 Re-run 액션 본문 추가, §5 API 엔드포인트 표에 `re-run` / `chain` 추가
- [x] [Spec 워크플로 실행/디버깅 §10.14](../../spec/3-workflow-editor/3-execution.md#1014-re-run-진입점) — Run Results 드로어 진입점 신설
- [x] [Spec AI Assistant §4.1.2](../../spec/3-workflow-editor/4-ai-assistant.md#412-re-run-비트리거-정책) — RR-PL-07 read-only 한계 명시

> **진행 현황 (2026-05-31, decision F2 — backend 코어 구현)**: `/goal` 결정 처리로 backend 코어 완료. 마이그레이션은 NOT NULL 대신 NULLABLE chain_id 채택(복수 execution 생성 경로 회귀 위험 회피 — V067 주석 참조).
>
> **진행 현황 (2026-05-31, PR2 — dry-run 완전 구현 + frontend + audit/rate-limit)**: 사용자 결정으로 잔여 전체 구현. dry-run 게이트를 실 mock 인프라로 대체 (`supportsDryRun` 메타 + `variables.__dryRun` 주입 + V068 `execution.dry_run` 컬럼 + 4개 외부 부수효과 노드 mock: http/email 전체, db/cafe24 는 write 만). pre-flight `assertDryRunSupported` 가 mock 미구현 부수효과 노드 검출 시 거부. audit-log(`re_run_initiated`) + per-user rate-limit(UserThrottlerGuard 10/min) 추가. frontend 전체(모달·진입점·chain badge·View chain·dry-run 배지·i18n history 네임스페이스) 구현.

### 3. 백엔드 구현 (TDD) — PR2

- [x] `POST /api/executions/:executionId/re-run` 엔드포인트 — [Spec Re-run §8.1](../../spec/5-system/13-replay-rerun.md#81-post-apiv1executionsexecutionidre-run) (executions.controller/service). 전역 prefix `/api` + 기존 라우트 컨벤션(`/executions`) 따름 — `/v1` 미사용.
- [x] `GET /api/executions/:executionId/chain` 엔드포인트 — [Spec §8.2](../../spec/5-system/13-replay-rerun.md#82-get-apiv1executionsexecutionidchain)
- [x] V067 마이그레이션 — `re_run_of UUID NULL REFERENCES execution(id) ON DELETE SET NULL` + `chain_id UUID NULL` + 인덱스 2개 (`re_run_of`, `(chain_id, started_at)`). **NULLABLE 채택** — re-run 행만 세팅, 일반 실행은 null, chain root = 원본 id. (spec §9.1 의 NOT NULL/self-chain 은 복수 생성 경로 회귀 위험으로 v1 미채택 — 마이그레이션 주석에 근거 기록.)
- [x] (EIA cross-ref) Re-run 은 워크스페이스 JWT 전용 — endpoint 는 `@Roles('editor')` + `@WorkspaceId` 만 사용, `@Public()`/외부 토큰 family 미수용 확인.
- [x] dry-run handler 분기 — `isDryRun(context)` + 외부 부수효과 노드면 `buildDryRunMock` 출력 ([Spec §7.2](../../spec/5-system/13-replay-rerun.md#72-dry-run-동작-명세)). 엔진이 `variables.__dryRun` 주입(V068 컬럼 + rehydration 복원), 공유 헬퍼 `nodes/core/dry-run.util.ts`. http/email 전체 mock, db/cafe24 는 write 만 mock(read 통과).
- [x] 노드 메타에 `supportsDryRun: boolean` 필드 추가 + 4개 Integration 노드에 `true` 부여. `assertDryRunSupported` pre-flight 가 mock 미구현 부수효과 노드 검출 시 `RERUN_DRY_RUN_NOT_APPLICABLE`.
- [x] 권한 가드 (RR-PL-06) + RBAC Editor+ + 워크스페이스 격리 — `@Roles('editor')` + verifyOwnership(workspace) + 타인 실행 owner/admin 한정 (JWT `role`). 단위 테스트 커버.
- [x] chain 깊이 32 enforce (애플리케이션 레벨) — `computeChainDepth` (re_run_of walk).
- [x] `audit_log` `re_run_initiated` 이벤트 기록 ([Spec §11](../../spec/5-system/13-replay-rerun.md#11-감사-로그)) — `AuditLogsService.record` (originalExecutionId/chainId/dryRun/inputModified).
- [x] Rate limit — 사용자당 분당 10회 ([Spec §12](../../spec/5-system/13-replay-rerun.md#12-rate-limit)) — `UserThrottlerGuard`(user.sub 키, IP 폴백) + re-run 엔드포인트 `@Throttle 10/min`.
- [x] 단위 테스트 — 입력 동일 / 입력 수정(chainId from original) / 권한 거부 / dry-run pre-flight(거부+허용) / chain 깊이 초과 / admin 타인 실행 / getChain / audit 기록 (executions-rerun.service.spec.ts 11 케이스) + 4 노드 mock 테스트(http/email/db/cafe24).

### 4. 프론트엔드 구현 — PR2

- [x] 실행 상세 페이지 헤더에 `[⟳ Re-run]` 버튼 + 모달 ([Spec §10.2](../../spec/5-system/13-replay-rerun.md#102-re-run-모달)) — 권한 미충족 시 disabled+tooltip.
- [x] Run Results 드로어 헤더에 `[⟳ Re-run]` 버튼 — 권한 미충족 시 hidden ([Spec §10.14](../../spec/3-workflow-editor/3-execution.md#1014-re-run-진입점)).
- [x] Chain badge ([Spec §10.3](../../spec/5-system/13-replay-rerun.md#103-chain-표시)) + "View chain" 드롭다운 (getChain).
- [x] Manual Trigger parameters 폼 재사용 (원본 입력 기본 + "원본 그대로" 토글).
- [x] dry-run 미지원 워크플로 검출 + 토글 disabled (supportsDryRun 메타 + category 기반).
- [x] Re-run 후 새 실행 페이지 자동 이동 (`/workflows/:wid/executions/:newId`).
- [x] dry-run NodeExecution 시각화 — `🧪 dry-run` 배지 (`output._dryRun`).
- [x] i18n (ko/en) — `history` 네임스페이스 신설, [Spec §10.4](../../spec/5-system/13-replay-rerun.md#104-i18n-키) 키 전체.
- [x] 단위 테스트 — rerun-modal 11 / can-rerun 9 / detail-page / result-detail / i18n parity.

### 5. 검증 — PR2

- [x] backend lint / unit / integration — executions 519 + execution-engine 227 pass, 프로덕션 tsc clean, eslint 0 err.
- [x] frontend lint / unit — 347 pass (rerun 관련 + i18n parity), tsc 0 errors, eslint clean.
- [x] e2e (backend `*.e2e-spec.ts`): Re-run happy/입력수정/dry-run/chain/권한거부 — `re-run.e2e-spec.ts`.
- [x] `ai-review` 실행 → Critical/Warning fix.

## 수용 기준

- ✅ (PR1) PRD 신규 문서 작성·승인됨 — [Spec Re-run](../../spec/5-system/13-replay-rerun.md)
- ✅ (PR1) [Spec 실행 엔진 §6.3](../../spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy) 의 Re-run 🚧 표기 제거 + 외부 부수효과 가드 cross-link
- ⏳ (PR2) Re-run 엔드포인트 + UI 동작
- ⏳ (PR2) 권한·격리·외부 부수효과·dry-run·chain 깊이·multi-turn 회귀 잠금
- ⏳ (PR2) ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: [`plan/complete/engine-raw-config-exposure.md`](../complete/engine-raw-config-exposure.md) (raw config echo) 이미 완료. 본 PR1 의 Spec Re-run §14.2 가 이를 명시적 전제로 cross-link.
- **리스크**:
  - **외부 부수효과 재트리거** — RR-PL-01 (확인 모달 + dry-run) 로 v1 안전장치 확정. v2+ 의 멱등성 키 (A3) / 노드별 정책 (A4) 는 §15 향후 확장 에 reference
  - **multi-turn / blocking 노드** — RR-PL-04 (사용자 새 입력) 로 v1 결정. D2 (자동 재사용) 는 별도 plan
  - 워크플로 정의가 원본 실행 이후 변경되면 Re-run 결과가 달라지는 점 — Spec §14.1 에서 "원본 이후 워크플로가 N회 수정" 표기는 v2+ 로 미루고 v1 은 일반 안내만 두기로 결정
