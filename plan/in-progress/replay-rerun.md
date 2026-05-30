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
- [`plan/in-progress/retry-handler-followup.md`](./retry-handler-followup.md) WARNING #10 — 2026-05-30 의 `spec-draft-retry-downstream-graph` PR 이 `spec/5-system/13-replay-rerun.md §14.3` 끝에 retry 직교성 단락을 추가했고 Rationale 끝에 "`execution.retry_last_turn` 과의 경계 (§14.3 보강)" 단락을 신설했다. 본 plan 의 후속 spec 갱신 시 §14.3 / §Rationale 의 변경된 상태를 base 로 rebase 검토 필요 (text 충돌 가능성).

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

### 3. 백엔드 구현 (TDD) — PR2

- [ ] `POST /api/v1/executions/:executionId/re-run` 엔드포인트 — [Spec Re-run §8.1](../../spec/5-system/13-replay-rerun.md#81-post-apiv1executionsexecutionidre-run) 명세 그대로 구현
- [ ] `GET /api/v1/executions/:executionId/chain` 엔드포인트 — [Spec §8.2](../../spec/5-system/13-replay-rerun.md#82-get-apiv1executionsexecutionidchain)
- [ ] V### 마이그레이션 — `re_run_of UUID NULL REFERENCES executions(id)` + `chain_id UUID NOT NULL` + 인덱스 2개 ([Spec §9.1](../../spec/5-system/13-replay-rerun.md#91-executions-테이블-컬럼-추가)). 기존 row 백필: `chain_id = id`. **V057·V058 은 `plan/in-progress/2fa-webauthn.md` 가 선점, V059 는 `plan/complete/external-interaction-api.md` 가 점유 — 본 plan 착수 시 max(V) 재확인 후 V060 이후 사용**
- [ ] (EIA cross-ref) Re-run 은 워크스페이스 JWT 전용 — External Interaction API 의 `iext_*` / `itk_*` 토큰으로 호출 불가. [Spec External Interaction API §12](../../spec/5-system/14-external-interaction-api.md) 의 호환성 노트에 이미 명시됨. 본 plan 의 backend 구현 시 Re-run endpoint 가 `@Public()` 등 외부 토큰 family 를 수용하지 않도록 라우트/Guard 검증.
- [ ] dry-run handler 분기 — handler 가 `meta.dryRun === true` + 외부 부수효과 카테고리이면 mock 출력 ([Spec §7.2](../../spec/5-system/13-replay-rerun.md#72-dry-run-동작-명세))
- [ ] 노드 메타에 `supportsDryRun: boolean` 필드 추가 + Integration 카테고리 노드 (HTTP/Email/Database write) 에 `true` 부여
- [ ] 권한 가드 (RR-PL-06) + RBAC Editor+ + 워크스페이스 격리
- [ ] chain 깊이 32 enforce (애플리케이션 레벨)
- [ ] `audit_log` enum 확장 + `re_run_initiated` 이벤트 기록 ([Spec §11](../../spec/5-system/13-replay-rerun.md#11-감사-로그))
- [ ] Rate limit — 사용자당 분당 10회 ([Spec §12](../../spec/5-system/13-replay-rerun.md#12-rate-limit))
- [ ] 단위·통합 테스트 — 입력 동일 / 입력 수정 / dry-run / 권한 거부 / 삭제된 워크플로 / chain 깊이 초과 / multi-turn 새 세션 / `supportsDryRun: false` 거부 케이스

### 4. 프론트엔드 구현 — PR2

- [ ] 실행 상세 페이지 헤더에 `[⟳ Re-run]` 버튼 + 모달 ([Spec §10.2](../../spec/5-system/13-replay-rerun.md#102-re-run-모달))
- [ ] Run Results 드로어 헤더에 `[⟳ Re-run]` 버튼 (종료된 실행만, [Spec §10.14 cross-link](../../spec/3-workflow-editor/3-execution.md#1014-re-run-진입점))
- [ ] Chain badge ([Spec §10.3](../../spec/5-system/13-replay-rerun.md#103-chain-표시)) + "View chain" 드롭다운
- [ ] Manual Trigger parameters 폼 재사용 (`resolveTriggerParameters` 패턴)
- [ ] dry-run 미지원 워크플로 검출 + 토글 disabled
- [ ] Re-run 후 새 실행 페이지 자동 이동 (실행 상세 진입점) / 드로어 reset (드로어 진입점)
- [ ] dry-run NodeExecution 시각화 — `🧪 dry-run` 배지, `_dryRun: true` 강조
- [ ] i18n (ko/en) — [Spec §10.4 i18n 키](../../spec/5-system/13-replay-rerun.md#104-i18n-키) 표 그대로
- [ ] 단위 테스트

### 5. 검증 — PR2

- [ ] backend lint / unit / integration / build
- [ ] frontend lint / unit / build
- [ ] e2e (`docker-compose.e2e.yml`): 실행 상세 → Re-run → 새 실행 페이지 진입 → 결과 확인 (입력 동일 + 입력 수정 + dry-run 3가지)
- [ ] e2e: chain badge / View chain 드롭다운 / 권한 거부 케이스
- [ ] `ai-review` 실행 → Side Effect / Security / API Contract 중심

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
