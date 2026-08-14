# RESOLUTION — `00_02_43`

ai-review **CRITICAL 0 / WARNING 3**. 전부 조치.

## W1 — breaking change 통지 (api_contract)

**리뷰어가 조치 완료로 판정.** CHANGELOG 의 *"수신자 영향 (breaking)"* 절을 직접 확인하고
추가 조치 불요라 했다. 외부 webhook payload 에 스키마 버전 필드를 얹는 안은 백로그 제안으로
남겼고, 활성 구독자 확인은 이미 plan 에 운영 항목으로 등재돼 있다.

## W2 — 제목이 "placeholder" 라 부르는 동안 동작은 달랐다 (testing)

**조치 완료.** 헬퍼로 통일한 뒤 스칼라 입력(`42`)은 placeholder(`'unknown error'`)가 아니라
**문자열화**(`'42'`)된다. 그런데 테스트는 `code: null` 만 단언하고 `message` 를 보지 않아
**제목과 실제 동작의 괴리가 드러나지 않았다.** `message` 단언 추가 + 제목 정정.

## W3 — 내가 쓴 첫 테스트가 그 분기를 못 갈랐다 (testing)

**조치 완료 — 다만 두 번 썼다.**

초판은 `{error:{code:'X'}}` / `{}` fixture 로 "폴백이 돈다" 를 단언했는데, **뮤테이션에서
생존했다**(`?? "Execution failed before the tool completed"` 를 지워도 GREEN).

원인: 그 폴백은 `flushPendingToolItemsAsError` 안에 있고, **dangling pending tool item 이
있어야 관측된다.** 초판은 그 셋업 없이 스토어 상태만 봤다 — 관측 지점이 분기 밖이었다.

자매 테스트(`execution.failed flips dangling pending tool items…`)와 같은 셋업으로 재작성해
같은 뮤턴트에서 **2건 RED** 확인.

> **교훈**: 이번 라운드에서 리뷰어가 준 것은 "이 분기가 안 걸려 있다" 였고, 나는 그 분기를
> **겨냥했다고 생각한 테스트**를 썼다. 뮤테이션이 아니었으면 갭을 메웠다고 보고했을 것이다.
> **테스트를 추가한 뒤에도 뮤턴트를 돌려야 한다** — 추가했다는 사실이 판별력을 뜻하지 않는다.
> 이 브랜치에서 뮤테이션이 커버리지 갭을 잡은 것이 네 번째다(타입가드 · sentinel code ·
> 자식 cascade · 이번 폴백).

## INFO 넘김

14건 전부 이월·재확인성이며 대부분 3~4라운드 연속 같은 판정이다.

| # | 처분 |
|---|---|
| 1 (`message`/`details` 마스킹) | 별도 트래커. 리뷰어가 `details` 는 **producer 4곳이 채우지 않아 dead path** 임을 확인 |
| 2 (타입 2중 선언) | 안정적. 필드 추가 시 `Pick<>` 고려 |
| 3 (`cancelled` 미통일) | 3계층 명시 추적 — 은폐 아님 |
| 4 (emit 경계 `unknown`) | 이 PR 이 고친 CRITICAL 의 근본 원인. 별건 등재됨 |
| 5·6 (스코프·산출물 비중) | 리뷰어 전수 대조로 무단 확장 아님 확인 |
| 7·8 (dead field 제거·`code` 완화) | 다운스트림 전수 확인, 영향 없음 |
| 9~12·14 | 기결정, 라운드마다 재확인 |
| 13 | positive — 이전 4라운드 문서 지적(죽은 plan 참조 · §6/§6.4 자기모순 5곳 · 체크리스트 지연)이 실제로 해소됐음을 리뷰어가 전수 재검증 |

## 검증

- 백엔드 **424 suites / 8674 passed** · 프런트 WS+가드 **27 files / 3117 passed**
- lint `--max-warnings 0` · 타입 199(래칫 동일)
- W3 판별력: 폴백 제거 뮤턴트에서 2건 RED (초판은 생존 → 재작성)
