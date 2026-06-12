# 문서화(Documentation) 리뷰 결과

리뷰 대상: HTTP 하드닝 관련 spec 및 review 산출물 (파일 41~48 실질 변경, 파일 1~40 review 산출물)
리뷰 일시: 2026-06-12

---

## 발견사항

### [WARNING] `spec/conventions/error-codes.md §4` — §3 과 §4 의 목적 차이 도입문 불충분
- 위치: `spec/conventions/error-codes.md` 신규 섹션 `## 4. 내부 전용 분류 코드 (정규화 후 발행)`
- 상세: 신규 §4 도입문은 "§3 와 달리 본 절의 코드는 §1 적용 범위 밖이다"라고만 기술한다. consistency-checker 가 별도 WARNING 으로 지적한 것과 별개로, §3 제목이 "Historical-artifact 예외 레지스트리"이고 §4 제목이 "내부 전용 분류 코드"인데, 두 절의 차이(§3 = 클라이언트 노출이지만 §1 명명 위반 코드, §4 = 클라이언트 비노출 내부 코드)가 도입문 한 문장으로는 충분히 전달되지 않는다. 독자가 §3 를 읽고 §4 로 넘어올 때 레이어 전환을 직관적으로 인식하기 어렵다.
- 제안: §4 도입부에 "§3 는 클라이언트 계약 에러 코드 중 §1 명명 위반 historical artifact, §4 는 클라이언트에 노출되지 않는 구현 내부 분류 코드 — 두 절은 레이어가 다르다" 한 줄 비교 문구를 추가한다.

### [WARNING] `spec/4-nodes/5-data/2-code.md §4` — 2단 래퍼 라인 오프셋(+3) 근거 미교차검증
- 위치: `spec/4-nodes/5-data/2-code.md` §4 실행 로직 2번 항목
- 상세: "래퍼가 사용자 코드 앞에 헤더 3줄을 덧붙이므로 런타임 에러 라인은 사용자 원본 기준 **+3**" 이라고 단언했다. 래퍼 코드 예시 상 3줄 헤더는 맞으나, isolated-vm 의 `compileScript` 가 외곽 IIFE 기준 vs `__user` 함수 기준 중 어느 라인을 에러로 보고하는지에 따라 실제 오프셋이 달라진다. 구현 파일(`code.handler.ts`)의 라인 보정 로직이 spec 에 교차 참조되지 않아 spec 이 잘못된 오프셋을 "표시 계층" 구현 지침으로 안내할 위험이 있다.
- 제안: `codebase/backend/src/nodes/data/code/code.handler.ts` 의 라인 오프셋 보정 로직 위치를 spec 에 교차 참조하거나, "+3 (구현 파일 참조, 실제 값 검증 필요)" 로 단언을 완화한다.

### [WARNING] `spec/4-nodes/4-integration/1-http-request.md §4 step 8` — dry-run SSRF 생략 주석의 가시성 부족
- 위치: `spec/4-nodes/4-integration/1-http-request.md` §4 step 8 끝 문장
- 상세: "dry-run 실행은 실제 fetch 가 없으므로 본 SSRF 가드 이전에 mock 을 반환하고 가드를 생략한다"가 step 8 세부 설명 마지막 인라인 문장으로 추가됐다. dry-run 이 SSRF 가드를 건너뛴다는 정보는 보안 동작의 예외이므로 독자 주의가 필요하나, 긴 step 8 설명의 끝에 묻혀 있다. dry-run 에서 사설 주소 호출이 성공하는 것을 보고 가드 미작동으로 오해하거나, 반대로 테스트에서 SSRF 차단을 기대하며 dry-run 을 쓰는 경우 예상 밖 동작이 발생한다.
- 제안: §4 SSRF opt-out callout 또는 §4 본문에 별도 `> **dry-run 예외**: ...` callout 블록으로 분리한다.

### [INFO] `spec/conventions/node-output.md` D4 주석 — SSRF 코드 예시가 `HTTP_BLOCKED` 만 열거
- 위치: `spec/conventions/node-output.md` D4 blockquote (line ~110)
- 상세: 앵커 링크가 `1-http-request.md §5.8` 로 갱신됐으나, SSRF 차단 예시는 여전히 `HTTP_BLOCKED` 단독이다. 이번 diff 에서 `DB_HOST_BLOCKED` 가 신규 정의됐고 `EMAIL_HOST_BLOCKED` 도 이미 존재하는데, D4 주석이 단일 코드만 언급하면 Database/Email 노드의 SSRF 차단도 동일 D4 패턴임을 독자가 유추해야 한다.
- 제안: D4 주석 예시를 `HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED` 로 확장하거나 "각 Integration 노드 전용 SSRF 차단 코드" 로 추상화한다.

