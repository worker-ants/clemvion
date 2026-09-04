# 변경 범위(Scope) 리뷰

## 검토 방법

프롬프트가 보여준 diff 는 `origin/main..HEAD` 3개 커밋(`499675277` 응답 83곳 flip →
`441761478` 83→15 로 좁히며 68곳 되돌림 → `145b7ddcd` plan 전용 후속 기록)의 **순 변경분**이다.
`git log origin/main..HEAD`, `git diff origin/main...HEAD --stat`, `git show --stat`
으로 세 커밋 각각의 실제 diff 를 재현해 프롬프트의 25개 파일 목록과 대조했다 — **정확히 일치**
(25 files changed, 1374 insertions, 53 deletions). 저장소에는 아무것도 쓰지 않았다(read-only
`git log`/`git show`/`git diff`/`grep` 만 사용).

## 검토 대상 요약

- 실질 코드 변경 5개: `CHANGELOG.md`, `execution-response.dto.ts`(10필드),
  `execution-status-response.dto.ts`(5필드), 그 spec 테스트, plan 트래커.
- 나머지 20개는 이전 리뷰 라운드(`review/code/.../14_54_36/*`)와 후속
  consistency-check(`review/consistency/.../15_16_28/*`)의 산출물 신규 커밋 — 본 저장소 관례상
  `review/code/**`·`review/consistency/**` 에 보존되는 프로세스 산출물이며 애플리케이션 코드가
  아니다.
- 목적: 직전 라운드 리뷰(W1/W2, Critical 0·WARNING 2)가 지적한 두 결함 — (a) "tsc 가 판정했다"는
  주장이 엔티티 패스스루 컨트롤러엔 적용 안 됨(83→15 로 좁힘, 68곳 되돌림), (b) 유일한 스키마
  테스트가 `required` 축을 검사하지 않음(`it.each` 3→5 필드 확장 + `required` 배열 단언 추가) —
  을 그대로 좁혀서 반영한 fix 커밋이다.

## 발견사항

- **[INFO]** 순 diff 가 넷팅되면서 82곳 중 68곳(다른 18개 DTO 파일)은 "flip 후 revert" 로 diff
  에 아예 등장하지 않는다 — 프롬프트에 실린 25개 파일이 그 넷 결과다.
  - 위치: `git diff origin/main...HEAD --stat` (25 files) vs `git show --stat 441761478`
    (18개 DTO 파일 포함, 20개 파일)
  - 상세: 개별 커밋만 보면 `441761478` 은 18개 DTO 파일을 되돌리는 변경을 포함하지만, 세 커밋을
    합친 순 diff 에서는 그 파일들의 순 변경이 0이라 프롬프트 목록에서 빠졌다. 리뷰 대상이 "이
    branch 전체" 인지 "최신 커밋만" 인지에 따라 그림이 달라 보일 수 있다는 점을 표기해 둔다 —
    다만 최종 결과(15필드만 순변경)는 CHANGELOG·plan·RESOLUTION.md 서술과 정확히 일치하므로
    결함은 아니다.
  - 제안: 조치 불요 — 관측 사실 기록.

