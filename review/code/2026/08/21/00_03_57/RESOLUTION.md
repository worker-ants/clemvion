# RESOLUTION — 00_03_57

대상 SUMMARY: `review/code/2026/08/21/00_03_57/SUMMARY.md` (위험도 **CRITICAL**, Critical **1**, WARNING 9, INFO 다수)

**처분: CRITICAL 1 + WARNING 7 수정 · 2건 조치 불요(이미 결정·문서화).**

---

## CRITICAL — `boolean` 파라미터가 가드를 통째로 우회했다

`testing`·`api_contract`·`requirement` 세 리뷰어가 **독립적으로** 잡았다. 무수정 프로브로
실증했다:

```
BOOLEAN resolved= {"flag":true}   detected= 0     ← 완전 우회
NUMBER  threw= ...(coerce_failed)                  ← 안내가 틀린다
STRING  detected= 1                                ← 대조군
DEFAULT resolved= {"d":"***"}  detected= 1        ← 과잉 차단
```

**근본 원인은 검사 시점이었다** — 나는 `resolveTriggerParameters` **결과**를 검사했다.
`coerceToType('***', 'boolean')` 은 `Boolean('***')` → `true` 라, 검사 시점엔 원본 문자열이
이미 사라져 `isMaskedMarker(true)` 가 `typeof v === 'string'` 에서 즉시 false 다.

> **내가 이 PR 에서 "검사 순서" 를 두 번 다뤘는데 둘 다 틀린 층위였다.** 헬퍼 안에서는 값
> 검사를 깊이 검사보다 먼저 두는 데 신경 썼지만(그건 맞았다), **파이프라인 층위**에서
> coerce 가 검사를 앞선다는 것은 못 봤다. 안쪽 순서를 맞추느라 바깥 순서를 놓쳤다.

### 세 갈래가 한 원인이었다 (CRITICAL + W1 + W2)

| 갈래 | 증상 | 수정 |
| --- | --- | --- |
| `boolean` (CRITICAL) | `true` 로 캐스팅돼 완전 우회 | **raw 를 먼저 검사** |
| `number` (W1) | `coerce_failed` 가 안내를 선점 | 동상 |
| `defaultValue` (W2) | 손대지 않은 필드가 매 실행 400 | **대상 키를 raw 기준으로** 제한 |

`resolveTriggerParametersRejectingMasked(schema, raw)` 가 **순서를 소유한다** — raw 검사 →
resolve → resolve 검사. 두 번째 검사가 필요한 이유는 object/array 를 **JSON 문자열**로
보내면(`'{"apiKey":"***"}'`) 마커가 파싱 뒤에야 leaf 로 드러나기 때문이다. raw 만 봐도,
resolve 만 봐도 뚫린다.

### 재검증 (뮤테이션 3종 — 각각 다른 캐너리)

| 뮤턴트 | RED |
| --- | --- |
| raw 검사 제거 | `boolean` · `number` 캐너리 **2건** |
| resolve 후 검사 제거 | `object` JSON 문자열 캐너리 **1건** |
| 대상 키를 raw 로 제한하는 필터 제거 | `defaultValue` 과잉 차단 캐너리 **1건** |

- `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` + 테스트
- 호출부 2곳(`executions.service.ts` · `workflows.controller.ts`)

## WARNING 4 — 판정+throw 4줄이 두 호출부에 복붙 — **수정**

리뷰어가 *"이 PR 자체가 두 호출부 사이 봉투 드리프트(`errors` vs `details`)를 겪은 이력이
있어 같은 클래스가 재발하기 쉽다"* 고 짚었다. 맞다. 위 재작업에서 **함수가 순서를 소유**
하도록 바꾸면서 호출부는 한 줄이 됐다 — 세 번째 Manual 경로가 생기면 이 함수를 부르면
되고, 순서를 다시 틀릴 자리가 없다.

## WARNING 3 · 9 — 마스커↔판정기 왕복 테스트 부재 — **수정**

두 재귀는 `MAX_REDACT_DEPTH` 상수만 공유하고 **구현은 각자**다. 내 경계 테스트는
`nestObj`/`nestArr` 라는 **내 모델**을 쓰므로, 모델이 맞아도 실제 산출물과 어긋날 수 있다.

`deepRedactSecrets` 가 실제로 만든 값을 판정기에 그대로 먹이는 통합 캐너리를 추가했다.
**전제 확인을 먼저 넣었다** — 마스커가 실제로 마커를 남겼는지 단언하지 않으면 그 아래가
vacuous 하다.

## WARNING 7 — §R17 표 행이 아래 캐비엇과 다른 그림 — **수정**

표 행 라벨이 `서버 (재제출 API)` 인데, 바로 아래 캐비엇은 *"Manual 실행 경로 전체다,
재제출만이 아니다"* 로 스스로 정정한다. **정정의 출발점이던 표 행이 갱신에서 빠졌다** —
이 브랜치 시리즈에서 반복된 "주제문은 옛 값에 두고 아래에 캐비엇만 덧붙이는" 형태다.
`서버 (Manual 실행 경로)` + fresh 입력도 대상임을 행 안에 적었다.

## WARNING 5 — 트래커 W6 미종결 — **수정**

이 PR 이 곧 그 구현인데 체크박스가 `[ ]` 였다. 같은 항목 본문이 *"구현이 머지될 때
닫는다"* 고 스스로 적었고 자매 W5 는 이미 `[x]` 다. 종결하고 범위 정정 사유를 적었다.

## WARNING 8 — CHANGELOG 항목 부재 — **수정**

직전 커밋(#1188)의 CHANGELOG 항목이 *"서버측 거부는 트래커로 남겼다"* 며 **이 PR 이 닫을
작업을 예고**해 뒀는데 정작 이 변경엔 항목이 없었다. 최상단에 추가하고 그 연결고리를
명시했다.

---

## 조치 불요 (2건)

- **W6**(execute 거부 범위가 fresh 입력까지) — 이미 `23_33_00` consistency 가 잡아 spec
  §R17 캐비엇으로 명문화했고 이번 라운드 리뷰어도 *"인지·수용된 결정"* 으로 적었다.
  side-effect 관점 등재로만 남긴다.
- **INFO 다수** — 보안(에러에 값 echo 없음·O(n) 순회) · 성능(폼 규모) · 아키텍처(닫힌 union
  exhaustive 매핑) 전부 확인용.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (47s) |
| unit | PASS — backend jest **428 suites / 8,856**(baseline 8,832 대비 **+24**) |
| build | PASS (137s) + 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (209s) — backend supertest **276** · playwright **51** (`51 passed (55.7s)` 실측) |
