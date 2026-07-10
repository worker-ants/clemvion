### 발견사항

- **[INFO]** 카탈로그 "완결성 종결" 문구가 인접 미문서 코드(`ALREADY_A_MEMBER` 등)를 넘어서는 것으로 오독될 여지
  - target 위치: 변경 2 `2c) Rationale 신규 bullet` — "이로써 완결성 bullet 이 남긴 후속 0."
  - 충돌 대상: `spec/data-flow/12-workspace.md §1.9`(멤버 직접 추가) · `spec/conventions/error-codes.md §3`(historical-artifact 예외 레지스트리)
  - 상세: 동일 `workspaces.service.ts` 모듈이 발행하는 `ALREADY_A_MEMBER`(409)·`WORKSPACE_TYPE_MISMATCH`(403)·`CANNOT_ASSIGN_OWNER`(403, `data-flow/12-workspace.md:178`)·`CANNOT_DELETE_PERSONAL`(403, `data-flow/12-workspace.md:188`) 는 `error-codes.md §3` 와 `data-flow/12-workspace.md` 에 이미 도메인 문서화돼 있음에도 `3-error-handling.md §1.2` 공용 카탈로그에는 등재돼 있지 않다(확인: `grep`, §1.2 에 미출현). target 의 bullet 자체는 "#882·#887 이 남긴 [특정 3개] 후속 = 0" 으로 범위가 좁게 읽히지만, 절 제목("§1 카탈로그 완결성 종결")과 §Overview 의 "제품 전반 단일 진실" 선언이 함께 있어 향후 독자가 "workspace 도메인 UPPER_SNAKE 코드 전부 등재 완료" 로 오독할 위험이 있다.
  - 제안: bullet 말미에 "workspace 직접-추가 경로의 `ALREADY_A_MEMBER`/`WORKSPACE_TYPE_MISMATCH`/`CANNOT_ASSIGN_OWNER`/`CANNOT_DELETE_PERSONAL` 등은 #882/#887 deferred 목록 밖이라 별도 후속" 정도의 한 줄 scope 한정을 추가하거나, 별도 backlog 항목으로 명시. Blocking 은 아님 — 현재 bullet 문구가 이미 "완결성 *bullet* 이 남긴" 으로 한정 서술돼 있어 엄밀히는 거짓이 아님.

- **[INFO]** `PASSWORD_REQUIRED`(신규 등재) 와 `REAUTH_REQUIRED`(§1.2.1 기존)의 4번째 근접명명 쌍이 target 의 명시적 disambiguation 대상에서 누락
  - target 위치: 변경 2 `2a` 신규 `PASSWORD_REQUIRED` 행 설명 컬럼 / 변경 1 `1a` 신규 note
  - 충돌 대상: `spec/5-system/3-error-handling.md §1.2.1`(L63, `REAUTH_REQUIRED` 400) · `spec/5-system/1-auth.md:334`(재인증 에러 코드 blockquote)
  - 상세: target 의 배경 절이 "3중 근접명명"(`INVALID_PASSWORD` / `PASSWORD_INVALID` / `PASSWORD_REQUIRED`)만 명시하고 `INVALID_PASSWORD`·`PASSWORD_REQUIRED` 신규 행에는 각각 "`PASSWORD_INVALID`(§2.3)와 별개"/"별도 헬퍼" 식 disambiguation 문구를 넣지만, `PASSWORD_REQUIRED`(401, `verifyPasswordForUser` 비밀번호 미입력/미설정)와 이름·문맥이 가장 근접한 `REAUTH_REQUIRED`(400, `verifyReauth` 자격증명 미입력·미충족)의 구분은 어느 신규 텍스트에도 명시되지 않는다. 두 코드 모두 "무언가 입력/충족되지 않음 → *_REQUIRED" 패턴이고 같은 문서 §1.2/§1.2.1 에 인접 배치된다. HTTP status(401 vs 400)와 발행 헬퍼가 달라 실질적 충돌은 아니나, target 이 스스로 설정한 "naming_collision 특히 점검" 기준에서 보면 커버리지가 3쌍에 그친다.
  - 제안: 1a 신규 note 또는 2a `PASSWORD_REQUIRED` 행 설명에 "재인증 코드 `REAUTH_REQUIRED`(§1.2.1, 400, `verifyReauth`)와는 발행 헬퍼·status 가 다른 별개 코드" 한 문장 추가 권장(non-blocking).

- **[INFO]** `data-flow/12-workspace.md` 링크가 target 신규 행에서 섹션 앵커 없이 파일 전체를 가리킴 — 기존 `1-auth.md` 의 동일 참조는 앵커 포함
  - target 위치: 변경 2 `2a` `NOT_A_MEMBER` 행 — `[data-flow §1.5](../data-flow/12-workspace.md)`
  - 충돌 대상: `spec/5-system/1-auth.md:485` — 동일 문맥의 기존 참조는 `[data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급)` 로 §1.5 앵커를 포함
  - 상세: 두 참조가 같은 대상(§1.5 워크스페이스 전환 토큰 재발급)을 가리키면서 앵커 포함 여부가 달라 cross-file 링크 정밀도가 불일치한다. 기능적 오류는 아니고(파일 링크 자체는 유효) 클릭 시 정확한 절로 스크롤되지 않는 수준의 사소한 불일치.
  - 제안: `2a` 행에 `#15-워크스페이스-전환-토큰-재발급` 앵커를 추가해 `1-auth.md:485` 표기와 정렬 — target 워크플로 체크리스트의 "spec-link-integrity 통과" 항목에서 함께 실측·정정 가능.

### 요약
target 이 새로 등재하려는 `NOT_A_MEMBER`(403)·`INVALID_PASSWORD`(401)·`PASSWORD_REQUIRED`(401) 3개 코드의 status·발행처·의미는 실제 코드(`auth.service.ts`, `users.service.ts`, `workspaces.service.ts`) 와 정확히 일치하며, 이미 도메인 문서화된 `1-auth.md §5`·`data-flow/12-workspace.md` 내용과도 모순 없이 정합한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전수 점검 결과 다른 spec 영역과의 직접적 모순(CRITICAL/WARNING)은 발견되지 않았다. 다만 (1) "카탈로그 완결성 종결" 문구가 같은 모듈의 인접 미문서 코드(`ALREADY_A_MEMBER` 등)까지 완결된 것으로 오독될 여지, (2) target 이 스스로 강조한 근접명명 disambiguation 이 `REAUTH_REQUIRED` 와의 4번째 쌍을 다루지 않는 점, (3) 신규 행의 cross-file 링크 앵커 정밀도가 기존 참조와 미세하게 다른 점 — 3건 모두 INFO 수준으로, target 채택을 막을 이유는 아니며 원한다면 같은 PR 에서 한 줄씩 보강 가능하다.

### 위험도
LOW
