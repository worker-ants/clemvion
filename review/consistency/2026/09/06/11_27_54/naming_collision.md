# 신규 식별자 충돌 검토

## 검토 범위 및 방법

- `spec/5-system/` 은 이 브랜치에서 **델타 0** — 신규 요구사항 ID·spec 식별자는 도입되지 않았다.
- 프롬프트 번들의 `## 구현 변경 사항` 이 예산에 잘려(2678줄 프롬프트에 diff 섹션 헤더 자체가 없음) 실제 코드 diff 는 워킹트리에서 직접 `git diff origin/main...HEAD` 로 재확인했다:
  `codebase/backend/src/{modules/workflow-versions/*, modules/workspaces/dto/responses/workspace-response.dto.ts, repo-guards/__tests__/{user-entity-exposure-guard.ts,user-entity-exposure.spec.ts,fixtures/user-relation-load.fixture.ts}, shared/testing/user-secret-absence.{ts,spec.ts}}` + `codebase/backend/test/{audit-logs,workflow-crud,workspace-rbac}.e2e-spec.ts` (11파일/1128줄 코드 diff, plan 문서 1건 별도).
- 이 PR 은 `User` 엔티티 컬럼 노출 방어(§5.4 계열 검출 2축 신설) + 기존 엔드포인트(`GET /api/workflows/:wfId/versions/:versionId`, `GET /api/workspaces/:id/members`)의 응답 투영 수정이다. **신규 API endpoint·webhook/queue/SSE 이벤트·ENV 변수는 도입되지 않았다.**

## 발견사항

- **[INFO]** `SRC_ROOT` 상수명이 형제 guard 파일 두 곳에서 각각 독립 선언됨
  - target 신규 식별자: `export const SRC_ROOT = path.resolve(__dirname, '..', '..');` (`codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:14`)
  - 기존 사용처: 동일한 선언이 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:22` 에 이미 존재. 반면 `swagger-dto-contract-guard.ts` 는 같은 개념을 상수가 아니라 `srcRoot` **매개변수**로 받는다(159행 등).
  - 상세: 이름은 동일(`SRC_ROOT`)하지만 각 파일이 자신의 모듈 스코프에서만 export 하므로 실제 import 충돌은 없다 — 두 spec(`user-entity-exposure.spec.ts`, `nullable-type-lie-cast.spec.ts`)이 각자 자기 형제 guard 에서만 가져다 쓰고, 한 파일이 둘을 동시에 import 하는 지점은 없음을 확인했다. 코드 주석도 "형제 가드와 동일한 규약" 이라고 명시해 의도된 반복임을 밝히고 있다. 다만 `swagger-dto-contract-guard.ts` 는 다른 패턴(매개변수화)을 쓰고 있어, guard 파일군 내에 **상수 export 방식 / 매개변수 전달 방식** 두 관례가 공존한다(이 PR 이전부터 존재하던 불일치이며, 이번 PR 은 기존 다수파 관례를 따랐을 뿐).
  - 제안: 충돌은 아니므로 조치 불요. 다음에 guard 를 셋 이상으로 늘릴 계획이 서면 `source-scan.ts` 에 공용 `SRC_ROOT` 도출 헬퍼를 두는 리팩터를 고려할 수 있다(지금 강제할 사안은 아님).

- **[INFO]** `USER_SECRET_KEYS` 가 기존 "strip" 계열 상수와 이름 패턴은 다르지만 의도가 유사
  - target 신규 식별자: `export const USER_SECRET_KEYS = [...] as const;` (`codebase/backend/src/shared/testing/user-secret-absence.ts`)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(53행)·`NOTIFICATION_SIGNING_STRIP_KEYS`(74행)·`TRIGGER_RESPONSE_STRIP_COLUMNS`(94행), `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 의 `SECRET_CONFIG_KEYS`(29행).
  - 상세: 이름이 동일하지도, 같은 모듈에 있지도 않아 **충돌은 아니다.** 다만 이 저장소에는 이미 "응답에서 빼야 할 키 목록" 을 가리키는 `*_STRIP_KEYS`/`*_STRIP_COLUMNS`/`SECRET_CONFIG_KEYS` 명명 계열이 존재하는데, `USER_SECRET_KEYS` 는 그 계열과 달리 **strip(제거) 용이 아니라 detect(검출) 용** 목록이다 — 실제로 코드 어디에서도 이 배열로 필드를 지우지 않고, e2e/`user-secret-absence.spec.ts` 에서 응답에 그 키가 "존재하는지" 만 검사한다. 파일 헤더 주석이 이 구분("형제 가드는 구조를 보고 이쪽은 값이 나간 결과를 본다")을 설명하고 있어 혼동 위험은 낮다.
  - 제안: 현재 이름으로도 문제는 없으나, 추후 유사 검출-전용 상수를 더 추가할 계획이면 `*_LEAK_DETECTION_KEYS` 류로 접미사를 분화해 strip 계열과 시각적으로 갈라두면 좋다(선택 사항, 이번 PR 병합을 막을 사유 아님).

