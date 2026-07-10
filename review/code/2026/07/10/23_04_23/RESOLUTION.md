# RESOLUTION — review/code/2026/07/10/23_04_23

> **집계 정정 선행**: workflow 가 반환한 `RISK=NONE / WARNING=0` 은 부정확했다. `documentation`·`side_effect`
> reviewer 가 `status=success` 인데 output 파일이 디스크에 없어(기지 workflow disk-write 갭) summary agent 가
> 두 리뷰어를 카운트에서 제외했기 때문이다. main 이 workflow journal 에서 원문을 복구해 두 파일을 디스크에
> 재작성했고, 그 결과 **실제 등급 = RISK: LOW, CRITICAL: 0, WARNING: 1**. 아래는 그 기준의 조치 기록이다.

## 조치 항목

| SUMMARY # | 등급 | 발견사항 | 조치 | commit |
|---|---|---|---|---|
| documentation #1 | **WARNING** | 파일 상단 모듈 헤더 주석이 `truncation?` 를 누락해 `asEnvelope` JSDoc 과 shape 정의 불일치(stale 주석) | 헤더 shape (2) 서술에 `truncation?` 추가 + "cap 메타는 payload 바깥 top-level" 명시 | `da3d2672c` |
| side_effect #1 | INFO | `output` 에만 truncation 을 통째로 spread → `config`/`output` 대칭 파괴. 현재 키 충돌은 없으나 코드에 고정돼 있지 않아, 장래 payload/truncation shape 확장 시 렌더 필드가 조용히 덮일 수 있음 | 통째 spread → **명시적 4-키 화이트리스트**(`TRUNCATION_KEYS` + `truncationMeta()`)로 병합 범위를 봉인. 미등록 키 흡수 금지 회귀 테스트 추가 | `da3d2672c` |
| maintainability #9 | INFO | "값 충돌 시 truncation 우선" 우선순위가 주석에 미명시 | JSDoc 에 병합 규칙(흡수는 output 한정 / 충돌 시 top-level truncation 우선 + 근거) 명시 | `da3d2672c` |
| testing #11 | INFO | 충돌 우선순위를 고정하는 테스트 부재 — spread 순서를 뒤집는 리팩터가 조용히 통과 | `payload.rowsTruncated:true` + `truncation.rowsTruncated:false` → `truncated=false` lock-in 테스트 추가 | `da3d2672c` |
| testing #13 | INFO | `truncation` 이 non-object(`null`/문자열)일 때의 방어를 잠그는 테스트 부재 | `truncation: null` / `"garbage"` no-op 테스트 추가 | `da3d2672c` |
| documentation #2 | INFO | TS 주석 안 마크다운 링크 문법이 파일 내 다른 spec 참조 관례와 불일치 | plain 텍스트 표기로 통일 | `da3d2672c` |
| security #1·#2, scope #5·#6·#7, requirement #4, documentation #3·#4 | INFO | "조치 불요" 로 명시된 확인성 기록 | 조치 없음 | — |

## TEST 결과

fix commit(`da3d2672c`) 이후 TEST WORKFLOW 1단계부터 재수행:

- lint: **통과** (`_test_logs/lint-20260710-231752.log`)
- unit: **통과** (`_test_logs/unit-20260710-231847.log`) — 위젯 3파일 87건 green
- build: **통과** (`_test_logs/build-20260710-231953.log`)
- e2e: **통과** — 249 passed (`_test_logs/e2e-20260710-232143.log`)

## 보류·후속 항목

아래 2건은 이번 PR 스코프 밖으로 `plan/in-progress/widget-presentation-restore.md` §6 에 등재:

| SUMMARY # | 항목 | 사유 |
|---|---|---|
| requirement #3 | 위젯 truncation 배너가 `rowsTotalCount`/`itemsTotalCount`(잘리기 전 총 개수)를 미노출 — 메인 FE(`assistant-presentations-block.tsx:316`)는 count 를 함께 표시 | 이 diff 가 만든 회귀 아님. spec 도 count 표시를 강제하지 않음. `TableData`/`CarouselData` 에 `totalCount?` 를 더하는 표면 확장이라 별도 결정 |
| testing #12 | `toCarousel` 의 `itemsTruncated` 는 흡수되지만 **소비처(카루셀 잘림 배너)가 위젯에 없음** — `CarouselData` 에 `truncated` 필드 부재 | 카루셀 배너는 미구현 UI. 구현 시 대칭 렌더 테스트 동반 필요 |

`maintainability #8·#10`(테스트 헬퍼 `payloadOf` 2파일 중복·타임스탬프 상수화)은 리뷰어 권고대로
**3번째 파일로 반복이 늘 때** 공용 fixture 로 추출한다 — 현재 조치 없음.
