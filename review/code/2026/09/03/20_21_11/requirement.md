# 요구사항(Requirement) 리뷰 — `invitedBy` nullable 정정 리뷰 1R 후속 (fix 커밋)

## 검증 방법

- 소스 대조: `workspace-response.dto.ts`, `workspaces.controller.ts`,
  `workspace-invitations.service.ts`, `workspace-invitation.entity.ts`,
  `V017__workspace_invitations.sql`, `frontend/src/lib/api/workspaces.ts`,
  `spec/5-system/2-api-convention.md §5.4`.
- `git diff --stat origin/main...HEAD` 로 diff 스코프(17개 파일) 전수 확인 — 이번 커밋은 직전 라운드
  (`20_02_03`) SUMMARY 의 WARNING 3건(W1 테스트 인자 미검증·W2 CHANGELOG 누락·W3 plan 문서 자기모순)에
  대한 fix + 그 라운드의 review 산출물 자체를 이력으로 커밋.
- 뮤테이션 재현(W1 유효성): `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 를
  scratch 로 백업 후 `listPending(workspaceId, user.sub)` 인자 순서를 `(user.sub, workspaceId)` 로
  스왑, `npx jest workspaces.controller.spec.ts` 실행 → **`1 failed, 13 passed, 14 total`**, 실패
  지점이 신규 `toHaveBeenCalledWith` 단언 정확히 그 줄. `cp` 로 원복 후 `diff` 바이트 동일 확인 +
  `git status --short` 로 잔여 변경 없음(untracked 는 이 리뷰 산출물 디렉터리뿐) + 재실행 14/14 GREEN.
  RESOLUTION.md 가 적은 "실측 1 failed / 13 passed" 와 독립 재현으로 정확히 일치.

## 발견사항

- **[INFO]** W1 fix(`toHaveBeenCalledWith('ws-1', user.sub)` 추가)가 실제로 회귀를 잡는 유효한
  단언임을 독립 뮤테이션으로 재확인했다 — vacuous 아님.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:84`
  - 상세: 위 "검증 방법" 절 참조. RESOLUTION.md 의 실측치와 내 재현이 정확히 일치.
  - 제안: 없음.

- **[INFO]** W2 fix(CHANGELOG 항목)가 코드 diff·DB 스키마·엔티티·FE 계약과 line-level 로 정확히
  일치한다.
  - 위치: `CHANGELOG.md:3-22` vs `workspace-response.dto.ts:105-110`,
    `migrations/V017__workspace_invitations.sql:15`(`invited_by UUID REFERENCES "user"(id) ON
    DELETE SET NULL`), `frontend/src/lib/api/workspaces.ts:154`(`invitedBy: string | null`).
  - 상세: 표의 "종전/지금" 값이 실제 diff(`invitedBy: string` → `invitedBy?: string | null`,
    `@ApiProperty({ format: 'uuid' })` → `@ApiPropertyOptional({ format: 'uuid', nullable: true })`)
    와 정확히 일치. "동작 변경 없음" 주장도 핸들러가 코어션 없이 그대로 통과시키는 것으로 확인됨
    (`workspaces.controller.ts:402` `invitedBy: i.invitedBy`). "FE 는 이미 nullable 로 다루고
    있었다" 주장도 grep 으로 재확인.
  - 제안: 없음.

- **[INFO]** spec fidelity — DTO 변경이 §5.4 규정과 line-level 로 정확히 일치 (재확인, 직전
  라운드 requirement.md 의 판정과 동일).
  - 위치: `workspace-response.dto.ts:109-110` vs `spec/5-system/2-api-convention.md:184`
    (*"`null` 을 쓰는 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null`"*).
  - 상세: `@ApiPropertyOptional({ format: 'uuid', nullable: true })` + `invitedBy?: string | null`
    로 정확히 이 표기를 따름. 자매 항목 `AuthConfigDto.ipWhitelist`(`auth-config-response.dto.ts:27-28`
    `@ApiPropertyOptional({ type: [String], nullable: true })` + `ipWhitelist?: string[] | null`)와
    형태가 동일해, CHANGELOG 가 "바로 앞 `ipWhitelist` 항목과 같은 형태" 라 적은 주장도 확인됨.
  - 제안: 없음.

