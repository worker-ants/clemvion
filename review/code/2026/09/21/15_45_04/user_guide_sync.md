# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read 했다.

## 변경 파일 (origin/main...HEAD 전수, `git diff --name-only`)

- `CHANGELOG.md`
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts`
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`
- `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts` (신규)
- `plan/in-progress/authconfig-dup-delete.md` (신규)
- `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `review/code/2026/09/21/15_18_16/**`, `review/consistency/2026/09/21/14_41_01/**` (직전 리뷰/컨시스턴시 세션의 산출물 — 코드 아님)

## trigger 매칭 검토

21개 row 를 전수 대조했다. 핵심 변경(`auth-configs.service.ts` — 동시 DELETE 이중 감사 로그 결함을 원자적 `delete()` + `affected===0` 판정으로 수정)에 대해 다음을 확인했다:

- **new-node / node-schema-change** — trigger glob `codebase/backend/src/nodes/**`. 변경 경로는 `codebase/backend/src/modules/auth-configs/**` 로 `src/nodes/` 가 아니다. 미매칭.
- **backend-api-change** — trigger glob `**/*.controller.ts`, `**/dto/**`. 이번 diff 는 `auth-configs.controller.ts`/`dto/**` 를 건드리지 않았다(서비스·spec·e2e 만). 미매칭.
- **auth-session-flow-change** (「인증·권한·세션 흐름 변경」) — trigger glob `codebase/backend/src/modules/auth/**`. 변경 모듈은 `auth-configs`(워크스페이스별 외부 연동 자격증명 저장소 — `api_key`/`bearer_token`/`basic_auth`/`hmac`)이지 `auth`(로그인/JWT/세션/WebAuthn/TOTP) 모듈이 아니다. 두 모듈은 디렉터리·책임이 명확히 분리돼 있고(`ls codebase/backend/src/modules/auth` 로 직접 확인: `auth.service.ts`/`sessions.*`/`webauthn/`/`totp.service.ts` 등, `auth-configs/` 와 별도), 이번 변경은 인증·인가·세션 프로토콜 자체를 조금도 건드리지 않는다 — 삭제 시 감사 로그 중복만 고친다. **의미상으로도 미매칭**.
- **auth-config-type-enum-change** (「AuthConfig type enum 변경」) — `api_key`/`bearer_token`/`basic_auth`/`hmac` 열거값 자체는 이번 diff 에서 추가·변경·삭제되지 않았다. `remove()` 내부 구현(엔티티 `remove` → 조건부 `delete`)만 바뀌었다. 미매칭.
- **new-warning-code / new-error-code** — `warningRules`, `error-codes.ts` 무변경. 미매칭.
- **expression-language-change / run-debug-flow-change / integration-provider-change / new-userguide-section-dir / new-ui-string(TSX) / new-cross-cutting-enum / new-handler-output-field / new-backend-ui-zod-value / new-bullmq-queue / spec-major-change / userguide-gui-flow-section** — 전부 대상 glob·의미 범위(frontend TSX, packages/expression-engine, nodes/, spec/2·3·4·5-*, docs/*.mdx, system-status.constants.ts 등) 밖. 미매칭.

`plan/in-progress/*.md`, `review/**/*.md`, `CHANGELOG.md` 는 매트릭스 어떤 row 의 trigger glob/semantic 범주에도 속하지 않는다(매트릭스는 `codebase/` 소스 변경을 트리거로, `docs/mdx`·`dict`·`backend-labels.ts`·`spec/*` 를 target 으로 정의 — plan/review 산출물은 이 축 밖).

## 결론

이번 changeset 은 `auth-configs` 모듈(외부 연동 인증 설정 저장소)의 동시 삭제 경합 시 감사 로그 중복 버그를, 형제 6건(#1369~#1373)과 같은 패턴(원자적 `DELETE` + `affected===0` 판정)으로 고친 backend-only 수정이다. 노드 추가/스키마 변경, frontend UI 문자열, 통합 provider 신설, 신규 문서 섹션, 인증(`auth/`) 흐름, AuthConfig enum, 표현식 언어, 실행/디버깅 흐름, warning/error 코드 신규 발행 등 — 매트릭스 21개 trigger 어디에도 매칭되지 않는다.

### 발견사항

없음 — 매칭된 trigger 0건.

## 요약

매트릭스 21개 trigger 전수 대조, 매칭 0건, 누락 0건. 변경은 `codebase/backend/src/modules/auth-configs/**`(서비스·spec)와 신규 e2e 스펙, plan/CHANGELOG 문서에 국한되며 `nodes/`·frontend·`auth/`(세션·인증) 모듈·expression-engine·docs mdx·spec 본문 어느 것도 건드리지 않아 유저 가이드 동반 갱신 의무가 발생하지 않는다. 해당 없음.

## 위험도

NONE
