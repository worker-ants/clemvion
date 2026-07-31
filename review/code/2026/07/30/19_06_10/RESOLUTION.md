# RESOLUTION — review/code/2026/07/30/19_06_10 (2차 / fresh 라운드)

대상: 1차 라운드(`review/code/2026/07/30/17_54_27`)의 fix 커밋들이 원 리뷰 이후 변경이라
review-guard 가 stale 판정 → 그 fix 를 포함해 `--branch origin/main` 전체를 다시 리뷰한 라운드.

결과: **Critical 0 · Warning 1 · INFO 17**, 전체 위험도 LOW. 유일한 Warning 이 **코드 결함이 아니라
1차 RESOLUTION.md 의 테스트 수치 서술 오류**였다 — 즉 fix 자체에서 새로 발견된 코드 결함은 0건이다.
발견의 성격이 동작 → 구조 → 문서로 내려왔으므로 이 라운드로 수렴 처리한다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING #1 | 문서(감사 기록 정확성) | 본 커밋 | 1차 `RESOLUTION.md` 의 "`workflows.service.spec.ts` 단독 137/137" 을 실측값으로 정정. **직접 재실측 확인**: 단독 `npx jest src/modules/workflows/workflows.service.spec.ts` → **77/77**(1 suite), `npx jest src/modules/workflows` → **137/137**(5 suites). 리뷰어 주장이 참이었다. 2곳 정정 + 정정 노트 blockquote 추가 |
| INFO #2 | 코드(테스트) | 본 커밋 | `REPEATABLE READ` isolation 인자를 지키는 단언 추가 (`toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function))`). 리뷰어가 "저비용·고효과" 로 지목한 유일한 INFO |

### WARNING #1 — 커밋 메시지 전파분 처리

같은 잘못된 수치가 커밋 메시지 `e6c6322f4` 에도 들어갔다. 이미 푸시 대상 히스토리이므로
**rebase/amend 로 재작성하지 않고**, 1차 `RESOLUTION.md` 안에 정정 노트를 blockquote 로 고정해
"이 수치는 이렇게 틀렸고 실제는 이렇다" 를 추적 가능하게 남겼다. 커밋 메시지 문구를 고치려고
공유 히스토리를 다시 쓰는 비용이 얻는 것보다 크다.

### INFO #2 — mutation 으로 vacuous 아님 증명

리뷰어 지적의 핵심은 "isolation 인자가 실수로 제거돼도 **어떤 테스트도 못 잡는다**" 였다. 새 단언이
정말 그 축을 지키는지 직접 확인했다:

1. GREEN — 단언 추가 후 `-t "REPEATABLE READ"` 통과.
2. `transaction('REPEATABLE READ', cb)` → `transaction(cb)` 로 소스를 임시 변형 후 스펙 전체 실행 →
   **RED 1건 / GREEN 77건**. mock 어댑터가 variadic 을 흡수해 콜백은 그대로 돌기 때문에 **다른 어떤
   동작 단언도 이 변형을 잡지 못했고**, 새 단언 하나만 실패했다 — 리뷰어의 사각지대 진단이 정확했고,
   새 단언은 vacuous 가 아니다.
3. `cp` 로 원복(절대경로 백업 사용, `git checkout` 미사용) 후 78/78 GREEN, `git diff --stat` 로
   `workflows.service.ts` 가 mutation 전후 무변화임을 확인.

## TEST 결과

- lint  : 통과 — 48s (`_test_logs/lint-20260730-193046.log`)
- unit  : 통과 — backend **412 suites** + frontend/web-chat/channel-web-chat/internal packages 전부.
  `workflows.service.spec.ts` 단독 **78/78**(INFO #2 단언 1건 추가 후). 68s
  (`_test_logs/unit-20260730-193150.log`)
- build : 통과 — 141s, docker 이미지 빌드 + backend 프로덕션 이미지 위생 스모크 포함
  (`_test_logs/build-20260730-193313.log`)
- e2e   : 통과 — backend Jest e2e **260/260**, 270s, 재시도 없이 1회 통과
  (`_test_logs/e2e-20260730-193546.log`)

## 보류·후속 항목

INFO 17건 중 #2 외 16건은 미조치. 분류:

- **1차에서 이미 의식적으로 보류한 항목의 재확인** (#1 `findById` 트랜잭션 밖 — 404 fast-path
  트레이드오프, #6 엣지-0건 조합 단언, #7 `edge.condition` 참조 격리, #8 네이밍 드리프트,
  #9 e2e `it()` 분리): 1차 `RESOLUTION.md` §보류·후속 항목과 `plan/in-progress/
  workflow-duplicate-nodes-edges.md` §3 에 이미 등재돼 있다. 이번 라운드가 새로 만든 부채가 아니다.
- **이번 diff 가 만든 리스크가 아님이 명시된 항목** (#3 배치 insert chunk 상한 — `importWorkflow`
  기존 패턴 재사용, #4 `node.config` 무검증 복사 — 의도된 동작이자 동일 워크스페이스 한정,
  #10 Swagger description 길이 — 파일 내 다른 엔드포인트와 동일 스타일, #16 결함 의존 외부 자동화 —
  비공개 API): 조치 불필요로 리뷰어 자신이 판정.
- **선택적 보강** (#5 컨트롤러 pass-through 테스트, #11 `Promise.all` 병렬화, #15 응답에 node/edge
  요약 노출, #17 `saving-and-sharing.mdx` 에 duplicate 범위 언급 — 리뷰어가 "확정 WARNING 대상이
  아니었고 필수 target(`ui-tour`)은 이미 충족" 이라 명시).
- **긍정 기록** (#12 mock variadic 어댑터 하위호환 검증, #13 오염 차단 반영 확인, #14 `tags`/
  `settings` 얕은 복사로 에일리어싱 제거): 조치 대상 아님.

민감 변경·spec 변경·SPEC-DRIFT 0건.
