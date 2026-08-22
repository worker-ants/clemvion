### 발견사항

- **[INFO]** target 이 실행하는 두 항목은 정본 트래커의 해당 미해결 항목과 문자 그대로 일치 — 우회 없음
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` ①·②
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:989-998`(401 코드명), `:1000-1016`(swagger.md §3 길이-예외)
  - 상세: 두 tracker 항목 모두 2026-08-22 같은 배치에서 등재됐고 "지금 안 고치는 이유: spec/ 편집은 developer 권한 밖 → planner 턴 항목" 이라 명시한다. target 이 이 두 항목을 그대로 집행하며, target 이 남긴 진단(런타임 이미 `AUTH_REQUIRED` · `10~40자` 규칙이 응답 예외만 문면상 포괄)도 tracker 원문과 동일하다. 실측 재확인 결과:
    - `spec/5-system/13-replay-rerun.md:240,269` 는 여전히 `UNAUTHORIZED` (target 의 diff 대상과 정확히 일치, `f65ca193c`(#1193, error-code-unify)가 같은 파일 §8.1 을 최근 건드렸음에도 이 두 행은 무관해 stale 화되지 않았다)
    - `spec/conventions/swagger.md:256-267` 의 현재 예외 문면·길이 규칙(`10~40자`)이 target 이 인용한 원문과 정확히 일치
    - `re-run.dto.ts` 3필드 실측 길이 = `59 · 129 · 174자`(target 인용 수치와 정확히 일치, 3/3 초과 재확인)
    - `error-codes.md` 전역에 `UNAUTHORIZED` 등장 0건 — target 의 "이름이 바뀌는 게 아니라 오기를 고치는 것" 판단(Rename 이력 대상 아님)이 실측과 합치
  - 제안: 조치 불요. target 작업 완료 시 tracker 의 두 체크박스(`:989`, `:1000`)를 `[x]` 로 플립하는 것이 target 작업 목록에 이미 포함돼 있음 — 그대로 진행.

- **[INFO]** "결정 필요" 항목을 target 이 정확히 회피(우회 아님)하고 있음을 확인
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` "넓히지 **않는** 것 — 기본 수치 규칙"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1000-1016`
  - 상세: 실측 34% 초과라는 더 넓은 사실(기본 `10~40자` 규칙 자체가 현실과 벌어짐)이 드러났지만, target 은 이를 별도 결정 항목으로 신규 등재하기로 명시하고 이번 편집 범위에서 제외했다. 저장소 전역(spec/·plan/in-progress/) 에 "기본 수치 규칙 재검토" 라는 동명 항목이 이미 존재하는지 확인했으나 **0건** — 중복 등재 위험 없음.
  - 제안: 조치 불요.

- **[INFO]** 배치의 세 번째 항목(`POST /workflows/:id/execute` body DTO 승격)이 orphan 아님
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` 도입부 blockquote
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:900-907`
  - 상세: target 은 이 항목을 "developer 턴이라 여기 넣지 않는다" 고만 적고 넘기는데, 실제로 tracker 원문에 별도 미해결 항목(`19_25_39` documentation W1)으로 이미 등재돼 있어 유실 위험은 없다.
  - 제안: 조치 불요.

- **[INFO]** swagger 관련 다른 in-progress plan 들과 섹션 충돌 없음
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` ②
  - 관련 plan: `eia-context-schema-followups.md`(§1-4·§5-1 DTO 위치/enum 패턴), `spec-sync-stop-editor-and-forbidden-routes.md`(§5-4 Forbidden·§2-4 401 데코레이터 부재), `harness-review-gate-followups.md`(멀티라인 앵커 링크)
  - 상세: 위 plan 들이 `swagger.md` 를 참조하지만 전부 §1-4/§2-4/§5-1/§5-4 섹션이며 target 이 편집하는 §3(길이 규칙)과 겹치지 않는다. `spec/conventions/egress-masking.md`(#1194, 이미 머지)도 마스킹 좌표계(깊이 상한·경계 연산자·마커)를 다뤄 §3 길이 규칙과 다른 축이라 충돌 없음.
  - 제안: 조치 불요.

### 요약
target(`spec-draft-swagger-401-drift.md`)이 집행하는 두 항목은 정본 트래커 `spec-sync-external-interaction-api-gaps.md` 에 2026-08-22 같은 배치로 등재된 "planner 턴 필요" 미해결 항목을 문자 그대로 이행하는 관계이며, 결정을 우회하거나 새로 내리는 지점이 없다. target 이 인용한 모든 실측 수치(파일 행 번호·문자 수·전역 검색 건수)를 재실측했고 전부 현재 저장소 상태와 일치한다 — 특히 `13-replay-rerun.md` 는 최근(#1193) 다른 편집을 받았지만 target 이 건드리는 두 행은 그 편집과 무관해 stale 화되지 않았다. target 이 명시적으로 범위 밖으로 미룬 "기본 수치 규칙 재검토" 는 중복 등재가 아니며, 배치의 세 번째 항목(developer 턴)도 tracker 에 별도로 안전하게 걸려 있다. 이 review 시점 기준 Plan 정합성 관점의 위험은 발견되지 않았다.

### 위험도
NONE
