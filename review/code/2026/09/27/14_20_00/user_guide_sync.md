# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 20개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read 했다.

## 변경 파일 개요

이 PR(`patch-omit-undefined`)의 변경 set 은 다음으로 구성된다:

- `CHANGELOG.md`
- `codebase/backend/src/common/utils/omit-undefined.{ts,spec.ts}` — 배열 거부 타입가드 + JSDoc 보강
- `codebase/backend/src/modules/auth-configs/auth-configs.service.{ts,spec.ts}` — PATCH 병합에 `omitUndefined` 적용
- `codebase/backend/src/modules/folders/folders.service.spec.ts` — 주석(파일명 인용) 정정만
- `codebase/backend/src/modules/nodes/nodes.service.{ts,spec.ts}` — PATCH 병합에 `omitUndefined` 적용 + 응답에서 `workflow` 관계 제거
- `codebase/backend/src/modules/workflows/workflows.service.{ts,spec.ts}` — PATCH 병합 + `settings` 병합에 `omitUndefined`/`!= null` 가드 적용
- `codebase/backend/test/patch-partial-body.e2e-spec.ts` (신규 e2e)
- `plan/in-progress/patch-omit-undefined.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` (plan 갱신)
- `review/code/2026/09/27/13_50_41/**`, `review/consistency/2026/09/27/13_11_33/**` (선행 리뷰 세션의 기존 산출물 — 이 PR 이 새로 만든 코드 변경이 아님)

전부 **backend 서비스 내부 PATCH 병합 로직 버그 수정**이다. frontend 변경은 0건이다.

## 매칭 판정 (trigger 별)

- **새 노드 추가 / 노드 schema 변경** — trigger glob `codebase/backend/src/nodes/**` (노드 *타입* 구현 디렉터리: `ai/`, `core/`, `data/`, `flow/`, `integration/`, `logic/`, `presentation/`, `trigger/`). 변경된 `codebase/backend/src/modules/nodes/nodes.service.ts` 는 이 glob 밖의 **다른 경로**다 — `modules/nodes/**` 는 캔버스 노드 엔티티의 CRUD 서비스(NestJS module)이지 노드 타입 구현이 아니다. 필드 추가·라벨 변경·신규 노드 타입 없음(PATCH 응답이 이미 존재하던 필드를 잃지 않게 하는 버그 수정, `Omit<Node,'workflow'>` 로 미문서화 내부 관계 누출 제거). **미매칭**.
- **인증·권한·세션 흐름 변경** — trigger glob `codebase/backend/src/modules/auth/**` (로그인·세션·webauthn·totp·oauth). 변경된 `codebase/backend/src/modules/auth-configs/**` 는 **다른 모듈**이다 — webhook 트리거의 수신 인증 설정(api_key/hmac 등)을 다루는 `AuthConfig` 엔티티이며 사용자 로그인·세션과 무관하다(디렉터리 확인: `modules/auth/` vs `modules/auth-configs/` 별도 존재). **미매칭**.
- **AuthConfig type enum 변경** — diff 는 `type` enum(`api_key`/`bearer_token`/`basic_auth`/`hmac`) 자체를 건드리지 않는다. PATCH 병합 시 `omitUndefined(rest)` 적용뿐. **미매칭**.
- **백엔드 API 추가·변경** (trigger: `*.controller.ts` / `dto/**`) — 이번 diff 에 controller/dto 파일이 없다(서비스 계층만). 또한 이 수정은 API 표면(필드 종류)을 바꾸는 게 아니라 **이미 존재하는 필드의 응답값이 틀리던 것**(거짓 null·키 누락)을 바로잡는 버그 수정이라 사용자 안내 문서의 서술 자체는 바뀌지 않는다(문서가 "PATCH 는 보내지 않은 필드를 보존한다" 고 이미 전제하고 있었다면 오히려 문서가 맞고 코드가 틀렸던 셈). **미매칭** — gray-zone 이지만 보수적으로 봐도 사용자 가시 *서술*이 바뀌는 변경이 아니다.
- **신규 warningCode/errorCode** — `error-codes.ts`/`warningRules` 변경 없음. **미매칭**.
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음. **미매칭**.
- **실행·디버깅 흐름 변경** — 실행 엔진·디버그 로깅 변경 없음(PATCH 는 실행과 무관). **미매칭**.
- **신규 UI 문자열 / i18n parity** — frontend TSX 변경 0건. **미매칭**.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/<NN>-<name>/` 신규 없음. **미매칭**.
- **통합/제공자 변경** — provider 변경 없음. **미매칭**.
- **spec 신규/대규모 변경** — `spec/**` 실제 파일 변경 없음. `plan/in-progress/spec-draft-nullable-notation-followups.md` 는 향후 spec 갱신을 planner 에게 제안하는 draft 일 뿐(§5.4 tri-state 문구를 `1-workflow-list.md`/`6-config.md` 에 추가하자는 제안이 이미 그 draft 안에 planner 몫으로 명시돼 있다) — 이 PR 자체가 spec 파일을 수정하지 않았다. **미매칭** (이미 발견해 plan 에 등재됨 — 중복 지적 불필요).

## 발견사항

없음 — 매칭된 trigger 가 없다.

## 요약

매트릭스 20개 행을 전수 대조했으나 이번 변경 set(백엔드 `omitUndefined` PATCH 병합 버그 수정 — workflows/nodes/auth-configs 세 서비스 + 신규 e2e + plan 갱신)은 어떤 trigger 에도 매칭되지 않는다. 핵심 근거는 glob 정밀도다: `nodes.service.ts` 는 "새 노드 추가" trigger 의 `backend/src/nodes/**`(노드 타입 구현) 가 아니라 `backend/src/modules/nodes/**`(캔버스 CRUD 모듈)이고, `auth-configs.service.ts` 는 "인증·권한·세션 흐름 변경" trigger 의 `backend/src/modules/auth/**`(로그인·세션)가 아니라 별도 모듈인 `backend/src/modules/auth-configs/**`(webhook 인증 설정)다. 필드 추가·라벨 변경·신규 노드·신규 provider·i18n 신규 문자열·경고/에러 코드 신설도 없다 — 이미 존재하던 필드가 PATCH 응답에서 틀리게(거짓 null·키 누락) 실리던 버그를 고친 내부 수정이라 유저 가이드 서술이 바뀔 이유가 없다. frontend 변경은 0건이라 i18n parity 이슈도 없다. 매칭 0 / 누락 0.

## 위험도

NONE
