# 신규 식별자 충돌 검토 — `spec-draft-else-branch-transaction.md`

## 검토 범위 요약

target plan(`plan/in-progress/spec-draft-else-branch-transaction.md`)이 예고하는 변경은
두 곳뿐이다:

1. `spec/5-system/4-execution-engine.md` §1.1 「원자성 보장」 블록에 문장 추가 (기존 식별자
   `updateExecutionStatus`/`linkedNodeExec`/`dataSource.transaction` 을 그대로 재사용, 새
   엔티티·타입·API 명 없음)
2. 같은 파일의 기존 "소급 각주 (2026-08-30)" (line 53) 블록에 후속 각주 추가 (신규 요구사항
   ID·엔드포인트·이벤트명·ENV 없음)

target 은 **어떤 새 요구사항 ID·엔티티/DTO 명·API endpoint·webhook/queue/SSE 이벤트명·
ENV var·config key 도 도입하지 않는다** — 순수 서술(narrative) 보정이며 기존 식별자만
인용한다. 이 관점의 리뷰 항목 1~5 는 target 에 해당 사항이 없다. 항목 6(파일 경로)만 실질
검토 대상이다.

## 확인한 사항

- **plan 파일 경로 명명 컨벤션**: `plan/in-progress/spec-draft-else-branch-transaction.md` —
  기존 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 와 동일한
  `spec-draft-<topic>.md` 패턴을 따른다. 경로 충돌·컨벤션 이탈 없음.
- **`spec_impact: spec/5-system/4-execution-engine.md`**: 기존 파일이며 신규 파일 생성이
  아니다. 경로 충돌 대상 없음.
- **참조 커밋/PR 식별자**: `#1242` → `git log` 상 `5fbcd20b8 docs(spec): raw SQL 결과 shape
  을 규약으로 승격 + 소급 각주 5건 (#1242)` 로 실재 확인. `8332d9a20` 도 해당 커밋이 고친
  대상과 일치. 식별자 오인용 없음.
- **`후속 각주` 라벨**: repo 전체(`spec/**`)에서 이 문자열이 쓰인 곳은 이 target plan
  파일 자체뿐이다 — 기존 spec 서술 관례에 없는 새 표현이지만, 이는 **formal ID 가 아니라
  블록쿼트 제목의 서술적 라벨**이라 "식별자 충돌" 대상이 아니다.
- **"소급 각주 (2026-08-30)" 라벨 재사용 확인**: 동일 날짜 라벨이 repo 전역에 이미 8곳
  존재한다(`4-execution-engine.md` ×2, `8-embedding-pipeline.md`, `10-graph-rag.md`,
  `conventions/node-cancellation.md` ×2, `data-flow/2-auth.md`). 각 인스턴스는 em-dash
  뒤에 고유한 부제(예: "종결 이벤트의 선점 감지가…", "admission gate 가…")를 붙이는 게
  이미 이 저장소의 확립된 패턴이며, target 이 그 중 line 53 항목에 내용을 보강하는 것은
  이 패턴을 깨지 않는다. 라벨은 날짜만으로 식별되지 않고 부제로 식별되므로 항목 간
  혼동 가능성은 낮다 (참고 사항, 결함 아님).
- **코드 diff 쪽 신규 식별자(`finishStatusTransition` private 메서드)**: 같은 PR 의
  `codebase/backend/.../execution-engine.service.ts` 에 새로 생겼지만, target spec draft
  본문은 이 메서드명을 전혀 언급하지 않는다 — spec 문서에 새 식별자로 노출되지 않으므로
  이 리뷰(spec 신규 식별자 충돌) 범위 밖이다. grep 결과 저장소 내 다른 곳에서 동명 사용
  없음 — 코드 레벨에서도 충돌 없음.

## 발견사항

없음.

## 요약

target 문서는 기존 코드/스펙 식별자(`updateExecutionStatus`, `linkedNodeExec`,
`dataSource.transaction`, `#1242`, `8332d9a20`)만 재인용하는 순수 서술 보정으로, 신규
요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/설정키·파일 경로 중 어느 것도 새로
도입하지 않는다. plan 파일 경로는 기존 `spec-draft-*` 컨벤션을 그대로 따르고, 유일하게
새로 등장하는 표현("후속 각주")도 formal ID 가 아닌 서술적 블록쿼트 제목이라 충돌
판정 대상이 아니다. 이 관점에서 target 은 충돌 위험이 없다.

## 위험도

NONE
