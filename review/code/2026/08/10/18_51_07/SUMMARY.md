# ai-review SUMMARY — `18_51_07` (forced 7 전원 실행)

대상: `claude/webchat-reload-rest-branches` vs `origin/main`. 단일 세션(`REVIEW_BATCH_SIZE=500`).

## 집계

| reviewer | Critical | Warning | Info | 위험도 |
|---|---|---|---|---|
| scope | 0 | 0 | — | NONE |
| requirement | 0 | 0 | 2 | LOW |
| maintainability | 0 | 1 | 3 | LOW |
| side_effect | 0 | 1 | 3 | LOW |
| documentation | 0 | — | 3 | LOW |
| testing | 0 | 1 | 4 | WARNING |
| security | **2** | 2 | 1 | **HIGH** |
| **합계** | **2** | **5** | **16** | **HIGH** |

## Critical — 방어를 한 칸 좁게 잡았다 (security, side_effect 독립 수렴)

직전 라운드에서 "토큰이 콘솔에 남는다" 를 고치면서 **`openStream` 진입점 셋 중 한 곳에만**
redaction 을 걸었다. 이번 라운드 프롬프트에 내가 직접 "자매 지점을 전수로 세라" 고 써 놓고
정확히 그 형태로 걸렸다.

### C1 — `start()` 경로

`openStream` 의 동기 throw 가 outer catch → `errMessage()` → `console.warn(e.message)` 로 흐른다.
그 메시지엔 **토큰이 쿼리로 실린 SSE URL** 이 그대로 들어 있다.

### C2 — `applyConfig` 경로

`void applyConfig(...)` 로 띄우고 try/catch 가 **아예 없다.** 같은 throw 가 unhandled rejection 이
되어 브라우저 기본 로거가 찍는다 — **애플리케이션 레벨 redaction 이 개입할 자리조차 없는** 구조다.

side_effect 는 요청받은 세 문항((a) 순수성 (b) spy 복원 (c) `throwOnce` 누출) 을 전부 "문제 없음"
으로 확인한 뒤, **그 검증 과정에서 같은 갭에 독립적으로 도달**했다.

## Warning

| # | reviewer | 내용 |
|---|---|---|
| W1 | security | SSE `onError` 가 원본 `Event` 를 통째로 로깅 — `e.target.url` 로 토큰 노출. **문자열 redaction 이 원천적으로 닿지 않는 별개 벡터** |
| W2 | security | 나머지 `console.warn` 지점들에 방어적 redact 미적용(현재는 Bearer 헤더라 직접 유출은 아님) |
| W3 | testing | 자매 파일 `use-token-refresh.test.ts:210-227` 에 **같은 취약 형태**(백오프 5초 vs 검증 여유 5초)가 남아 있다. 재현은 실패했으나 "재현 실패는 부재의 증거가 아니다" |
| W4 | maintainability | defer 항목이 plan 에만 있고 **트리거 시점에 발견될 코드 경로가 없다** — plan 제목이 "frontmatter 재판정" 이라 우연히 열어볼 이유가 없다 |
| W5 | side_effect | C1·C2 와 같은 갭(독립 발견) |

## 긍정 확인

- **scope**(NONE): `18_23_54` RESOLUTION 의 처분 주장을 `git diff` 로 대조 + 재실행(433 passed,
  tsc 0) 해 일치 확인. `redactToken` 도입 근거("이 PR 이 만든 catch 가 만든 노출")도 `git log -S`
  로 사실 확인. **한계도 정직하게 적었다** — 콜드 캐시 뮤턴트 숫자는 쓰기 권한이 없어 재현 못 함.
- **requirement**(Critical/Warning 0): `status: implemented` 정당성을 spec 원문 대조 + 독립 재실행
  으로 확인. 새 잔여 둘 다 spec 본문 약속을 미룬 것이 아님을 §3.1-3 문언("위 복원에서" 스코프)으로 확인.
- **testing**: 위젯 파일에서 `shouldAdvanceTime` 을 쓰는 6개 블록을 **개별 근거와 함께 전수 판정** —
  취약한 2개는 이미 넓혀졌고 나머지 4개는 구조적으로 안전(항상 실패하는 mock / positive control /
  큰 마진). 이 파일 안에는 놓친 자매가 없다.
- **documentation**(Critical 0): 직전 CRITICAL·WARNING 처분이 전부 반영됐음을 확인.

## 이 라운드의 성격

**동작 결함 0.** 두 CRITICAL 은 전부 "직전 라운드의 fix 가 덮는 면적이 좁았다" 이고, W3·W4 도
같은 문장의 다른 얼굴이다 — 테스트를 넓힐 때 자매 파일을 안 봤고, defer 를 등재할 때 발견 경로를
안 만들었다.

**이 브랜치에서 일곱 번째다.** 그리고 이번엔 내가 그 위험을 프롬프트에 명시적으로 적어 리뷰어에게
확인을 시킨 라운드에서 났다 — **위험을 아는 것과 그 시점에 세는 것은 다른 일이다.**

## RISK: HIGH
## CRITICAL_COUNT: 2
## WARNING_COUNT: 5