- **[INFO]** W3 fix — plan 문서의 신·구 절 모순이 실제로 해소됐다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:353-364`
    (폐기 배너 + 취소선 + "→ 반증 결과" 인라인 주석), `:195-231`(갱신된 결론 절).
  - 상세: 옛 절(舊 `### 새로 드러난 축`)의 "48건 미해결"·"가드 신설 필요" 서술에 폐기 배너와
    전방 포인터가 붙었고, 각 취소선 항목 뒤에 반증 근거(`→ 귀속했더니 1건이었다`, `→ 만들지
    않는다`)가 인라인으로 붙어 순서대로 읽어도 모순되지 않는다. 원본 측정치(`48건/26파일`, `:347`)
    자체는 "당시 계측값" 으로 남아 있고 그 옆에 폐기 배너가 있어 오독 유발 소지가 없다.
  - 제안: 없음.

- **[INFO]** `acceptedBy` 형제 필드가 응답 DTO 어디에도 노출되지 않는다는 plan 주장을 grep 전수로
  재확인 (컨트롤러·모든 workspaces DTO).
  - 위치: `codebase/backend/src/modules/workspaces/` 전체 (`grep -rn acceptedBy` 결과 3곳 모두
    엔티티·서비스 내부 UPDATE 문뿐, 응답 DTO 필드 아님).
  - 제안: 없음.

- **[INFO]** 이 diff 에 포함된 `review/code/2026/09/03/20_02_03/*` 11개 파일은 직전 라운드의
  review 산출물을 이력으로 커밋한 것으로, 애플리케이션 코드/동작에 영향이 없다(문서 아카이브).
  프로젝트 관례상 `review/` 는 gitignore 대상이 아니므로 이 자체는 정상.
  - 위치: `review/code/2026/09/03/20_02_03/` (신규 11개 파일)
  - 제안: 없음.

## 뮤테이션/작업트리 위생

- 뮤테이션 대상: `codebase/backend/src/modules/workspaces/workspaces.controller.ts`
  (저장소 트리 내부 편집 — NestJS 모듈 컴파일이 필요해 저장소 밖 사본으로는 재현 불가).
- 백업: scratch 디렉터리에 `cp` (`.../scratchpad/workspaces.controller.ts.orig`).
- 원복: `cp` 로 수행(`git checkout`/`restore` 미사용), `diff` 바이트 동일 확인, `git status --short`
  로 잔여 변경 없음 확인(untracked 는 `review/code/2026/09/03/20_21_11/` 이 산출물 디렉터리뿐),
  재실행 `14/14 GREEN` 재확인. 원복 실패나 잔여물 없음.

## 요약

이번 커밋은 직전 리뷰 라운드(`20_02_03`)의 WARNING 3건(테스트 인자 미검증·CHANGELOG 누락·plan
문서 자기모순)을 모두 정확히 조치했다. `WorkspaceInvitationDto.invitedBy` nullable 전환은 DB
스키마(V017 `ON DELETE SET NULL`)·엔티티·컨트롤러 통과 동작·FE 계약·API 규약 §5.4 표기와
line-level 로 일치하며, 신규 canary 테스트의 회귀 포착 능력을 독립 뮤테이션으로 재확인했다(인자
순서 스왑 → 예측대로 `1 failed/13 passed`, 원복 확인 완료). CHANGELOG 항목은 실제 diff·DB·FE
상태와 정확히 부합하고, plan 문서의 신·구 서술 모순도 폐기 배너 + 인라인 반증 근거로 해소됐다.
TODO/FIXME/HACK/XXX 류 미완성 표식 없음, 모든 경로에서 반환값 정의됨(코어션 없이 null/값 그대로
전달), 에러 시나리오(비-admin 접근 시 `ForbiddenException`)는 이 diff 의 스코프 밖 선재 공백으로
이번 변경의 결함이 아니다. Critical/Warning 급 발견사항 없음.

## 위험도

NONE
