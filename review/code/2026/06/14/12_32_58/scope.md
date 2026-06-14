# 변경 범위(Scope) 리뷰

## 작업 의도

본 작업(`refactor-04-a1-eia-msglen-ba62ae`)은 A-1 PR #598 에서 도입된 `MessageTooLongError` 를 EIA(REST) 진입점(`interaction.service.ts dispatchContinuation`)에서 generic 500 대신 `400 MESSAGE_TOO_LONG` 으로 매핑하는 단일 목적 후속 작업(I-5)이다.
계획 파일(`plan/in-progress/eia-message-length-error-mapping.md`)에 명시된 작업 범위:
- spec `14-external-interaction-api.md §5.1` 에러 표에 `400 MESSAGE_TOO_LONG` 행 추가
- spec `4-execution-engine.md §7.5.2` 에 EIA 진입점 매핑 cross-ref note 추가
- `interaction.service.ts dispatchContinuation` 에 `MessageTooLongError` catch 추가
- `interaction.service.spec.ts` 에 해당 테스트 케이스 추가

---

## 발견사항

### [INFO] 파일 1 — `interaction.service.spec.ts` : 범위 내
- 위치: 전체 diff (lines +36~+73)
- 상세: `MessageTooLongError` 임포트 추가 및 `I-5 — submit_message: engine MessageTooLongError → 400 MESSAGE_TOO_LONG` 테스트 케이스 1건 추가. 기존 테스트 코드에 대한 수정 없음. 포맷팅·공백 변경 없음.
- 제안: 없음. 범위에 완전히 부합한다.

### [INFO] 파일 2 — `interaction.service.ts` : 범위 내
- 위치: 전체 diff (lines +13~+15, +283~+590)
- 상세: `MessageTooLongError` 임포트 추가 및 `dispatchContinuation` 메서드 내 `MessageTooLongError` 인스턴스 분기(`throw badRequest('MESSAGE_TOO_LONG', error.message)`) 추가. 다른 메서드·로직 무변경. 추가된 주석은 변경 의도(spec §14 §5.1 / §7.5.2 cross-ref)를 명시하는 인라인 설명으로 적절하며 과잉 아님.
- 제안: 없음. 범위에 완전히 부합한다.

### [INFO] 파일 3 — `plan/in-progress/eia-message-length-error-mapping.md` : 범위 내
- 위치: 신규 파일 전체
- 상세: 작업 계획 파일을 `plan/in-progress/` 에 신규 생성. `worktree`, `status`, `owner` frontmatter 포함. PLAN 라이프사이클 규약에 따른 정상 산출물. 작업 체크박스 상태가 스펙 변경(완료 체크)·구현(미체크)으로 구분되어 있어 현재 커밋 시점과 정합한다.
- 제안: 없음.

### [INFO] 파일 4 — `spec/5-system/14-external-interaction-api.md` : 범위 내
- 위치: §5.1 에러 표, +1 행 추가
- 상세: `400 Bad Request | MESSAGE_TOO_LONG | ...` 행 1개만 추가됨. 기존 다른 행·섹션 무변경. 추가 행은 계획 파일에 명시된 내용과 정확히 일치한다.
- 제안: 없음.

### [INFO] 파일 5 — `spec/5-system/4-execution-engine.md` : 범위 내
- 위치: §7.5.2 아래 +2 라인 (blockquote 1개)
- 상세: `> **EIA(REST) 진입점 매핑**: ...` blockquote 1개 추가. 기존 단락과 `>` 구분자로 분리되어 명확하게 부가됨. `InvalidExecutionStateError→STATE_MISMATCH`(기존)와 동형의 매핑을 설명하는 cross-ref note 로, 계획 파일 명시 범위(`4-execution-engine.md §7.5.2` cross-ref note)와 일치한다.
- 제안: 없음.

---

## 요약

5개 변경 파일 모두 `plan/in-progress/eia-message-length-error-mapping.md` 에 명시된 I-5 작업 범위 내에 있다. 각 파일의 변경은 `MessageTooLongError → 400 MESSAGE_TOO_LONG` 매핑 단일 목적에 집중되어 있으며, 의도와 무관한 리팩토링·기능 확장·포맷팅 변경·불필요한 임포트·무관한 설정 변경은 발견되지 않는다. 인라인 주석은 변경 의도를 명시하는 최소한의 설명이며 과잉이 아니다. 작업 계획 체크박스 상태도 현재 커밋 범위(spec 완료, 구현 미완료)와 정합하게 관리되고 있다.

---

## 위험도

NONE
