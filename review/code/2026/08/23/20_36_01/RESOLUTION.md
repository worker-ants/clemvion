# RESOLUTION — `20_36_01` (CRITICAL 0 · WARNING 3 · 위험도 LOW)

WARNING 3건 처분 완료. INFO 10건 중 조치 2건(다른 WARNING 과 함께 해소)·정정 1건.

## WARNING #1·#2 (maintainability) — 자매 관례 미준수 → **맞췄다**

신규 캐너리가 이 저장소에 이미 확립된 스키마 테스트 관례를 안 따랐다:

| 관례 | 자매 | 내 초판 |
| --- | --- | --- |
| `SchemaObject` 파생 (`ApiResponseSchemaHost['schema']`) | 3개 스펙 | `Record<string, unknown>` 캐스팅 |
| `try/finally` 로 `app.close()` 보장 | 2개 스펙 | 없음 — `createDocument` 가 던지면 앱이 안 닫힌다 |

둘 다 자매와 동일 패턴으로 다시 썼다. **INFO 9**(캐스팅 중복)와 **INFO 10**(`[가드]` 태그
누락)도 그 편집에서 함께 해소됐다 — `beforeAll` 에서 `inputOverride` 를 한 번 파생해 두 `it`
이 공유하고, 두 번째 테스트에 태그를 붙였다.

**관례를 맞춘 뒤 캐너리가 여전히 무는지 재확인**했다 — 축약형으로 되돌리니 RED.

## WARNING #3 (scope) — Docker Hub 체크박스 동반 플립 → **현행 유지**

리뷰어가 *"plan 문서에 부수로 명시 고지했고 코드 영향 없는 plan-hygiene 이라 INFO 로
낮춰도 무방"* 으로 스스로 판정했다. 한 줄짜리 위생 정정을 별도 커밋으로 가르는 비용이
이득을 넘는다.

## ⚠️ INFO #2 — **내 수치가 틀렸다**

plan 에 *"미체크 30 → 27"* 이라 적었는데 실측은 **29 → 27** 이다.

원인: **다른 브랜치(#1205)의 수치를 옮겨 적었다.** 그쪽은 SSE·재배치·wire-only 항목을
등재해 30이 됐지만, 이 브랜치의 base 는 그 전이라 29다. 병렬 브랜치가 같은 트래커를
고치는 동안 수치를 옮기면 이렇게 어긋난다 — **쓰는 그 브랜치에서 다시 세야 한다**
(`git show origin/main:… | grep -c` 로 실측). plan 에 그 교훈과 함께 정정했다.

## 나머지 INFO — 미조치 사유

| # | 항목 | 사유 |
| --- | --- | --- |
| 4 | boilerplate 3번째 중복 | 리뷰어가 **"4번째 사례에서" 추출하라**는 조건부로 제시 — 지금 손대면 근거 없이 앞선다 |
| 5 | `required` 미검증 | 이번 diff 는 `@IsOptional()` 을 안 건드렸다. 스코프 밖 |
| 6 | CHANGELOG 생략 근거 | breaking 이 아니고 wire 계약 불변(api_contract 확인). "생성 문서 shape 변경은 대상 아님" 을 규약에 명문화하는 건 별건 |
| 7 | 트래커 ↔ plan 상호링크 | plan 이 `complete/` 로 이동하는 **이 PR 의 마무리 커밋**에서 붙는다 |
| 8 | 구조화 에러 응답 데코레이터 부재 | **선존 갭**, 이 diff 범위 밖 |
| 1·3 | 정보성 확인 | 조치 불요 |

## 재검증

- `re-run.dto.spec.ts` 2/2 GREEN, `tsc` 신규 오류 0
- 뮤테이션 재확인: 축약형 복귀 → RED
- TEST WORKFLOW 4단계 재수행 (아래 plan 참조)
