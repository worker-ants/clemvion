# 정식 규약 준수 검토 — catalog-residual-codes

target: `plan/in-progress/catalog-residual-codes.md` (spec draft: `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md` 변경안)

## 검증 방법
`spec/conventions/error-codes.md`(명명 규약)·`spec/conventions/spec-impl-evidence.md`(frontmatter/링크 가드)·`spec/conventions/swagger.md`(API 문서 규약)를 기준으로 target 의 §1a/2a/2b/2c/2d 변경안을 대조했다. 코드 발행처(ground truth) 3건(`NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED`)은 실제 소스(`auth.service.ts`·`users.service.ts`·`workspaces.service.ts`·`webauthn.controller.ts`)를 직접 읽어 라인 번호까지 대조했고, 신규 도입 앵커 3건(`1-auth.md#5-api-엔드포인트`·`1-auth.md#23c--...`·`12-workspace.md#15-...`)은 실제 `github-slugger` 라이브러리로 슬러그를 재계산해 검증했다.

## 발견사항

- **[WARNING] `NOT_A_MEMBER` 카탈로그 행(변경 2a)의 cross-ref 설명이 부정확·불완전**
  - target 위치: `## 변경 2 — spec/5-system/3-error-handling.md` → `### 2a)` 의 `NOT_A_MEMBER` 표 row, 설명 열 뒷부분 `"초대 수락 ALREADY_A_MEMBER(§1.9, 409)와 반대 의미"`
  - 위반 규약: `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙("이름만으로 분기 의미가 드러난다" — 카탈로그의 disambiguation 설명 자체가 정확해야 이 원칙이 성립) + 본 plan 이 표방하는 "4중 근접명명 disambiguation" 목적(§배경 문단)과 상충
  - 상세:
    1. **오분류**: `ALREADY_A_MEMBER`(UPPER_SNAKE, 409)는 `spec/data-flow/12-workspace.md §1.9 "멤버 직접 추가 (기가입 사용자)"`(`WorkspacesService.addMemberByEmail`, 초대 토큰과 무관한 별도 합류 경로)에서 발행된다 — "초대 수락"(§1.3, `POST /api/workspaces/invitations/accept`)이 아니다. §1.3 의 실제 흐름(target 문서에도 인용되지 않은 시퀀스)에는 "already a member" 계열 에러가 아예 없다. lowercase `already_a_member`(409)는 오히려 §1.2 "멤버 초대 발급" 단계(초대 *발송* 시점의 lower_snake historical artifact, `error-codes.md §3` 등재)에서 나온다. 즉 "초대 수락" 이라는 라벨이 §1.2(발급)·§1.3(수락)·§1.9(직접 추가) 세 흐름 중 어느 것과도 정확히 일치하지 않고, 인용된 코드(`ALREADY_A_MEMBER`, §1.9)는 §1.9(직접 추가)에서만 난다.
    2. **불완전한 트리거 나열**: 이 row 는 `NOT_A_MEMBER` 를 "워크스페이스 전환(`/api/auth/workspaces/:id/switch`) 대상 멤버십 검증 실패" 하나로만 설명하지만, target 문서 자체의 "코드 ground truth" 표는 발행처로 `auth.service.ts:1134`(switch) 외에 `workspaces.service.ts:553`(`leaveWorkspace` 자가 탈퇴 멤버십 검증)·`workspaces.service.ts:729`(`assertMembership`, 여러 워크스페이스 오퍼레이션이 공유하는 범용 가드)까지 3개 발행처를 명시한다. 같은 §1.2 표의 선례 `ADMIN_REQUIRED` 행은 "`WorkspacesService.assertAdmin()` 발행" 처럼 범용 가드로 서술하는데, `NOT_A_MEMBER` 행만 단일 엔드포인트로 좁혀 서술해 스타일도 어긋나고 실제로도 불완전하다.
  - 제안: `"초대 수락 ALREADY_A_MEMBER(§1.9, 409)"` → `"직접 추가 경로 ALREADY_A_MEMBER(§1.9, 409)"` (또는 `error-codes.md §3` 표기 그대로 "직접 추가 경로") 로 정정. 트리거 서술도 `ADMIN_REQUIRED` 선례처럼 "워크스페이스 멤버십 검증 실패(전환·자가 탈퇴·멤버 관리 등 공용 가드)" 식으로 넓히거나, 최소한 switch 외 두 발행처가 있다는 사실이 드러나게 조정 권장. 코드가 아닌 spec 산문 교정이라 `consistency-check` 재확인 전에 반영 가능.

## 검증 통과 항목 (참고 — 문제 없음)

- **UPPER_SNAKE_CASE·prefix-less 명명**: `NOT_A_MEMBER`·`INVALID_PASSWORD`·`PASSWORD_REQUIRED` 모두 `error-codes.md §1` 규약 준수, 같은 §1.2/§1.2.1 표의 기존 prefix-less 행들(`AUTH_REQUIRED`·`PASSWORD_INVALID`·`REAUTH_REQUIRED` 등)과 일관.
- **표 컬럼 포맷**: 2a(`코드|이름|설명|HTTP`)·2b(`코드|status|설명|도메인 SoT`) 모두 기존 §1.2/§1.2.1 표 헤더와 정확히 일치. 인라인 cross-ref 관행(`TOKEN_INVALID` 행 선례)도 그대로 재사용.
- **노트 포맷**: 1a 의 `> **제목**: 본문` 블록쿼트는 문서 전역의 기존 노트 패턴(예: 1-auth.md L280, L293, L312, L334)과 동일 스타일.
- **신규 앵커 3건 전수 검증**: `#5-api-엔드포인트`(기존 5회 검증된 앵커 재사용) · `#23c--비밀번호-변경-시-세션-revoke-범위-refactor-04-후속`(신규, `github-slugger` 로 재계산해 실제 heading `### 2.3.C — 비밀번호 변경 시 세션 revoke 범위 (refactor 04 후속)` 와 정확히 일치 확인) · `#15-워크스페이스-전환-토큰-재발급`(`12-workspace.md` 의 `### 1.5 워크스페이스 전환 (토큰 재발급)` heading 과 슬러그 계산 결과 일치, 괄호가 슬러그에서 제거되어도 동일) — `spec-link-integrity.test.ts` 통과 예상.
- **frontmatter**: `plan/in-progress/catalog-residual-codes.md` 의 `worktree`/`started`/`owner` 필수 3필드 충족(`plan-frontmatter.test.ts`), `spec_impact` 리스트 형식(bare string 아님) 정상. `spec/5-system/1-auth.md`·`3-error-handling.md` 의 기존 `code:` frontmatter 는 이번 변경(순수 spec 카탈로그 등재, 신규 구현 없음)으로 갱신 불요 — 두 파일 모두 이미 관련 모듈(`auth/**`, `error-codes.ts` 등) 커버.
- **ground truth 라인 정밀도**: `auth.service.ts:1134`(`NOT_A_MEMBER`), `auth.service.ts:74`(`PASSWORD_REQUIRED`), `users.service.ts:76,84`(`INVALID_PASSWORD`), `workspaces.service.ts:553,729`(`NOT_A_MEMBER`) 전부 실제 소스와 라인 단위로 일치. HTTP status(403 `ForbiddenException`/401 `UnauthorizedException`)도 실제 throw 와 일치. `verifyPasswordForUser` 가 `/api/auth/2fa/disable`(`auth.controller.ts:342`)·`/api/auth/2fa/webauthn/recovery-codes/regenerate`(`webauthn.controller.ts:372`) 양쪽에서 호출된다는 1a 서술도 확인됨.
- **API 문서 규약(swagger.md)**: 본 plan 은 코드 변경 없는 순수 spec 카탈로그 등재라 decorator/DTO 패턴 적용 대상 아님 — 위반 없음.
- **금지 항목**: rename 이 아닌 신규 카탈로그 등재이므로 `error-codes.md §2` rename 안정성 정책과 무충돌. `historical-artifact` 예외 등재도 불필요(신규 3코드 모두 §1 원칙 그대로 준수).

## 요약
target 은 에러 코드 명명(`UPPER_SNAKE_CASE`, prefix-less 일반 auth 카테고리)·카탈로그 표 포맷·블록쿼트 노트 스타일·신규 마크다운 앵커(3건, 실측 검증 완료) 모두 기존 `spec/conventions/error-codes.md` 및 문서 자체의 확립된 패턴을 정확히 재사용하며, "코드 ground truth" 표의 발행처·라인·HTTP status 도 실제 소스와 전수 일치할 만큼 이례적으로 정밀하다. 다만 `NOT_A_MEMBER` 카탈로그 행(변경 2a)의 disambiguation 설명 한 곳이 `ALREADY_A_MEMBER` 의 실제 발행 흐름(§1.9 "멤버 직접 추가", 초대 수락 아님)을 오분류하고 `NOT_A_MEMBER` 자체의 발행처도 3곳 중 1곳(switch)만 서술해, 본 plan 이 스스로 표방하는 "근접명명 disambiguation" 목적을 부분적으로 훼손한다. 구조적 규약 위반은 없고 산문 정정 1건으로 해소 가능한 수준이다.

## 위험도
LOW
