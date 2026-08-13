# 정식 규약 준수 검토 — spec/5-system/

## 사전 확인

- `git diff origin/main...HEAD -- spec/` 는 이번 회차도 **빈 결과**다 (HEAD `d8ac4cb07`). 실제
  변경은 `codebase/backend/**`(execution-engine.service.ts / knowledge-base.service.ts /
  auth-oauth.service.ts / 신규 `common/utils/update-returning-rows.ts`) + `plan/in-progress/**`
  뿐이다. Controller/DTO/Swagger 데코레이터 변경 0건 — API 표면·명명 신규 노출 없음.
- 이 diff 는 TypeORM `UPDATE`/`DELETE ... RETURNING` 이 `[rows, rowCount]` 튜플을 돌려주는데
  8곳이 행 배열로 오인했던 결함의 수정이다 (execution admission gate·`updateExecutionStatus`
  guarded UPDATE·KB CAS 락 2곳·KB 재큐 2곳·OAuth state 소비). 전부 **버그 수정**이며 동작을
  spec 서술 방향으로 정합시킨다 — 신규 위반이 아니다.
- 직전 회차(`23_27_49`) 대비 이번 회차에서 새로 드러난 사실: `plan/in-progress/` 3개 문서
  (`update-returning-tuple-shape.md`, `retry-turn-terminal-guard.md`,
  `ie-resume-turn-boundary-cancel.md`)에 "소급 정정" 배너가 추가되면서, **target 범위
  (`spec/5-system/`) 문서 다수가 지금까지 근거로 인용해 온 "검증 완료" 서술이 실제로는
  mock 경계 안쪽에서만 유효했다**는 사실이 구체화됐다. 아래 발견사항은 이를 target 문서
  좌표까지 직접 대조해 확인한 결과다.

## 발견사항

