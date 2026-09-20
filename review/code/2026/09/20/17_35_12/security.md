# Security Review — rotate lost-update 수정 (integrations.service.ts 외)

## 검토 범위
- `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 를 트랜잭션 + `pessimistic_write` 재읽기 방식으로 재작성
- `codebase/backend/src/modules/integrations/integrations.service.spec.ts` — 동시 rotate 단위 테스트 3건 추가
- `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` — 동시 rotate e2e (신규)
- `plan/complete/spec-draft-integration-error-facts.md`, `plan/complete/spec-draft-rotate-conflict.md`, `plan/in-progress/rotate-lost-update.md` — 문서(계획) 변경
- `review/consistency/2026/09/20/{16_43_05,16_58_56}/**` — consistency-check 산출물 (신규 아티팩트, 실행 코드 아님)

Read 로 `integrations.service.ts` 전체 `rotate()` 블록(라인 1078~1221)과 `requireEntity`(1461~1475), `isAdmin`(1561~1563), `broadcastCredentialChange`(457~461), `RotateCredentialsDto`(dto/integration.dto.ts:330~340)를 직접 열어 프롬프트에 잘린 전체 파일 컨텍스트를 보완했다. 저장소 파일은 뮤테이션하지 않았다 — `git status --short` 확인 결과 이번 세션이 만든 것은 리뷰 산출물 디렉터리(`review/code/2026/09/20/17_35_12/`)뿐이다.

## 발견사항

- **[INFO]** 이번 변경은 lost-update 뿐 아니라 조직-스코프 인가 TOCTOU 도 함께 닫음 (긍정적 보안 개선)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1159`(트랜잭션 안 재검사), 비교 대상 `:1093`(요청 시작 시점 검사)
  - 상세: 기존 코드는 `entity.scope === 'organization'` 검사를 연결 테스트(수 초) 이전, 요청 시작 시점 스냅샷 한 번만 수행했다. 그 사이 동시 요청이 스코프를 `personal → organization` 으로 바꾸면, 이미 시작된 non-admin 의 rotate 요청이 새 admin-only 제약을 우회한 채로 커밋될 수 있었다(TOCTOU 권한 상승 창). 이번 diff 는 `pessimistic_write` 락 안에서 `fresh.scope` 를 다시 읽어 동일 검사를 재실행하므로(`:1159-1165`) 이 창을 닫는다. 대응 단위 테스트도 존재(`integrations.service.spec.ts` "락 안에서 권한을 다시 본다").
  - 제안: 없음 — 개선 사항으로 기록.

- **[INFO]** 재읽기 쿼리가 `workspaceId` 필터를 유지해 테넌트 격리가 유지됨
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1148-1151`
  - 상세: `repo.findOne({ where: { id: entity.id, workspaceId }, lock: {...} })` 로 `requireEntity` 와 동일하게 `workspaceId` 조건을 유지한다. `id` 만으로 재조회했다면 다른 워크스페이스로 이관된 행을 향해 쓸 가능성이 있었겠지만, 그렇지 않다. 이후 `repo.update({ id: entity.id }, changes)` 는 `workspaceId` 조건이 없지만, 직전 락 획득 시점에 같은 트랜잭션 안에서 이미 `workspaceId` 일치를 확인했고 그 사이 락 보유 중 다른 트랜잭션이 이 컬럼을 바꿀 수 없으므로 문제 없음.
  - 제안: 없음.

- **[INFO]** 자격증명 병합에 object spread 사용 — prototype pollution 벡터 아님
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1170` (`const committed = { ...freshBase, ...body.credentials };`)
  - 상세: `body.credentials` 는 `@IsObject()` 만 있는 `Record<string, unknown>`(`dto/integration.dto.ts:338-339`, 이번 diff 대상 아님)이라 임의 키를 허용하지만, 객체 리터럴 spread(`CopyDataProperties`)는 `[[Set]]` 이 아니라 `CreateDataProperty` 를 쓰므로 `__proto__` 라는 키가 와도 실제 프로토타입 변경 없이 평범한 own-property 로만 들어간다. `Object.assign`/재귀 merge 유틸이었다면 별도 검토가 필요했겠지만 이 패턴(기존 코드에도 있던 형태, 이번 diff 는 base 를 `entity` 대신 `fresh` 로 바꿨을 뿐)은 안전하다.
  - 제안: 없음 — 참고용 기록.

- **[INFO]** e2e 테스트의 원시 SQL은 전부 파라미터 바인딩 — 인젝션 없음
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` (`SELECT id FROM integration WHERE id = $1 FOR UPDATE`, `UPDATE integration SET credentials = (SELECT credentials FROM integration WHERE id = $2) ... WHERE id = $1`)
  - 상세: 두 원시 쿼리 모두 `$1`/`$2` 파라미터 플레이스홀더를 쓰고 값 배열을 별도로 전달한다. 문자열 결합 없음 — SQL 인젝션 벡터 없음. 하드코딩된 값(`'old-secret'`, `'new-secret'`, `'X-Api-Key'` 등)은 테스트 픽스처용 placeholder 이지 실제 시크릿이 아니다.
  - 제안: 없음.

- **[INFO]** 락 대기 상한 부재는 설계상 결정이며 문서화됨 (가용성 관점 참고, 신규 취약점 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1141` 주석, `plan/in-progress/rotate-lost-update.md` "INFO 2"
  - 상세: 같은 행에 대한 동시 rotate 가 몰리면 `pessimistic_write` 대기가 쌓일 수 있으나, 임계 구간이 "재읽기 + 머지 + UPDATE" 뿐(외부 HTTP 호출은 락 밖)이라 대기 시간은 밀리초 단위로 설계되어 있고, 같은 모듈의 기존 선례(CONC H-3)와 동일한 트레이드오프다. 새로 도입된 위험이 아니라 기존 정책의 일관된 확장이므로 차단 사유 아님.
  - 제안: 없음 — 향후 같은 행에 대한 비정상적으로 많은 동시 rotate 호출이 실제로 관측되면(레이트리밋 부재) 재검토 권장.

- **[INFO]** consistency-check 산출물(`review/consistency/2026/09/20/**`)은 보고서/메타데이터일 뿐 실행 코드 없음
  - 위치: `review/consistency/2026/09/20/16_43_05/**`, `review/consistency/2026/09/20/16_58_56/**`
  - 상세: 신설안(409 `INTEGRATION_ROTATE_CONFLICT`)을 검토했다가 코드 수정으로 대체하기로 한 의사결정 이력이며, 시크릿이나 실행 가능한 코드는 포함하지 않는다. 보안 관점에서 특기사항 없음.
  - 제안: 없음.

## 요약
`rotate()` 를 "요청 시작 시점 스냅샷 위 머지"에서 "트랜잭션 + `pessimistic_write` 락 안에서 다시 읽은 행 위 머지"로 바꾼 이번 변경은 lost-update 결함을 닫을 뿐 아니라, 연결 테스트가 도는 수 초 동안 조직 스코프로 바뀐 통합에 대해 비-admin 이 쓰기를 완료할 수 있었던 인가 TOCTOU 창까지 함께 제거한다(테스트로 고정됨). 재조회 쿼리는 `workspaceId` 조건을 유지해 테넌트 격리가 보존되고, 자격증명 병합은 object-spread 라 prototype pollution 벡터가 아니며, 신규 e2e 는 파라미터 바인딩된 SQL만 사용해 인젝션 위험이 없다. 하드코딩된 시크릿, 인증 우회, 안전하지 않은 암호화/해시, 민감정보 노출 등 Critical/Warning 급 항목은 발견되지 않았다. 저장소는 리뷰 과정에서 뮤테이션하지 않았다.

## 위험도
NONE
