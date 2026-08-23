# 신규 식별자 충돌 검토 — naming_collision

## 스코프 정정 메모

prompt payload 는 target 을 `spec/5-system/` 로 지목하며 해당 폴더 전 파일을 번들했으나,
실제 `git diff origin/main...HEAD --stat` 로 확인한 이번 세션(swagger-decisions)의 diff 는
`spec/5-system/` 를 **전혀 건드리지 않는다**. 실제 변경분은:

- `spec/conventions/swagger.md` (§3 DTO description 길이 규칙 개정 + `## Rationale` 신설)
- `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` (`input` 필드에
  `deprecated: true` 추가)
- `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` (대응 가드 테스트)
- `plan/in-progress/swagger-decisions.md` (신규 plan 문서)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (트래커 항목 3건 종결)

절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/swagger-decisions-d24f77`)
를 SoT 로 삼아 위 실제 diff 를 근거로 신규 식별자 충돌 여부를 검토했다 (spec/5-system/ 번들은
diff 가 없어 이번 관점에서 분석 대상이 아니다).

## 검토 내용

이번 diff 가 도입하는 변경은 다음 세 가지뿐이며, 어느 것도 **새 식별자**를 만들지 않는다:

1. **`ExecuteWorkflowDto.input` 에 `@ApiPropertyOptional({ deprecated: true })` 추가** —
   기존 필드명·타입·와이어 계약 무변경. 새 필드명·새 DTO·새 엔드포인트 없음. 직전 세션
   (`00_33_31` naming_collision W1)이 지적한 `ExecuteWorkflowDto.input` vs `ExecuteNodeDto.input`
   동명이의는 **리네임이 아니라 `deprecated` 플래그로 해소**하기로 사용자가 택일했다 — 즉
   이번 diff 는 신규 충돌을 만드는 대신 기존에 보고된 충돌 하나를 완화하는 방향이다.
   - `grep -rln "deprecated: true" codebase/backend/src` 결과 이 파일 1곳뿐 — 다른 DTO 와
     충돌하거나 기존 `deprecated` 관행과 어긋나는 지점 없음.
2. **`spec/conventions/swagger.md §3` 문면 개정** — 새 규약 ID·새 섹션 키 신설이 아니라
   기존 절 2개의 표제만 rename (`### §3 보안·정책 캐비엇 예외 → ### §3 보안·정책 캐비엇`,
   신설 `### §3 DTO 길이는 왜 강제가 아닌가`). 저장소 전체에서 옛 anchor
   (`#3-보안정책-캐비엇-예외--왜-길이-제한-밖인가-그리고-왜-양방향인가`)를 참조하는 곳을
   `grep -rn` 으로 확인했으나 **0건** — 끊어진 링크·anchor 충돌 없음.
3. **`plan/in-progress/swagger-decisions.md` 신규 파일** — `plan/in-progress/<name>.md` 명명
   컨벤션 준수, 기존 파일명과 겹치지 않음. frontmatter `worktree: swagger-decisions-d24f77` 도
   현재 워크트리와 일치.

## 발견사항

없음 — 이번 diff 범위 안에서 신규 요구사항 ID, 신규 엔티티/DTO/인터페이스명, 신규 API
endpoint, 신규 이벤트/메시지명, 신규 ENV var/config key 어느 것도 도입되지 않았다. 유일한
"새 표식"은 기존 필드에 붙은 `deprecated: true` 불리언 플래그이며, 이는 새 식별자가 아니라
기존 식별자의 상태 변경이다.

## 요약

이번 세션의 실제 변경분(swagger.md 길이 규칙 개정 + `ExecuteWorkflowDto.input` deprecation)은
신규 식별자를 하나도 도입하지 않으며, 오히려 직전 라운드에서 checker 가 지적한 동명이의
(`input` 필드 충돌)를 리네임 없이 `deprecated` 표시로 완화하는 방향이다. anchor rename 도
참조처가 0건이라 파급이 없다. 신규 식별자 충돌 관점에서 이번 diff 는 깨끗하다.

## 위험도

NONE
