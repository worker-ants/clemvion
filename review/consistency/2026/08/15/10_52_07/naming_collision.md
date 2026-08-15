# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md

## 검토 범위 확인

`git diff origin/main -- spec/5-system/` 결과 실제 변경분은 `spec/5-system/14-external-interaction-api.md` 88줄(23줄 추가/12줄 삭제)뿐이며, 내용은 두 종류로 좁다.

1. `durationMs` 필드(`execution.completed`/`execution.failed`/`execution.cancelled` 3종 종결 이벤트)의 문서 상태를 **미구현 (Planned) → 구현됨**으로 갱신 (필드명 자체는 기존에 이미 spec 에 존재하던 것 — 신규 도입 아님).
2. Re-run API 경로 표기를 `POST /api/v1/executions/:id/re-run` → `POST /api/executions/:id/re-run` 로 정정 (오탈 세그먼트 제거 — 신규 endpoint 아님).

새 요구사항 ID·새 엔티티/타입명·새 endpoint·새 이벤트명·새 ENV var·새 spec 파일 경로 중 어느 것도 이 diff 에서 신규로 **도입**되지 않았다. 아래는 두 변경 각각에 대해 "혹시 기존 다른 의미와 충돌하는가"를 실측한 결과다.

## 실측 근거

### 1) `durationMs` — 기존 사용처와 의미 일치 (충돌 없음)

- DB 컬럼 SoT: `codebase/backend/src/modules/executions/entities/execution.entity.ts:62-63` — `@Column({ name: 'duration_ms' }) durationMs: number` (실행 소요 시간, ms).
- 동일 의미로 이미 쓰이는 곳: `codebase/backend/src/modules/dashboard/dashboard.service.ts:38,195`(`RecentExecution.durationMs` = "실행 소요 시간(ms)"), `codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts:65`, `spec/2-navigation/14-execution-history.md:370,408`, `spec/3-workflow-editor/3-execution.md:296-297,708`.
- WS 문서 계열은 같은 값을 `duration`(ms 접미사 없음)으로 표기 — target 문서 자체가 이미 "표기만 다르고 같은 값" 이라고 명시적으로 각주 처리했고(`spec/5-system/14-external-interaction-api.md` §6 표, `spec/3-workflow-editor/3-execution.md:296-297` "여기 적힌 이름·유무를 근거로 구현하지 말 것 (`duration` 표기는 EIA 의 `durationMs` 와 같은 값이다)"), 실측으로도 일치한다.
- AI turn 디버그 내부 필드 `ai-conversation-helpers.ts` 의 `durationMs`(턴 단위, `nodeOutput.meta.turnDebug[].durationMs`)와 `tool_call_completed` 이벤트의 `durationMs`(툴콜 단위)는 **스코프가 다른 중첩 필드**이고, target 문서 §6/§5.2 는 이미 "node-level firehose 와 EIA 표면 표시 이벤트는 별개" 로 스코프 분리를 명시하고 있어 실질적 혼동 위험이 낮다.
- 결론: 이름 재사용이지만 전 사용처가 "밀리초 단위 소요시간"이라는 동일 의미이고, 스코프(실행 vs 노드 vs 툴콜)가 다른 곳은 target 문서·자매 문서 양쪽에서 이미 명시적으로 구분돼 있다. **CRITICAL/WARNING 대상 아님.**

### 2) Re-run 경로 표기 정정 — 신규 endpoint 아니라 기존 endpoint 참조 오류 수정

- 실제 컨트롤러: `codebase/backend/src/modules/executions/executions.controller.ts:56` `@Controller('executions')`, `:258` `@Post(':id/re-run')`. 전역 prefix `codebase/backend/src/main.ts:193` `app.setGlobalPrefix('api')` → 최종 경로 `POST /api/executions/:id/re-run`.
- 같은 endpoint 를 이미 정의하고 있는 SoT 문서: `spec/5-system/13-replay-rerun.md:38,200,347` 전부 `POST /api/executions/:executionId/re-run` (버전 세그먼트 없음) — target 문서가 수정 후 값과 정확히 일치.
- API 규약: `spec/5-system/2-api-convention.md:31` "버전 | URL 경로에 포함하지 않음". `/api/v1/` 형태는 이 저장소에서 **외부 서드파티(MakeShop) API** 전용 표기(`connect.makeshop.co.kr/api/v1/{shop_uid}/...`)로만 쓰이며, 내부 Clemvion API 네임스페이스에는 존재하지 않는다(`git grep api/v1 codebase/backend/src` 결과 전부 MakeShop/Discord 외부 URL).
- 즉 수정 전 표기(`/api/v1/executions/:id/re-run`)가 오히려 (a) 존재하지 않는 내부 endpoint를 가리키는 오류였고 (b) API 규약 위반 표기였다. 이번 diff 는 그 오류를 **13-replay-rerun.md 의 기존 정의와 일치시키는 정정**이며, 새 경로를 만들거나 기존 경로와 충돌시키지 않는다.
- 결론: **충돌 없음.** 오히려 이전에 잠재했던 "문서 간 같은 리소스에 대해 다른 경로를 명시" 라는 불일치(자기 자신도 아니고 자매 문서 13-replay-rerun.md 와의 불일치)를 해소한 방향.

## 발견사항

없음 — 검토 관점 1~6(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 / 파일 경로) 어느 축에서도 이번 diff 가 새로 도입한 식별자가 없으며, 위 실측대로 이름 재사용(`durationMs`) 도 기존 정의와 의미가 일치하고 경로 표기 정정도 기존 SoT 와 정합한다.

## 요약

이번 target diff(`spec/5-system/14-external-interaction-api.md`, origin/main 대비 88줄)는 신규 식별자를 전혀 도입하지 않는다 — `durationMs` 필드명은 기존에 이미 spec/코드 전반(Execution 엔티티, dashboard, execution-history)에서 동일 의미로 쓰이던 것을 "미구현→구현됨" 으로 상태만 갱신했고, Re-run API 경로 표기는 신규 endpoint 가 아니라 자매 문서(13-replay-rerun.md)·실제 컨트롤러·API 규약과 이미 일치하던 정의로 되돌리는 오탈 정정이다. 두 변경 모두 실측(코드 SoT·자매 spec 문서) 대조 결과 다른 의미로 이미 쓰이고 있는 동일 식별자와의 충돌은 발견되지 않았다.

## 위험도

NONE
