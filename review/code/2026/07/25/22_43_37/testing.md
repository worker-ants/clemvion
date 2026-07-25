# 테스트(Testing) 리뷰 — review/consistency/2026/07/25/21_58_52/*

## 리뷰 범위에 대한 메모

이번 diff 는 소스 코드가 아니라 **consistency-checker 산출물(markdown 리뷰 문서 5건 + meta.json)**
이다. 따라서 "이 markdown 파일 자체에 대한 단위 테스트"는 해당 사항이 없다. 대신 이 문서들의
**본문이 실제 코드의 테스트 커버리지에 대해 구체적 주장(claim)을 하고 있으므로**, 그 주장이
현재 워킹트리(`node-cancel-signal-b4d1`) 상태와 부합하는지를 `Read`/`grep`/`jest` 실행으로
직접 실측 검증했다. 아래 발견은 그 결과다.

## 발견사항

- **[INFO]** `convention_compliance.md`/`cross_spec.md` 의 CRITICAL("handler 가 client 의
  재-throw `AbortError` 를 다시 삼켜 §5.1 `cancelled` 분류가 관측 불가")은 **작성 시점(21:58:52)
  기준으로 정확했고, 같은 커밋(`3b075dd5c`)에 동봉된 `RESOLUTION.md` 로 이미 완전히 해소됨** —
  이중 카운트 방지를 위해 기록
  - 위치: `review/consistency/2026/07/25/21_58_52/convention_compliance.md:12` (CRITICAL 헤더),
    `review/consistency/2026/07/25/21_58_52/cross_spec.md:17` (CRITICAL 헤더)
  - 상세: 직접 실측한 결과 —
    1) `codebase/backend/src/nodes/integration/cafe24/cafe24.handler.ts:272,368` 및
       `.../makeshop/makeshop.handler.ts:259,355` 에 inner/outer catch 양쪽 모두
       `if (err instanceof Error && err.name === 'AbortError') { throw err; }` 가드가 이미
       존재함 (`git log` 상 커밋 `0cfd547a8` "fix(nodes): handler 가 AbortError 를 삼켜
       cancelled 분류에 도달하지 못하던 문제", 2026-07-25 22:18:27 — 즉 21:58:52 컨시스턴시
       체크 **직후**, 22:43:37 이 리뷰 시작 **이전**).
    2) 양 handler.spec.ts 에 `describe('abortSignal forwarding (node-cancellation §4)')` 아래
       "rethrows AbortError so the ENGINE can classify the node as cancelled" 테스트가 신설되어
       `apiClient.call.mockRejectedValue(AbortError)` → `handler.execute(...).rejects.toMatchObject({name:'AbortError'})`
       를 직접 단언하며, 대응 경계 테스트("still maps ordinary transport failures to the error
       port")도 함께 있어 일반 실패와 취소를 혼동하지 않음을 검증한다.
    3) `npx jest cafe24.handler.spec.ts -t "abortSignal forwarding"` / 동일 makeshop 커맨드를
       직접 실행 — 양쪽 모두 **4 passed** 로 통과 확인.
    4) 동봉된 `review/consistency/2026/07/25/21_58_52/RESOLUTION.md` 도 "가드 제거 → mutation
       2 failed" 로 이 회귀 테스트가 vacuous 하지 않음을 자체 검증했다고 기록.
    이 CRITICAL 은 이번 diff(문서 추가) 시점에는 **이미 닫힌 상태**이며, 리뷰 프로세스가
    "문제 발견 → 같은 라운드 내 수정 → mutation 으로 재발 방지 테스트 고정"까지 제대로
    완주한 좋은 사례다. 다만 하위 SUMMARY 집계 시 이 CRITICAL 이 "현재도 열려 있는 결함"으로
    오집계되지 않도록 참고할 것.
  - 제안: 조치 불필요(확인 목적 기록).

