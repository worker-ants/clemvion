# RESOLUTION — Manual Trigger defaultValue fix

ai-review 결과: 위험도 **CRITICAL**, Critical 1 / Warning 11. 아래와 같이 처리.

## 조치 항목

| # | 카테고리 | 발견 | 조치 |
|---|---|---|---|
| CRIT-1 | requirement/spec | Fix(a) `handleConfigChange` 즉시 store 커밋이 spec ED-SP-05·`0-canvas.md §8 R-3`(2026-07-08 재확정) 위반, 게다가 root cause 무관 | **되돌림**: `node-settings-panel.tsx` 로컬 state 동작 복원, `node-settings-panel-config-commit.test.tsx` 삭제 |
| W1 | architecture/side-effect | (a) 파생 — config 편집 undo 불가 | CRIT-1 되돌림으로 해소 |
| W2 | performance | (a) 파생 — keystroke 마다 `nodes` 재구독 재렌더 | CRIT-1 되돌림으로 해소 |
| W3 | architecture | 저장 검증이 `NodeHandler.validate()` 우회, `evaluateMetadataBlockingErrors` 누락 | **수용**: 공식 에러봉투(`INVALID_TRIGGER_PARAMETERS` + `details[]`)를 보존하려면 `validateTriggerParameterSchema` 직접 호출이 맞다(handler.validate 는 flat string 반환). manual_trigger 는 현재 blocking rule 이 없어 결과 동등. 향후 blocking rule 추가 시 재수렴 — 후속 |
| W4 | architecture | `PARAM_NAME_RE` 프론트/백 독립 하드코딩 | **후속(백로그)**: 식별자 정규식 공유 패키지 추출. 저위험 drift |
| W5 | api-contract/doc | `INVALID_TRIGGER_PARAMETERS` 저장 시점(스키마) vs 실행 시점(값) 재사용이 spec 미문서 | 코드는 유지(동일 도메인 코드 재사용 합리, message 로 구분). spec §6/`data-flow/11-workflow.md` 반영은 **impl-done consistency** 로 확인 → 필요 시 project-planner |
| W6 | requirement/api-contract | 잔존 malformed `config.parameters` 워크플로우가 무관 저장·**버전 복원**까지 400 | **restoreVersion 예외** 구현(`skipParamSchemaValidation`) — 과거 스냅샷 복원은 차단 안 함. 신규 `/save` 차단은 의도(프론트 ③ inline 안내). 잔존 데이터 정리 마이그레이션은 운영 후속 |
| W7 | scope | `schedule-runner.service.spec.ts` 포맷-only diff | **유지**: 사전 존재 prettier 에러라 lint 통과에 필요(이번 작업이 처음 실행한 lint 가 표면화) |
| W8 | maintainability | 4번째 구조적 동일 호출부(`retry-turn.service.ts`)는 미수정 — 의도 불명확 | `retry-turn.service.ts` 교차주석 추가 — **의도적 제외**: AI multi-turn retry 는 완료된 중간 노드를 `_retryState` 로 재구동하며 진입 트리거는 재실행 안 됨 + `$input` 미해소는 spec 문서화 동작 |
| W9 | maintainability | `trigger-configs.tsx` prettier --check 실패 | 프로젝트 `eslint`(prettier/prettier rule) 통과. raw `prettier --check` 불일치는 알려진 CLI↔eslint config 괴리(memory `reference_frontend_prettier_cli_vs_eslint_fix`) — 프로젝트 lint 가 권위 |
| W10 | doc | plan 체크리스트 stale | 갱신 완료 |
| W11 | doc | severe fix 인데 CHANGELOG 미갱신 | Unreleased 항목 추가 |

핵심 root cause fix((c) 엔진 재진입 durable input, (b) `type` 조회)는 각 리뷰어가 타당 fix 로 확인 — 변경 없음.

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과
- e2e: 통과 (246/246 — `execution-crash-redrive`·`execution-stalled-redelivery`·`execution-park-resume` 무회귀 + 신규 `manual-trigger-default-param` 3케이스). fix 후 재수행 통과.

## 보류·후속 항목

- **W4** 식별자 정규식 공유 패키지 추출 (별도 그루밍)
- **W6** 실 데이터의 잔존 malformed `config.parameters` 정리 마이그레이션 (배포 전 조회 → 운영 판단)
- **W5** `INVALID_TRIGGER_PARAMETERS` 저장 시점 재사용의 spec §6/data-flow 문서화 — impl-done consistency 결과에 따라 project-planner 위임 여부 결정
