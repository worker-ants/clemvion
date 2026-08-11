# 요구사항(Requirement) Review — `9416da806` (테스트 주석 1줄 + plan 회고 절)

대상 델타: 커밋 `9416da806`만 (`codebase/channel-web-chat/src/widget/use-widget.test.ts` 주석 2줄,
`plan/complete/webchat-boot-apibase-scheme-validation.md` 회고 절 29줄 추가). 실행 코드 변경 0줄.
그 외 첨부 파일(use-widget.ts/use-widget.test.ts 전체, review/**, plan/in-progress/webchat-auth-session-status-reconcile.md
등)은 이전 라운드 산출물로, 이번 델타의 컨텍스트 검증용으로만 열람했다.

## 검증 절차 (직접 실측)

### 1. plan 수치(451 / 신규 9) — 실제 테스트 실행으로 확인

```
$ npx vitest run   (codebase/channel-web-chat)
 Test Files  23 passed (23)
      Tests  451 passed (451)
```

신규 테스트 수도 diff 로 직접 셌다 (`git diff da078a63f 9416da806` 기준, PR 시작 직전 커밋과 비교):

```
use-widget.test.ts            신규 it( ) 6건
use-widget-eager-start.test.ts 신규 it( ) 3건
```

6+3=9. `plan/complete/webchat-boot-apibase-scheme-validation.md` 의 "**단위 6건**
(`use-widget.test.ts`) + **호출부 통합 3건**(`use-widget-eager-start.test.ts`)" 및 "최종은
**451 passed**(신규 9)" 서술과 실측이 정확히 일치한다. 라운드1 시점 448 passed 라는 병기도
`3f1169ab5`(라운드1 구현, 6개 단위 테스트 포함) 시점과 정합 — 거짓 없음.

### 2. 라운드 1~5 회고 표 — 커밋 이력과 행 단위 대조

plan 표:

| 라운드 | 복제된 사실 | 고친 곳 | 놓친 곳 |
| --- | --- | --- | --- |
| 1 (`15_16_20`) | boot 검증 배선 | 헬퍼 단위 테스트 | 호출부 |
| 2 (`15_32_44`) | "applyConfig 가 자기 자리에서 실패한다"(거짓) | spec §R0 | safeApiBase JSDoc |
| 3 (`15_50_53`) | §R0→§R7 재번호 | spec·plan | 같은 커밋이 새로 쓴 JSDoc (6명 수렴) |
| 4 (`16_06_02`) | "쿼리 경로는 샘플 전용이 아니다" | spec §1 | 코드 주석 2곳 |
| 5 (`16_21_15`) | 위와 같음 | 코드 주석 2곳 | 테스트 주석 1곳 |

대응 커밋을 각각 열어 대조했다:

- **라운드1 → `d8abc7003`**: "testing CRITICAL — 헬퍼만 지키고 호출부는 무방비였다"
  (`mergeBootConfig` 단위 6건은 함수 직접 호출, 호출부 `bridge.onBoot` 을 옛 spread 로 되돌려도
  204건 전부 초록). 통합 회귀 2건 추가. 표 행과 정확히 일치.
- **라운드2 → `99d3e9000`**: "documentation CRITICAL — 정정의 자매를 또 놓쳤다" — spec §R0 은
  고쳤지만 그 spec 이 "코드 SoT" 로 지목한 `safeApiBase` JSDoc 은 그대로 뒀다는 서술. 표 행과 일치.
- **라운드3 → `4479e771b`**: "6명이 같은 자리를 짚었다 — `use-widget.ts:197` 의 죽은 §R0" — R0→R7
  재번호와 같은 커밋에서 새로 쓴 JSDoc 이 죽은 앵커를 인용. `scope·rationale_continuity·
  naming_collision·convention·documentation·side_effect` **정확히 6명**. 표 행과 일치.
- **라운드4 → `df1375208`**: "spec 은 '샘플 전용으로 읽지 마라' 고 쓰고, 코드 주석은 '샘플' 이라
  했다" — `configFromQuery` JSDoc + 직접 로드 폴백 호출부 주석 **2곳**을 diff 로 직접 확인(둘 다
  "host 없이 직접 로드/샘플" 표현을 포함하고 있었음). 표 행과 일치.
- **라운드5 → `9416da806`(현재 델타)**: "'정확히 2곳' 이 틀렸다" — 직전 커밋이 "grep 으로 정확히
  2곳" 이라 썼으나 세 번째 복제본(`use-widget.test.ts:15` 의 `direct-load 외부 입력 방어`)이
  다른 문구라 grep 을 통과했다는 서술. `review/code/2026/08/11/16_19_38/SUMMARY.md` +
  `review/consistency/2026/08/11/16_21_15/*` 를 열어 대조 — `16_19_38`(코드 7) 은 전원 NONE,
  `16_21_15`(consistency, rationale_continuity) 가 세 번째 복제본을 잡았다는 서술과 정확히
  일치한다. 표가 라운드 식별자로 `16_21_15`(consistency) 만 적어 짝인 `16_19_38`(코드) 을
  안 적었지만, 그 라운드의 SUMMARY 제목 자체가 "`16_19_38`(forced 7) + consistency `16_21_15`(5)"
  이고 실제 발견은 consistency 쪽에서 났으므로 대표 식별자로 축약한 것은 사실과 어긋나지 않는다.

**"다섯 번"** 이라는 수: 라운드1~5 가 각각 서로 다른 커밋(`d8abc7003`·`99d3e9000`·`4479e771b`·
`df1375208`·`9416da806`)에 대응하고, 다섯 커밋 모두 "복제된 사실 하나를 한 곳만 고친다" 패턴을
공통 주제로 삼고 있음을 커밋 메시지 원문으로 확인했다 — 개수·행 서술 모두 실측과 일치한다.

추가로 잔존 여부를 직접 grep 으로 재확인했다(문자열이 아니라 라운드5 가 지적한 것과 같은 의미
축으로): `codebase/channel-web-chat/src/` 전체에서 "샘플"/"host 없이"/"direct-load" 관련 문구를
훑었다. 남아 있는 것은 (a) 이미 정정된 부정문("샘플/개발 전용이 아니다" 류) 뿐이고, (b)
`api-base.ts:5` 의 "direct-load 쿼리 하드닝 참고" 는 단순 상호참조로 "전용" 주장을 하지 않으며,
(c) `use-widget-eager-start.test.ts:4248` 의 "host 없이 직접 로드 폴백" 은 그 폴백 코드의 실제
동작(host 유무를 검사하지 않는 조건문)을 정확히 서술하는 테스트 설계 주석이라 문제의 거짓 주장과
다르다. 6번째 복제본은 확인되지 않았다.

### 3. plan 체크리스트 · `spec_impact` 유효성

`plan/complete/webchat-boot-apibase-scheme-validation.md` frontmatter:

```
status: complete
spec_impact:
  - spec/7-channel-web-chat/4-security.md
  - spec/7-channel-web-chat/2-sdk.md
```

리스트 형식(Gate C 충족, bare string·빈 배열 아님) — 두 파일 모두 이 PR 라운드들에서 실제로
수정됐음을 각 커밋 diff 로 확인(`4-security.md` 는 §1 + §R7, `2-sdk.md` 는 `BootConfig.apiBase`
주석). 체크리스트 3항목:

- `[x] wc:boot 경로에도 동등한 스킴 검증 적용 판정 — 적용한다` — `safeApiBase(raw, source)` 로
  일반화된 구현이 실재(`use-widget.ts:204`), 판정 근거(위젯이 CDN origin iframe 에서 도는 것)도
  `bridge.ts`·`0-architecture.md` §4 정의와 일치.
- `[x] 구현 + 회귀 테스트` — 위 §1 로 수치 재확인 완료.
- `[x] (근거를 §R7 + safeApiBase JSDoc 양쪽에 남김)` — 두 자리 모두 직접 읽어 확인. `4-security.md`
  §R7(272행)과 `use-widget.ts` 의 `safeApiBase` JSDoc(166~203행)이 "기각한 대안"·"정당한
  비-http(s) 배포는 없다"·"진단은 거절 지점에만 있다" 세 논거를 동일하게 담고 있다.

`plan/in-progress/webchat-boot-apibase-scheme-validation.md` (선행 티켓) 는 삭제돼 있고
(`find plan -iname "*apibase-scheme*"` → `plan/complete/` 1건만 존재), lifecycle 이동이 정상
완료됐다.

### 4. 원래 plan 요구사항 전수 점검

원 티켓의 문제 정의("비대칭 하드닝")·체크리스트 3항목·관련 링크 모두 위에서 확인한 대로 이행
완료됐다. `plan/in-progress/webchat-auth-session-status-reconcile.md` 의 "완료 조건" 표(10행)도
그 문서의 10개 섹션과 1:1 대응함을 확인했다(이 델타 이전 라운드에서 이미 동기화됨 — 현재 델타는
이 파일을 건드리지 않는다). `applyConfig` 조용한 early return 관련 체크리스트는 여전히 미착수
`[ ]` 상태이지만, plan 자체가 "**도달 경로 전수 확인 후** — 도달 가능하면 관측 가능화" 로 조건부
후속 작업임을 명시하고 있어 이번 델타의 완료 조건이 아니다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 델타(테스트 주석 정정 + plan 회고 절)의 모든 사실 주장을 실행·
git 이력·spec 본문 대조로 검증했고 어긋나는 지점을 찾지 못했다.

## 요약

이번 델타는 실행 코드 변경이 없는 문서/주석 정정이다. plan 이 주장하는 두 핵심 수치(451 passed,
신규 9 = 단위 6 + 통합 3)는 `vitest run` 직접 실행과 diff 상의 `it()` 건수 집계로 정확히
재현됐다. 새로 추가된 "라운드 2~5 회고" 표는 다섯 개 서로 다른 커밋(`d8abc7003`·`99d3e9000`·
`4479e771b`·`df1375208`·`9416da806`)의 실제 커밋 메시지·diff 내용과 행 단위로 일치하며,
"다섯 번" 이라는 수·각 라운드가 놓친 자리 서술 모두 지어낸 것이 아니라 실제 리뷰/커밋 이력을
정확히 반영한다. 라운드5 가 지적한 "샘플/host-less 전용" 서술의 세 번째 복제본(테스트 주석)이
이번 델타로 실제로 정정됐고, 저장소 전체를 다시 훑어도 같은 의미의 네 번째 복제본은 발견되지
않았다. plan 체크리스트 3항목·`spec_impact` 리스트·lifecycle 이동(in-progress 삭제 → complete)
모두 실제 상태와 부합한다. 억지로 만든 발견 없이, 검증 결과 그대로 위험도 NONE 으로 판단한다.

## 위험도

NONE
STATUS: OK
