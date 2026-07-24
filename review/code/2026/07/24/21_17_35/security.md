# 보안(Security) 코드 리뷰

## 리뷰 범위

이번 diff 는 **프로덕션 런타임 코드를 포함하지 않는다**. 구성:

- `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` (신규 e2e, 336줄)
- `plan/complete/node-cancellation-inflight-followups.md` (신규, 완료 이동)
- `plan/complete/node-cancellation-infrastructure.md` (상대경로 링크 정정만)
- `plan/in-progress/harness-push-gate-did-not-fire.md` (신규, 하네스 조사 티켓)
- `plan/in-progress/node-cancellation-inflight-followups.md` (삭제 — 위로 이동)
- `plan/in-progress/node-cancellation-residual-signal-propagation.md` (신규 추적 plan)
- `review/code/2026/07/24/20_36_21/*` (신규, 직전 리뷰 라운드 산출물 — RESOLUTION/SUMMARY/meta/각 reviewer md/json)
- `spec/conventions/node-cancellation.md` (frontmatter `pending_plans` 포인터 갱신 + 본문 두 곳 plan 이름 치환)

`execution-engine.service.ts`, `executions.service.ts`, `executions.controller.ts` 등 인가/실행 로직 파일 자체는 이번 diff 에 없다. 아래 발견사항은 실제 소스(`Read`)로 직접 대조해 작성했다.

## 발견사항

- **[INFO]** code 노드에 주입되는 스크립트는 고정 템플릿 리터럴 — 인젝션 표면 없음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:136-140` (`slow.config.code` 템플릿 리터럴)
  - 상세: 템플릿에 보간되는 값은 파일 상단에 정의된 숫자 상수 `INFLIGHT_WINDOW_MS = 5_000` (`:57`) 뿐이고, 사용자 입력이나 외부 신뢰 불가 값이 섞이지 않는다. 실행은 `isolated-vm` 으로 샌드박싱되며(`code.handler.ts` 의 `setTimeout`/`setInterval`/`setImmediate`/`queueMicrotask` delete 하드닝, 코드 인접 주석 `:131-135`), 이 e2e 는 샌드박스 자체의 보안성을 검증 대상으로 삼지 않는다.
  - 제안: 조치 불요.

- **[INFO]** DB 직접 조회는 파라미터 바인딩 사용 — SQL 인젝션 표면 없음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:216-219` (`nodeStatus` 함수의 `db.query`)
  - 상세: `SELECT status FROM node_execution WHERE execution_id = $1 AND node_id = $2` — `executionId`/`nodeId` 모두 `$1`/`$2` 바인딩. 두 값은 `randomUUID()`로 테스트가 직접 생성했거나 API 응답에서 받은 값으로 외부 비신뢰 입력이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 인증 토큰·워크스페이스 식별자는 하드코딩 없이 매 실행 동적 발급
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:75-89` (`beforeAll` — `registerAndLogin`/`createTeamWorkspace`, `uniqueEmail`/`uniqueName`), `authHeader()` 는 `:95`
  - 상세: `ownerToken` 은 `registerAndLogin` 반환값이고 계정은 매 실행마다 고유 이메일로 신규 생성된다. API 키·비밀번호·인증서 등 하드코딩된 시크릿 없음.
  - 제안: 조치 불요.

- **[INFO]** 타임아웃 에러 메시지가 프로브 결과값을 그대로 문자열화 — 현재는 안전하나 재사용 확장 시 주의
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:232` (``throw new Error(`timeout waiting for ${label} — last=${String(last)}`)``)
  - 상세: 현재 이 헬퍼의 두 호출부(`nodeStatus`, `getStatus`)는 반환 타입이 `string | null` 이라 값은 상태 문자열뿐이며 토큰·PII 노출 가능성이 없다. 다만 `waitUntil<T>` 는 제네릭이라 향후 다른 프로브(예: 응답 바디 객체 전체)를 넘기면 `String(last)` 가 민감 필드를 포함한 객체를 그대로 직렬화할 수 있다.
  - 제안: 향후 이 헬퍼를 객체 반환 프로브에 재사용할 때는 로그/에러 메시지에 민감 필드가 섞이지 않는지 재검토 권고(테스트 전용 코드라 우선순위 낮음, 조치 불요).