- **[WARNING]** 같은 커밋에 동봉된 `RESOLUTION.md` 의 INFO2("cafe24 fixture path 잔존 —
  재확인 결과 이미 0건")가 사실과 다름 — 실제로는 여전히 1건 남아 있음. 동일 사안에 대해
  이번이 두 번째로 반복되는 "이미 고쳤다"는 부정확한 claim
  - 위치: `review/consistency/2026/07/25/21_58_52/RESOLUTION.md` "INFO2" 행(내가 assigned 받은
    6개 파일에는 포함되지 않은 같은 디렉토리·같은 커밋의 동반 문서이므로 게이트 번호 없이
    직접 경로로 인용 — `Read` 로 직접 확인, 4번째 줄 부근 표 안 `| INFO2 | cafe24 fixture path
    잔존 — 재확인 결과 이미 0건(직전 통일 작업에 포함돼 있었다) |`) vs
    `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts:285`
    (`await client.call(integration, { method: 'GET', path: 'product' });`)
  - 상세: `grep -n "path: 'product'" cafe24-api.client.spec.ts` 실행 결과 285행 1건이 여전히
    존재한다(단수형). 내가 assigned 받은 `convention_compliance.md` 자신의 INFO 파인딩(25~29행)은
    바로 이 동일한 라인을 정확하게 지적하고 있었다(그 문서가 인용한 대상은 다른 RESOLUTION —
    `review/code/2026/07/25/21_35_11/RESOLUTION.md` — 이었다). 그런데 이번에 **두 번째**
    RESOLUTION 문서(`review/consistency/2026/07/25/21_58_52/RESOLUTION.md`)가 또다시 "이미
    0건"이라고 잘못 기록했다 — 같은 잘못된 claim 이 반복 재생산되는 패턴이다. 기능적으로는
    무해하다(해당 테스트가 `path` 값 자체를 단언하지 않으므로 pass/fail 에 영향 없음)는 점은
    convention_compliance.md 의 원 판단과 동일하다.
  - 제안: `cafe24-api.client.spec.ts:285` 의 `path: 'product'` 를 `path: 'products'` 로
    통일하거나(1줄 수정으로 완전히 해소 가능), 향후 RESOLUTION 작성 시 "재확인"을 실제
    `grep` 실행 결과로 검증한 뒤 기록할 것 — 리뷰 산출물이 스스로 "확인했다"고 쓴 내용이
    반복해서 틀리면 RESOLUTION 문서 전반의 신뢰도가 떨어진다.

- **[INFO]** `naming_collision.md`/`plan_coherence.md`/`rationale_continuity.md` 는 테스트
  관점에서 특기할 결함 없음
  - 상세: `naming_collision.md` 는 신규 `signal?: AbortSignal` 필드가 §4 기존 패턴의 자연스러운
    확장이라는 판단이 실측(grep 0건)과 일치하고 테스트 커버리지 주장이 없다.
    `plan_coherence.md`/`rationale_continuity.md` 는 spec/plan 정합성 관점 문서로 테스트
    커버리지에 대한 직접 주장을 포함하지 않는다(§6 표 staleness, worktree frontmatter sentinel
    등은 이미 해소되었음을 위 첫 항목에서 확인한 `RESOLUTION.md` W1 로 재확인 —
    `plan/in-progress/node-cancellation-residual-signal-propagation.md` frontmatter 는 현재
    `worktree: node-cancel-signal-b4d1` 로 정상화돼 있음).
  - 제안: 없음.

## 요약

이번 diff 는 소스 코드가 아니라 consistency-checker 가 생성한 리뷰 markdown 5건 + meta.json 이라
전통적 "테스트 존재/커버리지/mock/격리" 체크리스트가 문서 자체에는 적용되지 않는다. 대신 문서가
주장하는 테스트 커버리지 갭(핸들러가 client 의 재-throw `AbortError` 를 삼켜 §5.1 `cancelled`
분류가 관측되지 않는다는 CRITICAL)을 실제 코드·테스트·`jest` 실행으로 직접 검증한 결과, 그
주장은 작성 시점엔 정확했고 같은 커밋에 동봉된 RESOLUTION 으로 이미 완전히 고쳐졌으며(handler
양쪽 catch 가드 추가 + 신규 propagate/경계 테스트 2건 + mutation 검증, `npx jest -t
"abortSignal forwarding"` 4 passed 실측 확인) 이중 카운트할 필요가 없다. 다만 그 RESOLUTION
문서 자신의 INFO2 항목("cafe24 fixture path 이미 0건")은 실측 결과 거짓이다 —
`cafe24-api.client.spec.ts:285` 에 `path: 'product'`(단수) 가 여전히 1건 남아 있으며, 이는
동일 이슈에 대해 두 번째로 반복되는 부정확한 "이미 해결됨" claim 이다. 기능적 영향은 없으나
리뷰 산출물의 자기-검증 신뢰도 문제로 WARNING 처리한다.

## 위험도

LOW
