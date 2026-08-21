# RESOLUTION — 03_14_16

대상 SUMMARY: `review/code/2026/08/21/03_14_16/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **3**, INFO 14)

**처분: W1 수정(설계 반전), W2·W3 은 리뷰어 자체 판정대로 조치 불요.** INFO 14건은 미조치 —
직전 라운드에 정한 멈춤 규칙(INFO 는 이 PR 에서 더 손대지 않고 트래커로) 적용.

> 이 라운드는 한 번 **한도 소진으로 통째 실패**했다(reviewer 10명 전원 `session limit`,
> 리포트 0건). 리뷰 결과가 아니라 인프라 실패였으므로 같은 세션 디렉터리로 재실행했다.
> 빈 세션 디렉터리는 게이트를 거짓 통과시킬 수 있어(선례 있음) 채워지기 전엔 push 하지 않았다.

---

## WARNING 1 — 가드가 **네 번째** 같은 결함 클래스 (security) — **수정: 정규식 → AST**

### 먼저 실증했다 (무수정 프로브)

```
탐지     A. named                          탐지     E'. named + as 리네임
탐지     B. namespace + dot
탐지     C. require 구조분해
미탐지   D. 동적 import 구조분해            ← 리뷰어 지적
미탐지   E. bracket 멤버 접근               ← 리뷰어 지적
미탐지   F. require + 콜론 리네임           ← 리뷰어 지적
```

세 건 모두 사실이었다.

### 이번엔 패치하지 않았다

초판 이후 라운드마다 형태를 하나씩 덧대 왔다(named → +namespace → +require → 이제 +3).
**형태를 덧대는 방식이 문제였다** — 다음 라운드에 다섯 번째가 나온다.

결정적인 것은 그 함수의 주석이었다. *"판정 대상이 import 문 하나라 문법 표면이 좁다 —
정본 파서를 끌어오는 비용이 이득을 넘는다"* 고 **내가 단언해 뒀는데, 그 단언이 네 번
반증됐다.** 표면은 좁지 않다.

`typescript` 는 backend 직접 의존성(5.9.3)이고 TS 소스에는 **정본 파서**가 있다. 판정 규칙이
두 줄로 줄었다:

1. **식별자 위치**의 `BASE_FN` — named·`as` 리네임·구조분해 `propertyName`·멤버 접근·직접
   호출이 전부 이 하나로 모인다.
2. **element access 의 문자열 인자** — `b['resolveTriggerParameters']` 는 문자열이지만 코드다.

부수 효과 두 가지가 공짜로 따라왔다:

- **`stripCommentsAndStrings` 가 통째로 사라졌다** — 주석·문자열은 애초에 식별자가 아니다.
  `02_04_38` W1(JSDoc 예시를 실제 import 로 오판)의 **원인 자체**가 없어졌다. 살아있는
  소비처 0건 실측 후 삭제.
- **접두 겹침**(`…RejectingMasked`)도 파서에겐 그냥 다른 식별자다. 단어 경계를 손으로 맞출
  일이 없다.

> 이건 "정규식보다 AST 가 낫다" 는 일반론이 아니다. 이 저장소에서 **정규식이 이긴 사례**도
> 있다(문법도 정본 파서도 없는 셸 명령 대상). 기준은 *대상에 진짜 문법과 정본 파서가 있는가*
> 이고, TS 소스는 둘 다 있다.

### 동작 변화 1건 — 정직하게 등재

AST 는 `export function resolveTriggerParameters` 의 **선언 이름**도 식별자로 본다. 전수
스캔(1237 파일, 110ms) 결과 base 모듈 자신이 새로 잡혔다. "선언은 사용이 아니다" 를 파서로
가르는 대신 허용목록 한 줄로 뒀다 — 읽는 쪽이 쉽다. 죽은 항목 0건.

### 재검증 (뮤테이션 3종, 전부 RED)

| 뮤턴트 | 죽은 테스트 |
| --- | --- |
| element-access 분기 무력화 | `bracket` 캐너리 **1건만** — 정확히 겨냥됨 |
| 정확일치 → `startsWith` | wrapper 오탐 캐너리 2건 + 실제 스캔 2건 |
| substring 선별을 판정으로 승격(파서 무력화) | 주석·문자열 캐너리 **3건 전부** + 4건 |

캐너리는 8 → 15개. 7개 우회 형태 각각을 `it.each` 로 나눠 **어느 형태가 깨졌는지** 실패
메시지에 드러나게 했다.

### 파생 결함 — devDependency 를 프로덕션 번들로 끌어들일 뻔했다

AST 전환은 `src/` 하위 파일에서 `typescript` 를 import 한다. 확인해 보니:

- `typescript` 는 **devDependency**
- `tsconfig.build.json` 의 제외 패턴은 `**/*spec.ts` 뿐 — `*-guard.ts` 는 안 걸린다
- 그래서 `dist/repo-guards/**` 가 **이미 나가고 있었다**(선존). 거기에 내가
  `require("typescript")` 를 얹으면 devDependency 가 없는 프로덕션 설치에서 지뢰가 된다

repo-guards 는 프로덕션 소비처 **0건**(실측)이므로 `src/repo-guards/**` 를 빌드에서 제외했다.
클린 빌드 후 `dist` 내 `require("typescript")` **0건** 확인. 타입체크 ratchet 은
`tsconfig.json` 을 쓰므로(스크립트 실측) 이 제외가 사각지대를 만들지 않는다 — 199건/38파일
baseline 그대로.

## WARNING 2 — developer 턴이 `spec/` 를 직접 편집 (scope) — **조치 불요**

리뷰어 판정 그대로다. 같은 PR 안에서 `git log -S` 로 스스로 발견해 planner 턴으로 절차대로
회수·정규화했다(`871d3fcb0`). 재작업 대상 아님.

## WARNING 3 — `execute` 엔드포인트 값 도메인 축소 (side_effect) — **조치 불요**

의도된 계약 축소이고 CHANGELOG·spec·테스트에 근거가 남아 있다. 다만 리뷰어 권고대로
**릴리스 노트에서 breaking 표면을 재확인**할 대상으로 남긴다 — 사용자 확인 결과 저장소 외부
소비자는 없다(프런트가 유일 소비자).

## 미조치 INFO (14건)

전부 이월 확인 또는 리뷰어 스스로 "조치 불요·필수 아님" 판정. 대표적으로 — 최상위
`error.code` 선존 drift · Swagger 예약어 노트 · `schema=null` 명시 케이스 ·
`findMaskedResubmissions` export 범위 · 파일명 어순 · 한/영 주석 혼재 · OpenAPI example.

INFO-8 의 절반(`stripCommentsAndStrings` 직접 테스트 부재)은 **W1 수정으로 소멸**했다 —
함수 자체가 없어졌다.

## 수렴 판정

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| `00_03_57` | **1** | 9 | boolean 완전 우회 — 검사 시점 |
| `00_39_27` | 0 | 5 | 절차 위반 · 폐기된 설계를 지시하던 spec |
| `01_15_47` | 0 | 0 | INFO 만 |
| `01_38_26` | 0 | 3 | 가드 부재 |
| `02_04_38` | 0 | 3 | **가드 자신의 결함** |
| `02_29_01` | 0 | 0 | — |
| `02_49_22` | 0 | 1 | 가드 우회 형태 |
| `03_14_16` | 0 | 3 | 가드 우회 형태(4번째) + 조치 불요 2 |

**런타임 방어**(거부 로직·두 호출부·에러 봉투)는 `01_15_47` 이후 일곱 라운드 연속
CRITICAL 0 / WARNING 0 이다. 남은 지적은 전부 2차 안전망인 repo-guard 한 파일에 몰려 있었고,
그 파일을 이번에 정규식에서 파서로 뒤집었다 — 형태를 덧대는 루프를 끊었다.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (47s) |
| unit | PASS — backend jest **429 suites / 8,876 passed** (1 skipped, 8,877 total) |
| build | PASS (136s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (216s) — backend supertest **276** · playwright **51 passed (55.8s)** 실측 |
