# 변경 범위(Scope) 검토 — 워크플로우 duplicate nodes/edges 복사 fix (fresh review, resolution 반영 후)

## 검토 방법

`git diff --stat origin/main...HEAD`(42개 파일)로 prompt 번들과 실제 diff 전체가 일치함을 확인했다.
직전 라운드(`review/code/2026/07/30/17_54_27/scope.md`)가 이미 원 구현(23개 파일, 커밋
`f71839fe6`→`0502e43c7`→`13b818ec5`→`539bbf7fd`)을 NONE 등급으로 검토했으므로, 본 라운드는 그 이후
추가된 **resolution 라운드**(커밋 `a7ab2750a`→`0cb0ac86d`→`6d3595319`→`e782bb829`→`d98acd850`→
`8783c63d8`→`e66bbb9c1`→`e6c6322f4`→`0ab87ac3f`→`f404d7a5a`→`806a156e9`, 총 11커밋)를 중점적으로
`git show <sha>`로 각각 전문 대조했다. `git diff origin/main...HEAD -- codebase/backend/src/modules/workflows/workflows.service.ts | grep '^@@'`
로 이 파일의 전체 hunk 위치도 재확인했다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 전부 0건). 아래는 검토 완결성을 위한 확인 내역이다.

## 점검 관점별 확인 내역

1. **의도 이상의 변경** — 없음. resolution 라운드 11개 커밋 전부가 `review/code/2026/07/30/17_54_27/SUMMARY.md`
   의 WARNING #1~#7(및 요청받은 INFO #4/#5/#7) 항목과 1:1 대응하며, 각 커밋 메시지에 대응 SUMMARY 번호가
   명시돼 있다(`SUMMARY#1`~`SUMMARY#7`). `RESOLUTION.md`·`_resolution_log.md`·`_resolution_state.json`의
   커밋 해시가 실제 `git log` 해시와 정확히 일치함을 대조 확인했다. `plan/in-progress/workflow-duplicate-nodes-edges.md`
   체크리스트 갱신(`0ab87ac3f`)도 "`/ai-review` + Critical/Warning fix" 항목 완료 표기뿐, 다른 항목을
   임의로 체크하거나 새 작업 항목을 추가하지 않았다.
2. **불필요한 리팩토링** — 경계선상이나 위반 아님. `d98acd850`(e2e C 케이스 5노드 payload를
   `buildFiveNodeGraphPayload()` 헬퍼로 추출, 183→109줄)은 리팩토링이지만 `maintainability.md` WARNING이
   명시적으로 요청한 조치이고, diff 전문 대조 결과 순수 코드 이동(로직·값 변경 없음)이었다 — 추출 후
   `nTrig`/`nLoop`/`nHttp`/`nAgent`/`nTool` 잔여 참조가 헬퍼 밖에 남지 않았음을 grep 으로 확인. `6d3595319`
   (Node/Edge row 조립 상호참조 주석)는 `duplicate()` 범위 밖의 `importWorkflow()`/`syncNodes()`/`syncEdges()`
   3곳도 함께 건드리지만, `git diff -- workflows.service.ts | grep '^@@'` 로 확인한 결과 그 3곳에는 **순수
   주석 2줄 추가**(로직 변경 0)만 있다 — `maintainability.md` WARNING #3 이 "최소한 상호 참조 주석만이라도"
   라고 명시적으로 제안한 범위와 정확히 일치한다.
3. **기능 확장(over-engineering)** — 없음. resolution 라운드는 리뷰가 발견한 결함(read skew, 테스트 오염,
   mutation 사각지대)을 고치거나 리뷰가 요청한 문서화(주석, CHANGELOG, user-guide)를 추가했을 뿐, 신규
   기능·API·설정을 도입하지 않았다.
