# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `webauthn.service.ts` `deleteCredential` 메서드 JSDoc 중복 선언
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` 라인 2460~2465
- 상세: 메서드 바로 위에 단행 `/** 개별 삭제. 마지막 credential 이면 user.webauthn_recovery_codes 도 NULL 화. */` 주석이 남아있고, 그 아래 새로운 JSDoc 블록이 추가됐다. 결과적으로 두 개의 주석이 연속으로 나열되어 첫 번째 단행 주석은 실질적으로 JSDoc 의 역할을 잃은 고아 주석이 됐다. TypeDoc 등 문서 생성기는 함수 직전 마지막 JSDoc 블록만 사용하므로 단행 주석은 문서에 포함되지 않지만 가독성을 해친다.
- 제안: 단행 `/** 개별 삭제... */` 주석을 삭제하고 새로운 JSDoc 블록으로 단일화한다.

### [INFO] `spec/data-flow/1-audit.md` Rationale 섹션의 call site 카운트 불일치
- 위치: `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` 본문 §1.1 (call site 숫자) vs. Rationale 끝 단락
- 상세: 본문 §1.1 에서는 "7개 위치(4개 service 모듈 + 3개 auth/user controller) 18개 call site 전수" 로 갱신됐으나, Rationale 마지막 단락("### '모든 도메인 service 가 호출하는 cross-cutting concern' 서술 폐기")에는 여전히 "실제 writer 는 4개 모듈 13개 call site 뿐이라 폐기했다 (§1.1)" 라는 구 숫자(4개 모듈, 13개 call site)가 남아있다. 이 Rationale 단락은 이번 변경에서 수정되지 않았다.
- 제안: Rationale 단락의 "4개 모듈 13개 call site" 를 "7개 위치(4개 service 모듈 + 3개 auth/user controller) 18개 call site" 로 갱신한다.

### [INFO] `spec/5-system/1-auth.md` §4.1 구현된 액션 표 항목의 라인 길이
- 위치: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` — 신규 추가 행
- 상세: 추가된 표 행 `| 인증 (워크스페이스 컨텍스트) | ... controller 경계 기록 ... 상세 [data-flow §1.1] + §Rationale 4.1.B |` 이 단일 셀에 매우 긴 설명을 담고 있어 diff 열람 시 가독성이 떨어진다. 기능적 오류는 아니지만 표 셀 내 설명이 길어 비고 컬럼 추가 또는 각주 링크 사용을 고려할 수 있다.
- 제안: 필수가 아니나, 기존 표 구조(다른 행들은 액션명만 기재)와 일관성을 맞추기 위해 상세 설명은 Rationale §4.1.B 링크로 위임하고 셀을 간결화하는 것을 권장한다.

### [INFO] `audit-action.const.ts` 모듈 주석의 `user.*` 액션 귀속 설명 — `auth.controller` 명칭 누락
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/audit-logs/audit-action.const.ts` 모듈 JSDoc 내 `기록은 세션 컨텍스트가 있는 controller 경계(users.controller·auth.controller·webauthn.controller)` 부분
- 상세: 이 내용 자체는 정확하다. 다만 `users.controller` 가 `UsersController` 를 가리키는지 `auth/users...` 경로를 가리키는지 상대 경로 없이 짧은 이름으로만 기술돼 있어, 프로젝트 구조를 모르는 독자에게 `users.controller` 와 `auth.controller` 가 같은 디렉터리 내에 있는지 혼동을 줄 수 있다. 이는 현재 `spec/data-flow/1-audit.md §1.1` 의 표가 전체 경로를 제공하므로 링크로 해소 가능하다.
- 제안: 주석 내 `(1-auth §4.1 + §Rationale 4.1.B; data-flow/1-audit.md §1.1)` 참조 링크가 이미 있으므로 추가 조치는 필수 아님. 단, 컨트롤러 이름에 상대 경로를 병기하면 명확도 향상.

### [INFO] `users.module.ts` 변경 — 모듈 수준 주석 부재
- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/users.module.ts`
- 상세: `AuditLogsModule` import 추가에 `auth.module.ts` 에는 기재된 것과 같은 이유 주석(`// user.* 인증 감사 이벤트...`)이 없다. 규모가 작은 변경이고 `auth.module.ts` 와 비교해 일관성이 낮다.
- 제안: `AuditLogsModule` import 옆에 `// user.password_changed 감사 이벤트 기록 — UsersController.changePassword (§Rationale 4.1.B)` 수준의 단행 설명을 추가한다.

## 요약

이번 변경은 `user.*` 감사 액션(password_changed, 2fa_enabled, 2fa_disabled)의 구현 및 spec 반영으로 구성된다. 코드 변경에 대한 인라인 주석은 `[Spec Auth §4.1 / Rationale 4.1.B]` 참조 형식으로 일관되게 달려 있고, `audit-action.const.ts` 모듈 JSDoc 은 새 액션의 귀속 정책을 상세히 설명한다. `spec/data-flow/1-audit.md` 와 `spec/5-system/1-auth.md` 의 관련 표도 현재 구현을 반영해 갱신됐다. 다만 `webauthn.service.ts` 의 `deleteCredential` 메서드에 중복 JSDoc 단행 주석이 잔존하고, `spec/data-flow/1-audit.md` Rationale 끝 단락에 구 call site 숫자(13개)가 수정되지 않아 본문 숫자(18개)와 불일치한다. 전반적으로 문서화 수준은 양호하며, 위 두 건을 정정하면 완전한 일관성을 달성한다.

## 위험도

LOW
