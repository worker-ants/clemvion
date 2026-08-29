# RESOLUTION — `19_53_43` (2라운드, fix 후 fresh review)

- 대상 커밋: `b27993a0d` 시점 (`--branch origin/main`)
- 결과: **RISK=LOW · Critical 0 · Warning 1 · INFO 8**, reviewer 7/7
  (`forced_missing=[]`, `unfinished=[]`)
- 처리: **수동** (코드 수정 0건 — 아래 참조)

## 왜 2라운드가 돌았나

1라운드(`19_17_28`)의 WARNING 을 `resolution-applier` 가 고치면서 `codebase/**` 가 바뀌었고,
`review_guard` 는 **커밋 시각**(clean 파일은 fs mtime 이 아니라 마지막 커밋 시각)을 세션
디렉터리 시각과 비교하므로 1라운드가 stale 이 됐다. 코드를 고쳤으니 다시 보는 게 맞고,
이건 우회할 성질이 아니다.

## WARNING 1 — 처리함 (plan 문서만, 코드 변경 없음)

**지적**: `backend-lint-gate-broken-on-main.md` 의 "재실측 21개/미배선 19개" 가, **이 PR 이
신설하는 `redis-fail-open-catalog-guard.ts` 자신이 그 측정 명령의 매치 대상이 되면서**
커밋 시점에 재현 불가능해진다.

**검증 — 리뷰어는 클래스를 맞히고 산수를 틀렸다.** 최종 커밋 상태에서 직접 재실행:

| 축 | 착수 시 | 최종 커밋 | 리뷰어 주장 |
| --- | --- | --- | --- |
| `fail-open` 언급 (non-spec) | 31 | **32** | — |
| 그중 Redis 접촉 | 21 | **21** | 22 |
| 그중 "배선" | 2 | **3** (오검출) | — |
| **미배선** | **19** | **19** | 20 |

- 새 가드는 `fail-open` 집합에는 들어오지만(31→32) **Redis 집합에는 안 들어온다** —
  술어가 `\bRedis\b` 인데 `RedisFailOpen…` 은 단어 경계가 없다. 그래서 21/19 는 그대로다.
- **실제로 틀린 것은 "배선 2개" 다** → 3. 그 가드는 `recordRedisFailOpen` 을 `RECORDER_FN`
  **문자열 상수**로 들고 있을 뿐 호출하지 않는데, 단순 문자열 grep 이 호출부로 센다.

**조치**: plan 의 해당 문단에 착수/최종 두 열의 표와 "무엇이 왜 틀렸는가" 를 넣었다.
결론(미배선 19, 배선 defer)은 바뀌지 않는다.

> **교훈은 리뷰어 지적 그대로가 맞다** — PR 이 추가하는 파일이 그 PR 이 인용한 측정의 입력
> 집합에 들어간다. 백로그 수치는 "지금" 이 아니라 **PR 이 닫히는 시점**에 재야 한다.
> 이 저장소가 이미 아는 실패인데(`PR 안의 정량 기록은 PR 이 닫히는 시점의 값`) 또 밟았다.

## INFO 8건 처분

| # | 처분 | 사유 |
| --- | --- | --- |
| 1 testing — `listProductionSources` 의 `node_modules`/`dist`/`.d.ts` 제외 분기가 뮤테이션에 안 죽음 | **plan 이관 (이번 PR 미수정)** | 진짜 갭이다(리뷰어가 뮤턴트로 실측, 10/10 GREEN). 다만 `codebase/backend/src` 에 그 디렉터리·확장자가 **없어서** 분기가 발화하지 않는 것이고, 닫으려면 `codebase/**` 를 건드려 **4라운드가 강제된다**. 도달 불가한 방어 코드라 위험이 낮아 트리거(다음에 이 가드를 만질 때)와 방법(scratch 합성)까지 적어 plan 에 옮겼다 |
| 2 maintainability — Logger spy 무음화 반복 | won't-do | 1라운드에서 이미 won't-do 확정, 리뷰어도 "블로킹 아님" |
| 3 maintainability — `findWiredComponents` 반환 타입 리터럴 중복 | won't-do | 타입 별칭 1개를 위해 라운드를 더 도는 비용이 이득보다 크다 |
| 4 maintainability — `backend-lint-…` 도 요약절 필요 | **조건부 유예** | 자매 문서는 `complete/` 로 **이동하기 때문에** 봉인 요약을 넣은 것이다. 이 문서는 계속 in-progress 라 시점이 아니다. 그 문서가 이동할 때 같이 한다 |
| 5·6 documentation — sub-agent 산출물의 STATUS 헤더/제목 줄 형식 불일치 | **범위 밖** | `review/**` 산출물 형식은 `subagent-call-contract.md` 관할이고 이 PR 의 코드와 무관하다. harness 트래커 사안 |
| 7 security — LIKE 인젝션 방어 불변 | 조치 불요 | 확인 기록 |
| 8 requirement — diff 대부분이 직전 라운드 산출물 | 조치 불요 | 정보성 |

## 수렴 판정 — developer SKILL §수렴 예외

- **(a) 발견의 성격이 이동했다.** 1라운드 WARNING 은 **동작 커버리지**(값 누출을 못 잡음),
  2라운드 WARNING 은 **문서 수치**다. 코드가 다투는 지점은 사라졌다.
- **(b) 남은 INFO 는 전부 비블로킹**이고, 리뷰어 스스로 "블로킹 아님/조치 불요" 로 낮췄거나
  범위 밖(`review/**` 형식·자매 문서 이동 시점)이다.
- **(c) 유일한 실질 잔여(INFO 1)를 `review/` 에 두지 않았다** — 트리거·방법과 함께 plan 본문에
  옮겼다. `review/**` 는 SoT 가 아니다.
- **(d) 이번 라운드 조치는 `plan/**` 뿐이라 `codebase/**` 가 불변**이다. 따라서 이 라운드는
  stale 이 되지 않고 3라운드를 부르지 않는다 — fix→stale 루프를 여기서 끊는다.

## 테스트

`codebase/**` 는 `4dbc6ee39`(lint/unit/build/e2e 전 단계 통과) 이후 불변이다. 이 라운드의
조치는 `plan/**`·`review/**` 뿐이라 TEST WORKFLOW 를 재수행하지 않는다.
