# 변경 범위(Scope) 코드 리뷰 — EIA/WS 대기 노드 표면 매트릭스 가드 (원 구현 + ai-review 반영 refactor)

검토 대상: 2개 커밋을 합친 diff.
- `9ba336453` fix(execution-engine): EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드 (§7.5.1) — 원 구현
- `2244539a9` refactor(execution-engine): ai-review 반영 — hooks 로그 진단정보·단일 JOIN 쿼리·buttons e2e — 후속 fix

본 리뷰는 특히 두 번째 커밋(refactor)이 `review/code/2026/07/11/00_03_25/SUMMARY.md`(Critical 0 / Warning 12) +
`RESOLUTION.md`(조치 항목 표)가 정한 대응 범위를 벗어나는지 검증했다. `git show --stat`/`git diff 9ba336453 2244539a9`
로 refactor 커밋 diff 만 분리해 파일 단위·라인 단위로 대조했다.

## 방법론

RESOLUTION.md 의 조치 항목 표(#1~#12, #6은 #5로 해소, #7~#9는 후속 이관)를 SoT 로 두고, refactor 커밋이 건드린
9개 코드/문서 파일 + `review/code/2026/07/11/00_03_25/` 신규 16개 산출물 파일을 전수 대조했다.

## 발견사항

- **[INFO]** `assertCommandMatchesWaitingSurface` 의 "대기 노드(Node 엔티티) 부재" 케이스가 단일 JOIN 전환의
  자연스러운 부작용으로 관측성이 낮아졌다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `resolveWaitingNodeExecutionId`
  - 상세: 원 구현은 `nodeRepository.findOne()` 이 `null` 을 반환하면 전용 분기로 `logger.warn` + 구체적 메시지
    (`waiting node ${row.nodeId} not found for execution=${executionId}`)를 남겼다. refactor 는 `innerJoin('ne.node', 'n')`
    으로 쿼리 자체를 병합하면서, node 정의가 없는 행은 JOIN 에 의해 **자동으로 결과에서 탈락**해 기존 "0건" 분기
    (`logger.debug` + 일반 메시지 `no WAITING_FOR_INPUT NodeExecution for execution=...`)로 흡수된다. `warn`→`debug`,
    구체적 원인(노드 삭제/불일치) 표시→일반 사유로 로그 등급·정보량이 낮아진다. 이는 RESOLUTION #5("단일 JOIN 쿼리로
    재작성")가 요청한 범위의 **의도된 부작용**이고(신규 테스트 `대기 node 정의 부재(JOIN 탈락) → 0건과 동일하게
    INVALID_EXECUTION_STATE` 가 이 변경을 명시적으로 커버함), 별도의 요청받지 않은 확장은 아니다. 다만 관측성 저하가
    #5 커밋 메시지·RESOLUTION 표 어디에도 명시적으로 언급되지 않아 참고용으로 기록한다.
  - 제안: 조치 불요(스코프 문제 아님). 후속에서 로그 레벨 저하가 실무상 문제되면 별도 트래킹.

- **[정보 확인 — 문제 없음] refactor 커밋 파일 목록이 RESOLUTION.md 조치 항목과 1:1로 대응**
  - `CHANGELOG.md`(#12), `execution-engine.service.ts`/`.spec.ts`(#3·#5·#6), `waiting-surface-guard.ts` JSDoc
    링크 1줄(#11), `hooks.service.ts`/`.spec.ts`(#1·#2), `execution-park-resume.e2e-spec.ts`(#4),
    `plan/in-progress/eia-command-waiting-surface-guard.md`(#7·#9 후속 이관 등재 + 체크리스트 갱신) 전부 RESOLUTION
    표의 특정 항목에 정확히 매핑된다. 매핑에서 벗어난 코드 변경(새 기능, 무관 파일 수정, 임의 리팩토링)은 발견되지 않았다.
  - `waiting-surface-guard.spec.ts`(registry 대칭 테스트가 있는 신규 파일)는 원 구현 커밋(`9ba336453`)에만 속하고
    refactor 커밋은 이 파일을 건드리지 않는다 — RESOLUTION #3(`resumeTurnRegistry` 대칭 테스트 추가)은
    `execution-engine.service.spec.ts` 쪽에 추가돼 있어 중복 작업 없이 깔끔하게 분리됐다.

- **[정보 확인 — 문제 없음] `review/code/2026/07/11/00_03_25/*` 신규 16개 파일은 스코프 크리프가 아니라 프로젝트 컨벤션상
  필수 산출물**
  - `SUMMARY.md`/`RESOLUTION.md`/reviewer별 `.md`/`_router.md`/`_retry_state.json`/`meta.json` 은 CLAUDE.md
    "코드 리뷰 산출물 `review/code/**`" 규약과 developer SKILL 의 REVIEW WORKFLOW(ai-review → fix → RESOLUTION.md)가
    요구하는 표준 산출물이며, RESOLUTION.md 자체가 "SUMMARY: `review/code/.../SUMMARY.md`" 로 이 파일들을 인용한다.
    무관한 파일 추가가 아니다.

- **[정보 확인 — 문제 없음] 포맷팅/주석/임포트 변경은 실질 변경에 수반된 것만**
  - `execution-engine.service.ts` 의 JSDoc 정리(RESOLUTION #10, 중복 케이스 문단 제거)는 표면 매트릭스 3번째 케이스
    서술이 두 곳에 중복 등재됐던 것을 하나로 합친 것으로, 삭제된 텍스트가 정확히 위쪽으로 이동한 형태라 정보 손실이
    없다. `readPersistedInteractionType` import 제거(더 이상 서비스 파일에서 직접 안 씀 — SQL COALESCE 로 대체)와
    `WaitingSurfaceCommand` 관련 import 조정도 QueryBuilder 전환에 종속된 필연적 변경이다. 불필요한 import
    추가/정리는 발견되지 않았다.
  - `hooks.service.ts` 의 `import { ConflictException, HttpException, ... }` 추가는 신설된 `readErrorBody(err: HttpException)`
    헬퍼 시그니처에 직접 쓰이며, `InteractDto` 타입 import 는 원 구현 커밋(`9ba336453`)에서 이미 도입된 것으로
    refactor 커밋 범위 밖(대조 결과 `9ba336453`에서 추가됨).

- **[정보 확인 — 문제 없음] 성능/DB 개선(#5)이 API 표면·에러 코드를 확장하지 않음**
  - QueryBuilder 전환은 `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 의 반환 타입·throw
    하는 에러 클래스(`InvalidExecutionStateError`)를 그대로 유지한다. 신규 필드·신규 엔드포인트·신규 설정 변경 없음.

## 요약

refactor 커밋(`2244539a9`)이 건드린 9개 코드/문서 파일은 예외 없이 `review/code/2026/07/11/00_03_25/RESOLUTION.md`
의 조치 항목(#1·#2·#3·#4·#5·#6·#10·#11·#12 코드 조치, #7·#9 plan 후속 이관 등재)에 정확히 대응하며, 의도 이상의
추가 수정·무관한 리팩토링·기능 확장·무관한 파일 수정·의미 없는 포맷팅/주석/임포트 변경·의도치 않은 설정 변경은
발견되지 않았다. `review/code/2026/07/11/00_03_25/` 하위 16개 신규 산출물 파일도 프로젝트 컨벤션이 요구하는 리뷰
표준 산출물이라 스코프 밖이 아니다. 유일하게 기록할 만한 항목은 INFO 수준으로, JOIN 전환에 따라 "대기 노드 정의
부재" 케이스의 로그 등급·구체성이 낮아진 것인데, 이는 RESOLUTION #5가 요청한 쿼리 재작성의 필연적 결과이며 신규
테스트로 커버돼 있어 스코프 이탈로 보지 않는다.

## 위험도

NONE
