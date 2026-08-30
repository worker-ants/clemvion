# 유지보수성(Maintainability) Review

## 리뷰 범위

이번 라운드(`15_07_17`)는 `origin/main...HEAD` 누적 diff 중 6라운드째 리뷰다.
유지보수성 관점 실질 검토 대상은 이전 다섯 라운드와 동일한 5개 코드 파일이다
(`git diff --stat origin/main...HEAD -- 'codebase/**'` 로 재확인):

- `codebase/backend/src/common/__test-utils__/source-scan.ts` — `countRawUpdateReturning`/`hasRawUpdateReturning`(3라운드 이후 코드 변경 없음)
- `codebase/backend/src/common/__test-utils__/source-scan.spec.ts` — 판정 축 테스트(양성 7·음성 7·개수 1, 5라운드 이후 변경 없음)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` — 발견형 구조 가드 + `findUnguarded` 순수 함수(5라운드 이후 변경 없음)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts` — 타입 인자 튜플 정정(1라운드 이후 변경 없음)
- `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts.spec.ts` — 이번 라운드 신규: 주석 3곳을 영어→한국어로 정정(로직·구조 변경 없음)

`plan/in-progress/update-returning-tuple-shape.md`, `CHANGELOG.md` 는 보조 검토 대상이고,
`review/code/2026/08/30/{12_41_15,13_15_58,13_46_53,14_11_02,14_33_52}/**`,
`review/consistency/2026/08/30/{12_17_21,14_43_41}/**` 는 이전 다섯 라운드가 생성한 워크플로
산출물(리포트 md/json)이라 애플리케이션 코드가 아니므로 본 관점 리뷰에서는 대상 밖으로 처리한다
— 다섯 라운드 동일 관점 리뷰어가 이미 같은 스코프 판단을 내렸다.

저장소는 Read/Bash(읽기 전용)로만 조사했다 — 뮤테이션·쓰기 없음. `git status --short` 확인 결과
이 세션 산출 디렉터리(`review/code/2026/08/30/15_07_17/`) 외 변경 없음.

## 이번 라운드의 델타 — 주석 언어 정정 하나뿐

직전 커밋(`e5b237377`)이 5라운드 이후 유일한 변경이다. `kb-stats.helper.spec.ts` 의 세 주석
블록(`:18-25`, `:44`)을 영어에서 한국어로 바꿨을 뿐, 테스트 로직·mock shape·assertion 은
전혀 건드리지 않았다 — 커밋 diff(`git show e5b237377`)와 현재 파일을 직접 대조해 확인.
이 파일에 원래 주석이 없어 "선례가 영어 테스트 이름" 이라고 오판했다가, 실제 선례(자매
프로덕션 파일·PR 나머지 4개 파일)가 한국어임을 확인하고 자체 정정한 것 — 이 저장소의 기존
코멘트 언어 컨벤션(전 파일 한국어)과 지금은 정확히 일치한다. 일관성 관점에서 개선이며 새로운
결함은 없다.

## 이전 다섯 라운드가 이미 처분한 항목 — 회귀 없음을 재확인

- 매직넘버 `MIN_REASON_LENGTH`(`update-returning-rows.spec.ts:186`), `SRC` 상수 hoist(`:12`),
  `discover()` `beforeAll` 캐싱(`:266-268`) — 전부 유지.
- 4라운드 WARNING(`ALLOWED` 선언값이 실측과 정확히 일치하는지 보는 테스트, `:287-302`)과
  INFO(멀티라인 백틱 캐너리, `source-scan.spec.ts:100-102`) — 5라운드에 반영되어 유지.
- `findUnguarded` 가 `source-scan.ts` 로 아직 이관되지 않고 `update-returning-rows.spec.ts:167-182`
  에만 있음 — 3라운드가 "두 번째 소비자(`assert-row-array.spec.ts` 발견형 확장) 등장 시점"을
  트리거로 조건부 유예했고 트리거 미발동 상태 그대로다(`grep -rn findUnguarded codebase/backend/src`
  로 소비자가 여전히 1곳뿐임을 재확인). 새 결함 아님.
- `hasRawUpdateReturning` 이 여전히 자기 테스트 파일 외 소비자가 없음 — 2라운드가 "두 번째
  소비자 등장 전까지 현행 유지"로 이미 조치 불요 처분, 변화 없음.
- 5라운드 INFO(`ALLOWED` docstring ↔ 신규 테스트 주석의 설명 중복, `:194-202` vs `:288-294`) —
  직전 커밋 메시지(`e5b237377`)가 "내용이 틀린 게 아니라 겹친 것이라 침묵 실패 위험 없음"으로
  명시적으로 유예했고, plan 에도 유예 사실을 남겼다(`plan/in-progress/update-returning-tuple-shape.md`
  참조). 이번 라운드에서 코드를 직접 재확인한 결과 두 텍스트는 여전히 존재하지만 사실관계가
  일치해 침묵 실패 표면은 없다 — 조치 불요 유지에 동의.

## 발견사항

이번 라운드의 신규 diff(주석 언어 정정, 로직 변경 0줄)에서 함수 길이·중첩 깊이·순환
복잡도·네이밍·매직넘버·중복 코드 관점의 새 결함은 발견되지 않았다.

- **[정보 확인]** `kb-stats.helper.spec.ts` 주석 정정이 기존 테스트 구조·assertion 을 전혀
  바꾸지 않았음을 확인
  - 위치: `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts.spec.ts:19-25`
    (`runs a single atomic UPDATE...` 테스트 내부 주석), `:44`(`tolerates an empty RETURNING
    result...` 테스트 내부 주석)
  - 상세: `dataSource.query.mockResolvedValue([[{ entity_count: 12, relation_count: 34 }], 1])`,
    `mockResolvedValue([[], 0])` 등 mock shape·assertion 은 1라운드 이후 무변경이다. 바뀐 것은
    주석 텍스트뿐이며, 새로 쓰인 한국어 주석도 이 파일의 나머지 새 텍스트(`kb-stats.helper.ts`
    의 인라인 주석)와 어조·형식(왜 이 shape 인가·과거 결함과의 연결)이 일치한다.
  - 판단: 결함 없음.

## 요약

이번 라운드(6라운드)의 실질 diff 는 주석 3곳의 언어 정정(영어→한국어) 하나뿐이며, 테스트
로직·구조·assertion 은 전혀 바뀌지 않았다. 이 정정은 저장소 전체가 한국어 주석 컨벤션을 쓰는
가운데 유일하게 영어였던 이탈을 없애 **일관성을 오히려 개선**한다. 1~5라운드에 걸쳐 실질
WARNING(중첩 제네릭 미탐지·판정 축 테스트 부재·파일 단위 존재-only 판정·허용목록 파일 단위
전면 면제·검증 로직 부재·다중 unguarded 미검증·허용목록 선언값 미검증)이 모두 코드에 반영돼
해소된 상태가 이번 라운드에서도 회귀 없이 유지됨을 직접 소스 대조로 확인했다. 남은 항목은 전부
이전 라운드가 명시적 근거와 함께 조건부 유예 또는 조치 불요로 처분한 carry-forward INFO
(`findUnguarded` 미이관, `hasRawUpdateReturning` 무소비, docstring/테스트 주석 설명 중복)뿐이며
이번 라운드에서 새로 발견된 것은 없다. 유지보수성 관점에서 추가 조치가 필요한 실질 결함은 없다.

## 위험도
NONE
