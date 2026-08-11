# ai-review SUMMARY — `10_02_22` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main`. 단일 세션(119파일).

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| security | 0 | 2 | 1 | LOW |
| scope | 0 | 1 | 2 | LOW |
| testing | 0 | 1 | 2 | MEDIUM |
| maintainability | 0 | 1 | 2 | LOW |
| side_effect | 0 | 2 | 1 | MEDIUM |
| documentation | **1** | 1 | 2 | HIGH |
| requirement | **1** | 1 | 1 | HIGH |
| **합계** | **2** | **9** | **11** | **HIGH** |

## Critical

### C1 (requirement · side_effect 독립 수렴) — 내 fix 가 부팅 실패를 조용히 삼켰다

직전 라운드에 `applyConfig` 의 unhandled rejection 을 닫으면서 `runApplyConfig` 의 catch 가
**로그만 남기고 상태 전이를 하지 않았다.** 복원 분기는 `RESTORED`(phase→`streaming`)를 **먼저**
dispatch 한 뒤 `openStream` 을 부르므로, 거기서 던지면 위젯이 **스피너에 영구 고착**된다.
바로 다음 줄인 `scheduleRefresh()` 에도 못 미쳐 복구 사이클조차 없다.

`start()` 는 같은 자리에서 `dispatch({type:"ERROR", message: errMessage(e)})` 를 내는데 이쪽만
안 했다. 게다가 `4-security.md §5` 는 `errMessage` 를 "에러 문구 정책의 코드 SoT" 로 지목하는데
내 catch 는 그 함수를 우회해 직접 `console.warn` 했다 — 정책이 이 경로에만 적용되지 않는다.

**이 PR 이 고치려던 형태를 이 PR 의 fix 가 다시 만들었다.**

### C2 (documentation) — Gate C 빌드 가드가 깨져 있었다

`plan/complete/webchat-reload-rest-error-branches.md` 를 옮기면서 `spec_impact` 를 선언하지
않아 `spec-plan-completion.test.ts` 가 FAIL 한다. 리뷰어가 재현했고 오케스트레이터도 재현했다
(필드를 빼면 RED, 넣으면 GREEN).

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | side_effect · requirement | SSE `onError` 를 `e.type` 으로 줄인 것은 **죽은 필드** — 스펙상 항상 `"error"` 라 진단 정보가 0. 로그가 존재하던 이유(CORS·네트워크 진단)를 없앴다 |
| W2 | security · scope · testing (**3인 수렴**) | 세 진입점 중 `applyConfig` 만 회귀가 없다 — 뮤턴트가 435건 전부를 통과 |
| W3 | security | cross-origin 위협 모델 정정을 `eia-client.ts` 에만 하고 **테스트 파일의 사본을 빠뜨렸다** |
| W4 | documentation | CHANGELOG 가 이번 보안 수정을 전혀 반영하지 않는다 |
| W5 | maintainability | SSE `onError` 인라인 표현식이 길다 — 헬퍼 추출 권장 |
| W6 | scope | `applyConfig` fix 의 테스트 공백이 어느 문서에도 기록되지 않았다 |
| W7 | requirement | 커밋 메시지가 redaction 3곳을 고쳤다고 하는데 그중 하나는 검증되지 않았다 |

## 긍정 확인

- **security**(LOW, Critical 0): 직전 CRITICAL 2건이 **전수 반영**됐음을 4개 로그 지점으로 확인.
  REST 3종은 토큰을 헤더로만 보내 애초에 대상이 아님도 재확인. cross-origin 정정도
  `0-architecture.md §R1/§R5` 대조로 **기술적으로 유효** 판정.
- **testing**: 요청한 두 확인(`shouldAdvanceTime` 제거의 충분성 / 신규 회귀 2건의 비-vacuity)을
  scratch 뮤테이션으로 **독립 재현 성공**.
- **scope**: `18_51_07` RESOLUTION 의 세 주장을 `git show` 로 대조 — 전부 사실, 과대주장 없음.
  범위 확장 (b)(c)가 기존 결함임도 git 최초 커밋까지 추적해 확인.
- **maintainability**: breadcrumb·`runApplyConfig` 헬퍼 양호.

## 이 라운드의 성격

**C1 은 여덟 번째 같은 뿌리다** — 고친 값·범위가 인접 표면을 보는지 확인하지 않았다. 이번엔
"예외를 닫는다" 를 로그로만 이해하고 **상태 전이라는 인접 면**을 빼먹었다.

W3 은 그 축의 가장 작은 형태다: **틀린 문장을 정정하면서 그 문장의 사본을 한쪽만 고쳤다.**

## RISK: HIGH
## CRITICAL_COUNT: 2
## WARNING_COUNT: 7
