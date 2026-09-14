# 문서화(Documentation) 리뷰 — 라운드 5 (`13_04_49`)

## 검토 방법

실제 코드 diff(`origin/main...HEAD`)는 6개 파일(`trigger-secret-columns-{guard.ts,spec.ts}`
신설 + `trigger-workflow-ref.spec.ts` 표기 통일 + e2e 3파일 주석/단언 추가)이고, 나머지는
`plan/**` 트래커 2건과 라운드 1~4 `/ai-review`·`/consistency-check` 산출물이다. 이전 4라운드
documentation reviewer 가 이미 인용 정확성·헤더 동기화·수치("9자리"→13) 재검산을 반복해
검증했으므로, 이번 라운드는 (a) 그 4라운드가 **다루지 않은 인접 서술**을 중심으로 `Read`/`grep`
직접 재현, (b) 새 라운드에서 처음 등장한 서술(라운드 5용 diff 자체는 아직 없음 — 이번이 그
직전 상태의 최종 점검)을 봤다.

## 발견사항

- **[WARNING]** `trigger-workflow-ref.spec.ts` 헤더가 "다섯 자리"라고 말하는 호출 지점 수가
  실제로는 6곳이다 — 형제 e2e 파일 자신의 헤더가 이미 "여섯 형태"라고 명시한 것과도 모순된다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:8-9`
    (`Read`로 직접 확인 — 이번 diff 의 편집 hunk 는 13번째 줄부터 시작하므로 8-9행은
    게이트가 없는 미편집 인접 줄이다)
  - 상세: 8-9행은 "이 헬퍼는 `trigger-workflow-ref.e2e-spec.ts` **다섯 자리**에서
    `TriggerDto.workflow` 가... 확인하는 유일한 양성 수단이다. 헬퍼가 무르게 바뀌면
    **다섯 자리**가 동시에 조용히 통과한다"고 적는다. 그런데 실측:
    (1) `grep -c 'expectTriggerWorkflowRef(' trigger-workflow-ref.e2e-spec.ts` → **6**.
    (2) 그 e2e 파일 자신의 헤더 JSDoc(`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:17`)이
    "이 축은 **여섯 형태**로 고정된다"고 명시적으로 센다 — 케이스 A(서브경로 2회) + B + C + D
    + E = 6. 즉 같은 축을 설명하는 두 파일이 서로 다른 수(5 vs 6)를 주장하는 상태다.
    `git blame`/`git log -p`로 확인하면 이 "다섯 자리"는 이 헬퍼 자체가 처음 생긴
    커밋(`5b458b1ec`)부터 있던 표현이라 이번 PR 이 새로 만든 결함은 아니지만, 이번 PR 이
    바로 이 파일의 헤더 문단(13-32행)을 두 차례(원문자→아라비아 통일 + 가드 5 예외 문단
    확장) 편집하면서 5행 위의 이 숫자는 손대지 않았다.
    이 배치는 바로 이 종류의 결함(문서가 주장하는 개수와 실제 개수의 불일치)을 정확히
    다섯 번 잡아 고쳤다는 자체 이력을 갖고 있다 — RESOLUTION 라운드 1~4가 각각
    "9자리→13"(round 1/3), "래퍼 3개 약속·2개만 잠금"(round 3), "`null`/`[]` 경계 진입로
    누락"(round 4), "트래커 두 사본 중 하나만 정정"(round 3) 순으로 "N개를 열거하고
    N−1개만 검증/반영한다"는 같은 형태를 다섯 번 반복해 짚었다. 이 "다섯 자리" 문장은
    그 여섯 번째 사례가 될 수 있는 자리이고, 하필 이 문서가 스스로 "번호 표기·수치를 정확히
    맞춘다"는 것을 이번 diff 의 목적으로 내세우고 있어(원문자→아라비아 통일 이유가
    "grep 으로 정확히 찾기 위해서") 바로 옆줄의 개수 오류가 더 눈에 띈다.
  - 제안: "다섯 자리"/"다섯 자리가" 두 곳을 "여섯 자리"로 정정하거나, 두 파일이 같은 숫자를
    두 번 유지보수해야 하는 부담을 없애려면 한쪽이 다른 쪽을 참조하는 형태로 바꾼다(예:
    `trigger-workflow-ref.spec.ts` 헤더가 "정확한 개수·표는 `trigger-workflow-ref.e2e-spec.ts`
    헤더가 SoT" 라고만 적고 숫자를 중복 기재하지 않음). 이 PR 의 스코프 밖(diff 가 그 줄을
    건드리지 않음)이라면 최소한 `spec-draft-nullable-notation-followups.md` 트래커에 5번째
    항목("정리: 캐너리 두 파일의 주석 표기·성격")의 후속으로 한 줄 등재.

- **[INFO]** 위 발견 외 나머지 서술은 전수 재대조 결과 전부 정확함을 확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`,
    `trigger-secret-columns.spec.ts`, `trigger-workflow-ref.spec.ts`(가드 1~11 번호·라벨),
    `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts`
  - 상세: (1) `CANONICAL_SOURCE`/`CANONICAL_CONST`(`TRIGGER_RESPONSE_STRIP_COLUMNS`, 비-export)와
    `MIRROR_SOURCES`/`MIRROR_CONST`(`TRIGGER_SECRET_COLUMNS`) 인용이 `triggers.service.ts`·
    `schedule-trigger-ref.ts`·`trigger-workflow-ref.ts` 실제 선언과 정확히 일치(경로·상수명·
    `as const satisfies readonly (keyof Trigger)[]` vs `as const` 래퍼 형태 차이까지).
    (2) `trigger-secret-columns.spec.ts`의 "분기 ↔ 대조군 대응표"(7행)가 실제 `it()` 7+2건과
    1:1 대응. (3) `trigger-workflow-ref.spec.ts`의 가드 1~11 번호가 헤더 목록·
    `// ── 가드 N ──` 마커·`expectTriggerWorkflowRef` 구현 순서·`it()` 12건과 전 구간 일치.
    (4) `schedule-trigger.e2e-spec.ts` 헤더의 "`ScheduleDto.trigger.workflow`(양성 3 + 음성
    1)" 주장을 `expectNarrowedScheduleTriggerRef` 호출 4건(withWorkflow:true×3,
    false×1)으로 직접 재검산해 일치 확인. (5) `chat-channel-trigger-create.e2e-spec.ts`의
    새 주석이 가리키는 "정본"(`trigger-workflow-ref.e2e-spec.ts`의 `afterAll` JSDoc)이
    실제로 그 서술(세션 간 `down -v`·세션 안 접두 스코프 표, `secret-store.md §R4` 는
    프로덕션 경로 한정)을 담고 있음을 확인. (6) `spec-impl-evidence.md:55`(밑줄 prefix
    제외 규정, `_overview.md` 예시)를 인용한 트래커 각주도 실제 줄과 일치.
  - 판단: 조치 불필요.