- **[INFO]** 실질 DTO 변경(2개 파일, 15필드)은 데코레이터(`@ApiPropertyOptional`→`@ApiProperty`)
  와 타입 옵셔널 마커(`field?:`→`field:`)에만 국한된다. 인접 필드·JSDoc 주석·import·포맷은
  손대지 않았다.
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (10필드: `triggerId`/`finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/
    `executedBy`/`parentExecutionId`/`reRunOf`/`chainId`), `execution-status-response.dto.ts`
    (5필드: `durationMs`/`currentNode`/`context`/`result`/`error`)
  - 상세: `execution-response.dto.ts` 의 import 라인(`ApiProperty, ApiPropertyOptional`)은
    해당 파일에 여전히 `ApiPropertyOptional` 을 쓰는 다른 필드(`nodeLabel?` 등)가 있어 그대로
    보존됐음을 `grep` 으로 직접 확인 — import 정리로 인한 부수 변경이 이 두 파일에는 없다.
  - 제안: 없음(정상).

- **[INFO]** 테스트 파일 변경은 W2 결함(`required` 축 미검사)에 정확히 대응한다.
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
    (`it.each` 목록 3→5필드 확장 + `required` 배열 단언 신규 `it` 블록)
  - 상세: 새로 추가된 `it` 블록의 docstring 이 "리뷰 W2" 를 명시적으로 인용하며 왜 이 단언이
    필요한지(`@ApiPropertyOptional` 은 `nullable` 은 유지한 채 `required` 만 뺀다)를 설명 —
    범위를 벗어난 임의의 테스트 확장이 아니라 지적된 결함에 정확히 대응하는 최소 추가.
  - 제안: 없음(정상).

- **[INFO]** `CHANGELOG.md`/plan 문서 변경은 이 diff 자체를 설명하는 필수 부속물이며, 자기
  정정 서사("83→15 로 좁혔다", "기계화되지 않는다를 두 번 뒤집었다")도 이 저장소의 기존
  CHANGELOG 컨벤션(직전 항목들도 동일 톤)과 일치한다.
  - 위치: `CHANGELOG.md:3` 신규 Unreleased 블록, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    §5.4 drift 배치 항목
  - 상세: plan 문서에 신규로 등재된 "2단계: 패스스루 응답 DTO 68곳"·"§5.4 가 WS wire 에도
    적용되는가"(cross_spec INFO#3, `--impl-done 15_16_28`) 두 항목 모두 **이번 diff 가 만든
    작업이 아니라 향후 백로그로 명시적으로 등재**돼 있다("이번 diff 가 만든 것이 아니다" 라고
    스스로 문서화). 코드 변경 없이 계획만 남기는 형태라 범위 확장(기능 추가)이 아니다.
  - 제안: 없음(정상) — 다만 병합·리뷰 시점에 "이 PR/branch 하나에 코드 fix 2건 + 문서 전용
    커밋 1건이 섞여 있다"는 점은 커밋 단위 분리를 선호하는 리뷰어라면 참고할 사실.

- **[INFO]** review 산출물 20개 신규 파일(`review/code/.../14_54_36/*`,
  `review/consistency/.../15_16_28/*`)은 애플리케이션 코드를 전혀 건드리지 않는 프로세스
  기록이며, 프로젝트 컨벤션(`review/code/**`, `review/consistency/**` 이 산출물 저장 위치)과
  일치한다.
  - 위치: 위 20개 파일 전부 `new file mode 100644`
  - 상세: 내용도 전부 "이번 83→15 축소 배치" 를 다루고 있어 무관한 리뷰 세션이 실수로 섞여
    들어온 것은 아니다.
  - 제안: 없음(정상).

## 요약

`origin/main..HEAD` 순 diff(25개 파일)는 직전 리뷰 라운드가 지적한 두 결함(검증 방법론이
패스스루 컨트롤러에 미적용, 스키마 테스트가 `required` 축 미검사)을 좁혀서 정정하는 fix 로
정확히 수렴한다. 실질 코드 변경은 2개 DTO 파일의 15필드 데코레이터/타입 전환과 그에 대응하는
테스트 단언 추가뿐이며, import·포맷·주석·무관한 로직은 건드리지 않았다. CHANGELOG·plan 갱신은
이 diff 를 설명하는 필수 부속물이고, 새로 등재된 백로그 항목(2단계 68곳, WS wire 질문)은 코드
없이 "지금 하지 않는다" 는 계획만 남겨 기능 확장이 아니다. 20개 review 산출물은 프로젝트
컨벤션대로 `review/**` 에 저장된 프로세스 기록이다. 의도 이상의 변경·불필요한 리팩토링·무관한
파일 수정·포맷팅 뒤섞임은 발견되지 않았다.

## 위험도

NONE
