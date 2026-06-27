# Rationale 연속성 검토 결과

검토 모드: --impl-done (scope=spec/conventions/, diff-base=origin/main)
검토 대상 변경 파일: `spec/conventions/swagger.md` (line 265 단일 변경)

---

## 발견사항

### 발견사항 1
- **[WARNING]** §2-5 UniversalWrap 불변량이 갱신되지 않은 채 paginated 예외 도입
  - target 위치: `spec/conventions/swagger.md` §2-5 (응답 wrapping) — "프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌉니다." (line ~205)
  - 과거 결정 출처: `spec/conventions/swagger.md §2-5` — 문서화된 시스템 invariant ("**모든** 성공 응답을 `{ data: ... }`로 감쌉니다")
  - 상세: 변경 후 `ApiOkPaginatedResponse` wire shape 는 `{ data: <Dto>[], pagination: {...} }` 으로 `pagination` 이 `data` 키 바깥에 위치한다. 이는 TransformInterceptor 가 `PaginatedResponseDto` 의 `data` 키를 감지해 pass-through 하기 때문이라고 §5-2 인라인 주석에 설명됐으나, §2-5 본문은 여전히 "모든 성공 응답을 `{ data: ... }`로 감쌉니다"라는 무조건 보편 주장을 유지하고 있다. paginated 응답이 이 invariant 의 예외임이 §2-5 에 반영되지 않았으며, 이 pass-through 동작의 배경을 설명하는 Rationale 항목도 추가되지 않았다.
  - 제안:
    1. `§2-5` 본문에 paginated 예외를 명시: "단, `PaginatedResponseDto` 처럼 response 자체에 `data` 키가 있는 경우 `TransformInterceptor` 는 pass-through 하므로 최종 wire 는 `{ data: [], pagination: {} }` 형태(top-level `data`·`pagination`)가 된다."
    2. `## Rationale` 에 `§5 ApiOkPaginatedResponse pass-through 예외` 항목을 추가해 ①PaginatedResponseDto 의 구조 ②TransformInterceptor pass-through 조건 ③최종 wire shape 가 `{ data: [], pagination }` 인 이유 ④이전 double-wrap 명세(`{ data: { data, pagination } }`)가 버그였던 근거를 기록한다.

---

### 발견사항 2
- **[INFO]** paginated wrapper shape 결정의 Rationale 항목 부재
  - target 위치: `spec/conventions/swagger.md §5-2` 표 및 `## Rationale` 전체
  - 과거 결정 출처: 없음 — `## Rationale` 에 paginated 응답 shape 결정이 기록된 항목 자체가 없다 (§0 만 존재)
  - 상세: double-wrap → single-wrap 정정은 스펙 버그 수정이며 기각된 대안의 재도입은 아니다. 그러나 이 변경이 "double-wrap 은 항상 잘못이었다"는 사실 확인인지, 아니면 TransformInterceptor 동작 변경의 결과인지를 향후 유지보수자가 판단할 근거가 Rationale 에 없다. `plan/in-progress/swagger-double-wrap-fix.md` 가 배경을 담고 있으나 plan 은 Rationale SoT 가 아니다.
  - 제안: Rationale 에 `§5 …` 항목을 신설해 발견사항 1 제안과 통합 기록 (중복 방지).

---

## 요약

이번 변경(`spec/conventions/swagger.md §5-2` 단일 라인)은 `ApiOkPaginatedResponse` wire shape 를 double-wrap `{ data: { data, pagination } }` 에서 single-wrap `{ data: [], pagination }` 으로 정정한 것이다. 기각된 대안의 재도입이나 합의된 결정의 무근거 번복 사례는 없다 — double-wrap 명세는 Rationale 에 기록된 의도적 결정이 아니라 버그였다. 그러나 §2-5 의 "모든 성공 응답을 `{ data: ... }`로 감쌉니다"라는 문서화된 불변량이 수정 없이 유지된 채 paginated pass-through 예외가 도입됐고, Rationale 에 이 예외 동작을 설명하는 항목도 없다. 이로 인해 §2-5 의 보편 주장과 §5-2 의 실제 wire shape 사이에 잠재적 혼선이 남는다.

---

## 위험도

LOW
