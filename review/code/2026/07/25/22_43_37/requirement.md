# 요구사항(Requirement) 리뷰 — review/consistency/2026/07/25/21_58_52/* (6 files)

## 리뷰 범위 메모

본 diff 는 코드가 아니라 `consistency-checker` 산출물 6건(신규 파일)이다. "의도한 기능 충족"
점검은 이 문서들이 (a) 자신이 주장하는 사실관계를 line-level 로 정확히 반영하는지, (b) spec
본문(`spec/conventions/node-cancellation.md`)을 정확히 인용하는지, (c) 첨부된 위험도 라벨이
독자(특히 downstream SUMMARY/게이트)를 오도하지 않는지로 구성했다. 판정을 위해 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/node-cancel-signal-b4d1`)의 실제 소스
(`cafe24.handler.ts`/`makeshop.handler.ts`/`database-query.handler.ts`/`http-request.handler.ts`/
`text-classifier.handler.ts`/`execution-engine.service.ts`/`node-cancellation.md`)와 `git log`
타임스탬프를 직접 대조했다.

## 발견사항

- **[WARNING]** convention_compliance.md·cross_spec.md 의 핵심 **[CRITICAL]** 판정("Cafe24/MakeShop
  핸들러가 client 의 재-throw `AbortError` 를 다시 삼켜 §5.1 `cancelled` 분류가 도달 못 함")이
  이번 diff 를 커밋하는 시점(리뷰 대상 시각 이후) 기준으로는 **이미 해소되어 stale** 하다
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:12-17`(CRITICAL 본문),
    `:37`(위험도 HIGH) / `review/consistency/2026/07/25/21_58_52/cross_spec.md:17-85`(CRITICAL
    본문), `:120`(위험도 CRITICAL)
  - 상세: 두 checker 는 21:58:52 시점 코드 상태(`cafe24.handler.ts`/`makeshop.handler.ts` 의
    `catch` 가 `mapClientErrorToOutput` 을 무조건 호출)를 정확히 짚었다 — **생성 당시엔 참**이었다.
    그러나 그 22분 뒤 커밋 `0cfd547a8`("fix(nodes): handler 가 AbortError 를 삼켜 cancelled
    분류에 도달하지 못하던 문제", 2026-07-25 22:18:27)이 정확히 이 결함을 고쳤다. 워크트리에서
    직접 확인: `cafe24.handler.ts` inner catch(L262-274)·outer catch(L358-370), `makeshop.handler.ts`
    inner catch(L249-261)·outer catch(L345-357) 모두 `if (err instanceof Error && err.name ===
    'AbortError') { throw err; }` 가드가 `mapClientErrorToOutput` 호출 **이전에** 존재하며,
    주석이 "node-cancellation.md §5.1 … Same shape as `database-query.handler.ts`" 를 명시
    인용한다. 대응 테스트도 확인: `cafe24.handler.spec.ts:750`·`makeshop.handler.spec.ts:577`
    "rethrows AbortError so the ENGINE can classify the node as cancelled". 독립적으로, **이후
    실행된 fresh consistency-check 라운드**(`review/consistency/2026/07/25/22_28_51/SUMMARY.md`,
    22:28:53, `BLOCK: NO`, 전체 위험도 MEDIUM)의 INFO #5 가 "직전 라운드(21_58_52) CRITICAL …
    이후 커밋(`0cfd547a8`)으로 해소 확인, 인용 선례(`database-query.handler.ts`)도 실사로 진위
    확인됨" 이라고 명시적으로 기록했고, 같은 폴더의 `RESOLUTION.md`(22:28, 본 target 파일 목록
    밖)도 해소 경위를 상세히 남겼다. 즉 시스템 자체(consistency-check → fix → 재검증)는 올바르게
    닫혔다. 문제는 이번 review 세션(`review/code/2026/07/25/22_43_37/`)에 전달된 target 파일
    목록이 21_58_52 폴더의 6개 checker 산출물만 포함하고 그 뒤의 22_28_51 라운드나 RESOLUTION.md
    를 포함하지 않는다는 점이다 — 이 6개 파일만 놓고 보면 문서 하단에 "위험도: HIGH"/"위험도:
    CRITICAL" 이 그대로 박혀 있어, 이 changeset 만 소비하는 자동 게이트나 사람이 "이 PR 은 아직
    CRITICAL 미해소" 로 오판할 위험이 있다(nested-ISO 타임스탬프 폴더는 이 저장소에서 불변
    스냅샷으로 설계된 것이므로 문서 자체의 결함은 아니다 — 다만 소비 시점의 컨텍스트 누락 위험).
    참고로 `mapClientErrorToOutput` 실제 시작 줄은 현재 518행이나 convention_compliance.md 는
    "494–559행"으로 인용한다 — 이는 오류가 아니라 이후 가드 삽입으로 코드가 24줄 밀린 결과이며,
    문서가 스냅샷 당시 줄번호를 정확히 기록했다는 방증이다.
  - 제안: 코드 수정 불필요(이미 해소됨). SUMMARY 통합 단계(`review/code/2026/07/25/22_43_37/`)가
    이 두 파일의 위험도 라벨을 그대로 상위로 전파하기 전에 `review/consistency/2026/07/25/
    22_28_51/SUMMARY.md`(BLOCK:NO) 및 `review/consistency/2026/07/25/21_58_52/RESOLUTION.md` 를
    교차 참조해 "이미 해소됨"으로 주석을 달 것을 권고.