- **[INFO]** README/API 문서/CHANGELOG — 이전 4라운드와 동일하게 갱신 불요 재확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/`(README 부재, 26개 기존 가드 전부
    동일 패턴), `CHANGELOG.md`(사용자 관측 가능한 동작 변경만 기록하는 관례)
  - 상세: 이번 diff 는 API 표면·환경변수·설정을 추가하지 않고 `spec_impact: none` 이다.
  - 판단: 조치 불필요.

## 요약

5라운드째 재검증에서도 새 코드(`trigger-secret-columns-guard.ts`/`.spec.ts`)의 JSDoc·
인라인 주석은 상수명·경로·메서드명·래퍼 형태까지 실제 소스와 전수 일치하고, e2e 3파일의 주석
개정도 상호 참조 대상(정본 문서)의 실제 내용과 정확히 부합한다. 유일하게 새로 발견한 것은
`trigger-workflow-ref.spec.ts` 헤더의 "다섯 자리"가 실제로는 6곳(형제 e2e 파일 자신의
"여섯 형태" 서술과도 모순)이라는 점이다 — 이번 PR 이 만든 결함은 아니고(헬퍼 도입 커밋부터
있던 값) 이번 diff 의 편집 hunk 도 건드리지 않은 인접 줄이지만, 이 PR 이 바로 이 문단에서
"수치를 정확히 맞춘다"는 작업을 두 차례 수행했고 이 저장소가 정확히 같은 형태의 결함을 이번
배치에서만 다섯 차례 잡아 왔다는 점에서 방치하면 여섯 번째 사례가 될 위험이 있어 WARNING 으로
기록한다. 그 외 CRITICAL/새 WARNING 없음.

## 위험도

LOW
