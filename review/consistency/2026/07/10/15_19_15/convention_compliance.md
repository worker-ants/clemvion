# 정식 규약 준수 검토 — catalog-residual-codes.md

대상: `plan/in-progress/catalog-residual-codes.md` (spec draft 검토, `--spec` 모드)
적용 규약: `spec/conventions/error-codes.md`(주 SoT), `spec/conventions/spec-impl-evidence.md`(문서 구조/frontmatter), `spec/conventions/swagger.md`(API 문서 데코레이터 — 해당 없음), `spec/conventions/audit-actions.md`(해당 없음)

> 참고: `prompt_file` 에 인용된 정식 규약 발췌(`audit-actions.md`, `cafe24-api-catalog/**`)는 본 target(auth 에러 코드 카탈로그)과 직접 관련이 없다. 실제 관련 규약은 `spec/conventions/error-codes.md` 이므로 해당 파일을 직접 열람해 대조했다.

## 발견사항

- **[INFO]** §1.2 vs §1.2.1 표 컬럼 헤더 표기 불일치를 그대로 계승
  - target 위치: 변경 2a (§1.2 표), 변경 2b (§1.2.1 표)
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/5-system/3-error-handling.md` 자체의 기존 컬럼 헤더 표기가 §1.2 는 `HTTP`, §1.2.1 은 `status` 로 이미 불일치
  - 상세: target 이 §1.2 에 추가하는 `NOT_A_MEMBER`·`INVALID_PASSWORD` 행은 `HTTP` 컬럼을, §1.2.1 에 추가하는 `PASSWORD_REQUIRED` 행은 `status` 컬럼을 쓴다 — 각각 소속 표의 기존 헤더를 정확히 따랐으므로 target 자체의 오류는 아니다. 다만 두 표가 같은 개념(HTTP status)에 다른 라벨을 쓰는 pre-existing drift 를 이번 기회에도 정정하지 않고 그대로 답습한다.
  - 제안: 이번 plan 범위 밖으로 두는 것이 합리적(범위 확장 방지). 후속 별도 plan 에서 두 표의 컬럼명을 `HTTP` 로 통일하는 정리를 고려할 수 있다는 점만 기록.

- **[INFO]** `NOT_A_MEMBER` 한글 라벨("워크스페이스 비멤버")이 §1.2 표의 기존 라벨(4자 내외: "인증 필요"·"토큰 만료"·"권한 없음"·"계정 잠김")보다 김
  - target 위치: 변경 2a, `NOT_A_MEMBER` 행 "이름" 컬럼
  - 위반 규약: 없음 — `error-codes.md`·`3-error-handling.md` 어디에도 라벨 글자수 제약은 명시돼 있지 않다
  - 상세: 순수 스타일 사소 편차. 의미 전달에는 문제 없음.
  - 제안: 선택적으로 "비멤버" 등으로 축약 가능하나 필수 아님.

## 정합성 확인 (위반 없음 — 근거 기록)

아래는 규약 위반은 아니지만, 검토 과정에서 실측 대조해 규약 준수를 확인한 항목:

1. **명명 규약 (`error-codes.md §1`)** — `NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED` 모두 `UPPER_SNAKE_CASE`, 조건의 의미를 기술(구현 세부 미포함). 코드베이스 실측(`auth.service.ts:74,1134`·`workspaces.service.ts:553,729`·`users.service.ts:76,84`)과 target 의 ground-truth 표가 정확히 일치.
2. **Historical-artifact 예외 레지스트리 (`error-codes.md §3`)** — 3코드 모두 `UPPER_SNAKE_CASE` 준수라 예외 등재 불필요. 대상 아님.
3. **근접 명명 disambiguation** — `INVALID_PASSWORD`(변경) ≠ `PASSWORD_INVALID`(재확인/재인증) ≠ `PASSWORD_REQUIRED`(재확인 missing) ≠ `REAUTH_REQUIRED`(재인증 missing) 4중 구분을 명시 — `error-codes.md §1` "클라이언트는 코드의 의미로 분기" 원칙에 부합하는 모범적 처리.
4. **표 컬럼 순서** — 2a) 는 §1.2 기존 헤더(`코드│이름│설명│HTTP`), 2b) 는 §1.2.1 기존 헤더(`코드│status│설명│도메인 SoT`)를 각각 정확히 따름.
5. **`spec-link-integrity` (spec-impl-evidence.md §4.2)** — target 이 신설/참조하는 앵커 4개를 실제 heading 텍스트로부터 github-slugger 규칙(공백→`-`, 구두점 제거, 인접 구두점 제거 시 이중 공백→이중 하이픈)으로 직접 재계산해 대조:
   - `1-auth.md#23c--비밀번호-변경-시-세션-revoke-범위-refactor-04-후속` ↔ 실제 heading `### 2.3.C — 비밀번호 변경 시 세션 revoke 범위 (refactor 04 후속)` (1-auth.md:675) — 일치.
   - `1-auth.md#5-api-엔드포인트` ↔ `## 5. API 엔드포인트` (1-auth.md:460) — 일치.
   - `data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급` ↔ `### 1.5 워크스페이스 전환 (토큰 재발급)` (12-workspace.md:111) — 일치.
   - `3-error-handling.md#121-2fa--webauthn--재인증-코드-도메인-spec-참조` ↔ `#### 1.2.1 2FA / WebAuthn / 재인증 코드 (도메인 spec 참조)` (3-error-handling.md:50) — 일치(이중 하이픈까지 정확).
   - 기존 정착 패턴(`1-auth.md §2.3.D` 앵커가 `3-error-handling.md:478` 에서 이미 동일 방식으로 쓰이고 있음)과도 동형이라 회귀 위험 낮음.
