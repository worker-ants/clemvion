# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-done)

## 사전 확인 (SoT 워킹트리 기준)

- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/review-info-followups`) 기준 `git diff $(git merge-base HEAD origin/main) HEAD -- spec/` → **0줄** (spec 트리 전체에 변경 없음, `spec/data-flow/` 포함).
- 실제 변경분(21 files)은 `codebase/backend/src/modules/workflows/{workflows.service.ts, workflows.controller.ts, workflows.service.spec.ts}` + `plan/in-progress/review-info-followups.md` + `review/code/2026/07/31/**` 산출물뿐. spec 변경이 없으므로 "target 문서가 새로 도입하는 식별자" 후보 자체가 spec 축에는 존재하지 않는다.
- 코드 diff 상세 확인(`git diff` 3개 파일 전문 대조):
  - `workflows.service.ts`: `duplicate()`·`importWorkflow()` 내부 지역 변수 `nodeEntities`/`edgeEntities` → `nodeRows`/`edgeRows` **리네임**(신규 도입 아님, 기존 관용구와 통일) + `edge.condition` 얕은 복사 버그 수정(변수명·필드명 변경 없음).
  - `workflows.controller.ts`: `@ApiOperation` 의 `description` 을 단일 문자열 → 배열+`join(' ')` 로 포맷만 변경(출력 문자열 byte-identical, 신규 endpoint·필드 없음).
  - `workflows.service.spec.ts`: 테스트 2건 추가(Jest `it(...)` 설명 문자열은 리포트 산출물이라 식별자 네임스페이스 대상 아님).

## 발견사항

이번 검토 대상 diff 가 새로 도입하는 식별자는 없다. 신규 요구사항 ID, 신규 엔티티/DTO/인터페이스명, 신규 API endpoint(method+path), 신규 webhook/queue/SSE 이벤트명, 신규 ENV var·config key, 신규 spec 파일 경로 — 6개 점검 관점 어느 축으로도 "새로 생긴 이름"이 없어 CRITICAL/WARNING 후보가 존재하지 않는다.

- **[INFO]** `nodeRows`/`edgeRows` 리네임은 충돌이 아니라 기존 관용구로의 수렴
  - target 신규 식별자: 없음 — 엄밀히는 "신규 도입"이 아니라 `importWorkflow()` 지역 변수 `nodeEntities`/`edgeEntities` 를 같은 파일 `duplicate()` 가 이미 쓰던 이름 `nodeRows`/`edgeRows` 로 맞춘 rename.
  - 기존 사용처: `codebase/backend/src/modules/workflows/workflows.service.ts:289,309`(`duplicate()`, rename 전부터 `nodeRows`/`edgeRows` 사용) · `codebase/backend/test/workflow-crud.e2e-spec.ts:153,356` · `codebase/backend/test/execution-park-resume.e2e-spec.ts:537`(DB 쿼리 결과 배열을 가리키는 동일 의미의 지역 변수로 이미 존재).
  - 상세: 두 이름 모두 함수-스코프 `const` 라 TS/JS 블록 스코핑상 서로 다른 메서드·테스트 파일에 동시 존재해도 충돌하지 않는다. 의미도 전부 "노드/엣지 관련 row 배열"로 동일해 명명 드리프트가 오히려 rename 으로 해소됐다(rename 전에는 `duplicate()` 안의 주석이 `importWorkflow()` 변수를 "nodeEntities" 로 잘못 인용하고 있어 코드-주석 불일치였음). `git -C <worktree> grep -rn "nodeEntities|edgeEntities" -- codebase/ spec/` 전수 검색 결과 잔존 0건 — 옛 이름을 참조하는 곳이 스펙·코드 어디에도 남아있지 않아 dangling reference 도 없음.
  - 제안: 조치 불요. 향후 `nodeRows`/`edgeRows` 를 TypeORM `Node`/`Edge` 엔티티 인스턴스 배열(partial 아님)이라는 다른 의미로 재사용하지 않도록 주의만 유지(현재는 3중 중복 지점 주석이 이를 명시적으로 상호 참조하고 있어 위험 낮음).

## 요약

검토 대상 diff 는 `spec/data-flow/` 를 포함한 spec 트리 전체에 변경이 없고(선언된 target 문서는 미변경 참조 자료), 실제 코드 변경은 `workflows.service.ts` 의 함수-지역 변수 리네임(기존 관용구와 통일) + `edge.condition` 얕은 복사 버그 수정 + `workflows.controller.ts` 의 Swagger description 포맷 변경(문자열 내용 동일) + 테스트 2건 추가뿐이다. 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·webhook/queue/SSE 이벤트명·ENV/설정키·spec 파일 경로 6개 관점 중 어느 축으로도 새로 도입된 식별자가 없어 충돌 후보 자체가 없다. 유일하게 언급할 만한 변경(로컬 변수 리네임)도 신규 도입이 아니라 같은 파일 안에 이미 존재하던 이름으로의 통일이며, 전수 검색으로 옛 이름의 잔존·dangling reference 가 없음을 확인했다.

## 위험도
NONE
