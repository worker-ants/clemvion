# ai-review SUMMARY — `10_24_54` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main`.

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| security | 0 | 0 | 3 | **NONE** |
| documentation | 0 | 0 | 3 | **NONE** |
| requirement | 0 | 1 | 2 | LOW |
| maintainability | 0 | 2 | 4 | LOW |
| testing | 0 | 1 | 1 | LOW |
| scope | 0 | 1 | 5 | MEDIUM |
| side_effect | 0 | 1 | 1 | MEDIUM |
| **합계** | **0** | **6** | **19** | MEDIUM |

## **CRITICAL 0 — 라운드 6 이후 처음이다**

라운드 7~10 은 전부 직전 라운드 fix 가 만든 결함으로 열렸다. 이번엔 그 사슬이 끊겼다.

- **security**(NONE): 세 확인축(readyState 유출 / `errMessage` 일반화 계약 / 틀린 문장 잔존)
  전부 통과. `panel.tsx` 가 `state.error` 를 렌더하지 않고 카탈로그를 재조회해 **이중으로
  일반화**된다는 것까지 확인.
- **documentation**(NONE): `spec_impact` 가 실제 diff 와 정확히 일치(넓지도 좁지도 않음).
  CHANGELOG 의 "위협 모델이 좁다" 도 `0-architecture §2.1` 의 same-origin carve-out 과 대조해
  **지어낸 것이 아님** 확인. 문서-코드 정합성 전수 통과.
- **requirement**: fix 가 spec 과 line-level 일치. "부팅 전 실패가 미개봉 위젯을 ended 로
  만드는가" 는 전수 추적 결과 트리거 없음. `status: implemented` 는 세 진입점 정책이
  동형화돼 **오히려 더 정당해졌다**.

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | testing | `sseErrorDetail` 에 **직접 회귀가 없다** — 추출 로직을 뭉개도 75건 전부 GREEN |
| W2 | maintainability | 그 헬퍼가 `useWidget()` 안에 있는데 들여쓰기 0칸이라 module-level 로 오독되고, `openStream` 의 JSDoc 과 정의 사이에 끼었다 |
| W3 | maintainability | 주석 **719/1358줄(52.9%)** — 같은 설명이 네 곳에 전문 복제 |
| W4 | requirement | `4-security.md §5` 인용이 §1 표 행을 가리켜야 한다(선행 오류) |
| W5 | side_effect | `runApplyConfig` catch 에 stale 가드 부재 — **재현 경로는 못 찾음**(구조적으로 `attempt` 토큰이 클로저에 없음) |
| W6 | scope | `10_02_22/SUMMARY.md` 의 reviewer별 Warning 개수 표가 본문 나열과 어긋난다 |

## 이 라운드가 말하는 것

발견의 성격이 **동작 → 커버리지·배치·밀도**로 완전히 내려왔다. W1 은 "내가 만든 헬퍼에 회귀를
안 붙였다" 이고 W2·W3 은 배치와 분량, W4 는 선행 인용 오류, W5 는 재현되지 않는 구조 비대칭이다.

**scope 의 "어디서 멈췄어야 했나" 판정**: 지금 형태는 응집적이며(코드 footprint 가 하나의 인과
사슬 위에 있고 무관 모듈 없음), 굳이 꼽자면 redaction 전수화가 끝난 `18_23_54`~`18_51_07` 이후가
경계였다는 의견.

## RISK: MEDIUM
## CRITICAL_COUNT: 0
## WARNING_COUNT: 6