6. **문서 구조 규약 (CLAUDE.md / `spec-impl-evidence.md`)** — target 이 건드리는 두 spec 파일은 이미 `id`/`status: implemented`/`code:` frontmatter 를 보유(§1 적용 대상 `spec/5-system/**.md` 충족, 신규 파일 생성 없음). 변경 2d)는 기존 `## Rationale` 섹션 말미에 bullet 추가 — 3섹션 구조(Overview/본문/Rationale)를 깨지 않음. 변경 1a)는 §5 본문 내 note 삽입으로 구조 영향 없음.
7. **plan frontmatter (`spec-impl-evidence.md §4.2` `plan-frontmatter.test.ts`)** — target 자체의 frontmatter 에 `worktree`/`started`(ISO)/`owner`/`spec_impact` 모두 존재, 가드 요건 충족.
8. **API 문서 규약 (`swagger.md`)** — target 은 spec 문서 변경만 다루고 코드(`codebase/backend/**`) 변경은 범위 밖(project-planner 소관, developer 로 위임 예정 없음)이라 swagger 데코레이터 패턴 규약은 해당 사항 없음.
9. **audit-actions.md** — target 이 다루는 대상은 `error.code`(에러 코드)이지 `AuditLog.action`(감사 액션)이 아니므로 미해당. `login_history.failure_reason` 언급도 별도 도메인(`1-data-model.md §2.18.2`)이며 target 이 이를 정확히 구분해 서술.

## 요약

target `plan/in-progress/catalog-residual-codes.md` 는 `spec/conventions/error-codes.md`(주 SoT)의 의미 기반 명명·`UPPER_SNAKE_CASE`·근접 명명 disambiguation 원칙을 실제 코드베이스 발행처(`auth.service.ts`·`workspaces.service.ts`·`users.service.ts`) 대조까지 거쳐 정확히 준수한다. 제안된 두 표(§1.2·§1.2.1) 삽입은 각 표의 기존 컬럼 헤더 순서를 그대로 따르고, 신규/인용 앵커 4개는 실제 heading 대비 github-slugger 규칙(이중 하이픈 케이스 포함)까지 정밀 일치한다. `spec-impl-evidence.md` 의 문서 구조·frontmatter 요건도 위반이 없다(신규 파일 생성 없이 기존 spec 문서의 Overview/본문/Rationale 구조를 그대로 보존). CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았고, 발견된 두 건은 모두 사소한 표기 일관성(pre-existing 컬럼 헤더 drift 계승, 라벨 길이) INFO 수준이다.

## 위험도
NONE
