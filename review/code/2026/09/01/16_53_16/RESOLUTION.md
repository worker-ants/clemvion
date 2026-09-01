# RESOLUTION — 감사 로깅 잔여 리뷰 6라운드 (수렴)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **1** · INFO 15

**수렴한다.** 6라운드 발견은 전부 **서술 정확성**이고 동작 결함이 없다. 두 건 다 조치했다.

## W1 — CHANGELOG 이 5라운드 보강을 안 적고 있었다

CHANGELOG 의 가드 서술이 **1라운드 시점**("묶였는가만 검사")에 멈춰 있어, 5라운드에 닫은
`findMisboundHelpers`(엉뚱한 리소스에 묶인 형태)가 빠져 있었다. plan 에는 있으니 은폐는
아니지만, **CHANGELOG 만 읽는 사람은 가드가 오귀속까지 잡는다는 걸 모른다.**

이 파일의 기존 addendum 선례를 따라 절 끝에 보강 인용문을 달았다. 거기에 **유예 근거가
반증된 경위도 함께** 적었다 — "`_NoCrossDomain` 이 막는다" 가 틀렸고 실제로 잡는 것은
호출부라는 사실은, 다음에 이 가드를 손대는 사람이 같은 오판을 반복하지 않게 하는 정보다.

## INFO 1 — fixture "형태" 라벨이 5에서 중복됐다

3명(maintainability·documentation·testing)이 같은 자리를 지적했다. `ARROW_FIELD_BARE_SOURCE`
와 신규 `WRONG_RESOURCE_BOUND_SOURCE` 가 둘 다 "형태 5" 였다. 순수 주석 오기지만 **이 파일이
형태 커버리지를 세는 근거**라 카운트를 오인시킨다 — 이 PR 이 내내 고쳐 온 "세는 대상" 오류와
같은 종류라 그냥 고쳤다. 이제 1~6 이 유일하다.

## INFO 14건 미조치

전부 "조치 불요 / 이미 등재 / 확인 목적" 이다. 성격별로:

- **의도된 설계 재확인** (INFO 5·6·7): best-effort 적재, 관측 호출의 빈 catch, 가드의 전수
  스캔 비용. 셋 다 이번 diff 가 만든 것이 아니고 근거가 코드·spec 에 적혀 있다.
- **이미 plan 에 등재된 이월** (INFO 12·13·14): `clampLabel` 대칭 테스트 · `login_history`
  축 비대칭 · `record()` JSDoc. **미조치이며 우선순위 판단**이다 — 문서화되어 있어서가 아니다.
- **방어 심층화** (INFO 3·4): 로그 문자열 결합, 열린 `string` 라벨. 현재 producer 가 전부
  서버 생성 UUID·내부 상수라 악용 경로가 없음을 리뷰어가 확인했다.
- **범위 확인** (INFO 9·10·11): 두 plan 항목 번들, 팩토리→가드 처방 전환, `clampLabel` 공유.
  1~6라운드에 반복 확인됐고 결론이 바뀌지 않았다.
- **가독성** (INFO 2): `extractActionType` 과 `extractBoundResourceText` 의 순회 로직 중복.
  추출하면 얇은 래퍼 둘이 되는데, 지금은 **각자 다른 것을 반환**(타입 텍스트 vs 제네릭 인자)
  하고 fixture 가 divergence 를 잡는다. 우선순위 판단으로 남긴다.

## 수렴 근거

| 라운드 | 위험도 | Critical | Warning | 성격 |
|---|---|---|---|---|
| 1 | MEDIUM | 0 | 5 | 무테스트 구현 · swallow 계약 · SPEC-DRIFT |
| 2 | LOW | 0 | 3 | 위생 (주석 귀속 · plan 라이프사이클) |
| 3 | MEDIUM | 0 | 2 | **내 거짓 근거 #1** (존재하지 않는 문서) · vacuous 테스트 |
| 4 | LOW | 0 | 1 | 리뷰 산출물 (코드 아님) |
| 5 | LOW | 0 | 2 | **내 거짓 근거 #2** (`_NoCrossDomain`) · plan 위생 |
| 6 | **LOW** | **0** | **1** | 서술 정확성 (CHANGELOG) |

Critical 은 6라운드 내내 0이었다. 5라운드에 Warning 이 되올라간 것은 **내가 코드를 새로
넣었기 때문**이고(가드 확장), 6라운드는 그 신규 코드에 대해 동작 결함 0 · 서술 1건만 냈다.

가장 값어치 있었던 두 지적(3R·5R)은 **둘 다 내가 조치를 건너뛰려고 댄 근거**에 대한 것이었다.
한 번은 없는 문서를 인용했고, 한 번은 엉뚱한 가드에 공을 돌렸다. 두 번 다 그 자리에 실재하는
갭이 있었다 — **반증된 전제는 더 큰 결함의 덮개**라는 패턴이 이 PR 안에서 두 번 반복됐다.

## 검증

lint(`--max-warnings 0`) · prettier · `tsc --noEmit`(repo-guards 에러 0) ·
repo-guards **7 suites / 116 passed** · backend **442 suites / 9211 passed, 1 skipped** ·
docs 가드 **3120**.
