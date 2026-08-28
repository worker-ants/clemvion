# RESOLUTION — 12_28_11 (라운드 2)

직전 라운드(`11_45_02`)의 Critical 1 + Warning 2 조치 뒤, 그 **조치 코드 자체**가
아직 리뷰되지 않아 push 게이트가 막았다(`newest_review 11:45:02 < newest_code 12:10:32`).
본 라운드는 그 재리뷰다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (Warning) | 코드 | 본 커밋 | `text-chunker.spec.ts` force-split 테스트가 **vacuous** 하다는 지적 — 실측으로 확인하고 판별 가능한 케이스를 추가했다. 상세는 아래 |
| INFO #1 | — | 미조치 (등재됨) | `cause` 보존 런타임 단언 — `plan/in-progress/deps-peer-gating-and-eslint10.md` 에 §수렴 예외로 이미 등재. 두 파일 다 spec-linked 라 고치면 `--impl-done`(12_20_11)이 무효화된다 |
| INFO #2·#3·#4 | — | 미조치 | `#1049` 서사 중복 · unicorn 블록 주석 길이 · `dependabot.yml` 묘비 주석. 전부 "다음에 그 파일을 열 때" 성격이고, 지금 고치면 리뷰가 또 한 바퀴 돈다 |
| INFO #5 | 문서 | 본 커밋 | plan 체크리스트 부모 항목 `[x]` 정리 |
| INFO #6 | — | 미조치 (등재됨) | frontend eslint 9 잔류 해제 조건의 자동 가드 부재 — 스코프 밖. plan 후속 항목 옆에 함께 적었다 |
| INFO #7 | — | 미조치 (등재됨) | `typeorm→ioredis` — plan §3 로 이미 분리 |
| INFO #8 | — | 조치 불요 | unicorn ignore 제거로 dependabot 자동 PR 재활성화 = **의도된 정책 변경**. 사후 게이트 2종(가드 + `--strict-peer-dependencies`)의 실효성을 리뷰어가 실측 확인했다 |

### Warning #1 — 지적이 맞았다 (뮤테이션 실측)

내가 직전 라운드에 요청·수용한 force-split 테스트는 **분기 진입만** 고정하고
`overlapBuffer = ''` 리셋은 관측하지 못했다. 원인은 fixture 형태다 — force-split 직후
텍스트가 끝나서 그 값을 **읽는 코드에 도달하지 않는다**. `overlapBuffer` 는
`pushChunk(chunks, currentChunk, overlapBuffer, …)` 에서만 소비되므로, force-split
이후에 일반 청크가 하나 더 나와야 비로소 관측된다.

판별 fixture: 문단1(작음, `overlapBuffer` 를 `'ARRYOVER.'` 로 채움) → 문단2 의 첫 문장
(91자, 종결부호 없음 → force-split) → 문단2 의 둘째 문장(작음 → 루프 종료 후 flush).
마지막 flush 가 `overlapBuffer` 를 읽는 유일한 지점이다.

뮤턴트: `text-chunker.ts` 의 `overlapBuffer = '';` **삭제**.

| 케이스 | 예측 | 실측 |
|---|---|---|
| 신규 `force-split 이 직전 문단의 overlap 캐리오버를 끊는다` | RED | **RED** |
| 기존 `force-split 분기에 실제로 진입해…` | GREEN | **GREEN** — 지적대로 단독으로는 판별 불가 |

예측을 먼저 적어 둔 이유는 기존 케이스의 **GREEN 도 증거**이기 때문이다 — 그것이
"이 테스트만으로는 부족했다" 를 실측으로 확정한다. 원복은 `cp` + 절대경로로 했고
`git diff` 0 으로 확인했다(`git checkout` 은 미커밋 작업을 지운 전례가 있어 쓰지 않는다).

**주의 — 왜 원본 dead-store 를 되살리는 뮤턴트를 쓰지 않았나**: 지워진 그 줄은
`overlapBuffer = '';` 가 **무조건** 뒤따르는 자리라, 되살려도 어떤 fixture 로도 관측되지
않는 **무효 뮤턴트**다. 관측 가능한 축은 "리셋이 있는가" 쪽이고, 위 뮤턴트가 그 축이다.

## TEST 결과

- lint  : 통과 (`stage=lint status=PASS`)
- unit  : 통과 (`stage=unit status=PASS`, backend 434 suite / 9,032 tests)
- build : 통과 (`stage=build status=PASS`)
- e2e   : 통과 (`stage=e2e status=PASS tests=285 passed`)

## 보류·후속 항목

INFO #1·#6·#7 은 `plan/in-progress/deps-peer-gating-and-eslint10.md` 에 등재돼 있다.
INFO #2·#3·#4 는 등재하지 않는다 — 전부 "그 파일을 다음에 열 때" 축약을 고려하라는
성격이고 대상 파일이 특정돼 있어, 별도 트래커 없이 그 파일의 다음 편집자가 본다.

**developer SKILL §수렴 예외 인용** — 남은 INFO 들은 (a) 동작 결함이 아니고(전부 문서·주석
수준이거나 이미 실측으로 안전 확인됨), (b) 고치면 리뷰 freshness 가 재무장돼 라운드가 한 번 더
돌며 그 라운드가 또 같은 성격의 잔여를 낸다. 발견의 성격이 **동작 → 구조 → 문서**로 이동했고
Critical 은 0 이다. 등재 사유는 비용이 아니라 수렴이다.
