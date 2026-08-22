# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-done)

## 사전 확인

- `git fetch origin` 후 `git merge-base HEAD origin/main` == `origin/main` HEAD(`8a112c33e`) 확인 — diff-base 는 최신이다.
- `git diff origin/main..HEAD --stat` 실측: 이번 target 커밋 3개(리팩터 1 + plan 종결 2)는 **`spec/5-system/` 하위 파일을 단 한 줄도 바꾸지 않는다** (`git diff origin/main..HEAD --name-only | grep '^spec/'` → 0건). 변경분은 `codebase/backend/src/modules/executions/executions.service.ts`(95줄, 순수 리팩터) + `plan/**`(이동·갱신) + `review/**`(리뷰 산출물)뿐이다.
- 실제 신규 프로덕션 식별자는 private 헬퍼 `resolveManualOverrideInput` 하나이며, 이는 직전 라운드(`review/consistency/2026/08/22/21_53_41/naming_collision.md`, --impl-prep)에서 이미 충돌 없음으로 검토된 그 헬퍼와 **동일 diff**다(이번 라운드에서 재도입·변경 없음). 재검증: `grep -rn "resolveManualOverrideInput" codebase/` → 정의(L546)·호출(L487) 2곳뿐, 다른 의미의 동명 정의 없음.
- 이번 세 커밋 중 나머지 둘은 `masked-marker-test-gaps.md`·`spec-sync-external-interaction-api-gaps.md`·신규 `rerun-input-resolution-extract.md`(plan 파일, `complete/`) 갱신뿐이며, plan 문서는 신규 식별자 충돌 검토 대상(요구사항 ID·엔티티·endpoint·이벤트·env var·spec 파일 경로)에 해당하는 것을 새로 도입하지 않는다.

## 발견사항

검토 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·환경변수/설정키·파일 경로) 전부에서 target 이 새로 도입하는 충돌은 발견되지 않았다.

- **요구사항 ID / 엔티티·타입명**: `spec/5-system/` 본문 변경 0줄 → 신규 ID·엔티티·DTO·인터페이스 없음.
- **API endpoint**: 신규 endpoint 없음. 코드 변경은 `ExecutionsService.reRun` 내부 구조 재배치뿐이고 controller/route 는 무변경.
- **이벤트/메시지명**: 신규 audit action·webhook·SSE·WS 이벤트 없음. `INVALID_TRIGGER_PARAMETERS`(에러 코드) 는 spec/5-system/3-error-handling.md §1.3 에 이미 등재된 기존 코드이며, 이번 리팩터는 그 코드를 발행하는 위치만 옮겼을 뿐 새 코드를 신설하지 않았다.
- **환경변수·설정키**: 없음.
- **파일 경로**: 신규 spec 파일 없음. `plan/complete/rerun-input-resolution-extract.md`(신규) 는 기존 plan 명명 컨벤션(`<주제>-<동작>.md`, kebab-case)과 일치하며 같은 슬러그의 기존 파일과 충돌하지 않는다(`git status`/`ls plan/complete/`로 단일 파일 확인). `masked-marker-test-gaps.md` 는 `in-progress/` → `complete/` 이동뿐, 파일명 변경 없음.
- **코드 식별자 `resolveManualOverrideInput`**: 코드베이스 전역에서 정의 1곳(private method)·호출 1곳뿐이며, 유사 이름(`ManualOverrideInput`, `manualOverrideInput` 등 다른 정의)도 없다. 인접한 base/wrapper 쌍(`resolveTriggerParameters`/`resolveTriggerParametersRejectingMasked`, `masked-reject-callers-guard` 감시 대상)과도 이름이 명확히 구분되고, 새 헬퍼가 wrapper 를 올바르게 호출하고 있어 가드의 AST 탐지축과도 충돌하지 않는다.
- **참고 (본 target 범위 밖)**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이번 라운드에서 새로 등재된 항목 — `13-replay-rerun.md §8.1·§8.2` 의 401 코드가 `UNAUTHORIZED` 로 표기돼 있는데 표준 코드명은 `AUTH_REQUIRED`(spec/5-system/3-error-handling.md §1.2)다. 이는 **`spec/5-system/` 자체가 아니라 `spec/5-system/13-replay-rerun.md`(대상 영역 밖) 의 선존 drift**이고, 이번 PR 이 신규 도입한 식별자가 아니라 이미 별도 planner 항목으로 등재·이관되어 있으므로 본 naming_collision 발견사항에는 포함하지 않는다(중복 계상 방지). 등급을 매긴다면 표기 drift(WARNING) 수준이나 스코프·소유권 밖이라 이 리포트에서는 정보 제공에 그친다.

## 요약

target(`spec/5-system/`, --impl-done)은 diff-base(`origin/main`) 대비 실제로 `spec/5-system/` 하위 파일을 전혀 변경하지 않는 순수 plan-정리 + 코드 리팩터 PR이다. 유일한 신규 프로덕션 식별자인 private 헬퍼 `resolveManualOverrideInput` 은 직전 라운드에서 이미 충돌 없음이 확인됐고 이번 라운드에서도 재확인했다 — 코드베이스 전역에서 유일하며 기존 사용처와 의미가 겹치지 않는다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec/plan 파일 경로 어느 축에서도 신규 식별자 충돌은 발견되지 않았다. 스코프 밖에서 발견된 `13-replay-rerun.md` 401 코드명 drift 는 이미 별도 트래커 항목으로 등재돼 있어 본 검토의 결론에 영향을 주지 않는다.

## 위험도

NONE
