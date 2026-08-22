# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep)

## 검토 범위 및 방법

Target 은 `spec/5-system/` 전체(1-auth.md·2-api-convention.md·3-error-handling.md 는 본문
전문, 나머지 15개 파일은 컨텍스트 예산 초과로 프롬프트에서 생략). 실제 착수 예정 작업
(`plan/in-progress/rerun-input-resolution-extract.md`)은 `ExecutionsService.reRun` 의 입력
해석 40줄을 private 헬퍼로 추출하는 **순수 리팩터**(`spec_impact: none`, 코드만 변경, spec
텍스트 변경 없음)이므로, cross-spec 검토의 초점을 이 작업이 닿는 실제 도메인 —
Re-run(`spec/5-system/13-replay-rerun.md`, 프롬프트에서 생략돼 `Read` 로 직접 열람), 마스킹
마커 재제출 거부(EIA §R17), 트리거 파라미터 에러 코드, RBAC, 감사 로그 — 에 맞추고, 프롬프트에
전문이 있는 1-auth.md/2-api-convention.md/3-error-handling.md 와 `Read`/`grep` 으로 직접 확인한
`spec/1-data-model.md`·`spec/4-nodes/7-trigger/1-manual-trigger.md`·`spec/5-system/12-webhook.md`·
`spec/conventions/error-codes.md`·`spec/conventions/audit-actions.md`·`spec/data-flow/1-audit.md`·
`spec/data-flow/10-triggers.md`·`spec/data-flow/11-workflow.md` 를 대조했다.

## 발견사항

교차 영역 간 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌을 발견하지 못했다.
대조한 항목들은 오히려 **의도적으로 촘촘히 동기화된 레퍼런스 그래프**를 이루고 있었다:

- **데이터 모델**: `spec/1-data-model.md §2.13`(Execution 엔티티의 `re_run_of`/`chain_id`/
  `dry_run`/`single_node_id`/`previous_execution_id`)이 `spec/5-system/13-replay-rerun.md §9`
  의 정의(NULLABLE 설계·chain 깊이 32·인덱스 2종)와 필드 단위로 일치. `input_data` 마스킹
  카브아웃 이력(2026-08-20 전환)도 두 문서에서 동일하게 기술됨.
- **API 계약**: `POST /api/executions/:executionId/re-run` 의 `400 INVALID_TRIGGER_PARAMETERS`
  (+ `details[].code = MASKED_VALUE_RESUBMITTED`)가 `spec/5-system/13-replay-rerun.md §8.1`·
  `spec/5-system/3-error-handling.md`(L80·L195·L197·L199)·
  `spec/4-nodes/7-trigger/1-manual-trigger.md`(§6)·`spec/5-system/12-webhook.md`(L312-313)·
  `spec/conventions/error-codes.md`(L129·L157)·`spec/data-flow/10-triggers.md`·
  `spec/data-flow/11-workflow.md` 전체에서 동일한 3-엔드포인트 공용 코드·헬퍼
  (`resolveTriggerParametersRejectingMasked`/`toTriggerParameterErrorDetails`)로 수렴.
  `error-codes.md` §Rename 이력이 `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`(#1193, 등급
  B — 잔여 위험 인수)로 통일한 이력까지 정합.
- **RBAC**: `spec/5-system/13-replay-rerun.md` RR-PL-06(원본 시작자 + Editor+)이
  `spec/5-system/1-auth.md §3.2` RBAC 매트릭스의 "Workflow 실행" 행(Owner/Admin/Editor = ✅,
  Viewer = —)과 일치.
- **감사 로그**: `execution.re_run` 액션이 `spec/5-system/1-auth.md §4.1`·
  `spec/5-system/13-replay-rerun.md §11`·`spec/conventions/audit-actions.md`·
  `spec/data-flow/1-audit.md` 넷 모두에서 동일 분류("도메인 고유 동사")·동일 details 스키마
  (`originalExecutionId`/`chainId`/`dryRun`/`inputModified`)로 일치. 과거 이탈 표기
  (`re_run_initiated`)의 정정 이력(cross-audit G-02)도 네 문서 모두 일관되게 언급.
- **계층 책임**: `reRun` 이 손대는 "입력 해석" 책임(스키마 로드 · 마커 거부 resolve · 검증
  예외 → 응답 봉투 매핑)은 spec 상 `executions.service.ts` 소유로 명시돼 있고(3-error-handling.md
  L80 "Re-run 의 `inputOverride`(`executions.service.ts`)"), private 헬퍼 추출은 같은 서비스
  파일 내부 구조 변경이라 이 소유 경계를 넘지 않는다. spec 은 함수/메서드 내부 분해 수준까지
  규정하지 않으므로 이 리팩터 자체가 spec 상 계층 책임 재획정을 요구하지 않는다.

프롬프트에서 컨텍스트 예산으로 생략된 12개 파일(4-execution-engine.md 등, 목록은 프롬프트
"⚠️ 컨텍스트 예산 초과로 생략된 파일" 절 참조) 중 이번 작업과 직접 관련된 13-replay-rerun.md
는 `Read` 로 전문을 직접 확인했다. 나머지(예: 6-websocket-protocol.md·11-mcp-client.md 등)는
이번 리팩터 범위(reRun 입력 해석 블록)와 도메인이 겹치지 않아 본 검토에서 직접 열람하지
않았다 — 향후 이 스코프의 다른 부분(예: EIA/webhook 도메인)을 다루는 작업에서는 별도 확인
필요.

## 요약

Target(`spec/5-system/`)과 관련 영역(`spec/1-data-model.md`, `spec/4-nodes/7-trigger/`,
`spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/*`)
간 데이터 모델·API 계약·요구사항 ID·RBAC·감사 로그 명명이 전부 상호 참조로 촘촘히
동기화돼 있으며 모순을 발견하지 못했다. 착수 예정 작업이 spec 변경 없는 순수 코드
리팩터(입력 해석 블록의 private 헬퍼 추출)이므로 이번 검토 사이클에서 cross-spec 충돌이
새로 유입될 표면도 없다.

## 위험도

NONE
