# 테스트(Testing) 리뷰 — node-cancel-signal-b4d1 / 22_58_00 세션

## 스코프 확인

이번 프롬프트가 지정한 26개 변경 파일은 전부 `review/consistency/2026/07/25/{19_13_33,21_35_11,21_58_52,22_28_51}/**` 하위의
harness 산출물(`_retry_state.json`/`meta.json`/각 checker `.md`/`RESOLUTION.md`/`SUMMARY.md`)이다.
실제 프로덕션 코드(`codebase/backend/src/nodes/integration/{cafe24,makeshop}/*.ts(.spec.ts)`)는
`git diff origin/main --stat` 상 이번 PR에 포함돼 있으나, **이번 testing 리뷰어에게 전달된 diff 목록에는
들어있지 않다** — 해당 코드는 이전 라운드(21_58_52 이전)에서 이미 리뷰돼 이번 changeset에서 제외된 것으로 보인다
(memory 상 기록된 "리뷰 changeset이 직전 검토 코드 제외" 패턴과 일치). 따라서 본 리뷰는 (a) 이 26개 문서 자체가
테스트 관점에서 문제가 없는지, (b) 문서들이 담고 있는 테스트 관련 주장(claim)이 실제 코드와 부합하는지를
직접 코드베이스를 열어 대조하는 방식으로 진행했다.

## 발견사항

- **[INFO]** 이번 diff 자체에는 신규 프로덕션 코드가 없어 신규 유닛/통합/e2e 테스트 요구사항이 발생하지 않음
  - 위치: 26개 파일 전체 (예: `review/consistency/2026/07/25/22_28_51/SUMMARY.md`, `review/consistency/2026/07/25/21_58_52/RESOLUTION.md`)
  - 상세: 모두 JSON 상태 스냅샷(`_retry_state.json`, `meta.json`)과 사람이 읽는 리포트(`.md`)이며, 이를 생성하는
    `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`는 이번 diff에서 변경되지 않았고
    이미 `.claude/tests/test_consistency_orchestrator_state.py` 등 별도 스위트로 커버된다. 이 산출물 자체를
    검증할 신규 테스트가 필요하다고 보지 않는다.
  - 제안: 없음 (정보성 기록).

- **[INFO] — 긍정 확인** RESOLUTION.md(21_58_52, 게이트 6~27행)가 서술한 "테스트가 못 본 이유" + 신규 테스트/뮤테이션 주장을 실제 코드로 대조 확인
  - 위치: `review/consistency/2026/07/25/21_58_52/RESOLUTION.md:8-17,21-27`("client 재throw는 됐지만 handler catch가 다시 삼켰다", "신설: propagate 테스트 + 경계… mut: 가드 제거 → 2 failed")
  - 상세: 실제 저장소를 열어 확인한 결과 —
    - `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:262(inner catch)`·`:368(outer catch)`, `codebase/backend/src/nodes/integration/makeshop/makeshop.handler.ts:259`·`:355` 양쪽 모두 `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 가드가 실제로 존재한다.
    - `cafe24.handler.spec.ts:750`(`rethrows AbortError so the ENGINE can classify the node as cancelled`) + `:780`(`still maps ordinary transport failures to the error port`, 경계 테스트), `makeshop.handler.spec.ts:577`+`:604` 동형 쌍이 실제로 추가돼 있다.
    - 코드 구조상 inner try/catch가 outer try 내부에 중첩돼 있어, `apiClient.call`이 `AbortError`로 reject되는 단일 테스트가 **두 catch 모두**를 관통한다 — inner 가드만 있고 outer 가드가 없으면 재throw된 에러가 outer catch에서 다시 흡수돼 같은 테스트가 실패하므로, "가드 제거 → 2 failed"(cafe24 1건 + makeshop 1건) 주장은 설계상 타당하다.
  - 제안: 없음. 리포트의 테스트 관련 주장이 실측과 일치함을 확인한 결과이며, 후속 리뷰가 이 리포트를 근거로 삼아도 무방하다.

- **[INFO] — 긍정 확인** cross_spec.md(19_13_33, 게이트 55~61행)가 지목한 `http-request.handler.spec.ts`의 커버리지 갭이 실제로 존재함
  - 위치: `review/consistency/2026/07/25/19_13_33/cross_spec.md`(§ "테스트 커버리지 증거" — `http-request.handler.spec.ts:1668` `.resolves.toBeDefined()`) — 참고로 이 발견 문구는 21_58_52 회차의 cross_spec.md 게이트 65~68행에도 재인용됨
  - 상세: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts:1660-1674`을 직접 열어 확인한 결과, "upstream abort fired during fetch cascades to the fetch controller" 테스트는 실제로 `await expect(exec).resolves.toBeDefined()`로 단언한다 — 즉 handler가 `AbortError`를 엔진까지 throw하는지는 전혀 검증하지 않고, "signal이 fetch로 forward된다"만 확인한다. 이는 이번 PR이 cafe24/makeshop에서 고친 것과 **동일 계열의 살아있는 회귀 위험**이며, 여러 checker(cross_spec 3회, convention_compliance)가 독립적으로 "이미 project-planner 후속 plan으로 위임됨"이라 결론짓는데, 실제로 확인해보니 위임 자체는 맞으나 **아직 아무 조치도 되지 않은 상태**다.
  - 제안: 없음(이번 diff 범위 밖) — 다만 후속 세션에서 `http-request.handler.ts`/`text-classifier.handler.ts`의 동일 gap을 처리할 때, 정확히 이번 PR이 채택한 패턴(재throw 가드 + "still maps ordinary transport failures" 경계 테스트 쌍)을 그대로 재사용하면 이번 RESOLUTION과 동일한 회귀 방지 효과를 얻을 수 있음을 참고 삼아 기록.

