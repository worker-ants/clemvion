# 테스트(Testing) 리뷰 — backend-redact-depth-boundary (재실행, `16_21_03`)

## 범위

diff 24개 항목 중 실제 테스트 코드 변경은
`codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 1개뿐이다. 나머지는
`plan/complete/*.md`(2건, in-progress → complete 이동 + 내용 확정) · `plan/in-progress/*.md`(2건,
삭제된 이전 버전) · `review/code/2026/08/22/16_07_45/**`(직전 라운드 산출물) ·
`review/consistency/2026/08/22/15_35_56/**`(consistency 산출물)로, 테스트 관점 리뷰 대상이 아니다.

이번 라운드는 `16_07_45` 라운드에서 나온 scope WARNING 2건(무관한 트래커 grooming 커밋)을
분리 처분한 뒤의 재실행이다. `git show a1be4c97a` 로 확인한 결과 `16_07_45` 이후 spec 파일에는
prettier 줄바꿈 정정(3줄) 외 **동작 변경이 전혀 없다** — 직전 라운드의 testing 판정(NONE)이 그대로
유효하다는 뜻이므로, 아래는 그 판정을 독립적으로 재검증한 결과다.

## 독립 검증

- `npx jest src/shared/utils/sanitize-error-message.spec.ts` → **76/76 GREEN** (0.177s).
- 경계 연산자 뮤턴트(`depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH`)를 소스에 직접
  주입(스크래치패드에 원본 백업 후 실행, diff로 원복 확인) → 새 `[경계]` 스위트에서 **5개 RED**.
  plan 문서(`plan/complete/masked-marker-shared-package.md:206`)가 주장하는 "뮤테이션 9종,
  생존 0/9"와 같은 방향의 독립 증거.
- `deepRedactCore`의 깊이 계산을 직접 추적해 각 신규 `it`의 기대값이 실제 재귀 진입 지점(객체·배열
  분기는 `depth+1`, JSON 문자열 잎은 `redactSecretsInJsonString`이 파싱 후 `depth+1`로 재진입)과
  수학적으로 일치함을 확인 — 특히 `MAX_REDACT_DEPTH - 1` JSON 문자열 잎 테스트는 파싱이 깊이를
  한 칸 더 쓰는 것까지 정확히 반영해 기대값을 구성했다.
- `codebase/packages/masked-markers/src/index.ts:81` → `MAX_MASK_DEPTH = 10`, 리터럴을 테스트에
  박지 않고 import 해 쓰는 설계(SoT 변경에 자동 追従)를 확인.

## 평가

새로 추가된 `깊이 상한 경계 (MAX_REDACT_DEPTH)` 스위트(`it` 8종)는 이전의 vacuous한
`not.toThrow()` 단일 테스트(25겹 중첩 — 상한이 없어도, 10이 1로 바뀌어도 GREEN이었던 테스트)를
대체한다. 다음을 모두 커버한다: (1) 정확한 경계값과 그 한 칸 안쪽(`-1`), (2) 객체·배열·혼합 세
재귀 진입 경로가 같은 보폭으로 세는지, (3) 문자열 검사가 깊이 검사보다 먼저 평가되는 순서
불변식(뒤집으면 재제출 판정기가 정상 입력을 오탐 거부하게 되는 실제 위험과 연결), (4) JSON
문자열 잎을 통한 세 번째 재귀 진입점의 `depth+1` 보정, (5) 상한 없는 구현이 실제로 터지는
크기(5,000, #1188 실측 근거)로 고른 스택 오버플로 회귀 — 그리고 "던지지 않는다"만이 아니라
산출물 형태(치환 지점)까지 단언해 옛 테스트 제목이 약속만 하고 검사하지 않았던 부분을 메운다.

Mock은 사용하지 않으며 순수 함수 테스트라 적절하다. 각 `it`은 독립된 입력을 새로 생성하고
(`nestObj`/`nestArr`/`nestMixed`는 매번 새 객체 그래프를 만듦), `deepRedactSecrets`의 depth-0
identity 캐시(`DEEP_REDACT_CACHE`)는 최상위 루트 객체에만 적용되므로 테스트 간 공유되는
`PLAIN_SUBTREE` 상수가 있어도 캐시 오염이나 상태 누수가 없다(직접 추적 확인). 테스트 제목과
JSDoc이 "무엇을, 왜, 어떤 뮤테이션에 RED가 되는지"까지 명시해 가독성이 높다. `MAX_REDACT_DEPTH`를
export해 리터럴을 테스트에 박지 않는 설계는 테스트 용이성 관점에서도 바람직하다.

## 발견사항

- **[INFO]** 세 번째 깊이 상한(`MAX_SANITIZE_DEPTH`, `websocket.service.ts`)에는 대응하는 경계
  테스트가 이번 diff에 없음
  - 위치: diff 밖의 파일. `plan/complete/masked-marker-shared-package.md` (`### MAX_SANITIZE_DEPTH(websocket)는 건드리지 않는다 — 실측 근거` 절)에서 의도적 범위 제외임을 명시
  - 상세: 별개 불변식(`depth > N`, 마커 위치가 한 칸 다름)이라는 근거가 문서에 있고 이번 PR
    목적과도 무관해 갭이 아니라 의도된 스코프다. 향후 WS sanitizer를 손댈 때 같은 패턴(경계 상수
    import + 연산자/순서 뮤턴트 대조)을 적용할 선례로 남겨둔다.
  - 제안: 조치 불필요, 참고용.

- **[INFO]** `deepRedactSecretsPreserving`(preserveKeys 변형)에는 별도의 경계 테스트가 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactSecretsPreserving`
    함수 / 테스트는 `deepRedactCore`를 공유하는 `deepRedactSecrets` 경로로만 경계를 검증
  - 상세: 두 진입점이 `deepRedactCore`를 공유하므로 깊이 판정 로직 자체는 이미 간접 커버된다.
    다만 `preserveKeys`가 깊이 카운트에 영향을 주지 않는다는 점(하위 트리를 건너뛸 때 depth를
    증가시키지 않고 그대로 반환)은 이번 스위트가 직접 단언하지 않는다.
  - 제안: 우선순위 낮음. 필요 시 `preserveKeys`로 보존된 서브트리가 상한 깊이를 넘어서도 마스킹
    되지 않는다는 캐너리 1개를 추가하면 좁힐 수 있다.

- **[INFO]** 스택오버플로 회귀 테스트가 5,000-깊이 트리를 두 번 생성·순회함
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (`it('[회귀] 매우 깊은 입력에서도...')`)
  - 상세: `run` 클로저 내부에서 `nestObj(5000, ...)`를 호출하므로 `expect(run).not.toThrow()`와
    `expect(run()).toEqual(...)`가 각각 독립적으로 트리를 새로 만든다. 실질 비용은 낮다
    (`deepRedactCore`가 `MAX_REDACT_DEPTH`(10)에서 즉시 치환하므로 실제 재귀 깊이는 10에 그치고,
    `nestObj` 자체는 for 루프라 스택 위험이 없다 — 실측: 76개 전체 0.177~0.2s). 직전 라운드에서도
    같은 지적이 INFO로 나왔고 팀은 "재사용 없음 + 비용 근거 없음"으로 조치 보류를 확정했다
    (`review/code/2026/08/22/16_07_45/RESOLUTION.md`).
  - 제안: 조치 불필요(이미 처분됨). 재언급은 참고용.

## 요약

이번 diff의 테스트 실질 변경은 `sanitize-error-message.spec.ts`의 깊이 상한 경계 스위트(8종)
하나이며, 그 외 파일은 plan 문서 이동/확정과 직전 리뷰 라운드 산출물이다. 직전 라운드(`16_07_45`)
이후 spec 파일에는 prettier 포맷 정정 외 동작 변경이 없어 testing 판정은 그대로 유효하고, 이번
라운드에서 jest 실행(76/76 GREEN)과 경계 연산자 뮤턴트 직접 주입(5/8 RED)으로 plan 문서의
"경계 7종 + 뮤테이션 9종, 생존 0/9" 주장을 독립적으로 재확인했다. 이전의 vacuous한
`not.toThrow()` 단일 테스트를 정밀한 경계 스위트로 교체한 것은 이 저장소가 반복해 겪은
"판별력 없는 회귀 테스트" 패턴을 정확히 겨냥한 개선이며, mock 미사용·테스트 격리·가독성·SoT
상수 재사용 모두 양호하다. 발견된 것은 모두 스코프 확인/사소한 개선 여지 수준의 INFO이며 차단
사유가 없다.

## 위험도

NONE