- **[정보 확인 — 충돌 없음]** `WorkspaceMemberDto.joinedAt` 신규 필드
  - target 신규 식별자: `WorkspaceMemberDto.joinedAt: string | null` (`codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`)
  - 기존 사용처 대조: `workspace-member.entity.ts:40`(`joinedAt: Date | null`), `workspaces.service.ts`(65·184·209·223·262행), `workspace-invitations.service.ts:471`, `codebase/frontend/src/lib/api/workspaces.ts:10` — 전부 동일한 의미(워크스페이스 멤버 합류 시각)로 사용 중이며, 이번 DTO 필드 추가는 이미 런타임에 나가고 있던 값을 계약에 뒤늦게 등재한 것이다. 의미·이름 모두 기존 사용처와 정확히 일치한다.

- **[정보 확인 — 충돌 없음]** `USER_SECRET_KEYS` 7컬럼과 `spec/1-data-model.md` §2.1 User 컬럼 대조
  - `passwordHash`/`twoFactorSecret`/`totpRecoveryCodes`/`webauthnRecoveryCodes`/`emailVerifyToken`/`passwordResetToken`/`emailChangeToken` (camelCase) 는 `spec/1-data-model.md` 60·65·68·70·79~81행의 `password_hash`/`two_factor_secret`/`totp_recovery_codes`/`webauthn_recovery_codes`/`email_verify_token`/`password_reset_token`/`email_change_token` (snake_case) 과 1:1로 정확히 대응한다. 명명 표기(camelCase vs snake_case)만 다를 뿐 의미·집합이 일치해 충돌·드리프트 없음.

- **[파일 경로 — 충돌 없음, 컨벤션 준수 확인]** 신규 파일 2쌍
  - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` + `user-entity-exposure.spec.ts` — 기존 `nullable-type-lie-cast-guard.ts`+`.spec.ts`, `swagger-dto-contract-guard.ts`+`.spec.ts`, `audit-action-binding-guard.ts`+`.spec.ts` 등과 동일한 `<name>-guard.ts`/`<name>.spec.ts` 명명 컨벤션을 그대로 따른다. `fixtures/user-relation-load.fixture.ts` 도 형제 `fixtures/` 하위 배치와 일치.
  - `codebase/backend/src/shared/testing/user-secret-absence.ts` + `.spec.ts` — 기존 `response-contract.ts`/`.spec.ts`, `schedule-trigger-ref.ts`/`.spec.ts`, `swagger-probe.ts`/`.spec.ts` 와 동일한 페어링 컨벤션. 기존 파일과 이름이 겹치지도, 컨벤션을 깨지도 않는다.

- **[식별자 충돌 없음 확인]** 신규 export 전수 대조
  - `CREATOR_PROJECTION`(`workflow-versions.service.ts`), `UserRelationLoad`/`collectUserRelationNames`/`findUserRelationLoads`(`user-entity-exposure-guard.ts`), `findUserSecretLeaks`/`expectNoUserSecrets`(`user-secret-absence.ts`), `CreatorProbeController`(테스트 전용, 라우트 `probe-wv-creator`) — 전부 `grep -rn` 으로 저장소 전체에서 재사용/중복 정의가 없음을 확인했다. `CreatorProbeController` 의 라우트 문자열 `probe-wv-creator` 도 기존 `@Controller('probe')`(두 곳의 격리된 테스트 모듈) 와 겹치지 않고, 애초에 이런 probe 컨트롤러들은 실제 앱 모듈에 등록되지 않는 테스트 전용 NestJS 모듈이라 런타임 라우트 충돌 가능성 자체가 없다.
  - 요구사항 ID·API endpoint(method+path)·webhook/queue/SSE 이벤트명·ENV 변수 — 이번 diff 는 이 네 범주에서 **신규 항목을 하나도 도입하지 않는다** (기존 엔드포인트의 응답 투영만 좁혔다). 따라서 해당 범주의 충돌 가능성은 원천적으로 없음.

## 요약

이번 변경은 `spec/5-system/` 에 신규 식별자를 도입하지 않았고(델타 0), 코드 레벨에서도 신규 API endpoint·이벤트명·ENV 변수는 없다. 새로 등장한 식별자(`CREATOR_PROJECTION`, `USER_SECRET_KEYS`, `findUserSecretLeaks`, `expectNoUserSecrets`, `UserRelationLoad`/`collectUserRelationNames`/`findUserRelationLoads`, `WorkspaceMemberDto.joinedAt` 등)는 저장소 전수 검색으로 기존 사용처와 이름·의미 모두 충돌하지 않음을 확인했고, 새 파일 경로 2쌍(`repo-guards/__tests__/`, `shared/testing/`)도 기존 guard/testing helper 페어링 컨벤션을 정확히 따른다. `SRC_ROOT` 상수명이 형제 guard 파일 간 반복되는 점과 `USER_SECRET_KEYS` 가 기존 `*_STRIP_KEYS` 계열과 명명 패턴만 유사한 점은 실질적 충돌이 아니라 명명 일관성 차원의 INFO 로만 남긴다. 신규 식별자 충돌 관점에서 이 PR 을 막을 근거는 없다.

## 위험도

NONE