### [INFO] `spec/conventions/error-codes.md §4` — `LEGACY_TO_NORMALIZED` 폴백(`CODE_EXECUTION_FAILED`) 미기재
- 위치: `spec/conventions/error-codes.md §4` 신규 테이블 및 도입문
- 상세: §4 는 3종 정규화 매핑을 SoT 로 기술하지만 "미등재 코드의 폴백이 `CODE_EXECUTION_FAILED` 로 고정됐다"는 사실이 §4 에 없다. `code.handler.ts` 에서 `LEGACY_TO_NORMALIZED` 에 없는 코드가 오면 `CODE_EXECUTION_FAILED` 로 떨어지는 동작은 클라이언트 계약에 영향을 주는 방어 로직인데, spec SoT 에서 문서화되지 않았다.
- 제안: §4 테이블 하단에 "표에 없는 미등재 내부 코드는 `CODE_EXECUTION_FAILED` 로 폴백" 한 줄 추가.

### [INFO] `spec/4-nodes/4-integration/1-http-request.md §5.7` — `output.response.error` Deprecated 제거 일정 미명시
- 위치: `spec/4-nodes/4-integration/1-http-request.md` §5.7 출력 필드 표
- 상세: `output.response.error` 필드 설명이 "**Deprecated**"로 강화됐으나 제거 예정 시점이나 호환성 유지 기간이 없어 구현자가 이 필드를 언제까지 방어적으로 읽어야 하는지 알 수 없다.
- 제안: "향후 major 버전에서 제거 예정" 또는 "현재 제거 계획 없음(레거시 호환 무기한 유지)" 중 하나를 명시한다.

### [INFO] `spec/5-system/3-error-handling.md §3.2` — Email 행에 `EMAIL_HOST_BLOCKED` 미등재
- 위치: `spec/5-system/3-error-handling.md §3.2` 대표 에러 코드 표
- 상세: §1.4 의 Email 행에는 `EMAIL_HOST_BLOCKED` 가 이미 등재되어 있으나, §3.2 의 Email 행에는 `EMAIL_SEND_FAILED` 만 있어 동일 파일 내 비대칭이 발생한다. 이번 diff 에서 §1.4 Database 행에 `DB_HOST_BLOCKED` 가 추가됐으나 §3.2 Email 행은 갱신되지 않았다.
- 제안: `spec/5-system/3-error-handling.md §3.2` Email 행에 `EMAIL_HOST_BLOCKED` 추가.

### [INFO] review 산출물 JSON 파일 — trailing newline 없음
- 위치: `review/consistency/2026/06/12/*/` 하위 `_retry_state.json`, `meta.json` 전체 (파일 4, 7, 12, 15, 19, 22, 27, 30, 34, 37)
- 상세: 모든 `_retry_state.json` 과 `meta.json` diff 말미에 `\ No newline at end of file` 가 표기된다. POSIX 표준상 텍스트 파일은 개행으로 끝나야 하며, 일부 git 훅·diff 도구에서 경고를 발생시킬 수 있다. 기능 영향은 없으나 일관성 문제다.
- 제안: 생성 스크립트에서 JSON 파일 write 후 trailing newline 을 추가한다.

---

## 요약

이번 변경은 HTTP/DB/Email 노드 SSRF 가드 하드닝, Code 노드 isolated-vm 전환, 에러 코드 카탈로그 정비를 spec 에 반영한 것이다. 문서화 관점에서 전반적으로 변경 의도가 잘 기술됐으나 세 가지 WARNING 이 있다. (1) `error-codes.md §4` 도입문이 §3 와의 레이어 차이를 충분히 설명하지 않아 독자 혼선이 남아 있고, (2) `2-code.md §4` 에서 2단 래퍼 런타임 에러 라인 오프셋(+3)을 구현과 교차 검증 없이 단언하고 있으며, (3) `1-http-request.md §4 step 8` 에서 dry-run 이 SSRF 가드를 생략한다는 중요 예외가 인라인에 묻혀 가시성이 낮다. 나머지 INFO 항목은 spec 단일 진실 원칙상 권장 보완 사항으로 기능 동작에는 영향이 없다.

---

## 위험도

LOW
