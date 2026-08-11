# RESOLUTION — `12_56_06`

Critical 0 / Warning 1 **처분 완료**.

## W1 (maintainability WARNING · testing INFO 수렴) — 자매를 한 `it()` 에 담았다 → **분리**

리뷰어의 지적이 정확하다. 나는 커밋 메시지와 docstring 양쪽에

> "한 테스트에 자매 둘을 담으면 앞이 뒤를 가린다"

라고 **진단해 놓고 구조는 그대로 두었다**. 진단하는 문장만 쓰고 형태를 안 바꾸면, 이 파일을
본떠 쓰는 다음 사람이 같은 함정을 그대로 재현한다.

`rotateNotificationSecret` / `revokePerTriggerToken` 을 각각 자기 `it()` 로 분리했다.

**분리가 판별력을 죽이지 않았는지 다시 세웠다** — 형태를 바꿨으면 증거도 다시 만들어야 한다:

| 뮤턴트 | 결과 |
|---|---|
| A — `rotateNotificationSecret` 만 audit→save 반전 | notification 테스트 **RED**, interaction 테스트 GREEN |
| B — `revokePerTriggerToken` 만 반전 | interaction 테스트 **RED**, notification 테스트 GREEN |

분리 전에는 A 를 심어도 "한 테스트가 실패" 로만 보였고 어느 자매인지는 실패 줄 번호로
역산해야 했다. 이제 **뮤턴트와 실패 테스트가 1:1 로 대응**한다 — 그게 분리가 산 것이다.

원복은 `cp`, `git status` 로 `triggers.service.ts` 잔여 0 확인.

## 등재 처분 (코드 무수정) — 5건

전부 INFO 이고 리뷰어 스스로 "조치 불필요" 또는 "다음 확장 시점" 으로 판정한 것들이다.
주석 비중·자기 이력 서술 두 건만 `plan/` 에 남기고(다음에 이 파일을 확장할 때 걸리도록),
나머지 셋(커밋 설명 세부·산출물 커밋 타이밍·줄바꿈)은 이 문서가 종착점이다.

## 검증

- 트리거+감사 **172 passed**(직전 171 → +1, 테스트 하나가 둘로 갈렸다).
- 뮤테이션 **누적 11종**.
- `triggers.service.ts`(production) 이번에도 **무변경**.

## 수렴 판정

7명 중 **6명 NONE**, scope 는 독립적으로 "머지 가능". 남은 하나(maintainability LOW)의
WARNING 도 이 문서로 닫혔다.

발견의 성격이 **동작(라운드1 CRITICAL) → 커버리지(라운드2) → 구조/진단정밀도(라운드3)** 로
얕아졌다. "발견 0" 이 아니라 이 궤적이 수렴 신호다. 다음 라운드는 이 분리 자체를 확인하는
용도이며, 그 뒤 머지한다.
