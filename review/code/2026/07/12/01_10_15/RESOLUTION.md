# RESOLUTION — 웹채팅 위젯 multi-turn 히스토리 복원 통합 테스트

/ ai-review 세션 `review/code/2026/07/12/01_10_15/` 결과: **RISK=LOW, Critical 0, Warning 2, INFO 3**.
초기 `side_effect` 리뷰어는 disk-write gap(출력 파일 결측)으로 커버리지 결측 → **단독 재실행**으로 해소
(RISK=NONE). 최종 위험도 **LOW** 확정.

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | 커밋 |
|---|---|---|---|
| WARNING 1 | Testing | `widget-state.test.ts`: `threadMessages=undefined` 테스트를 "타입 레벨 방어 분기(프로덕션 dispatch 미도달)"로 코멘트 정정 + 실제 도달 가능한 `waiting([])` 빈-배열 스냅샷 케이스 추가(local 비면 빈 유지·비어있지 않으면 로컬 보존) | `462a23e4e` |
| WARNING 2 | Documentation | `widget-state.ts`: `mergeMessages` JSDoc 을 "합치/dedup" 서술 → 실제 length-기반 select 정책으로 정정 | `462a23e4e` |
| INFO 2 | Testing | plan 에 `buttons`/`form` 복원 시드 **out-of-scope carve-out** 명시 | `462a23e4e` |
| INFO 3 | Documentation | plan e2e 소요시간 2회(main-root 229s / worktree 216s) 구분 표기 | `462a23e4e` |
| INFO 1 | Maintainability | `fetchMock` 골격 재복제 → reviewer 권고("이번 diff 단독 변경은 과도")대로 **후속 리팩터로 defer** (아래 §보류) | — |
| (disk-write gap) | side_effect | `side-effect-reviewer` 단독 재실행 → `side_effect.md` 기록, RISK=NONE(INFO 4건 전부 "조치 불필요") | — |

## TEST 결과

fix(`462a23e4e`) 후 worktree 재수행:

- **lint**: 통과 (`stage=lint status=PASS`, 41s)
- **unit**: 통과 (`stage=unit status=PASS`, 33 pkg — channel-web-chat 63 tests 포함)
- **build**: 통과 (`stage=build status=PASS`, 79s — channel-web-chat build+typecheck + docker 이미지)
- **e2e**: 통과 (`stage=e2e status=PASS`, backend Jest 253 tests, 211s)
  - 근거: `*.test.ts` 전용 변경은 `PROJECT.md §e2e 면제 화이트리스트`의 회색지대(화이트리스트 밖)라 면제 불가 → 수행. docker daemon 가용.

## 보류·후속 항목

- **INFO 1 — `fetchMock` 공용 헬퍼 추출**: 신규 "복원 통합" 테스트가 인접 "race fix" 테스트와 유사한 fetch mock 골격(embed-config reject → GET status 분기)을 재복제. reviewer 가 "이번 diff 단독 변경은 과도"로 판단 → `installFetchWithStatusContext(...)` 류 헬퍼 추출은 파일 전반의 테스트별-독립-mock 관례 정리와 함께 후속 리팩터로 이관(별도 백로그 필요 시 신설).