4. **무관한 수정** — 없음. 42개 변경 파일 전부가 이 task 하나로 추적된다: 코드 4개(controller/service/
   service.spec/e2e-spec, `duplicate()` 표면 + 요청된 3곳 주석), 문서 2개(CHANGELOG, 요청 WARNING #6),
   user-guide 2개(ui-tour ko/en, 요청 WARNING #7), plan 1개, spec 2개, 나머지 31개는 이 저장소가 SDD
   워크플로에서 의무화한 code-review(`review/code/17_54_27/**` 14개 + RESOLUTION/log/state 3개)·
   consistency-check(`review/consistency/{16_45_59,17_03_26}/**` 14개) 산출물이다 — CLAUDE.md 가 명시한
   저장 위치 규약과 정확히 일치하며 review 폴더는 gitignore 대상이 아니다.
5. **포맷팅 변경** — `e6c6322f4`는 직전 커밋(`0cb0ac86d`)이 방금 추가한 코드 한 줄의 줄바꿈만 조정하는
   순수 prettier 자동수정이며, 그 외 무관한 위치의 포맷팅 변경과 섞여 있지 않다(diff 3줄, 해당 블록 내부
   한정).
6. **주석 변경** — `6d3595319`(상호참조 주석 3곳)·INFO #4(자기참조 표현 정밀화: "본 파일 하단" →
   "`workflows.service.spec.ts` 의 W3c 가드")·INFO #7(`remap()` null 반환 사유 주석) 전부 리뷰가 지목한
   정확한 위치에만 적용됐고 로직 변경이 섞이지 않았다(hunk 단위로 재확인).
7. **임포트 변경** — resolution 라운드에서 신규 import 추가/삭제 없음. `git diff -- workflows.service.spec.ts`
   / `workflow-crud.e2e-spec.ts` 전체를 재검사한 결과 `Edge, EdgeType`(spec.ts)·`randomUUID`(e2e-spec.ts)
   import 라인은 원 구현 커밋(`13b818ec5`, 직전 라운드가 이미 "미사용 아님" 확인)에서만 변경됐고, resolution
   라운드 11개 커밋 어디에도 import 라인 변경이 없다.
8. **설정 변경** — 없음. `package.json`/tsconfig/lint 설정 등 diff 대상에 포함되지 않음.

## resolution 라운드 커밋별 스코프 대조 (참고)

| 커밋 | 대응 SUMMARY | 실제 diff 범위 | 판정 |
|---|---|---|---|
| `a7ab2750a` | #1 REPEATABLE READ | `duplicate()` 트랜잭션 오픈 1줄 + mock 어댑터(모든 1/2-arg 겸용화) | 일치 |
| `0cb0ac86d` | #2 테스트 오염 | `saveCanvas` describe `beforeEach` 에 명시적 reset 13줄 추가 | 일치 |
| `6d3595319` | #3,INFO#4/5/7 | 주석 전용(로직 0줄 변경), describe 제목 1곳 확장 | 일치 |
| `e782bb829` | #5 mutation 사각지대 | 신규 `it()` 1개 추가(기존 테스트 무변경) | 일치 |
| `d98acd850` | #4 e2e 리팩터 | payload 구성을 헬퍼로 순수 이동 | 일치 |
| `8783c63d8` | #6 CHANGELOG | 최상단 신규 항목 1개만 추가 | 일치 |
| `e66bbb9c1` | #7 user-guide | ko/en 각 1줄만 보강 | 일치 |
| `e6c6322f4` | (lint 후속) | 직전 커밋 코드의 줄바꿈만 | 일치 |
| `0ab87ac3f` | (plan 위생) | 체크리스트 1개 항목 완료 표기 | 일치 |
| `f404d7a5a`/`806a156e9` | (기록) | RESOLUTION.md·리뷰 산출물 커밋 — 코드 변경 없음 | 일치 |

## 요약

직전 스코프 리뷰(`review/code/2026/07/30/17_54_27/scope.md`, NONE)가 검토한 원 구현에 더해, 이번 라운드는
그 리뷰 자신이 발견한 Warning 7건 + 요청 INFO 3건을 조치하는 11개 후속 커밋을 대상으로 스코프를 재검증했다.
resolution 라운드의 모든 커밋이 `SUMMARY.md`의 특정 항목 번호를 커밋 메시지에 명시하고 있고, `git show`로
각 커밋의 실제 diff 를 대조한 결과 그 항목이 요청한 조치 범위를 벗어나지 않았다 — 특히 `duplicate()` 범위
밖의 `importWorkflow()`/`syncNodes()`/`syncEdges()`를 건드린 유일한 커밋(`6d3595319`)도 리뷰가 명시적으로
제안한 "상호참조 주석" 범위에 정확히 한정되고 로직 변경은 0줄이었다. 새 import·미사용 코드·디버그
구문(`console.*`/`TODO`/`.skip`)·설정 파일 변경도 발견되지 않았다. `review/**` 산출물(28개 파일)은 CLAUDE.md
가 의무화한 code-review·consistency-check 프로세스의 표준 산출물이며 임의 추가가 아니다. 42개 변경 파일
전부가 "워크플로우 복제가 nodes/edges 를 복사하지 않던 결함 수정"이라는 단일 task 로 추적되며, 범위 이탈로
분류할 항목을 찾지 못했다.

## 위험도

NONE