- **[WARNING]** 리뷰 산출물에 박제된 수치 테스트 결과 주장이 명령/로그 근거 없이 그대로 커밋됨
  - 위치: `review/consistency/2026/07/25/21_58_52/RESOLUTION.md:40`(게이트 40행) — "lint: **PASS** / unit: **PASS**(14) / integration 노드 **345 passed** / build: **PASS** / e2e: **통과**(259)"
  - 상세: 이 파일은 `review/` 하위에 영구 기록으로 남는 산출물인데, 위 통과 개수들이 어떤 명령의 출력에서 나온 것인지 파일 내에 근거(커맨드·로그 발췌)가 없다. 프로젝트 메모리에 이미 "실측했다"가 세 번 틀린 사례(프록시 지표·측정 시점 오차)가 기록돼 있는 만큼, 이런 자기보고 수치가 훗날 다른 세션이 "이미 검증됨"으로 재인용할 근거로 쓰이면 검증되지 않은 확신이 전파될 위험이 있다.
  - 제안: 강제 사항은 아니나, 향후 RESOLUTION/SUMMARY 류 산출물에 테스트 통과 수치를 적을 때는 실행한 명령(예: `pnpm --filter backend test -- cafe24 makeshop`)이나 CI 링크를 한 줄이라도 함께 남기는 관행을 권장.

- **[INFO]** naming_collision.md(21_58_52, 게이트 파일16 "전체 파일 컨텍스트" 절)가 프롬프트 조립 예산으로 62줄 중 10줄만 노출됨
  - 위치: `review/consistency/2026/07/25/21_58_52/naming_collision.md` — 프롬프트의 "전체 파일 컨텍스트" 블록만 10/62줄로 잘림(변경된 코드 unified diff 블록 자체는 62줄 전체가 있음)
  - 상세: 이는 소스 파일 자체의 결함이 아니라 이번 review 하네스가 프롬프트를 조립할 때 발생한 표시상의 절단이다. 실제 파일(`Read` 확인)에는 62줄이 온전히 존재하므로 테스트 리뷰 관점에서 실질적 결함으로 보지 않는다 — 다만 위치 인용 규약과 관련해 게이트 없는 절단 구간이 있다는 점만 기록.
  - 제안: 조치 불요.

## 요약

이번 changeset은 실제 프로덕션 코드가 아니라 consistency-checker 하네스가 생성한 리뷰 산출물(JSON 상태 + 마크다운 리포트) 26건으로 구성돼 있어, 전통적 의미의 "테스트 커버리지"를 요구하는 신규 코드 경로가 없다. 대신 이 문서들이 담고 있는 테스트 관련 주장들을 실제 코드베이스(`cafe24.handler.ts`/`makeshop.handler.ts`와 각 `.spec.ts`, `http-request.handler.spec.ts`)에 대조 확인한 결과, RESOLUTION.md의 "handler가 AbortError를 삼켰다"는 진단과 그 수정(양쪽 catch에 재throw 가드) 및 신규 테스트(propagate 테스트 + 경계 테스트, 뮤테이션으로 "2 failed" 확인)는 모두 실측과 정확히 일치했고, `http-request.handler.spec.ts`의 커버리지 갭 지적도 사실로 확인됐다(단 아직 미조치 상태로 후속 plan에 남아있음). 유일한 경미한 지적은 RESOLUTION.md에 박제된 테스트 통과 개수(unit 14 / integration 345 / e2e 259)가 실행 근거 없이 자기보고 형태로 영구 기록된다는 점이다.

## 위험도
LOW
