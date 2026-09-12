# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 컨텍스트

SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]` 20행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read.

변경 set (커밋 `66968fc26`, 전수 7파일 — `git show --stat HEAD` 로 확인):

- `CHANGELOG.md`
- `codebase/backend/src/modules/auth/login-history.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (+ `.spec.ts`)
- `plan/in-progress/keyset-cursor-uuid-validation.md`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`

변경 내용: keyset 커서의 `id` 성분이 검증 없이 `uuid` 컬럼에 바인딩되어 Postgres 22P02 →
`GlobalExceptionFilter` 미분류 → 500 으로 마스킹되던 결함을, 기존에 있던 `isUuidShaped`
(신규 아님 — `codebase/backend/src/common/utils/uuid.ts`, 이전 커밋 `7ef8dc993` 계열에서 이미 도입)
를 두 디코더(`login-history.service.ts`, `background-runs.service.ts`)에 적용해 막는다. 각
디코더의 **기존 실패 계약을 유지**(login-history: 무시 → 1페이지, background-runs: 400
`INVALID_CURSOR`)하며, 신규 UI·신규 노드·신규 provider·신규 error/warning code·신규 문서 섹션은
없다.

## 매트릭스 매칭 검토

1. **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 파일이 `nodes/`
   경로 밖(`modules/auth/`, `modules/executions/background-runs/`)이라 미매칭.
2. **new-ui-string** (`*.tsx`) — 변경 파일에 `.tsx` 없음. 미매칭.
3. **integration-provider-change** — provider 코드 변경 없음. 미매칭.
4. **new-userguide-section-dir** — 신규 `content/docs/<NN>-*/` 없음. 미매칭.
5. **backend-api-change** (`*.controller.ts`, `dto/**`) — 변경 파일이 `.service.ts`/`.spec.ts`
   뿐이고 `.controller.ts`·`dto/**` 없음. 요청/응답 스키마·엔드포인트 계약도 불변(기존 실패
   계약 유지가 이 커밋의 명시적 설계 원칙). 미매칭.
6. **new-warning-code / new-error-code** — `INVALID_CURSOR` 는 background-runs 의 기존 코드
   재사용(같은 함수 내 다른 catch 분기가 이미 쓰던 코드)이고 `isUuidShaped` 자체도 기존
   유틸이다. 신규 코드 발행 없음. 미매칭.
7. **expression-language-change** — `packages/expression-engine/**` 무관. 미매칭.
8. **auth-session-flow-change** (semantic, trigger glob `codebase/backend/src/modules/auth/**`)
   — `login-history.service.ts`/`.spec.ts` 가 **경로상으로는** 이 glob 에 정확히 든다. 판단
   지점: 이 매치가 "인증·권한·세션 흐름 변경" 이라는 의미에 실제로 해당하는가.
9. **run-debug-flow-change** (semantic) — `background-runs.service.ts` 는 실행 모니터링
   read-only API(spec/4-nodes/1-logic/12-background.md §8)라 "실행·디버깅 흐름" 과 인접.
10. **spec-major-change / userguide-gui-flow-section** — `spec/` 변경 없음(plan 문서만). 미매칭.

## 발견사항

- **[INFO]** `login-history.service.ts` 변경이 `auth-session-flow-change` 트리거 glob 에
  경로상 매칭되나, 의미상 로그인/세션/권한 흐름 변경이 아니다
  - 변경 파일: `codebase/backend/src/modules/auth/login-history.service.ts`,
    `codebase/backend/src/modules/auth/login-history.service.spec.ts`
  - 매트릭스 항목: `auth-session-flow-change` — "인증·권한·세션 흐름 변경" →
    "`codebase/frontend/src/content/docs/07-workspace-and-team/` 의 관련 페이지 + e2e"
    (PROJECT.md 176행)
  - 상세: `login-history.service.ts` 는 파일시스템상 `modules/auth/` 아래 있지만, 이번 diff 가
    건드리는 것은 `GET /api/users/me/login-history` 의 **keyset 페이지네이션 커서 디코딩**
    뿐이다. 로그인·로그아웃·세션 발급/검증·권한 체크(`RolesGuard` 등) 로직은 전혀 건드리지
    않았고, 요청/응답 스키마도 그대로다(비-UUID 커서를 조용히 무시하고 1페이지를 주는 **기존
    계약**을 유지 — 500→200 은 계약 위반 사례를 정상 계약으로 되돌리는 결함 수정이지 신규
    사용자 가시 기능이 아니다). `07-workspace-and-team/` 문서를 grep 했으나 로그인 이력
    페이지네이션·커서 오류 처리를 서술하는 내용은 원래 없다(문서가 이 세부까지 내려가지
    않음) — 즉 이 변경으로 인해 기존 문서가 stale 해지는 지점이 없다. 사용자 가시 동작
    변경분(500→200 상태 코드 변경)은 이미 `CHANGELOG.md` 에 배포 확인 문구까지 포함해
    상세히 기록됐다(이 저장소의 이런 부류 변경(예: `rotate-bot-token` 500→400,
    `rotateBotToken` 400→502)에 대한 기존 관례와 일치).
  - 결론: 실제 동반 갱신 누락으로 판단하지 않음(grey zone, 정보성 기록).

- **[INFO]** `background-runs.service.ts` 변경이 `run-debug-flow-change` 트리거와 의미상 인접하나
  실행/디버깅 UI 흐름 변경이 아니다
  - 변경 파일: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`,
    같은 디렉토리 `.spec.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "실행·디버깅 흐름 변경" →
    "`codebase/frontend/src/content/docs/05-run-and-debug/`" (PROJECT.md 179행)
  - 상세: 이 서비스는 Background 노드의 본문 실행을 모니터링하는 read-only API(파일 상단
    JSDoc: "메인 흐름의 격리 컨트랙트에 영향을 주지 않는 순수 read")다. 이번 diff 는 커서의
    `i`(NodeExecution id) 성분에 `isUuidShaped` 검증 한 줄을 추가해 malformed 커서의 500→400
    디스포지션만 바꿨다. `05-run-and-debug/` 문서를 커서 오류 처리 관점으로 grep 했으나
    해당 세부를 서술하는 내용이 원래 없어 stale 해지는 지점이 없다.
  - 결론: 실제 동반 갱신 누락으로 판단하지 않음(grey zone, 정보성 기록).

## 요약

매트릭스 20행 중 glob 매칭 후보는 0건(노드/UI/provider/섹션/API 컨트롤러·DTO/enum/warning·
error code 전부 미매칭)이었고, semantic 매칭 후보 2건(`auth-session-flow-change`,
`run-debug-flow-change`)은 경로·도메인 인접성만 있을 뿐 실제 의미(로그인·세션·권한 흐름,
실행·디버깅 UI 흐름)에는 해당하지 않는 것으로 판단했다 — 두 파일 모두 keyset 커서의 uuid
형태 검증이라는 순수 방어적 버그 수정이며, 요청/응답 계약·UI·문서가 서술하는 어떤 세부도
바꾸지 않는다(사용자 가시 상태 코드 변화는 `CHANGELOG.md` 가 이미 충분히 기록). 신규 노드·
신규 UI 문자열·신규 provider·신규 error/warning code·신규 문서 섹션도 전무해 CRITICAL/WARNING
사유 없음. 두 semantic grey-zone 판단만 INFO 로 기록.

## 위험도

NONE
