## Maintainability Code Review

### 발견사항

---

**[WARNING] `status_reason` 필드 설명이 단일 테이블 셀에 과도하게 밀집**
- 위치: `spec/1-data-model.md` — Integration 테이블 `status_reason` 행
- 상세: 하나의 테이블 셀 안에 4개 상태별 분기, 예외 케이스(`resource_not_found`), 인라인 링크, 네이밍 컨벤션 설명이 혼합되어 있다. 단일 셀이 3~4줄의 조건문을 담으면 Markdown 렌더러에 따라 줄바꿈이 깨지고, 향후 변경 시 어느 부분을 수정해야 하는지 한눈에 파악하기 어렵다.
- 제안: 테이블은 타입/제약만 간결하게 기술하고, 상태별 사유 코드 목록은 아래 별도 섹션(`#### status_reason 상태별 유효값`)으로 분리한다.

---

**[WARNING] 5개 consistency check 세션이 동일 이슈를 중복 추적 — 해소 이력 추적 불가**
- 위치: `review/consistency/2026-05-14_17-49-11/` ~ `2026-05-14_18-38-32/` (5개 세션)
- 상세: `resource_not_found` status_reason 충돌, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` HTTP 상태코드(400→409), legacy path 폐기 follow-up 미등재 등 동일 이슈가 3~4개 세션에 걸쳐 반복 기록되어 있다. 어느 세션에서 해소되었는지 RESOLUTION.md 없이는 추적이 불가능하다. 이후 개발자가 가장 최신 세션(18-38-32)만 읽으면 이전 세션에서 이미 해소된 항목을 다시 열린 이슈로 오인할 수 있다.
- 제안: 일관성 검토 세션이 연속 실행될 때는 최종 세션 SUMMARY.md에 "이전 세션 대비 해소된 항목" 섹션을 두거나, `review/consistency/RESOLUTION.md`를 별도로 생성하여 각 이슈의 최종 결론을 단일 진실로 관리한다.

---

**[WARNING] 모든 review 파일 끝에 개행 없음 (`\ No newline at end of file`)**
- 위치: 31개 review 파일 전체
- 상세: POSIX 표준에서 텍스트 파일은 개행으로 끝나야 한다. `git diff`에 `\ No newline at end of file`가 표시되고, `cat`으로 연결하거나 스크립트로 파싱할 때 마지막 줄이 잘린다. 31개 파일 전체에 걸쳐 반복되므로 파일 생성 템플릿에 구조적 결함이 있다.
- 제안: review 파일 생성 시 마지막에 `\n`을 추가하도록 템플릿 또는 skill 스크립트를 수정한다.

---

**[WARNING] `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 4 — 한 줄에 여러 책임 혼합**
- 위치: `spec/4-nodes/4-integration/4-cafe24.md` 줄 +385 (step 4)
- 상세: step 4가 단일 번호 항목 안에 ①row 조회, ②HMAC 검증, ③OAuthState 생성, ④redirect, ⑤두 가지 에러 코드 조건을 모두 서술한다. 이 밀도는 구현자가 어느 하위 단계를 별도 함수/메서드로 분리해야 하는지 판단하기 어렵게 만든다.
- 제안: step 4를 "4a. install_token으로 단일 row 조회" / "4b. HMAC 1회 검증" / "4c. OAuthState 생성 및 redirect" 3개 하위 단계로 분리한다. 에러 코드는 각 단계 끝 괄호로 배치한다.

---

**[INFO] 날짜 박힌 CHANGELOG 항목이 spec 본문에 혼재**
- 위치: `spec/4-nodes/4-integration/4-cafe24.md` — CHANGELOG 섹션 / `> 2026-05-14 개정:` blockquote
- 상세: `> 2026-05-14 개정:` blockquote는 spec 본문 흐름 안에 "이 내용은 언제 바뀌었다"는 역사적 사실을 끼워 넣는다. CLAUDE.md는 spec 파일이 "history가 아닌 latest에 대한 기술"임을 명시한다. 시간이 지나면 이 blockquote가 본문보다 오래된 정보를 담게 되어 독자를 혼란스럽게 한다.
- 제안: 변경 배경은 CHANGELOG 섹션(파일 하단)에만 기록하고, 본문 흐름에서 `> N년 M월 개정:` 형태의 인라인 역사 메모는 제거한다.

---

**[INFO] consistency review 헤더 구조 불일치**
- 위치: `2026-05-14_17-49-11/plan_coherence/review.md` vs `2026-05-14_17-58-37/plan_coherence/review.md`
- 상세: 일부 파일은 "발견됐습니다. 검토 결과를 정리합니다." 같은 작업 경과 문장으로 시작하고, 일부는 `## 발견사항`으로 바로 시작한다. 경과 문장은 산출물 파일에 포함될 필요가 없으며 검색·파싱 시 노이즈가 된다.
- 제안: 파일 생성 skill에서 작업 경과 문장이 출력 파일에 포함되지 않도록 구조화한다.

---

**[INFO] meta.json의 `total_elapsed_seconds`와 개별 checker `elapsed_seconds` 합이 불일치**
- 위치: `2026-05-14_17-58-37/meta.json`
- 상세: `total_elapsed_seconds: 927.84`이나 5개 checker의 합은 `222.51 + 230.22 + 241.96 + 334.45 + 830.37 = 1859.51`로 2배 이상 차이가 있다. 병렬 실행이라면 wall-clock을 표기하는 것이 맞지만 필드명이 `total_elapsed`여서 해석이 모호하다.
- 제안: 필드명을 `wall_clock_seconds` / `total_cpu_seconds`로 구분하거나 주석 필드를 추가해 병렬 실행 여부를 명시한다.

---

### 요약

변경된 파일은 spec 문서 5개와 consistency review 산출물 31개다. spec 파일 측에서는 `status_reason` 필드 설명이 단일 테이블 셀에 지나치게 많은 정보를 압축해 유지보수성을 낮추는 것이 가장 큰 문제이며, step 4의 다중 책임 혼합과 본문 내 날짜 인라인 메모도 "latest 상태를 서술하는 spec" 원칙과 충돌한다. review 산출물 측에서는 31개 파일 전체의 개행 누락이 구조적 결함이고, 5개 연속 세션에 걸친 동일 이슈 중복 기록이 "어느 것이 최신 결론인가"를 추적하기 어렵게 만든다. 전반적으로 내용의 정확성보다 정보 밀도와 연속 세션 관리 방식이 유지보수성의 주요 개선 포인트다.

### 위험도

**LOW** — spec 정확성 자체의 문제가 아니라 정보 구조와 산출물 관리 방식의 문제이므로 즉각적인 버그 위험은 없다. 단, `status_reason` 테이블 셀의 밀도와 review 세션 중복 추적은 팀 규모가 커지거나 spec 변경 빈도가 높아질수록 오독 위험을 높인다.