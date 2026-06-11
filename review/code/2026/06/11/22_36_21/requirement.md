# 요구사항(Requirement) Review

## 발견사항

### 1. **[INFO]** 기능 완전성 — CRUD 4종 audit 기록 모두 구현됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `create`, `update`, `regenerate`, `remove`
- 상세: 계획된 `auth_config.create/update/delete/regenerate` 4종 감사 로그 기록이 서비스 레이어에 완전히 구현됐다. `AUDIT_ACTIONS` 상수에 4종 추가 → 서비스 메서드에 `userId`/`ipAddress` 파라미터 전파 → `auditLogsService.record()` 호출까지 일관성 있게 구현됐다. spec `5-system/1-auth.md §4.1` 의 구현됨 표에 5종(`create/update/delete/regenerate/reveal`)이 정확히 반영되어 있으며 Planned 목록에서도 제거됐다.
- 제안: 이상 없음.

---

### 2. **[INFO]** spec fidelity — `§4.1` 액션 명세와 코드 일치 확인
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` + `spec/5-system/1-auth.md §4.1`
- 상세: spec §4.1 구현됨 표에 `auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal` 5종이 명시되어 있다. `AUDIT_ACTIONS` 상수의 값 문자열(`AUTH_CONFIG_CREATE: 'auth_config.create'` 등)이 spec 표와 line-level 로 일치한다. 명명 규약(현재형 동사)도 spec §4.1 서문의 "auth_config 은 CRUD 동사 현재형으로 통일" 방침과 일치한다.
- 제안: 이상 없음.

---

### 3. **[INFO]** spec fidelity — `§3.2` 권한 매트릭스 vs `@ApiForbiddenResponse` 수정 확인
- 위치: `auth-configs.controller.ts` — `create`(라인 96), `update`(라인 119), `remove`(라인 224)
- 상세: spec §3.2 권한 매트릭스는 Auth Config CRUD 를 Owner+Admin 에게만 허용하며(`Auth Config | CRUD | CRUD | R | R`), 코드 `@Roles('admin')` 가드와 일치한다. 이번 변경으로 `@ApiForbiddenResponse` 설명이 `'Editor 미만 권한'` → `'Admin 미만 권한'` 으로 수정됐으며 실제 가드(`@Roles('admin')`)와 정확히 정렬됐다. 이전에 존재하던 Swagger 설명 불일치가 해소됐다.
- 제안: 이상 없음.

---

### 4. **[INFO]** `regenerate` 의 `basic_auth` 타입 무동작 — spec 침묵 영역
- 위치: `auth-configs.service.ts` — `regenerate` 메서드, `api_key`/`bearer_token`/`hmac` if-else if 체인 이후
- 상세: `basic_auth` 타입에 대해 `regenerate` 호출 시 자격증명 교체 없이 `save()` 후 `auth_config.regenerate` audit 가 기록된다. spec(1-data-model.md §2.17.1 "basic_auth 는 사용자 입력 — 자동 발급 없음", 2-navigation/6-config.md §A.2)은 `regenerate` 가 `api_key`/`bearer_token`/`hmac` 대상임을 암시하지만 `basic_auth` 에 대해 명시적으로 허용/금지를 선언하지 않는다. 코드는 자격증명을 바꾸지 않고 감사 로그를 기록하므로 "아무것도 안 했는데 regenerate 성공" 의미가 되어 감사 추적성을 오염시킬 수 있다.
- 제안: (a) spec 에서 `basic_auth`의 `regenerate` 동작을 명시(허용 시 no-op 주석 추가, 금지 시 `BadRequestException`)하도록 `project-planner` 에 위임하거나, (b) 임시로 "// basic_auth: 사용자 입력 자격증명 — 자동 재발급 없음, no-op" 주석을 추가해 의도적 처리임을 명시. spec 침묵 영역이므로 INFO.

---

### 5. **[INFO]** [SPEC-DRIFT] `spec/data-flow/1-audit.md §1.1` call site 수 표현 — 이미 갱신 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/spec/data-flow/1-audit.md` §1.1
- 상세: 현재 파일을 확인한 결과 `"4개 모듈 13개 call site 전수"` 로 이미 갱신되어 있다. 직전 리뷰 세션(`21_50_33/requirement.md` 발견사항 #4)에서 "9개 → 13개 미갱신" 으로 보고됐으나, 이는 해당 시점 코드 기준이었고 spec 갱신이 동일 커밋에 포함됐다. 현재 최신 코드에서는 spec 과 구현이 일치한다.
- 제안: 이상 없음. 선행 발견사항의 정합성 확인 완료.

---

### 6. **[INFO]** 에러 시나리오 — `findById` NotFoundException 후 audit 미기록 (의도된 동작)
- 위치: `auth-configs.service.ts` — `update`, `regenerate`, `remove` 메서드
- 상세: `findById` 에서 `NotFoundException` 이 발생하면 `auditLogsService.record()` 는 호출되지 않는다. 이는 구조상 올바른 동작이다 — 존재하지 않는 리소스에 대한 실패 조작을 audit 로 기록할 필요가 없으며, 성공 후에만 기록하는 best-effort 정책과 일관된다. spec 에서도 실패 조작의 audit 기록을 요구하지 않는다.
- 제안: 이상 없음. 현재 설계가 spec 의도와 일치.

---

### 7. **[INFO]** 반환값 — `create` 는 평문 반환, `update` 는 마스킹 반환의 비대칭성
- 위치: `auth-configs.service.ts` 라인 149(`return saved`), 라인 170(`return this.toMasked(saved)`)
- 상세: `create` 는 평문(`saved`)을 반환하고 `update` 는 `toMasked(saved)`를 반환한다. spec/1-data-model.md §2.17.2 는 "평문 노출은 create/regenerate/reveal 3 경로만 허용" 이라 명시한다. `create` 의 평문 반환은 spec 의 의도된 허용이며, `update` 의 마스킹 반환은 spec 요구사항과 일치한다. 비대칭 설계가 의도적이고 spec-aligned 하다.
- 제안: 이상 없음.

---

### 8. **[INFO]** 데이터 유효성 — `userId` 필수 파라미터 비어있을 경우 타입 강제만 존재
- 위치: `auth-configs.service.ts` — 4개 메서드 시그니처 `userId: string`
- 상세: `userId` 는 TypeScript 수준에서 `string` 필수 파라미터이며 빈 문자열(`''`)은 타입 레벨에서 허용된다. 그러나 `@CurrentUser('sub')` 데코레이터가 JWT claims 에서 추출하므로 인증된 요청에서 빈 문자열은 실제 발생하지 않는다. `AuditLogsService.record` 에 빈 `userId` 가 전달되더라도 audit 로그의 `userId` 컬럼이 nullable 이면 DB 레벨 오류 없이 저장된다. 현 보안 모델(JWT 강제 인증)에서는 실용적 위험이 없다.
- 제안: 이상 없음. JWT 인증 강제가 충분한 가드 역할을 한다.

---

## 요약

이번 변경은 `AuthConfig` CRUD 4종(`create/update/delete/regenerate`)에 `userId`·`ipAddress` 기반 감사 로그 기록을 추가하며, `AUDIT_ACTIONS` 상수 4종 추가, 서비스 메서드 시그니처 확장, 컨트롤러 `@CurrentUser`·`@Req` 전파, 테스트 CRUD 감사 4케이스 추가, spec §4.1 및 data-flow §1.1 갱신까지 포함한다. spec/5-system/1-auth.md §4.1 과 구현이 action 명칭·명명 규약·권한 매트릭스(Admin 미만 권한으로 통일) 기준 line-level 로 일치한다. data-flow/1-audit.md §1.1 call site 수 "13개"도 이미 반영됐다. `@ApiForbiddenResponse` 의 "Admin 미만 권한" 수정은 spec §3.2(`Auth Config | CRUD | CRUD | R | R`)와 `@Roles('admin')` 가드를 올바르게 정렬했다. 유일한 미결 영역은 `basic_auth` 타입에 대한 `regenerate` 동작(무동작+audit 기록)이 spec에 명시되지 않은 침묵 영역으로, 감사 로그 정확성 측면에서 향후 spec 명시 또는 코드 주석이 권장된다.

## 위험도

LOW
