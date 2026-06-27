# 정식 규약 준수 검토 결과

검토 대상: `spec/conventions/swagger.md` (변경된 유일한 conventions 파일)
diff-base: `origin/main`
변경 범위: §5-2 헬퍼 표의 `ApiOkPaginatedResponse` 행 1줄 수정

---

## 발견사항

### 발견사항 없음 — CRITICAL

정식 규약 직접 위반 사항이 없다.

---

- **[WARNING]** §2-5 의 "모든 응답 TransformInterceptor 래핑" 선언과 §5-2 신규 pass-through 설명의 부분 모순
  - target 위치: `spec/conventions/swagger.md` §2-5 ("프로젝트는 `TransformInterceptor`로 모든 성공 응답을 `{ data: ... }`로 감쌉니다") 및 §5-2 `ApiOkPaginatedResponse` 행
  - 위반 규약: `spec/conventions/swagger.md` 자체 — 출력 포맷 규약의 내부 일관성
  - 상세: §2-5 는 "모든 성공 응답을 `{ data: ... }` 단일 키로 감싼다" 고 단언한다. 그러나 이번 변경으로 수정된 §5-2 는 `ApiOkPaginatedResponse` 에 대해 "`PaginatedResponseDto` 가 `data` 키를 가져 `TransformInterceptor` 가 pass-through" 라고 설명하며, 실제 응답 최상위 구조가 `{ data: <Dto>[], pagination: {...} }` (두 키)임을 명시한다. §2-5 가 "모든 성공 응답" 이라고 한 것은 페이지네이션 pass-through 예외를 포함하지 않아 §5-2 의 수정된 내용과 외형상 모순된다.
  - 제안: §2-5 에 한 문장의 예외 주석을 추가한다. 예: "단, 페이지네이션 응답(`ApiOkPaginatedResponse`)은 `PaginatedResponseDto` 자체가 `data` 키를 포함하므로 `TransformInterceptor` 가 pass-through 처리해 최종 응답이 `{ data: <Dto>[], pagination: {...} }` 형태가 된다." 이 주석을 추가하면 §5-2 의 설명과 완전히 일관된다.

---

- **[INFO]** swagger.md 에 "## Overview" 섹션 미존재
  - target 위치: `spec/conventions/swagger.md` 최상단
  - 위반 규약: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: swagger.md 는 도입부 단락 이후 §0 ~ §6 + Rationale 구조이며, 명시적 `## Overview` 섹션이 없다. 이 issue 는 이번 변경 이전부터 존재했으며(pre-existing), 이번 diff 에서 도입된 것이 아니다.
  - 제안: 대응 여부는 별도 판단. 이번 변경의 범위(§5-2 한 행 수정)와 무관하다.

---

- **[INFO]** §5-2 수정 행의 내부 일관성 확인
  - 변경 전 `{ data: { data: <Dto>[], pagination: {...} } }` (이중 래핑)은 §6 의 "서비스 실제 반환 형태(`{ data, pagination }`)와 다른 스키마는 버그입니다" 와 직접 모순됐다.
  - 변경 후 `{ data: <Dto>[], pagination: {...} }` 는 §6 설명과 일치하며, 이 측면에서 변경은 규약 내부 일관성을 **회복**한다.

---

## 요약

이번 변경(`spec/conventions/swagger.md` §5-2 `ApiOkPaginatedResponse` 행 1줄)은 정식 규약에 대한 CRITICAL 위반을 포함하지 않는다. 변경 자체는 잘못 기술된 이중 래핑 스키마를 실제 동작인 단일 래핑(`{ data: <Dto>[], pagination: {...} }`)으로 교정하여 §6 의 서비스 실제 반환 형태 설명과 일관성을 회복한다. 단, §2-5 가 "모든 성공 응답을 `{ data: ... }`로 감싼다"고 단언하는 문장이 이번 수정에서 명시된 `PaginatedResponseDto` pass-through 예외를 포괄하지 않아 WARNING 수준의 내부 모순이 남는다. 해소책은 §2-5 에 페이지네이션 예외를 한 문장으로 추가하는 것이다.

## 위험도

LOW
