# 문서화(Documentation) Review

대상: docs-guard walker 통합 PR (`tree-walk.ts` 신설 + 5개 수집기 전환 + Gate C 함수 이동 + plan
완료 서술). 지시대로 주석·commit·plan 의 "검증 가능한 주장"을 전부 실측으로 대조했다. 재현
스크립트는 리뷰 종료 후 삭제했다(저장소 파일 미수정 원칙 준수 — 신규 스크래치 파일도 실행 후 제거).

## 실측 결과 요약 (참/거짓)

| # | 주장 | 위치 | 실측 | 판정 |
|---|---|---|---|---|
| 1 | "손수 짠 DFS 여섯 벌" | `tree-walk.ts:5` | diff 로 walker 5개(walkPlanMarkdown·collectSpecMarkdown·collectCodebaseSources·collectApplicableSpecs·collectMdxFiles) 전환 확인 + `globMatchesAny`(spec-frontmatter-parse.ts) 는 손대지 않은 채 남아 있음(6번째, 의도적 제외) — **6개 합산 정확** | 참 |
| 2 | `plan-scan.ts` 는 `_` 접두를 파일명에, `impl-anchor-parse.ts` 는 디렉터리명에 | `tree-walk.ts:9-11` | `plan-scan.ts`: `isLifecyclePlan(e.name)` — 파일명. `impl-anchor-parse.ts`: `skipDir: (name) => name.startsWith("_")` — 디렉터리명(`entry.isDirectory()` 분기에서만 호출됨) | 참 |
| 3 | codebase 소스 2077개 · `"]("` 35개(1.7%) | `spec-links.ts:94` | 직접 재현 스크립트로 `CODEBASE_SOURCE_ROOTS`+`CODEBASE_SKIP_DIRS` 그대로 순회: **2077개**, `"]("` **35개(1.7%)** — 정확히 일치 | 참 |
| 4 | `"]\`"` 만 211개 → 통과 246개(11.8%) | `spec-links.ts:94` | 재현: `"]\`"`-only **212개**, 합집합(통과) **247개(11.89%)** — **1건 차이** (아래 상세) | 근접하지만 부정확 |
| 5 | 전수 스캔 114ms → 56ms | `spec-links.ts:104` | 재현(동일 파일셋, 3회 평균): 사전필터 없음 **~64ms**, 있음 **~21ms** — 절대값·배율(약 2x 주장 vs 실측 ~3x) 모두 재현 안 됨(하드웨어 의존) | 재현 불가(환경 의존) |
| 6 | 집합 대조 `spec 134·codebase 2075(+1)·live 36·complete 378·applicable 130·mdxGuide 92·mdxIntegrations 24` | commit `75f2e2af9` 본문 + plan `:161-165` | 현재 구현으로 재현: spec **134**, live **36**, complete **378**, applicable **130**, mdxGuide **92**, mdxIntegrations **24** 전부 일치. **codebase 만 2077**(주장 2076) | codebase 항목만 부정확 (아래 상세) |
| 7 | "외부 소비처 0건"(Gate C 함수 이동) | commit `6002603e1` + plan `:195-197` | `from "./plan-scan"` import 전수 grep — `spec-links.ts`(`collectLivePlanMarkdown`만)·`spec-plan-completion.test.ts`·`plan-frontmatter.test.ts`(Gate C 함수 미포함)·`spec-frontmatter-parse.ts`(`matterNoCache`만)·`plan-scan.test.ts`. Gate C 8개 함수 import 하는 곳 0건 | 참 |
| 8 | `danglingSpecImpact`→`findDanglingSpecImpact` 개명, 잔존 참조 0건 | plan `:95-100` | `.ts` 전수 grep — 코드 내 잔존 0건(plan 문서·리뷰 산출물의 서술적 언급만 남음) | 참 |
| 9 | 뮤테이션 6종 RED (표) | plan `:199-209` | 세 커밋 메시지의 부분 합(3+2+1=6)과 정확히 일치, 최종 pass 수 `2893`·타입 오류 `0`·lint 신규 `0`(잔여 3건 `_` 접두)까지 직접 재현(`vitest run`/`tsc --noEmit`/`eslint`) | 개별 뮤테이션 자체는 재실행 안 함(추적 파일 수정 금지 제약), 나머지 정황 전부 일치 |
| 10 | `plan-scan.ts` 헤더 "네 벌 → 하나" | `plan-scan.ts:15-25` | 이 PR 의 diff 가 해당 라인을 건드리지 않음(헤더는 이전 PR 시점 그대로) | 아래 §5 참조 |

