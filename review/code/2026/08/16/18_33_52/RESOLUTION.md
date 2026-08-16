# RESOLUTION — `18_33_52` (5라운드) + `18_33_59` (impl-done)

**CRITICAL 0**. 코드 리뷰 WARNING 4 + impl-done WARNING 2 — 전부 조치.

## 코드 품질 (maintainability W1·W2) — 둘 다 내가 만든 것

1. **`buildSingleQB` 중복** — 내 신규 describe 가 기존 정의를 토씨 하나 안 틀리고 복붙했다.
   최상위 describe 로 hoist 해 하나만 남겼다(`buildListQB`/`buildParentNameQB`/`buildNodeCountQB`
   와 같은 자리).

2. **리뷰 이력이 영구 소스 주석에 박제** — 지적이 옳다. `"종전 이 문장은 … 틀렸다
   (`18_14_50` documentation W1)"` 같은 서술은 이 파일을 처음 여는 사람에게 **맥락 없는 라운드
   ID** 만 남긴다. 함수 본문 3줄에 JSDoc 30줄이 된 것도 같은 뿌리다.
   → 라운드 ID·자기정정 서사를 걷어내고 **설계 근거와 보장의 경계만** 남겼다. 그 서사는
   커밋 메시지·CHANGELOG·plan 문서가 이미 담고 있다.

## 문서 (documentation W3)

CHANGELOG 신규 항목의 *"위 항목"* 이 실제로는 **아래**를 가리켰다 — 최신이 위로 쌓이는 관례
때문이다. `#1177`(아래 항목)로 직접 지칭해 위치 의존성을 없앴다.

## #4 — 리뷰어를 액면가로 받지 않았다

`requirement`(plan 5건)와 `documentation`(spec 18 · plan 5)이 **서로 다른 값**을 제시했고,
그 불일치 자체가 방법론 신호였다. 실측 결과 **둘 다 과다 계상**이다 — `grep -rl '^pending_plans:'`
는 파일 전체를 훑어 **본문 코드블록의 예시**까지 센다:

| 오탐 | 정체 |
|---|---|
| `spec/conventions/spec-impl-evidence.md` (2곳) | 그 문서가 **설명하는** frontmatter 스키마 예시 |
| `plan/complete/spec-draft-web-chat-console.md:158` | 펜스 코드블록 안의 **제안된** spec frontmatter |

내 스크립트는 각 파일의 **frontmatter 블록만** 파싱하므로 이들을 세지 않는다 → **17 · 4 가 맞다.**

**그러나 지적의 뿌리는 옳다**: 하드코딩된 수치가 이런 분쟁을 부른다. 수치를 바꾸는 대신
**세는 방법을 문서에 박았다** — frontmatter 파싱 기준 · `grep` 이 과다 계상하는 이유와 오탐
파일 2곳 · "스냅샷이라 시간이 지나면 어긋나는 것이 정상". 다음 사람이 같은 분쟁을 반복하지 않는다.

## impl-done W1 — R17 이 자기 원칙을 그 자리에서 어겼다

§R17 잔여 ③ 이 workflow-assistant 노출을 *"같은 두 컬럼"* 이라 총칭했는데 실제로는
**세 필드**(`inputData`·`outputData`·`error`)다. **바로 그 R17 이 "총칭이 아니라 열거" 를
선언한 문서**인데 내가 그 자리에서 어겼다.

세 필드로 열거하고 `4-ai-assistant.md` 를 SoT 로 링크했으며, 같은 오염을 상속한 정본 트래커
항목 제목도 함께 정정했다.

> 이 세션에서 **"총칭을 열거로" 를 요구받은 것이 두 번째**다(첫 번째는 §R17 적용 범위 자체).
> 같은 문서 안에서 같은 실수를 반복했다.

## impl-done W2 — `spec_impact` 누락

실제 변경 spec 이 6개인데 5개만 선언했다(`spec/1-data-model.md` 누락). **Gate C 는
`complete/` 이동 시점에 실행**되므로 지금 고치지 않으면 그때 막힌다.
스크립트로 `git diff --name-only ... -- spec` 과 frontmatter 선언을 대조해 **누락 0** 확인.

## 검증

- 영향 스위트 **10 suites / 132 tests PASS**
- TEST WORKFLOW 4스테이지 — lint / unit(**백엔드 427 suites · 8,776 passed**, 프런트 285 files) /
  build / **e2e 276 passed**
  > build·e2e 가 각 1회 `no space left on device` 로 실패 — **코드 회귀가 아니다**.
  > `docker image prune -af` 로 **36GB** 회수 후 통과(Docker 이미지 154개 · 38GB 였다).
