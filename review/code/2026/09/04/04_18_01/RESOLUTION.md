# RESOLUTION — repo-guard walker 통합 + 낡은 spec 캐스트 가드 리뷰 8R

대상 SUMMARY: 위험도 **MEDIUM** · Critical **0** · Warning **1** · INFO 15
reviewer 7명 결과 확보(forced 7명 전원).

## W1 — 자매 중 하나만 하드닝했고, **안 고친 쪽이 더 비쌌다**

3R 에서 `isNullableType()` 을 만들어 `widenedEntityFields` 를 하드닝했다. 같은 파일의
`findUntypedNullableColumns` 는 **옛 `tsType.includes('| null')` 을 그대로 뒀다.**

두 함수가 막는 것의 무게가 다르다:

| 함수 | 놓치면 |
|---|---|
| `widenedEntityFields` | 낡은 캐스트를 못 잡는다 (불편) |
| `findUntypedNullableColumns` | **앱이 부팅을 못 한다** (`DataTypeNotSupportedError`, 배치 1 실제 사고) |

**더 비싼 쪽을 안 고쳤다.** 이 changeset 이 내내 다룬 "자매 중 하나만 고친다" 가 판정 함수
자신에게 났다.

### 조치

- `findUntypedNullableColumns` 를 `isNullableType()` 로 교체(같은 파일, 호이스팅되므로 이동
  불필요 — **블록을 옮기지 않았다.** 7R 의 JSDoc orphan 이 블록 이동에서 났다).
- `isNullableType` docstring 에 **소비처가 둘임을 명시**했다. 다시 갈라지면 그 문장이 거짓이 된다.
- `widenedEntityFields` 의 `it.each` 와 **대칭인 캐너리 3건**을 추가했다. 두 함수가 다시
  갈라지지 않게 하는 것은 판정 함수 공유가 아니라 **양쪽의 캐너리**다 — 공유는 이번에도
  했지만 갈라졌다.
- **뮤테이션**: 옛 판정으로 되돌리면 예측대로 **2건 RED**(공백 없음 · 순서 반대).

## INFO 15건 — 전부 조치 없음, 새 항목 없음

7R 과 같이 **새로운 항목이 하나도 없다.** 전부 앞선 라운드에서 판단·유예된 항목의 재확인이다.
`INFO#8`(균형 괄호 정규식 조각 3회 반복)만 이번에 처음 명시됐는데, 리뷰어도 "다음에 데코레이터
파싱 축을 만질 때" 로 트리거를 걸었다 — 지금 상수로 묶으면 정규식 3개를 동시에 건드리는
별건이 된다.

## 수렴 판단

reviewer 가 요약에 이렇게 적었다 — *"이 changeset 은 이미 8라운드 리뷰-수정 루프를 거쳐
수렴 단계 — 위 WARNING 1건 조치 후 나머지 INFO 14건은 전부 기존에 판단·유예되었거나 저장소
전수 실측으로 현재 무영향임이 확인된 항목이므로 **추가 라운드 없이 종결 가능**"*.

라운드별 발견의 성격도 그 판단을 뒷받침한다:

| 라운드 | Warning | 성격 |
|---|---|---|
| 1R | 4 | 거짓 단언 · 테스트 부재 · 새 사본 · orphan |
| 2R | 1 | **오탐**(앞 PR 에서 반증한 실패 모드 재도입) |
| 3R~5R | 1·1·3 | 전부 **내 문서 편집이 만든 것** |
| 6R | 3 | **진짜 사각지대**(옵션 배선) + 문서 2 |
| 7R | 1 | orphan 재발 |
| 8R | 1 | **자매 비대칭**(부팅 크래시 가드) |

## 검증

lint **PASS** · unit backend **9,283**(443 suites) · 가드 8스위트 **147건** · eslint PASS ·
`tsc` 비-spec **0**.