## 발견사항

- **[WARNING]** `"2075 → 2076"` 집합-대조 수치가 실제로는 `2075 → 2077` 이어야 한다 — "조용한
  스코프 변경 0건"을 **정확한 카운트로 증명**한다고 주장하는 바로 그 숫자가 틀렸다.
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:161-165` (동일 문구가 commit
    `75f2e2af9` 본문에도 있음 — "유일한 차이는 새로 만든 `tree-walk.ts` 자신이 codebase 수집에
    들어온 것뿐(2075 → 2076)")
  - 상세: `git ls-tree -r --name-only <parent>` 로 부모 커밋의 `codebase/{backend,frontend,
    channel-web-chat}/src`+`packages` 하위 `.ts`/`.tsx`(스킵 디렉터리 제외) 개수를 세면
    **2075**, 통합 커밋(`75f2e2af9`) 자체를 세면 **2077** 이다. 그 커밋은 `tree-walk.ts` 와
    `tree-walk.test.ts` 를 **같이** 새 파일로 추가했는데(둘 다 `codebase/frontend/src` 하위라
    `collectCodebaseSources` 의 `.ts` 필터에 둘 다 걸린다), 서술은 "새로 만든 `tree-walk.ts`
    자신"만 언급해 `tree-walk.test.ts` 몫 1개를 빠뜨렸다. 실제로 `tree-walk.ts` 자체 주석에도
    `` `collectCodebaseSources(): SpecMdFile[]` `` 처럼 `]`` 패턴이 있어 이후 스캔 통계
    (아래 항목)에도 영향을 준다.
  - 제안: `2075 → 2077`(+2: `tree-walk.ts`+`tree-walk.test.ts`)로 정정. 이 PR 이 스스로
    "조용한 스코프 변경 여부는 개수가 아니라 집합으로 봐야 한다"고 강조한 만큼, 개수 서술 자체의
    정확성도 같은 기준으로 지켜야 한다.

- **[INFO]** `extractLinks` 사전 필터 JSDoc 의 실측 수치가 현재 트리 기준 1건씩 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:94`
    (`실측(codebase 소스 2077개): "](" 35개(1.7%) · "]\`" 만 211개 → 통과 246개(11.8%).`)
  - 상세: 동일 로직으로 재현하면 `"]\`"`-only **212개**, 합집합(필터 통과) **247개(11.89%)**.
    총 파일수(2077)·`"]("` (35/1.7%)는 정확히 일치하지만 `246`/`211`/`11.8%` 만 1씩 밀린다.
    원인은 위 항목과 같다 — `tree-walk.ts:33` 자신의 주석에 `` `collectCodebaseSources():
    SpecMdFile[]` `` 형태로 `]\`` 패턴이 들어 있어, 이 파일이 추가된 시점 이후 재기 시작하면
    +1이 생긴다. 이 PR 의 세 커밋 순서(walkTree 신설 → prefilter 추가)를 보면 실측 자체는
    `tree-walk.ts` 존재 상태에서 이뤄졌어야 하는데 실제로는 그 전 스냅샷 숫자가 그대로 굳어진
    것으로 보인다.
  - 제안: 사소한 오차(±1, 0.1%p)라 동작에 영향은 없다. 다음에 이 주석을 손댈 일이 생기면
    `211/246/11.8%` → `212/247/11.9%` 로 정정 권장. CRITICAL 로 올릴 사안은 아니다.

