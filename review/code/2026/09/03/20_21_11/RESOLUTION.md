# RESOLUTION — `invitedBy` nullable 정정 리뷰 2R (최종)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **0** · INFO 10
reviewer 8명 전원(`routing=all`) 결과 확보.

**코드 조치 없음 — 수렴.** 1R 의 WARNING 3건이 실제로 해소됐음을 리뷰어들이 **독립적으로
재현**해 확인했다. requirement reviewer 는 내 뮤테이션까지 다시 돌렸다 — 인자 순서 스왑 시
`1 failed / 13 passed`, 원복 확인. 내가 보고한 수치와 일치한다.

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| 1R | 0 | 3 | 인자 미검증 · CHANGELOG 누락 · **내 규칙 위반(문서 자기모순)** |
| 2R | 0 | **0** | — |

## INFO#4 만 짚는다 — 고치지 않는다

대조군 테스트에는 `toHaveBeenCalledWith` 가 없어 캐너리와 **비대칭**이다. 맞는 지적이다.

고치지 않는 이유: 회귀 방어는 **캐너리 쪽이 이미 담당**하고(인자 순서 뮤테이션을 그쪽이
잡는다), 대조군의 역할은 "값이 있을 때 그 값이 실린다" 를 보이는 것이다. 같은 인자 검증을
양쪽에 두면 뮤턴트 하나에 두 테스트가 함께 죽어 **실패 지점이 흐려진다**. reviewer 도
"조치 불요" 로 적었다.

> 다만 이 판단은 **취향이 아니라 규칙이어야 한다** — INFO#4 가 제안한 대로 "짝 테스트에서
> 인자 검증은 한쪽에만" 을 팀 컨벤션으로 성문화할지는 별건이다. 이번 PR 범위 밖.

## 나머지 INFO 9건

전부 "확인 결과 정상" 이거나 이미 추적 중인 항목이다. 두 가지만 기록한다:

- **INFO#1** `invitedBy?:` optional-key 표기가 wire 동작(키 상시 존재)과 어긋난다 — 원인은
  이번 diff 가 아니라 **§5.4 문면 자체의 내적 모순**이고, planner 턴 후속으로 이미 등재돼
  있다. reviewer 4명이 같은 결론에 도달했다.
- **INFO#6** `assertAdmin`(Admin+) 인가가 Swagger 주석이 아니라 **서비스 코드에서 실제로
  강제**됨을 security reviewer 가 직접 확인했다. 이번 diff 는 그 경로를 안 건드린다.

## 검증

lint **PASS** · unit backend **9,252**(443 suites) · build **PASS** · e2e **292** ·
ratchet **197/36** · `tsc` 비-spec **0**.
