# 보안(Security) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 실질 코드 변경 27개 파일 — 나머지 285개는 이전 라운드의 `review/**` 산출물·spec convention 문서로 코드 아님)의 핵심은 실제로 발생했던 두 건의 `User` 엔티티 컬럼 전체 노출을 고치고, 재발을 막는 3축 검출 가드(구조 축 `user-entity-exposure-guard.ts`, 값 축 `user-secret-absence.ts`, 문서 축 `dto-jsdoc-citation-guard.ts`)를 신설한 것이다. 부수적으로 `.claude/hooks/_lib/review_guard.py` 의 YAML frontmatter 파서가 강화되고, `TriggersService` 의 UNIQUE 제약 충돌 응답에 `details` 가 추가됐다.

## 발견사항

- **[INFO]** 새 방어선은 "검출"이지 "차단"이 아니다 — `User` 엔티티 자체에는 여전히 런타임 방어가 없다
  - 위치: `codebase/backend/src/modules/users/entities/user.entity.ts` (엔티티 전체 — `select: false`/`@Exclude()`/`@Expose()` 전무), `CHANGELOG.md` "### 택한 것 — 원인은 구조로, 결과는 이름으로" 절
  - 상세: `user-entity-exposure-guard.ts`/`user-secret-absence.ts`/`dto-jsdoc-citation-guard.ts` 는 전부 **테스트 시점(CI/리뷰 시점)** 에만 작동하는 정적 스캔·응답 스냅샷 단언이다. 신규 코드가 리뷰 게이트를 우회하거나(예: 테스트 실행 없이 강제 머지), 혹은 아직 e2e 로 배선되지 않은 새 엔드포인트가 같은 형태(`relations`/`joinAndSelect` 없이 다른 경로로 `User` 를 통째로 읽어 직렬화)로 유출을 재현하면 런타임에서는 아무것도 막지 않는다. CHANGELOG 자신이 "이것은 방어가 아니라 검출이다" 라고 명시하고 있어 팀이 트레이드오프를 인지한 상태이므로 새로 지적할 결함은 아니지만, `select: false` 도입이 19개 호출지점 재배선(46개 호출자 영향)이 필요해 이번 PR 범위 밖으로 미뤄진 점은 **잔존 위험으로 기록**할 가치가 있다.
  - 제안: 조치 불요(설계상 의도적 트레이드오프, CHANGELOG 에 이미 근거 기재). 다만 `select: false` + 공유 로더 재배선을 후속 planner 항목으로 유지할 것.

- **[INFO]** 가드가 못 보는 유일한 자리(`WorkspacesService.listMembers`)가 명시적으로 화이트리스트-아웃되어 있고, 안전망이 e2e 1건 + 신규 unit 1건뿐
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (`describe('listMembers — 수동 투영이 좁은지'`), `codebase/backend/test/workspace-rbac.e2e-spec.ts` (`it('J. GET /:id/members …')`)
  - 상세: `listMembers` 는 `relations: ['user']` 로 `User` 전 컬럼을 로드한 뒤 **JS 단 수동 매핑**으로 6개 필드만 골라 새 객체를 만든다. `user-entity-exposure-guard` 는 "로드 형태"만 보므로 이 매핑이 `...m.user` 스프레드 등으로 넓어져도 가드는 계속 초록이다. 이번 PR 이 그 사실을 정확히 인지하고 unit(`findUserSecretLeaks(rows)`)·e2e(`expectNoUserSecrets`) 두 안전망을 추가했으므로 결함은 아니지만, 이 자리는 "구조 축이 원리적으로 못 본다"는 이유로 **영구히** 이름 축(문자열 매칭)에만 의존하게 된다 — `USER_SECRET_KEYS` 목록이 미래에 추가되는 비밀 컬럼(패턴이 `Hash`/`Secret`/`Token`/`RecoveryCodes` 로 안 끝나는 경우, 예: `ssn`)을 놓치면 이 자리부터 다시 샌다. `user-secret-absence.spec.ts` 의 "컬럼 수 카나리아" 테스트가 그 경우 실패하도록 설계돼 있어 완전한 사각지대는 아니다.
  - 제안: 조치 불요 — 이미 카나리아로 부분 완화됨. 장기적으로는 `listMembers` 도 TypeORM `select` 투영으로 전환해 구조 축의 사각지대를 없애는 편이 이름 축 단독 의존보다 견고하다.

- **[INFO]** `TriggersService` 의 충돌 에러 메시지·`.claude/hooks/_lib/review_guard.py` 파서 변경에서 민감 정보 노출·인젝션 없음(확인 완료)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict`), `.claude/hooks/_lib/review_guard.py` (`_parse_frontmatter_code`/`_strip_comment`)
  - 상세: 신규 `ConflictException` 메시지는 일반화된 한국어 문구("같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요")와 도메인 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)만 노출하며, DB 에러 원문(`err`)이나 스택은 로깅·응답 어디에도 그대로 실리지 않는다(`catch` 블록에서 `err` 를 그대로 로그하는 지점 없음, 확인함). `pgErrorConstraint`/`isPostgresUniqueViolation` 은 TypeORM 두 래핑 표면(`driverError.code`/최상위 `code`)을 안전하게 흡수하며 SQL 문자열 조립이 없어 인젝션 표면이 아니다. `review_guard.py` 의 정규식(`\s+#`, 따옴표 탐색)은 모두 선형(비-역추적)이라 ReDoS 위험이 없고, 이 파서는 CI/훅 내부에서 신뢰된 저장소 내 `spec/*.md` 만 읽으므로 외부 입력 표면이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 신규/변경 테스트 픽스처의 "비밀값"은 전부 명백한 가짜 값(`'$2b$10$x'`, `'s'`, `'t'` 등)이며 실 자격증명 하드코딩 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`(`memberRow` 픽스처), `codebase/backend/src/shared/testing/user-secret-absence.spec.ts`
  - 상세: bcrypt 포맷을 흉내낸 `$2b$10$x` 는 60자 규격 미달로 실제 유효 해시가 아니고, 나머지도 한 글자짜리 placeholder 다. 유출 판정 로직(`findUserSecretLeaks`)이 값의 내용이 아니라 **키 이름**만 보므로 테스트 목적상 문제 없다.
  - 제안: 조치 불요.

## 요약

핵심 변경은 실제로 발생했던 두 건의 `User` 전체 컬럼 노출(워크플로우 버전 상세 API 의 `creator`, 감사 로그의 중첩 `user`)을 TypeORM `select` 투영으로 정확히 닫고, 동일 결함 클래스의 재발을 막는 3축 검출 가드와 다층 회귀 테스트(unit·e2e·정적 AST 스캔·엔티티 대조 카나리아)를 신설한 것으로, 새로운 인젝션·인증 우회·평문 전송·하드코딩 시크릿 등 OWASP Top 10 급 결함은 발견되지 않았다. 에러 메시지·로깅 경로도 민감 정보를 노출하지 않도록 확인했다. 유일한 잔존 리스크는 이 방어선 전체가 "검출(테스트/리뷰 시점)"이지 "차단(런타임)"이 아니라는 구조적 한계이며, 이는 CHANGELOG 에 이미 명시적으로 disclose 되어 있고 `select: false` 전환을 후속 과제로 남겨둔 상태다.

## 위험도

LOW
