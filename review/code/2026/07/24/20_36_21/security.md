# 보안(Security) 코드 리뷰

## 리뷰 범위

- `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` (신규 e2e 테스트, 331줄)
- `plan/complete/node-cancellation-inflight-followups.md` (신규, plan 이동)
- `plan/in-progress/node-cancellation-inflight-followups.md` (삭제, 위 파일로 이동)
- `spec/conventions/node-cancellation.md` (frontmatter `status: partial` → `implemented`, `pending_plans` 제거)

본 변경분은 **신규 프로덕션 코드가 아니라 기존 프로덕션 취소(cancellation) 인프라를 검증하는 e2e 테스트 1건 + plan/spec 메타데이터 정리**다. `execution-engine.service.ts`, `executions.controller.ts` 등 실제 인가/실행 로직 파일 자체는 이번 diff 에 포함되어 있지 않다.

## 발견사항

- **[INFO]** e2e 테스트가 code 노드에 실행하는 busy-wait 스크립트는 코드베이스 내부에서 작성한 고정 문자열이며 사용자 입력이 아니다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:136` (`code:` 필드, `slow` 노드 config)
  - 상세: `code` 노드의 `config.code` 는 프로덕션에서는 사용자가 자유롭게 입력하는 필드이고 `isolated-vm` 으로 샌드박싱된다는 점이 주석에 명시되어 있다(`code.handler.ts` 의 `setTimeout`/`setInterval` 등 삭제 하드닝 언급, 137행 근방). 이 테스트는 그 샌드박스 자체의 보안성을 검증하지는 않으며, 템플릿 리터럴에 삽입되는 값(`INFLIGHT_WINDOW_MS`)도 테스트 파일 내 상수(`5_000`)라 인젝션 표면이 없다.
  - 제안: 조치 불필요. isolated-vm 샌드박스 하드닝 자체의 검증(임의 코드 실행 격리)은 별도 단위/보안 테스트 영역이므로 이 e2e 의 스코프 밖으로 판단.

- **[INFO]** DB 직접 조회는 파라미터 바인딩을 사용해 SQL 인젝션 표면이 없음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:216` (`nodeStatus` 함수의 `db.query`)
  - 상세: `SELECT status FROM node_execution WHERE execution_id = $1 AND node_id = $2` — `executionId`/`nodeId` 는 `$1`/`$2` 로 바인딩되어 있고, 두 값 모두 테스트가 생성한 UUID(`randomUUID()`)나 API 응답값이라 외부 신뢰 불가 입력이 아니다. 안전한 패턴.
  - 제안: 조치 불필요(참고 확인 목적으로 기재).

- **[INFO]** 인증 토큰·워크스페이스 헤더는 하드코딩 없이 헬퍼로 매 실행 시 동적 발급
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:75` (`beforeAll` — `registerAndLogin`/`createTeamWorkspace`), `authHeader()` 정의는 95행
  - 상세: `ownerToken` 은 `registerAndLogin` 이 반환하는 값이며, `uniqueEmail`/`uniqueName` 헬퍼로 매 실행마다 고유한 계정을 생성한다. 시크릿·자격증명 하드코딩 없음.
  - 제안: 조치 불필요.

- **[INFO]** `waitUntil` 타임아웃 에러 메시지가 프로브 결과값을 그대로 문자열화해 노출
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:232` (``throw new Error(`timeout waiting for ${label} — last=${String(last)}`)``)
  - 상세: `last` 는 `node_execution.status` 문자열 또는 `execution` status 문자열뿐이라 민감정보(토큰·PII) 노출 가능성은 없다. 다만 향후 이 헬퍼가 다른 프로브(예: 응답 바디 전체)에 재사용될 경우 토큰/헤더가 실려 있는 객체를 그대로 `String()` 할 위험이 있으니 재사용 확장 시 유의할 값어치는 있다.
  - 제안: 향후 프로브 반환 타입을 넓힐 때는 로그에 민감 필드가 섞이지 않는지 재검토 권고(테스트 전용 코드라 우선순위 낮음).

- **[INFO]** `spec/conventions/node-cancellation.md` frontmatter 변경은 상태 메타데이터 정정일 뿐 동작 계약 변경 없음
  - 위치: `spec/conventions/node-cancellation.md:3` (`status: implemented`), 9~11행 (`pending_plans` 제거)
  - 상세: 문서 본문(§2.1 표, §5 AbortError 분류, §6 구현 현황 표)은 이번 diff 범위에 포함되지 않았고 실측 근거(§3 e2e 완료)와 일치하는 메타데이터 정정으로 보인다. 보안 영향 없음.
  - 제안: 조치 불필요.

인증/인가 관점에서 이 테스트가 검증하는 프로덕션 엔드포인트(`POST /executions/:id/stop`)에 대해, 이 테스트 스위트는 소유자 토큰으로만 stop 을 호출하는 happy-path/terminal-재진입 케이스만 다루고 **다른 워크스페이스·비인가 사용자가 stop 을 호출할 수 있는지(cross-tenant 인가 우회)** 는 이번 파일의 범위 밖이다. 다만 이는 새로 도입된 결함이 아니라 기존에 이미 존재했을 인가 검증 로직(`X-Workspace-Id` 기반)에 대한 커버리지 공백이며, 이번 e2e 는 그 표면을 넓히지도 좁히지도 않는다.

## 요약

이번 변경분은 프로덕션 코드(인증/인가/DB 접근/암호화 로직) 자체를 건드리지 않고, 기존 노드 취소(cancellation) 전파 기능을 검증하는 e2e 테스트 파일 신설과 그에 연동된 plan/spec 문서 정리로 구성된다. 신설된 e2e 는 파라미터 바인딩된 DB 쿼리, 매 실행 동적 발급 토큰, 하드코딩 시크릿 부재 등 안전한 패턴을 따르고 있으며 SQL 인젝션·시크릿 노출·인증 우회 등 실질적 보안 취약점은 발견되지 않았다. code 노드에 주입되는 스크립트는 테스트 내부 고정 문자열로 인젝션 표면이 없고, isolated-vm 샌드박스 자체의 보안성 검증은 이 e2e 의 스코프 밖이다.

## 위험도

NONE
