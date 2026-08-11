# ai-review SUMMARY — `16_19_38` (forced 7) + consistency `16_21_15` (5)

델타 = 커밋 `df1375208`(주석 2줄) + `4daeaa534`(리뷰 산출물).

## 집계 — 12/12 착지, **CRITICAL 0 / WARNING 0**, 전원 BLOCK:NO

| | 결과 |
|---|---|
| 코드 7 (security · testing · scope · side_effect · documentation · requirement · maintainability) | **전원 NONE** |
| consistency 5 (cross_spec · convention · naming · plan_coherence · rationale_continuity) | **전원 BLOCK:NO**, INFO 2 |

## rationale_continuity 가 이 라운드의 값을 냈다 — 출처를 실측으로 확정

내가 고친 주석이 "**당시엔 맞았는데 이후 SDK 변경으로 낡은 것**" 인지 "**처음부터 틀린 것**"
인지를 `git log -S` 로 판정했다:

- 문제의 주석("host 없이 직접 로드/샘플 대비")을 건드린 커밋은 도입(`a652f8733`, #384)과
  이번 정정 **둘뿐**.
- 그 주석을 반증하는 SDK 함수 `resolveIframeTarget` **도 같은 `a652f8733`** 에서 도입됐다.
- `git show a652f8733:.../use-widget.ts` 로 당시 폴백 코드를 확인하니 **host 유무를 검사하는
  조건문이 없었다** — 지금과 동일한 무조건 발동.

⇒ **번복이 아니다.** #384 는 "쿼리 폴백은 host-less 전용" 이라는 결정을 내린 적이 없다 —
코드가 처음부터 그 결정을 구현하지 않았다. 주석만 처음부터 틀려 있었고, 그것이 한 달 뒤
spec 오서술로 번졌다. **파생본만 고쳤다면 되돌아왔을 것이다.**

이 저장소는 "문서화됐는데 미구현" 을 폐기된 규칙으로 오인해 되살릴 뻔한 이력이 있다. 그
반대 방향(주석이 결정을 지어냈다)을 실측으로 가른 것이 이 판정의 값이다.

## INFO 2건 — 둘 다 처분

| 출처 | 내용 | 처분 |
|---|---|---|
| **rationale_continuity** | **세 번째 복제본**이 테스트 파일에 다른 문구(`direct-load 외부 입력 방어`)로 남아 있다 — 커밋이 검색한 문자열과 달라 grep 을 통과했다 | **고침** — 내 "정확히 2곳" 실측이 틀렸음을 커밋에 명시 |
| plan_coherence | 라운드 2~5 회고가 plan 본문에 없다(`review/` 는 SoT 아님) | **고침** — 회고 절 추가 |

**첫 항목이 아프다.** 나는 직전 커밋에 "grep 으로 복제본이 정확히 2곳임을 확인했다" 고 썼는데,
`샘플` 이라는 **문자열**을 센 것이었다. 같은 주장을 다른 말로 적은 곳은 그 grep 을 통과한다.
하필 **복제본을 세는 일**에서 프록시 측정 오류가 났다.

## 리뷰어들이 다시 내 서술을 교정했다

- **maintainability** — 새 주석이 "또 다른 복제본" 인지 정직하게 판정하라는 요구에, **복제
  카디널리티가 늘지 않았음**(2곳의 내용만 오류→정정)을 밝히고 직전 라운드가 잡은 "4곳 복제"
  (SoT 없는 이력 반복)와 **클래스가 다름**을 구분했다. 내가 유리하게 뭉갤 수 있는 자리였다.
- **documentation** — `bridge.ts`·`index.ts`·`use-widget.ts` 를 직접 읽어 새 주석이 코드와
  맞는지 확인하고, `codebase/`·`spec/` 전수 grep 으로 "복제본 2곳" 을 **검증했다**(같은
  문자열 기준이라 세 번째는 이쪽도 못 봤다 — 프록시 문제는 리뷰어도 공유한다).
- **cross_spec** — 영역 7문서 전수로 상호배타 서술 잔존 0 확인. `5-admin-console.md §6.1` 은
  이미 순차·머지로 서술돼 있었음을 확인했다.

## RISK: NONE
## CRITICAL_COUNT: 0
## WARNING_COUNT: 0
