# Security Review — rotate lost-update 수정 후속 (private 헬퍼 통일 · 뮤테이션 테스트 보강 · e2e try/finally · 문서화)

## 검토 범위

이번 라운드(`18_09_24`)의 diff base 는 직전 라운드(`17_35_12`)가 이미 리뷰한 커밋 `5c694cc5f`(핵심 lost-update 수정) 위에 쌓인 후속 커밋들이다.

- `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 의 락 전/후 권한재검사·머지검증을 `assertCanRotate` / `mergeAndValidateCredentials` private 헬퍼로 통일 (`af6cc0d2c`)
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 락 안 재검증(`freshErrors`) 삭제 뮤턴트, `workspaceId` 스코핑 제거 뮤턴트를 잡는 단위 테스트 추가 (`ab0988f7f`)
- `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` — `BEGIN`~`COMMIT` 구간을 `try/finally` 로 감싸 중간 단언 실패 시 트랜잭션·pending 요청이 새는 것을 방지 (`154e17d31`, 직전 라운드 side_effect WARNING 조치)
- `CHANGELOG.md` — 이번 수정에 대한 Unreleased 항목 추가 (`d532184f5`)
- `plan/complete/spec-draft-integration-error-facts.md`, `plan/complete/spec-draft-rotate-conflict.md`, `plan/in-progress/rotate-lost-update.md` — 문서(계획) 변경. `spec-draft-rotate-conflict.md` 는 409 신설안이 `/consistency-check --spec` 로 반증되어 `superseded` 로 남긴 draft
- `review/code/2026/09/20/17_35_12/**`, `review/consistency/2026/09/20/**` — 직전 라운드 리뷰·consistency-check 산출물 (신규 커밋 대상, 실행 코드 아님)

`git diff 22727e287..HEAD -- codebase/backend/src/modules/integrations/integrations.service.ts` 로 lost-update 수정 이전 baseline 과의 전체 diff 를, `Read` 로 `integrations.service.ts` 전체 파일(특히 `rotate()` 1121~1224줄, `assertCanRotate` 1082~1093줄, `mergeAndValidateCredentials` 1100~1119줄)을 직접 확인했다. 저장소 파일은 뮤테이션하지 않았다 — `git status --short` 확인 결과 이번 세션이 만든 것은 `review/code/2026/09/20/18_09_24/` 디렉터리뿐이다.

## 발견사항

- **[INFO]** private 헬퍼 통일로 락 전/후 권한 검사·머지 검증의 drift 위험이 구조적으로 제거됨 (긍정적 보안 개선)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `assertCanRotate`(1082-1093), `mergeAndValidateCredentials`(1100-1119), 호출부 `rotate()` 1136·1138(락 전)·1179·1182(락 안)
  - 상세: 직전 라운드는 권한 재검사·머지 검증 로직이 락 전/후 두 곳에 복붙돼 있어 한쪽만 고치면 조용히 어긋날 수 있다는 유지보수성 지적(WARNING)을 남겼는데, 이번 커밋이 그 두 지점을 같은 private 메서드로 통일했다. 두 호출부 모두 동일한 `assertCanRotate(row, userRole)` / `mergeAndValidateCredentials(row, patch)` 시그니처를 쓰고, `row` 파라미터만 락 전 스냅샷(`entity`)과 락 안 재읽기(`fresh`)로 갈린다 — 보안 직결 로직(조직-스코프 admin 검사, 자격증명 구조 검증)이 이제 단일 소스다. 신규 단위 테스트(`integrations.service.spec.ts` "락 안 재검증이 실패하면 커밋하지 않는다")가 이 재검증이 실제로 재읽은 행 위에서 동작하는지도 뮤테이션으로 확인했다.
  - 제안: 없음 — 개선 사항으로 기록.

- **[INFO]** 신규 단위 테스트가 뮤테이션으로 실측 검증됨 — 커버리지 갭이 실제로 닫혔는지 확인
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` "락 안 재검증이 실패하면 커밋하지 않는다" · "임계 구간은 트랜잭션 + pessimistic_write 락이고..." (workspaceId 스코핑 단언)
  - 상세: `review/code/2026/09/20/17_35_12/RESOLUTION.md` 의 뮤테이션 검증 절에 따르면 (1) 락 안 재읽기 `where` 의 `workspaceId` 제거, (2) 락 안 `freshErrors` 재검증 블록 삭제 — 두 뮤턴트를 `cp` 백업 후 직접 적용해 각각 신규 단언이 RED 로 반응함을 확인하고 `cp` 로 원복했다고 기록돼 있다. `workspaceId` 스코핑은 테넌트 격리와 직결된 보안 불변식이라, 이 뮤테이션 검증이 회귀 감지력을 실측했다는 점은 긍정적이다.
  - 제안: 없음.

- **[INFO]** e2e `try/finally` 보강 — 트랜잭션/락 잔존 위험이 닫힘 (직전 라운드 WARNING 조치 확인)
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` `locker.query('BEGIN')` ~ `finally { await locker.query('ROLLBACK').catch(...); await pending?.catch(...); }`
  - 상세: 직전 라운드 side_effect 리뷰가 지적한 "구간 내 단언 실패 시 `locker` 커넥션이 미종결 트랜잭션인 채로 행 락을 계속 쥐고 `pending` 요청도 드레인되지 않는다" 문제가 `try/finally` 로 해소됐다. `finally` 의 `ROLLBACK` 은 정상 경로(이미 `COMMIT` 된 뒤)에도 no-op 이라 안전하며, `pending?.catch(() => undefined)` 로 미해결 프라미스도 드레인한다. 테스트 인프라 자체의 보안 취약점은 아니지만, 락을 오래 쥔 채 방치되는 시나리오는 CI 안정성뿐 아니라 반복 실행 시 DB 커넥션 고갈로 이어질 수 있어 이번 조치는 타당하다.
  - 제안: 없음.

- **[INFO]** 신규 e2e 원시 SQL 은 전부 파라미터 바인딩 — 인젝션 벡터 없음 (직전 라운드 확인 재확인)
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` `SELECT id FROM integration WHERE id = $1 FOR UPDATE`, `UPDATE integration SET credentials = (SELECT credentials FROM integration WHERE id = $2) ... WHERE id = $1`
  - 상세: 두 쿼리 모두 `$1`/`$2` 플레이스홀더 + 별도 값 배열이며 문자열 결합이 없다. `'old-secret'`/`'new-secret'`/`'X-Api-Key'`/`'X-Concurrent'` 는 테스트 픽스처 placeholder 이지 실제 시크릿이 아니다(diff 전체를 `password|secret|token|api_key` 로 grep 해 확인).
  - 제안: 없음.

- **[INFO]** CHANGELOG·plan 문서 변경은 코드 변경사항의 서술일 뿐 — 신규 실행 경로·시크릿 없음
  - 위치: `CHANGELOG.md` (Unreleased 항목), `plan/complete/spec-draft-rotate-conflict.md`(신규, `superseded`), `plan/in-progress/rotate-lost-update.md`(신규), `plan/complete/spec-draft-integration-error-facts.md`(frontmatter `title:` quoting 수정)
  - 상세: 전부 마크다운 산문이며 코드·설정값·자격증명이 포함되지 않는다. `spec-draft-rotate-conflict.md` 는 409 `INTEGRATION_ROTATE_CONFLICT` 신설안을 다뤘지만 `/consistency-check --spec` 반증으로 철회된 안이라고 문서 자체가 명시하며 실제 구현에 반영되지 않았다(코드 diff 어디에도 해당 코드가 없음을 확인).
  - 제안: 없음.

- **[INFO]** 리뷰/consistency-check 산출물(`review/**`)은 보고서·메타데이터일 뿐 실행 코드 없음
  - 위치: `review/code/2026/09/20/17_35_12/**`, `review/consistency/2026/09/20/**`
  - 상세: 직전 라운드 리뷰 결과 및 그 이전 여러 `/consistency-check` 세션(14_01_01 ~ 16_58_56)의 산출물이 신규 커밋으로 들어왔다. 전부 마크다운/JSON 보고서이며 시크릿이나 실행 가능한 코드가 없다.
  - 제안: 없음.

## 요약

이번 라운드의 실질 코드 변경은 직전 라운드가 이미 NONE 등급으로 검토한 rotate lost-update 수정 위에 (1) 락 전/후 권한재검사·머지검증을 private 헬퍼로 통일해 보안 직결 로직의 drift 위험을 구조적으로 제거하고, (2) 그 재검증 경로가 실제로 재읽은 행 위에서 동작하는지를 뮤테이션 테스트로 실측 검증했으며, (3) 신규 e2e 의 트랜잭션 구간을 `try/finally` 로 감싸 락·pending 요청 잔존 위험을 닫은 것이다. 새로운 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지 않은 암호화·민감정보 노출 벡터는 발견되지 않았고, 문서/리뷰 산출물 커밋들은 보안에 영향이 없다. 저장소는 리뷰 과정에서 뮤테이션하지 않았다.

## 위험도
NONE
