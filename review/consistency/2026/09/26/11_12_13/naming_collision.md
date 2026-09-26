# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-swagger-forbidden-codes.md`

## 검토 범위

target 이 새로 도입하는 식별자를 실제 코드베이스·spec 전수와 대조했다.

- 신규 상수/함수: `FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole(role)` (`common/swagger`)
- 신규 가드: `forbidden-response-codes` (`src/repo-guards/__tests__/forbidden-response-codes*.ts`)
- 신규 frontmatter `code:` 등재 항목 (glob)
- 신규 Rationale 서브섹션 제목 `§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)`
- (참고, target 문서 자신의 범위는 아니지만 같은 PR 의 구현 plan 이 언급하는) `lowestRequiredRole`

## 발견사항

- **[INFO]** `FORBIDDEN_NOT_A_MEMBER` 가 기존 근접 동의어 상수 3벌과 병존하다 사라지는 과도기
  - target 신규 식별자: `FORBIDDEN_NOT_A_MEMBER`(`common/swagger`, 이 draft §변경(2) 문구에 등장)
  - 기존 사용처: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:71` 의 로컬 `FORBIDDEN_MEMBER_ROUTE`, `codebase/backend/src/modules/integrations/integrations.controller.ts:96` 의 로컬 `FORBIDDEN_MEMBER` — 둘 다 정확히 같은 문자열(`` 워크스페이스 멤버가 아님(${NOT_A_MEMBER.code}) ``)을 만드는 근접 동의어 상수
  - 상세: 이름 충돌(동일 식별자·다른 의미)은 아니다 — 세 이름 모두 "같은 개념"을 가리키며, 로컬 상수 두 벌을 공용 헬퍼로 흡수하는 것이 자매 구현 plan(`plan/in-progress/forbidden-desc-codes.md` §방향 "workspaces.controller.ts 의 로컬 상수 셋 · integrations 의 상수를 헬퍼로 옮긴다")의 명시 의도다. 다만 **target(spec draft) 자신의 문구**는 헬퍼 이름만 선언할 뿐 기존 두 로컬 상수를 제거/치환하라는 문장을 담지 않는다 — spec 만 읽는 독자에게는 세 번째 동의어가 추가되는 것으로 보일 위험이 있다.
  - 제안: 이미 구현 plan 이 이 이관을 다루고 있으므로 target 자체를 바꿀 필요는 낮다(BLOCK 대상 아님) — 다만 §변경(2) 또는 Rationale 에 "기존 `FORBIDDEN_MEMBER_ROUTE` · `FORBIDDEN_MEMBER` 로컬 상수는 이 헬퍼로 흡수되어 사라진다" 한 문장을 덧붙이면 spec 단독 열람 시의 혼선을 없앨 수 있다.

- **[INFO]** 가드명 `forbidden-response-codes` 는 스코프가 "가드 코드만" 임을 이름만으로 드러내지 않는다
  - target 신규 식별자: 저장소 가드 `forbidden-response-codes`(파일 `codebase/backend/src/repo-guards/__tests__/forbidden-response-codes{-guard.ts,.spec.ts}`)
  - 기존 사용처: 없음(전수 `ls codebase/backend/src/repo-guards/__tests__/` 및 grep 결과 동일/유사 이름 파일 부재 — 순수 신규)
  - 상세: target 본문 "정하지 않는 것" 절이 "서비스 계층이 내는 403(`FORBIDDEN` · `RERUN_PERMISSION_DENIED` 등)" 을 명시적으로 범위 밖이라 적었다. 그런데 가드 이름 `forbidden-response-codes` 는 "403 응답 코드 전반" 을 함의해, 서비스 403 코드까지 이 가드가 검사한다고 오인할 위험이 있다(실제로는 가드 거부 코드만). 이는 기존 식별자와의 충돌이 아니라 target 내부 명명의 자기설명력 문제라 등급을 INFO 로 둔다.
  - 제안: 가드 실제 동작을 아는 사람에게는 문제 없으나, 이름에 `guard-` 접두(예: `guard-forbidden-codes`)를 넣거나 doc 주석(이미 frontmatter 주석에 "가드 거부 코드" 라 명시돼 있어 완화됨)을 유지하는 선에서 충분 — 강제 변경 불요.

## 충돌 없음으로 확인된 항목

- `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole` · `lowestRequiredRole` · `forbidden-response-codes` — 코드베이스 전수(`grep -rn`) 결과 기존 사용처 0건, 완전 신규.
- frontmatter `code:` 신규 glob(`codebase/backend/src/repo-guards/__tests__/forbidden-response-codes*.ts`)은 기존 26개 glob 어느 것과도 매치되지 않는다(패턴 문자열 대조 완료) — 이중 등재·경로 겹침 없음.
- 신규 Rationale 소제목 "§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)" 은 기존 "§5-4 확장 배경 — `@WorkspaceId()` 소비 라우트로 확대 (2026-08-08)" 과 날짜 접미사가 달라 앵커(`#...-2026-09-26` vs `#...-2026-08-08`)가 겹치지 않는다.
- 참조 앵커 `../data-flow/12-workspace.md#가드-거부의-오류-코드-2026-09-25` 는 실제 `spec/data-flow/12-workspace.md:400` 의 `### 가드 거부의 오류 코드 (2026-09-25)` 헤딩과 일치 — 유효.
- 새 spec draft 파일 경로 `plan/in-progress/spec-draft-swagger-forbidden-codes.md` 는 기존 `spec-draft-*.md` 명명 컨벤션(`spec-draft-nullable-notation-followups.md`, `spec-draft-eia-62-waiting-payload.md` 등)을 그대로 따른다 — 컨벤션 위반 없음.
- API endpoint·webhook/queue/sse 이벤트명·ENV 변수·config key — target 은 이 중 어느 것도 신설하지 않는다(문서·가드 등재만). 해당 관점은 적용 대상 없음(N/A).
- 요구사항 ID — target 은 신규 요구사항 ID를 부여하지 않는다(§5-4 기존 섹션 번호 재사용, 신규 번호 없음). 트래커 항목 "기존 `@ApiForbiddenResponse` 설명 ~120곳이 가드 거부 코드를 싣지 않는다"(`plan/in-progress/spec-draft-nullable-notation-followups.md:5052`)와 target 이 닫으려는 항목이 문자열까지 일치 — 참조 정합.

## 요약

target 이 새로 도입하는 식별자(`FORBIDDEN_NOT_A_MEMBER`, `forbiddenForRole`, `forbidden-response-codes` 가드, 신규 `code:` glob, 신규 Rationale 소제목)는 코드베이스·spec 전수 대조 결과 기존에 **다른 의미로 이미 쓰이는 동일 식별자는 없다** — 전부 순수 신규다. 유일한 뉘앙스는 `FORBIDDEN_NOT_A_MEMBER` 가 기존 로컬 근접 동의어 상수(`FORBIDDEN_MEMBER_ROUTE`, `FORBIDDEN_MEMBER`)와 개념이 겹치는데, 이는 자매 구현 plan 이 이미 "헬퍼로 흡수" 하기로 명시한 의도된 통합이라 충돌이 아니라 과도기적 중복이며, target 문서 자체에 그 이관 문장을 한 줄 보강하면 더 명확해진다. 가드명이 스코프(가드 코드 한정)를 이름만으로 드러내지 않는 점도 경미한 자기설명력 이슈일 뿐 실제 충돌은 아니다. 둘 다 BLOCK 사유가 아니다.

## 위험도

LOW