- **[INFO]** stop API 인가 범위 — cross-tenant 케이스는 이번 diff 의 범위 밖(신규 갭 아님)
  - 위치: 전체 파일 — 세 `it` 모두 `authHeader()`(소유자 토큰) + 자신의 `workspaceId` 로만 `POST /api/executions/:id/stop` 호출 (`:262-266`, `:308-317`, `:375-379`)
  - 상세: 이 스위트는 (a) 진행 중 노드가 있는 실행의 stop→cancelled 전파, (b) stop 미실행 대조군, (c) terminal 재진입 stop 거부(400) 만 검증한다. 다른 워크스페이스/비인가 사용자가 타인의 실행에 stop 을 호출할 수 있는지(IDOR/cross-tenant 인가 우회)는 다루지 않는다. 다만 이는 이번 diff 가 새로 만든 결함이 아니라 기존 `X-Workspace-Id` 기반 인가 로직에 대한 **커버리지 공백**이며, 이 파일이 그 표면을 넓히거나 좁히지 않는다.
  - 제안: 별도 조치 불요(참고). cross-tenant stop 인가는 `executions.controller.ts`/`executions.service.ts` 기존 가드 대상이며, 필요 시 별도 e2e 항목으로 커버 가능.

- **[INFO]** plan/spec 문서 변경은 메타데이터/포인터 정정뿐 — 동작 계약 변경 없음
  - 위치: `spec/conventions/node-cancellation.md` frontmatter `pending_plans` 필드(구 `node-cancellation-inflight-followups.md` → 신 `node-cancellation-residual-signal-propagation.md`), 본문 두 곳(§구현 현황 legend, §6 표 MakeShop/Cafe24 행)의 추적 plan 이름 치환; `plan/complete/*.md` 3곳 상대경로 링크 정정(`../in-progress/` → same-dir)
  - 상세: §2.1(AbortError 분류)·§5(취소 컨트랙트) 등 보안/인가 관련 본문은 이번 diff 로 변경되지 않았다. 순수 추적 포인터·frontmatter 정정.
  - 제안: 조치 불요.

- **[INFO]** 리뷰 산출물(`review/code/2026/07/24/20_36_21/*`) 자체에 시크릿·인증정보 없음
  - 위치: `RESOLUTION.md`, `SUMMARY.md`, `_retry_state.json`, `meta.json`, `documentation.md`, `maintainability.md`, `requirement.md`, `scope.md`, `security.md`, `side_effect.md`, `testing.md`
  - 상세: 전부 로컬 절대경로(`/Volumes/project/private/clemvion/...`)와 리뷰 텍스트뿐이며 API 키·토큰·자격증명 문자열 없음. 절대경로 자체는 이 저장소의 리뷰 산출물 관행(worktree 경로 기록)과 일치해 정보 노출 이슈로 보지 않음.
  - 제안: 조치 불요.

- **[INFO]** (참고, 이번 diff 밖) `harness-push-gate-did-not-fire.md` 가 기록한 push 리뷰 게이트 미발동은 프로세스 통제 갭
  - 위치: `plan/in-progress/harness-push-gate-did-not-fire.md` (전체)
  - 상세: 이 문서는 코드 취약점이 아니라 "리뷰 없는 `codebase/**` 변경이 origin 에 올라간" 하네스/CI 게이트 결함을 실측 근거와 함께 별도 P1 티켓으로 이미 분리·추적하고 있다. 공급망/변경관리 관점에서는 legitimate 한 발견이지만, 본 security 리뷰의 대상 코드(이 diff) 자체의 취약점은 아니며 이미 적절히 문서화·격리됐다.
  - 제안: 별도 조치 불요(이미 P1 로 추적 중, 본 리뷰 대상 아님). 언급만 해 둠.

## 요약

이번 변경분은 인증/인가/DB 접근/암호화를 다루는 프로덕션 코드를 전혀 건드리지 않고, (1) 기존 cancellation 인프라를 검증하는 신규 e2e 테스트 1건, (2) plan lifecycle 이동·정리, (3) spec frontmatter 의 추적 포인터 갱신으로 구성된다. 신규 e2e 는 파라미터 바인딩된 DB 쿼리, 매 실행 동적 발급 인증 토큰, 하드코딩 시크릿 부재, 고정 문자열 code 노드(인젝션 표면 없음) 등 안전한 패턴만 사용하며, 리뷰 산출물(md/json)에도 민감정보가 없다. 유일하게 기록해 둘 만한 항목은 이 e2e 가 stop API 의 cross-tenant 인가 우회(IDOR) 케이스를 다루지 않는다는 점인데, 이는 이번 diff 가 새로 만든 갭이 아니라 기존 커버리지 공백이며 위험을 넓히지도 좁히지도 않는다. SQL 인젝션·XSS·커맨드 인젝션·하드코딩 시크릿·안전하지 않은 암호화·민감정보 에러 노출 등 실질적 보안 취약점은 발견되지 않았다.

## 위험도
NONE
