# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-frontmatter-pending-plans.md`

## 검토 방법

target 은 `spec/5-system` 세 문서(`10-graph-rag.md`·`8-embedding-pipeline.md`·`4-execution-engine.md`)의
`pending_plans:` frontmatter 오염을 정정하려는 **plan draft**(--spec 모드)다. 적용 대상 정식 규약은
`spec/conventions/spec-impl-evidence.md`(frontmatter evidence, §2/§3/§4/R-11) 다. 진단·처방의 사실관계를
실제 저장소로 대조 검증했다:

- 세 문서의 현재 frontmatter(`spec/5-system/{10-graph-rag,8-embedding-pipeline,4-execution-engine}.md`)를
  직접 읽어 A-1/A-2/A-3 의 실측 서술과 대조 — 일치.
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` 소스를 읽어 "경로 존재만
  검사하고 plan 여부는 안 본다"는 주장을 확인 — `fs.existsSync(root + planRel)` 뿐이라 `.sql` 경로도
  통과함이 코드로 확인됨(A-1 false-negative 주장 정확).
- `spec-status-lifecycle.test.ts` 소스를 읽어 (b)/(c) 가 `status === "partial"` 분기에만 있고
  `implemented`/`archived` 는 idle 임을 확인 — §C "가드 영향 확인" 서술과 일치.
- `plan/complete/exec-intake-followups.md` 실존(이동 완료) 확인, `spec/5-system/4-execution-engine.md`
  `:439`·`:1155` 부근에 해당 경로가 "잔여 후속"으로 여전히 인용됨을 확인 — A-3 정확.
- 나머지 두 `pending_plans`(`execution-engine-residual-gaps.md`·`retry-turn-terminal-guard.md`)가
  여전히 `plan/in-progress/`에 있음을 확인 — §C 처방 후에도 guard (b)/(c) 가 걸리지 않는다는 서술과 일치.

## 발견사항

- **[INFO]** `pending_plans:` 제거 방식 — "키 제거" vs "빈 배열" 미고정
  - target 위치: §C 표 (`10-graph-rag.md`·`8-embedding-pipeline.md` 행 — "**키 제거**")
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §5.3 사용 예시 — "`pending_plans` 비움 (또는
    제거)"
  - 상세: 컨벤션은 완성 시 `pending_plans` 를 "비움"(빈 배열 유지)과 "제거"(키 삭제) 둘 다 허용한다.
    draft 는 "제거" 만 택했는데, 이는 규약이 명시적으로 허용한 선택지 중 하나라 위반은 아니다. 다만
    저장소 전체에서 이 필드를 다루는 다른 `implemented` 문서들이 어느 관용을 따르는지(빈 배열 잔존
    사례가 있는지)는 이번 조사에서 별도 확인하지 않았다.
  - 제안: 위반 아님 — 그대로 진행해도 된다. 굳이 다듬는다면 커밋 메시지나 draft 본문에 "두 옵션 중
    제거를 택함"을 한 줄 남기면 다음 사람이 재확인할 필요가 없다.

- **[INFO]** R-11 적용이 §3.1 원문의 "승격 시점" 문구를 이미 `implemented` 인 문서로 확장 적용
  - target 위치: §B "R-11 전수 판정" 전체, §C 표의 `8-embedding-pipeline.md`·`10-graph-rag.md` 행
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` §3.1 "`partial` → `implemented`: … 공유
    트래커일 때" 하위 불릿 (R-11)
  - 상세: R-11 원문은 문자 그대로 "partial→implemented **승격 시점**"의 판정 규칙이다. 이번 대상
    두 문서는 이미 `status: implemented`이므로 지금 승격이 일어나는 게 아니라, 애초에 `implemented`
    문서에 `pending_plans`가 잘못 들어간 것(§3 표 자체가 "implemented ⇒ pending_plans 없음"이라고
    이미 명시)을 청소하는 작업이다. 즉 이 케이스는 §3 표 위반만으로도 제거가 정당화되며, R-11 의
    "열린 항목 전수 판정"은 규약이 요구하는 최소 조건을 넘는 자발적 추가 실사(diligence)다 — 위반이
    아니라 오히려 규약의 취지(«빈 약속 방지»)를 더 엄격히 지킨 것이다.
  - 제안: 문제 없음. 다만 이 구분(§3 표 위반 vs R-11 승격-시점 판정)을 draft 본문에 한 문장으로
    명시하면, 향후 이 draft를 §3.1 R-11 의 두 번째 실제 적용 사례로 인용할 때(R-11 Rationale 이
    이미 "이해상충 공개" 관행을 쓰고 있으므로) 구분이 더 명확해진다.

## 명명·출력 포맷·문서 구조·API 문서 규약 점검 결과

- **명명 규약**: 세 문서의 `id`/`status`/`code`/`pending_plans` 키 순서·타입이 §2 스키마 예시와 일치.
  파일 basename 기반 `id`(`graph-rag`/`embedding-pipeline`/`execution-engine`)도 §2.1 규칙과 일치.
  위반 없음.
- **출력 포맷 규약**: 해당 없음 — API 응답/이벤트 페이로드 변경 없음.
- **문서 구조 규약**: target 은 plan 문서라 spec 의 Overview/본문/Rationale 3섹션 요건이 적용되지
  않는다(plan-lifecycle 대상). plan frontmatter 필수 필드(`worktree`/`started`/`owner`)는 모두
  채워져 있고 현재 실행 중인 worktree(`spec-frontmatter-pending-plans-6b2e9f`)와 일치. 위반 없음.
- **API 문서 규약**: 해당 없음 — OpenAPI/Swagger/DTO 변경 없음.
- **금지 항목**: `pending_plans:` 에 `code:` 증거(마이그레이션 파일)를 섞는 것이 바로 이 draft 가
  고치려는 기존 위반이며, draft 의 처방(§C)은 이 금지 패턴을 되풀이하지 않고 정확히 §2.1 필드 정의
  ("미구현 surface 를 책임지는 **plan 경로**")로 되돌린다. 새로 도입되는 금지 패턴 답습 없음.

## 요약

target draft 는 `spec/conventions/spec-impl-evidence.md` §2(필드 정의)·§3(status 라이프사이클 표)·
§3.1 R-11(공유 트래커 승격 판정)을 정확히 인용하고, 세 실측(A-1~A-3)과 처방(§C)이 실제 저장소
파일·가드 테스트 소스와 전부 대조 확인됐다. `.sql` 경로를 `pending_plans`에서 `code:`로 되돌리는 것,
`implemented` 문서에서 `pending_plans` 키를 제거하는 것, `partial` 문서에서 완료·해소된 항목만 골라
제거하고 잔여 항목은 유지해 가드 (b)/(c)를 건드리지 않는 것 모두 규약과 정합한다. 발견된 두 항목은
모두 INFO 수준으로, 규약이 이미 허용한 선택지 중 하나를 택했다는 점을 기록해 두는 수준이며 채택을
막을 사유가 아니다. 정식 규약 준수 관점에서 이 draft 는 차단 요소가 없다.

## 위험도

NONE