- **[INFO]** `"전수 스캔 114ms → 56ms(실측)"` 이 하드웨어 의존적 절대 수치라 이 리뷰 환경에서
  재현되지 않는다(사전 필터 없음 ~64ms, 있음 ~21ms — 방향성·큰 폭의 개선은 동일하게 재현됨).
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:104`
  - 상세: 배율도 주장(약 2.0x)과 실측(약 3x) 이 다르다. 코드 주석에 "실측" 이라고 박제된 절대
    시간값은 원저자의 머신·부하 상태에 종속적이라 향후 다른 환경에서 재현 시도 시 오해를
    부를 수 있다. 이 저장소가 "실측 근거"를 신뢰의 근거로 자주 쓰는 만큼, 시간 값보다는
    "몇 배" 같은 상대적 서술이나 "환경에 따라 다름" 단서가 더 안전하다.
  - 제안: 선택 사항. 급하지 않음 — 성능 리뷰어 소관과도 겹치므로 문서화 관점에서는 INFO 로만
    남긴다.

- **[WARNING]** plan 문서가 "13개 항목 전부 처리"·"완료" 섹션까지 서술하며 체크박스 13/13 이
  전부 `[x]` 인데도 `plan/complete/` 로 이동하지 않고 `plan/in-progress/` 에 남아 있고
  frontmatter `status` 도 `in-progress` 그대로다.
  - 위치: `plan/in-progress/docs-guard-walker-dedup.md:6`(`status: in-progress`),
    `:143`(`## 완료 (2026-08-11, ...)` 섹션 시작), 체크박스 전수(`grep -c '\[x\]'` = 13,
    `\[ \]` 잔존 0건, "TODO"/"결정 필요"/"다음 단계" 잔존 0건)
  - 상세: `.claude/docs/plan-lifecycle.md §3`("이동은 마지막 작업 PR 안에서: 모든 체크박스
    `[x]` + 미해결 follow-up 0건이 되는 PR 안에 `chore(plan): mark <name> complete` 형태의
    별 commit으로") 및 §5 자가 점검 체크리스트(spec_impact 선언·status 종료값 갱신·commit
    메시지 포맷)와 현재 상태가 어긋난다. `spec_impact: none` 은 이미 선언돼 있으나 `status` 는
    종료 어휘(`complete`/`implemented`/`applied`/`superseded`)로 안 바뀌었고 파일도 그대로
    `in-progress/` 에 있다. push 게이트(`guard_review_before_push.py`)는 "같은 경로 수정"만
    봐도 통과하므로 이 상태로도 차단되진 않지만, Stop 훅의 "complete/ 로 이동" 넛지가 이미
    한 번 발화했을 가능성이 높고, 문서 서술("완료")과 실제 라이프사이클 위치가 불일치한다.
  - 제안: 이 PR 의 마지막 커밋에서 `git mv plan/in-progress/docs-guard-walker-dedup.md
    plan/complete/docs-guard-walker-dedup.md` + frontmatter `status: complete` 갱신 +
    `chore(plan): mark docs-guard-walker-dedup complete` 커밋 분리, 또는 아직 후속 작업이
    남아 있다면(예: `SpecMdFile` 잔존 참조 정리 등) "완료" 대신 "진행 메모"로 절 제목을
    낮추고 남은 항목을 명시.

