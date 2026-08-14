# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(plan 상호 체크리스트 stale) + INFO 4건. target(`spec/5-system/14-external-interaction-api.md` §6.4 / `spec/conventions/chat-channel-adapter.md`)의 필드 정정은 데이터 모델·API 계약·규약·명명 어느 축에서도 모순을 만들지 않음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `spec-draft-eia-62-waiting-payload.md:365` 의 "eia-terminal-payload.md 차단 해제 후 --impl-prep 재실행" 체크박스가 `[ ]` 로 남아 있으나, `eia-terminal-payload.md` 는 이미 `[x] --impl-prep 재실행 BLOCK: NO (22_29_16)` 로 완료를 기록했고 그 사실이 후속 커밋(`11ba5bdbf`)에도 남아 있음 | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 (이번 diff) | `plan/in-progress/spec-draft-eia-62-waiting-payload.md:365` | `spec-draft-eia-62-waiting-payload.md:365` 를 `[x]` 로 갱신하고 완료 근거(`22_29_16` impl-prep BLOCK:NO)를 남길 것. 기능적 blocking 은 아니나 다음 세션이 "아직 안 됨"으로 오판해 중복 작업할 위험 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §6.4 "code 는 null 일 수 있다" 설명에서 취소 전용 코드(`RESUME_*`/`EXECUTION_QUEUE_WAIT_TIMEOUT`/`WEBCHAT_IDLE_TIMEOUT`)가 `failed` 전용 코드(sentinel/`WORKER_HEARTBEAT_TIMEOUT`)와 나란히 열거되어 스코프가 흐려짐(표 자체는 모순 없음) | `spec/5-system/14-external-interaction-api.md` §6.4 blockquote | 괄호를 두 그룹으로 분리하고 "행동 계약" 절로 상호 참조 링크 추가 |
| 2 | rationale_continuity | 직전 라운드(`23_18_06`)가 지적한 §6.4 blockquote 자기모순(§6 필드표와 상충하는 stale caveat)이 이번 HEAD 에서 이미 해소됨 확인 | `spec/5-system/14-external-interaction-api.md` §6.4 blockquote (라인 792-798) | 조치 불요. 향후 이 blockquote 편집 시 §6 필드표·CHANGELOG·`spec-sync-external-interaction-api-gaps.md` 를 같은 편집 단위로 유지해 재-drift 방지 |
| 3 | plan_coherence | `execution.cancelled` 의 `error.nodeId`/`details` 부재("아직"이라는 문구)가 `spec-sync-external-interaction-api-gaps.md` backlog 에 항목화되지 않음. §행동 계약 절과 뉘앙스가 살짝 엇갈림 | `spec/5-system/14-external-interaction-api.md` §6 필드 집합 표 `error` 행 | 향후 보완 의도가 있으면 backlog 에 `[ ]` 항목 추가, 설계상 영구 부재가 맞다면 "아직" 표현을 "설계상 없음"으로 통일 |
| 4 | naming_collision | `toTerminalErrorPayload`/`TerminalErrorPayload` 가 `modules/execution-engine/` → `shared/utils/` 로 파일 이동(리뷰 라운드 중 발생) 후에도 전역 유일 정의 유지, 형제 헬퍼 명명 컨벤션과 정합 재확인 | `codebase/backend/src/shared/utils/terminal-error-payload.ts:36,48` | 조치 불요. 참고: `to<X>ErrorPayload` vs `extract<X>ErrorPayload` 접두사 컨벤션 명시는 비차단 개선 아이디어로 유효 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §6.4 blockquote 내 취소전용/실패전용 코드 열거 스코프 흐림(INFO). 데이터모델·API계약·요구사항ID·RBAC 축 모순 없음 |
| rationale_continuity | NONE | 직전 라운드 지적 자기모순 이미 해소 확인(회귀 감시만). Rationale R1~R19 어느 것도 번복 없음 |
| convention_compliance | NONE | 에러코드 명명·null 부재표현(§5.4)·DTO/Swagger 패턴·spec frontmatter·파일명 컨벤션 전부 준수 |
| plan_coherence | LOW | `spec-draft-eia-62-waiting-payload.md` 상호 체크리스트 stale(WARNING) + cancelled error 필드 backlog 미등재(INFO) |
| naming_collision | NONE | PR 생애주기 전체에서 신규 프로덕션 export 는 `toTerminalErrorPayload`/`TerminalErrorPayload` 뿐이며 전역 유일 정의, 명명 충돌 0건 |

## 권장 조치사항
1. `plan/in-progress/spec-draft-eia-62-waiting-payload.md:365` 체크박스를 `[x]` 로 갱신하고 완료 근거(`22_29_16` impl-prep BLOCK:NO)를 남긴다 (WARNING 해소).
2. (선택) `execution.cancelled` 의 `error.nodeId`/`details` 부재를 `spec-sync-external-interaction-api-gaps.md` backlog 에 등재하거나, 설계상 영구 부재라면 §6 필드표 문구의 "아직"을 "설계상 없음"으로 정리.
3. (선택) §6.4 blockquote 의 취소전용 코드 열거를 `failed` 전용 코드와 시각적으로 분리해 스코프 오독 가능성을 낮춘다.