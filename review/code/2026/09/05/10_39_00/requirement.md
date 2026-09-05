# Requirement Review

## 검토 방법

이번 changeset(70개 파일)은 실행 코드 변경이 전혀 없는 순수 문서/spec/plan/리뷰 산출물 PR이다.
이미 6라운드의 code review(`09_27_04`→`09_42_13`→`10_20_57`→`10_30_38` 등)와 5라운드의
consistency-check(`09_13_39`→`09_53_09`→`10_04_12`→`10_13_38`)가 반복 검토해 대부분의
지적이 해소·수렴돼 있음을 `git log`/`git show`(HEAD=`88d037197`)와 현재 워킹트리 파일
(`codebase/backend/migrations/README.md`, `spec/conventions/migrations.md`,
`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`,
`spec/data-flow/8-notifications.md`, `plan/complete/spec-draft-migration-rerun-and-citations.md`,
`plan/in-progress/spec-draft-nullable-notation-followups.md`)을 직접 열어 확인했다. 이전
라운드가 "조치 완료"로 표시한 항목(README §5 두 경로 표, §checksum 이름-참조 수정,
부록 A/B 중복 제거, `review-citations.md` §3 DTO JSDoc 예외 등)은 전부 실제로 반영돼 있고
회귀는 없다.

그 위에서, 이 라운드가 새로 검증한 것은 `spec/conventions/review-citations.md` 자신이
주장하는 **정량적 사실 관계**다 — 이 문서는 인용 형식을 규정하면서 자신의 근거로 삼는
수치(107개 파일·514회, 8건 해소 불가 등)를 대는데, 그 수치 중 하나가 실측과 어긋난다.

## 발견사항

- **[WARNING]** `review-citations.md` §3 이 `spec/**` 를 "현재 위반 사례 0건" 이라고 단언하지만, 실측하면 최소 22곳(12개 파일)에서 날짜 없는 bare `hh_mm_ss` 인용이 이미 존재한다
  - 위치: `spec/conventions/review-citations.md:67` (`| spec/** 문서 | 적용 | codebase/** 와 같은 논리 — 살아 있는 문서라 오래 읽힌다 (현재 위반 사례 0건) |`)
  - 상세: §2 는 이 규약의 근거로 "bare `hh_mm_ss` 는 날짜가 없으면 이력으로도 해소 불가"라는
    실측을 든다. §3 는 그 규칙이 `spec/**` 에도 **적용**된다고 명시하면서 "현재 위반 사례
    0건"이라고 적는다. 그런데 직접 grep 해 보면 이 주장은 사실이 아니다 — bare 형태(날짜가
    앞뒤 문맥 어디에도 없는 `hh_mm_ss`)가 이미 12개 이상의 `spec/**` 파일에 22곳 이상 있다.
    직접 문맥까지 읽어 날짜 부재를 확인한 예:
    - `spec/1-data-model.md:995-996` — `` `--impl-done`(`21_59_41`) cross_spec ``, `` `--spec`(`10_37_51`) ``
    - `spec/5-system/1-auth.md:545` — 같은 `21_59_41` 인용 (날짜 없음)
    - `spec/2-navigation/14-execution-history.md:479` — `` (`10_53_52` security/architecture W2·W3) ``
    - `spec/5-system/14-external-interaction-api.md:863,1543,1560,1568,1763,1810,1840` — 다수의 bare 시각(`11_09_44`, `23_49_05`, `01_17_49`, `23_50_03`, `11_05_39`, `12_55_09`, `22_26_33`)
    - `spec/5-system/6-websocket-protocol.md:191,271,568` — `10_44_28`, `12_55_09`, `17_04_25`
    - `spec/5-system/3-error-handling.md:588` — `10_46_44`
    - `spec/7-channel-web-chat/4-security.md:39,302` — `15_50_56`, `15_16_20`
    - `spec/conventions/secret-store.md:46` — `17_12_34`·`18_14_50`
    - `spec/conventions/swagger.md:544` — `12_45_36`
    - `spec/conventions/node-output.md:65` — `16_41_05`

    같은 착오가 이 changeset 자체에도 있다 — `review/consistency/2026/09/05/10_04_12/cross_spec.md`
    INFO#1(및 그 SUMMARY)이 이미 "`§3` 표가 `spec/**` 를 다루지 않는다(실측 위반 사례는
    없음)"이라고 적었고, 그 뒤 `10_13_38` 라운드가 "적용 행 추가"로 반영하면서도 같은
    "0건" 전제를 그대로 옮겨 실었다 — 즉 이 PR 안에서만도 두 개의 자동 consistency 라운드가
    같은 잘못된 실측을 이어받아 재확인 없이 통과시켰다.
  - 제안: §3 의 "현재 위반 사례 0건"을 실측치로 정정하거나(가장 정확), 최소한 §4 "기존 인용은
    소급 정리 대상이 아니다"의 grandfather 목록(현재 `codebase/**` 499건 + `scripts/**`·
    `.github/**` 6건만 명시)에 `spec/**` 의 기존 bare 인용도 포함시켜 "적용은 신규 인용부터"
    임을 명확히 한다. 지금 상태로는 이 문서를 근거로 `spec/**` 편집 시 "여기는 이미 100%
    준수 중"이라 오해하고 무관한 레거시 bare 인용을 뒤늦게 "위반"으로 잘못 취급하거나,
    반대로 그 존재를 몰라 다음에도 같은 오탐지가 반복될 위험이 있다.

