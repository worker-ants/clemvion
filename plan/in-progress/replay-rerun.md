# Re-run (워크플로 재실행) 도입

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A

## 배경

`spec/5-system/4-execution-engine.md` §6.3 Replay 정책 표:

| 모드 | 정의 | 현 상태 |
|------|------|---------|
| **View** | 실행 이력 조회 | ✅ 구현됨 (execution-history UI) |
| **Re-run** | 새 Execution 시작 — 현재 워크플로 정의의 raw config 를 다시 평가 | 🚧 미구현 (future PRD) |

PRD 3 §11 도 본 변경에서 "본 버전에는 진정한 replay (재실행) 기능이 미구현. 향후 도입 시 View 와 Re-run 두 모드로 분리한다" 로 명시.

## 관련 문서

- `spec/5-system/4-execution-engine.md` §6 Engine Contract / §6.3 Re-run 정책
- `prd/3-node-system.md` §11 Engine Contract
- `prd/7-execution-history.md` (실행 내역 페이지에 Re-run 진입점이 들어갈 가능성)
- `memory/engine-raw-config-decision.md` / `engine-raw-config-followups.md` (rawConfig echo 정책 — Re-run 의 핵심 전제)
- `plan/complete/engine-raw-config-exposure.md`

## 작업 단위

### 1. PRD 작성 (현재 future PRD 로 표기됨)

- [ ] PRD 신규 문서 작성 — `prd/10-replay-rerun.md` 등 (또는 PRD 7 § 신설). 다음 항목 포함:
  - View vs. Re-run 의 분리 (외부 부수효과 재트리거 여부)
  - Re-run 의 입력 데이터 — 원본 실행과 동일 / 사용자 수정 후 / 표현식만 재평가 (`$now` 등)
  - 권한 — 원본 실행을 시작한 사용자 + 워크스페이스 멤버 Editor+
  - Re-run 결과의 추적 — `re_run_of` 컬럼? 별도 chain ID?
  - 실패 분기 — 일부 노드만 Re-run 가능 여부 (currently 전체 워크플로만)
  - Multi-turn / Form / Buttons 같은 blocking 노드의 Re-run 동작 (사용자 입력 세션 유지 vs. 새 입력 대기)

### 2. Spec 작성

- [ ] `spec/5-system/4-execution-engine.md` §6.3 Replay 정책 표 갱신 (🚧 → 구현 후 ✅)
- [ ] `spec/2-navigation/14-execution-history.md` 에 Re-run 액션 UI 추가 — 실행 상세 헤더의 "Re-run" 버튼 + 입력 데이터 미리보기·편집 다이얼로그
- [ ] `spec/3-workflow-editor/3-execution.md` Run Results 드로어에 Re-run 진입점 추가 (옵션)
- [ ] AI Assistant 의 read-only 도구는 Re-run 을 트리거하지 않는다는 점 명시 (`spec/3-workflow-editor/4-ai-assistant.md` §실행 결과 조회)

### 3. 백엔드 구현 (TDD)

- [ ] `POST /api/v1/executions/:executionId/re-run` 엔드포인트 — 원본 실행의 워크플로 정의 + 입력 데이터를 가져와 새 Execution 시작. 옵션:
  - `useOriginalInput: boolean` (기본 true) — false 시 body 의 새 입력 데이터 사용
  - `reEvaluateOnly: boolean` (기본 false) — true 시 표현식만 재평가, 외부 부수효과 노드 (HTTP / Email / DB write) skip — 단 이 모드는 디버그 용도이므로 권한 한정
- [ ] 워크플로 정의는 **현재 시점의 정의** 사용 (원본 실행 시점의 snapshot 이 아님 — spec §6.3 명시)
- [ ] `re_run_of` (또는 동등) 컬럼 추가 마이그레이션. 단순 self-FK 면 충분
- [ ] 실행 이력 조회 시 Re-run chain 표시 (원본 → re-run 1 → re-run 2 …)
- [ ] 권한 체크 (RBAC Editor+ + 워크스페이스 격리)
- [ ] 단위·통합 테스트 (입력 동일 / 입력 수정 / 권한 거부 / 삭제된 워크플로 / multi-turn 노드 케이스)

### 4. 프론트엔드 구현

- [ ] 실행 상세 페이지 헤더에 "Re-run" 버튼 + 입력 데이터 미리보기·편집 모달
- [ ] 입력 데이터는 `Manual Trigger` 의 `parameters` 스키마 기반 폼 (PRD 8 WH-EP-05-1 패턴 재사용)
- [ ] Re-run 후 새 실행으로 자동 이동 + chain 표시
- [ ] i18n (ko/en)
- [ ] 단위 테스트

### 5. 검증

- [ ] backend lint / unit / integration / build
- [ ] frontend lint / unit / build
- [ ] e2e: 실행 상세 → Re-run → 새 실행 페이지 진입 → 결과 확인
- [ ] `ai-review` 실행 → Side Effect / Security 중심 (외부 부수효과 재트리거 — 의도된 행위 vs. 안전장치 필요)

## 수용 기준

- PRD 신규 문서가 작성·승인됨
- Re-run 엔드포인트 + UI 가 동작
- spec `4-execution-engine.md` §6.3 의 Re-run 🚧 표기 제거
- 권한·격리·외부 부수효과 케이스 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: `prd-spec-sync.md` 와 분리 가능. 다만 `engine-raw-config-exposure` 가 완료되어 있으므로 raw config 기반 재평가 전제는 만족
- **리스크**:
  - **외부 부수효과 재트리거** — 이메일 재발송, HTTP 재호출은 의도된 동작이지만 결제 노드 등 위험. 본 plan에서 "Re-run 시 경고 다이얼로그 + 노드별 dry-run 옵션" 수준의 안전장치 결정 필요
  - **multi-turn / blocking 노드** — Re-run 시 사용자 입력 세션을 어떻게 처리할지 (새 세션 시작 vs. 기존 세션 재사용) 명확히 결정
  - 워크플로 정의가 원본 실행 이후 변경되었으면 Re-run 결과가 달라짐 — 사용자에게 명시적으로 안내