- **[INFO]** `plan-scan.ts` 헤더 주석("스캔 소스가 하나여야 하는 이유" 절)이 이 PR 에서 갱신되지
  않았다 — 사실관계는 여전히 참이지만 이 PR 의 더 넓은 통합을 반영하지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:15-25`
  - 상세: "`plan/` 트리를 손으로 순회하는 walker 가 저장소에 **네 벌** 있었고 ... **그 네 벌이
    이 구현 하나로 모였다**"는 서술은 (이전 PR `plan-lifecycle-gates` 가 이미 확정한) plan-tree
    전용 4-walker 통합을 가리키는 것으로, 이 PR 의 diff 가 이 라인을 건드리지 않았다(hunk
    시작이 27번째 줄 `import fs`부터). 문장 자체는 지금도 거짓이 아니다 — `walkPlanMarkdown`
    은 여전히 plan 트리 수집의 단일 진입점이고, live/complete 파생·Gate C 위임도 그대로다.
    다만 괄호 안 "`spec-links.ts` 에도 손수 순회하는 walker 가 둘 있지만 ... 별 문제이고,
    통합 판정은 `docs-guard-walker-dedup.md` 에 등재했다"는 이제 이 PR 로 그 "별 문제"가
    바로 `walkPlanMarkdown` 자신을 포함해 여섯 벌 전부 `tree-walk.ts` 로 흡수됐다는 사실을
    반영하지 않은 채 남아 있다. 이 저장소가 반복해서 겪은 "고친 문장의 자매 문장이 안 고쳐진다"
    패턴의 경계선상 사례이지만, **팩트가 거짓이 되지는 않았으므로** WARNING 이 아니라 INFO 로
    내린다.
  - 제안: 다음에 이 헤더를 손댈 때 "이후 `docs-guard-walker-dedup` PR 에서 `walkPlanMarkdown`
    자체도 `tree-walk.ts` 의 공용 `walkTree` 로 전환됐다" 한 줄 각주 추가 권장.

- **[INFO]** `spec-links.ts` 가 `SpecMdFile` 을 `@deprecated`(→`MdFileRef` 권장)로 선언하면서도
  같은 파일의 내부 함수 시그니처는 여전히 `SpecMdFile` 을 쓴다 — 자기 파일 내 자기모순.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:196`
    (`function findBrokenLinksInFiles(files: SpecMdFile[], ...)`) vs 같은 파일
    `:141-149` 의 `@deprecated` JSDoc
  - 상세: 이 PR 의 diff 는 `collectSpecMarkdown`/`collectCodebaseSources` 반환 타입만
    `MdFileRef[]` 로 바꾸고 `findBrokenLinksInFiles` 의 파라미터 타입은 손대지 않았다.
    `SpecMdFile = MdFileRef` 타입 별칭이라 동작에 영향은 없지만, 방금 "신규 코드는 `MdFileRef`
    를 쓴다"고 못박은 파일 안에서 비공개 헬퍼가 예외로 남는 모양새다.
  - 제안: 사소함. 이후 이 함수를 손댈 일이 있으면 `MdFileRef[]` 로 함께 정리해도 좋다.

- **[없음/참]** 아래는 실측으로 **참**임을 확인해 지적 사항이 아니다(리뷰 신뢰도 근거로 남김):
  `.claude/docs/plan-lifecycle.md:131-132` 의 "판정은 `hasValidSpecImpact` 다(`plan-scan.ts`
  — 게이트 자체는 `spec-plan-completion.test.ts`)" 정정은 정확하고, `spec/conventions/
  spec-impl-evidence.md` §4.2 표(`:132-133`)·`code:` 등재(`:11,15`) 모두 이 이동과 모순되지
  않는다(게이트/SoT 표가 가리키는 파일이 실제로 안 바뀌었으므로). `plan-scan.ts` 로 옮긴 8개
  Gate C 함수의 외부 소비처 0건 주장도 import 전수 grep 으로 확인된다.

## 요약

문서·주석·commit·plan 서술 대부분이 실측과 정확히 일치했다(파일 수 2077, `"]("` 35/1.7%, 집합
대조 6개 중 5개 완전 일치, 외부 소비처 0건, 개명 잔존 0건, `2893 passed`/타입 오류 0/lint 신규
3건까지 전부 재현). 다만 이 PR 이 "조용한 스코프 변경이 없다"는 것을 **정확한 카운트**로 증명하려
한 바로 그 숫자(`2075→2076`)가 실제로는 `2075→2077`(파생 통계인 `246/211/11.8%` 도 같은 원인으로
1씩 밀림)이라 자기 증명의 정밀도가 스스로 세운 기준에 못 미친다. 더 실질적인 것은 plan 문서가
"완료"를 서술하고 체크박스 13/13 이 전부 닫혔는데도 `plan/complete/` 로 이동되지 않고
`status: in-progress` 로 남아 있는 라이프사이클 불일치다 — push 를 막지는 않지만 이 저장소의
plan-lifecycle 규약과 직접 어긋난다. 코드 자체(주석 정확성·JSDoc·설계 근거 서술)의 품질은 높고,
새로 발견된 CRITICAL 은 없다.

## 위험도

LOW

STATUS: OK