## 검증한 것 (참고 — 실측 재현, 문제 없음 확인)

- `review-citations.md` 의 핵심 수치(`origin/main` 기준 `codebase/**` 의 hh_mm_ss 패턴
  **107개 파일 · 514회**)를 독립적으로 `grep -rl`/`grep -roh` 로 재현한 결과 문서 서술과
  **정확히 일치**한다.
- `sanitize-loader-error.ts:17` 의 `review/code/2026/05/26/12_10_38` 인용이 워킹트리에
  없는 디렉터리를 가리킨다는 §1 자신의 서술도 실측과 일치(파일 직접 확인) — 새 결함 아님.
- `codebase/backend/migrations/README.md` §5 "감수하는 비대칭" 표(정상 재실행 vs
  `repair`+재실행 경로)·§6 말미 `docker compose up migrate-repair` 참조(직전 라운드 `10_30_38`
  이 "§checksum" 이름-참조를 구체 명령으로 고친 것)를 파일에서 직접 대조 — 정확히 반영됨.
  `grep -n "§"` 결과 README.md 안에 남은 이름-기반(앵커 없는) 섹션 참조는 0건.
- `spec/conventions/migrations.md` 의 신규 블록쿼트가 §5 절차 목록(1~6)과 마무리 블록쿼트
  사이를 더 이상 끊지 않고 독립 블록쿼트로 뒤에 배치됨을 확인 — 이전 라운드 INFO 반영 확인.
- `plan/complete/spec-draft-migration-rerun-and-citations.md` 의 부록이 전문 복제 대신
  실제 파일 3개를 가리키는 표 + "적용 후 달라진 것" 요약으로 축소돼 있음을 확인(224줄,
  이전 303줄에서 중복 제거) — 부록 드리프트 재발 소지 제거 확인.
- `spec/data-flow/8-notifications.md:275-279` 의 신규 캐비엇이 V056 시점 절차와 신규
  DROP-먼저 패턴 간 모순을 명시적으로 중재하고 있음을 확인 — 문맥·링크 정상.
- 저장소 파일은 이번 검증(Read/Grep/git log 만 사용) 동안 전혀 mutate 하지 않았다.
  `git status --short` 확인 결과 `review/code/2026/09/05/10_39_00/`(이 세션 자신의 출력
  디렉터리) 외 변경 없음.

## 요약

이 changeset은 애플리케이션 코드 변경이 없는 마이그레이션 재실행 안전성 패턴 + 리뷰 인용
규약 성문화 PR로, 11라운드에 걸친 반복 검토 끝에 실질적으로 수렴해 있다 — 기존 지적은
전부 실제로 반영됐고 회귀는 없다. 이번 라운드가 새로 발견한 것은, 신설된
`review-citations.md`가 자신의 적용 범위 주장(`spec/**` 위반 사례 "0건")에 대해 실측을
충분히 하지 않았다는 점이다 — 실제로는 최소 12개 파일·22곳에 날짜 없는 bare 인용이 이미
있고, 이 사실은 같은 PR 안의 두 consistency-check 라운드(`10_04_12`→`10_13_38`)에도
이어져 재확인 없이 통과했다. 시행 가드가 없는 순수 컨벤션 문서의 정확도 문제라 빌드/CI에는
영향이 없지만, 문서 자신이 정한 "실측 기반 서술" 원칙(§4 "이 수치를 처음 셀 때 거짓 0 을
냈다" 각주가 스스로 경계하는 바로 그 실패 유형)을 자기 문서 안에서 어겼다는 점에서
WARNING으로 남긴다.

## 위험도

LOW