- **[WARNING] target 문서 3곳이 driver 버그로 무효했던 보장을 캐비어트 없이 "검증됨"으로 서술**
  - target 위치:
    - `spec/5-system/4-execution-engine.md` §1.1 (79행 "자연 종결 … 조건부 UPDATE `affected=0`
      으로 무효화되고 종결 이벤트 발행도 함께 skip", 91~99행 retry 재진입 opt-in 단락,
      101~105행 "짝 전이" 단락 — 전부 `[node-cancellation §2.4]` 를 근거로 인용)
    - `spec/5-system/8-embedding-pipeline.md` §7.3.2 (255~264행 "atomic compare-and-swap 으로
      잠금 획득 … 결과가 0행이면 `409 KB_REEMBED_IN_PROGRESS`")
    - `spec/5-system/10-graph-rag.md` (524행 "`KB_REEXTRACT_IN_PROGRESS` 잠금", 565행
      "atomic compare-and-swap 으로 차단, 409 `KB_REEXTRACT_IN_PROGRESS`")
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` (Overview — "spec 가 약속한 surface 가
    *지금* 구현됐는가" 를 정적 증거로 검증하는 것이 이 컨벤션의 존재 이유) 의 정신 — 구현
    현황 서술이 실제 코드 동작과 어긋나면 안 된다는 원칙.
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 실측(§"실측 — TypeORM 은
    UPDATE/DELETE 에만 튜플을 돌려준다")에 따르면, `UPDATE … RETURNING` 의 반환 shape 오인으로
    **세 곳의 CAS/가드 분기가 프로덕션에서 한 번도 의도대로 발동하지 않았다** — KB 재추출/
    재임베딩 CAS 락은 `acquired.length === 0` 이 항상 거짓이라 동시 요청을 전혀 거절하지
    못했고(위 graph-rag.md 565행·embedding-pipeline.md §7.3.2 가 서술하는 "0행이면 409" 분기가
    미발동), `updateExecutionStatus` 의 `persisted` 는 항상 `true` 라 "동시 cancel 이 이미
    terminal 로 옮겼으면 종결 이벤트를 skip" 분기(execution-engine.md §1.1 79행)가 실전에서
    발동한 적이 없다. 세 지점 모두 이번 diff(`8332d9a20`)에서 **처음으로** 정상 동작하게 됐다.
    `spec/conventions/node-cancellation.md:198` 의 "§2.4 retry 재진입 종결 경로 terminal 가드
    | ✓ | … mutation 13/13 검증" 서술도 같은 문제 — mutation 테스트가 통과한 대상은 `persisted`
    를 이미 상수로 다루는 mock 이었으므로, 그 "검증"이 실제로 증명한 것은 "코드가 mock 의 계약을
    지킨다" 뿐이지 "driver 가 그 계약이 요구하는 값을 만들어 준다" 가 아니었다(등가 뮤턴트 —
    `plan/in-progress/ie-resume-turn-boundary-cancel.md` 소급 정정 참조). 세 target 문서 및 이
    convention 문서 어디에도 이 이력(2026-08-13 이전엔 신뢰할 수 없었다)에 대한 캐비어트가
    없다 — 지금은 실제로 맞는 서술이 됐지만, "언제부터 맞았는가" 를 모르면 향후 회귀 시
    "spec 대로 동작해야 하는데 왜 안 되지" 라는 재조사가 처음부터 다시 반복된다.
  - 제안: 이미 `update-returning-tuple-shape.md` §후속의 **[planner 위임] "소급 각주"** 항목이
    이 5개 문서(위 3개 + `spec/data-flow/2-auth.md` + `spec/conventions/node-cancellation.md`)
    전부를 열거하며 project-planner 반영을 기다리고 있다(developer 는 `spec/` 쓰기 권한이
    없어 이번 PR 로는 반영 불가 — 정당한 상태). 본 발견은 그 위임 항목의 **독립 확인**이며,
    target 문서 측 조치는 각 인용 지점에 "이 보장은 2026-08-13 driver-shape 수정
    (`8332d9a20`) 이전에는 실효되지 않았다" 캐비어트 1줄을 추가하는 것으로 충분하다. 추가로
    `node-cancellation.md` frontmatter `pending_plans:`(15~16행)가 현재
    `node-cancellation-residual-signal-propagation.md` 1건만 가리키는데, 이번에 새로 식별된
    3개 plan(`update-returning-tuple-shape.md`·`retry-turn-terminal-guard.md`·
    `ie-resume-turn-boundary-cancel.md`) 중 최소 1건을 함께 등재하면 `spec-pending-plan-
    existence.test.ts` 가드가 이 교정 의무를 구조적으로 추적하게 된다(현재는 plan 본문에만
    적혀 있어 gate 가 못 본다).

- **[WARNING] (직전 회차 `23_27_49` 재확인) 3회 재발한 결함 클래스에 대응하는 정식 규약 부재 — 이번 회차도 미신설**
  - target 위치: 규약 부재 — `spec/conventions/` 전체(신규 파일 없음, `git diff origin/main...HEAD -- spec/conventions/` 빈 결과 재확인)
  - 위반 규약: 특정 항목 위반이 아니라 항목 부재. 가장 근접한 기존 규약은
    `spec/conventions/node-cancellation.md` §2.4.
  - 상세: `update-returning-tuple-shape.md` 본문이 "이 저장소는 이미 이 결함을 세 번 겪었고
    매번 그 자리만 고쳤다"(`agent-memory-admin` → `stuck-document-recovery` → 이번 8곳)고
    직접 서술하며, §후속에 "[planner 위임] 같은 결함이 세 번 개별 발생했는데 invariant 가
    `spec/conventions/` 에 없다" 를 **체크되지 않은 항목**으로 남겨 두었다. 이번 diff 에도
    신규 convention 파일(`typeorm-query-result-shape.md` 등)이 만들어지지 않았다 — 직전
    회차 지적이 아직 반영 전이라는 뜻이며 새로운 위반은 아니다.
  - 제안: 직전 회차와 동일 — target(spec/5-system/) 수정이 아니라 project-planner 의 규약
    신설(또는 `node-cancellation.md` §2.4 인접에 절 추가) 이 맞는 방향. 이미 developer 의
    plan 이 위임을 스스로 등재해 뒀으므로 본 항목은 그 대기 상태의 재확인.

- **[INFO] 나머지 규약 관점 — 이번 diff 범위에서는 위반 표면 없음**
  - target 위치: 해당 없음
  - 위반 규약: 해당 없음(점검 결과 기록용)
  - 상세: (1) 명명 규약 — 신규 유틸 `updateReturningRows`/에러코드(`KB_REEXTRACT_IN_PROGRESS`
    등)는 모두 기존 표기 규약(`error-codes.md` UPPER_SNAKE_CASE)과 일치하며 이번 diff 가 새로
    도입한 식별자는 없다(기존 코드의 가드 로직만 교체). (2) API 문서 규약(`swagger.md`) —
    Controller/DTO 변경 0건이라 점검 표면 자체가 없다. (3) 문서 구조 규약(Overview 6개 파일
    결여)은 직전 회차와 동일하게 pre-existing 이며 이번 diff 가 그 파일들을 건드리지 않았다.

## 요약

이번 PR 은 `spec/` 을 여전히 1바이트도 바꾸지 않는 순수 백엔드 버그 수정이며, 고친 방향은
spec 서술과 정합한다(신규 위반 없음). 다만 이번 회차에서 target 범위(spec/5-system/) 3개
문서(`4-execution-engine.md` §1.1, `8-embedding-pipeline.md` §7.3.2, `10-graph-rag.md`)와
인접 규약(`node-cancellation.md` §2.4)이, driver-shape 버그로 인해 **최근까지 실효되지
않았던 보장**을 캐비어트 없이 "검증됨"으로 서술하고 있음을 확인했다 — 지금은 사실이 됐지만
"언제부터 사실이었는지"가 빠져 있다. 이는 이미 developer 의 plan 이 project-planner 위임으로
자체 등재해 둔 항목의 독립 확인이며, `spec/` 쓰기 권한이 없는 developer 단계에서는 정당하게
미반영 상태다. 그 외 3회 재발 결함 클래스에 대한 규약 부재(직전 회차 지적, 미해결)를 재확인한
것 외에 새로운 CRITICAL 위반은 없다.

## 위험도
LOW