- **[WARNING]** convention_compliance.md 의 **[WARNING]**(plan frontmatter `worktree: (unstarted)`
  sentinel 방치) 및 plan_coherence.md 의 동일 취지 **[INFO]** 도 같은 이유로 stale
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:19-23` /
    `review/consistency/2026/07/25/21_58_52/plan_coherence.md:26-30`
  - 상세: 두 문서 모두 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 의
    `worktree:` 가 여전히 `(unstarted)` 라고 지적한다 — 21:58:52 시점엔 정확했다. 그러나 커밋
    `f575671fc`(22:19:24, "docs(plan): §6 승격 조건 명시 + 기존 ✓ 행 재검증 위임")가 같은 diff
    hunk 에서 `worktree: (unstarted)` → `worktree: node-cancel-signal-b4d1` 로 교체했다(워크트리
    직접 확인: 현재 frontmatter `worktree: node-cancel-signal-b4d1`). 위 CRITICAL 항목과 동일한
    "생성 당시엔 정확, 소비 시점엔 stale" 패턴.
  - 제안: 조치 불필요(이미 해소됨). 첫 번째 발견사항과 동일한 SUMMARY 교차참조 권고 적용.

- **[INFO]** convention_compliance.md 의 **[INFO]**(cafe24 fixture path `product`→`products` 미통일,
  `cafe24-api.client.spec.ts:285`)는 지금도 유효 — 재확인 결과 여전히 미수정
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:25-29`
  - 상세: 워크트리에서 `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:285`
    를 직접 Read 해 확인 — 지금도 `await client.call(integration, { method: 'GET', path: 'product'
    });`(단수)로 남아 있다. 참고로 target 목록 밖의 `review/consistency/2026/07/25/21_58_52/
    RESOLUTION.md`(INFO2)는 "재확인 결과 이미 0건(직전 통일 작업에 포함돼 있었다)"이라 주장하는데
    이는 실측과 어긋난다 — 즉 convention_compliance.md 의 이 INFO 판단이 옳았고 지금도 유효하며,
    오히려 그 이후 작성된 RESOLUTION.md 쪽이 사실관계 오류를 새로 만들었다(본 target 파일 범위
    밖이라 이번 리포트에서는 참고 사실로만 기록).
  - 제안: 없음(이미 적절한 INFO). 다만 RESOLUTION.md 의 INFO2 claim 은 별도로 정정 필요(범위 밖).

- **[INFO]** meta.json·naming_collision.md·rationale_continuity.md 는 확인된 discrepancy 없음
  - 위치: `review/consistency/2026/07/25/21_58_52/meta.json` 전체, `naming_collision.md` 전체,
    `rationale_continuity.md` 전체
  - 상세: meta.json 의 `checkers[]` 5종은 `.claude/skills/consistency-checker/SKILL.md` 의 5-checker
    key 목록과 일치. naming_collision.md 의 "spec/conventions/ diff 0" 및 `signal` 필드 재사용
    claim 은 `git diff origin/main -- spec/conventions/` 실측(0 라인) 및 `node-cancellation.md §4`
    예시 코드 대조로 확인됨. rationale_continuity.md 의 §5.1 인용("`error.name === 'AbortError'`
    인 throw 는 노드가 실패한 것이 아니라 중단된 것")은 `spec/conventions/node-cancellation.md`
    §5.1 원문과 축자 일치. `NodeEventType.NODE_CANCELLED = 'execution.node.cancelled'`
    (`websocket.service.ts:176`)도 두 checker 가 인용한 WS 이벤트명과 정확히 일치.
  - 제안: 없음.

## 요약

리뷰 대상 6개 파일(consistency-checker 산출물)은 **생성 시점(2026-07-25 21:58:52) 기준으로는
모두 사실관계가 정확**했고 spec 인용(§5.1 원문, §6 표, WS 이벤트명)도 line-level 로 정확했다.
그러나 그 핵심 CRITICAL(handler 가 재throw 된 `AbortError` 를 삼켜 §5.1 `cancelled` 분류가
불가능해짐)과 WARNING(plan frontmatter worktree sentinel 방치)은 각각 커밋 `0cfd547a8`(22:18)·
`f575671fc`(22:19)로 이미 해소되었고, 후속 consistency-check 라운드(22:28:51, BLOCK:NO)가
이를 독립적으로 재확인했다 — 즉 검토→수정→재검증 루프 자체는 이 저장소의 워크플로대로 올바르게
닫혔다. 다만 이번 리뷰 세션에 전달된 target 파일 목록이 그 후속 라운드/RESOLUTION.md 를 포함하지
않아, 이 6개 파일만 단독으로 소비하면 "위험도: HIGH/CRITICAL" 라벨이 아직 미해소인 것처럼 오독될
위험이 남는다. 유일하게 지금도 유효한 실행 가능 항목은 fixture path `product`→`products` 통일
INFO 하나뿐이며, 그 문서 자체의 기능(정확한 스냅샷 기록)은 완전하다.

## 위험도

MEDIUM
