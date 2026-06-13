---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# expression-language — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/5-expression-language.md

## 미구현 항목
- [ ] `$trigger` 런타임 주입 — `ExpressionResolverService.buildExpressionContext` 가 `$trigger` 를 컨텍스트에 주입하지 않음. 엔진 타입(`ExpressionContext.$trigger`)·에디터 자동완성(`ROOT_VARIABLES`)에는 노출되어, 사용자가 입력하면 실행 시 undefined/참조 에러로 이어질 수 있음. **⚠ 결정 필요**: trigger 데이터를 담을 `ExecutionContext` 신규 필드 + webhook/trigger payload→`$trigger` shape (`$trigger.body.event` 등) 설계. decision-free 아님 → planner.
- [ ] `$env` 런타임 주입 — 동일하게 `buildExpressionContext` 가 `$env`(셀프 호스팅 환경 변수)를 주입하지 않음. 엔진 타입·에디터 자동완성에만 존재. **⚠ 결정 필요**: spec §의 "allowlist 기반 노출, self-hosting only" 보안 allowlist 설계. decision-free 아님 → planner.
- [x] `$thread` 에디터 자동완성 노출 — `expression-constants.ts` `ROOT_VARIABLES` 에 `$thread` 추가 (2026-06-03 groom). spec §4.4 marker flip 완료.

## 처리 결과 (2026-06-03 groom)
- `$thread` autocomplete 노출만 decision-free 로 처리 완료. `$trigger`/`$env` 런타임 주입은 숨은 설계 결정(데이터 소스·보안 allowlist) 포함 → C 버킷으로 재분류, in-progress 유지.

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__5-expression-language.md 참조.
- 재검증 근거:
  - `codebase/backend/.../expression/expression-resolver.service.ts` `buildExpressionContext` 반환 객체에 `$trigger`/`$env` 키 없음.
  - `codebase/packages/expression-engine/src/evaluator.ts` `ExpressionContext` 에는 `$trigger?`/`$env?` 선언 존재 (평가는 지원).
  - `codebase/frontend/src/components/editor/expression/expression-constants.ts` `ROOT_VARIABLES` 에 `$trigger`/`$env` 는 있으나 `$thread` 는 없음.

## 파생 처리 (2026-06-03 spec-inprogress-impl2)
- foreach-gaps 결정(a)에서 파생: `$itemIsFirst`/`$itemIsLast` top-level 변수도 함께 노출(ROOT_VARIABLES + resolver + expression-language §4 표). $thread 자동완성과 별개의 ForEach 항목 플래그. $trigger/$env 런타임 주입은 여전히 티어3 보류.

## 결정 옵션 (2026-06-13)

> 본 섹션은 위 두 티어3 보류 항목(`$trigger`/`$env` 런타임 주입)의 미해결 설계 결정을 펼쳐 둔 것이다. 각 결정의 권장안 채택은 spec write(`project-planner`) + `consistency-check --spec` 통과를 전제로 한다. 체크박스 상태는 변경하지 않는다 — 결정 확정·구현 시 위 `## 미구현 항목`에서 flip 한다.

### 결정 1: `$trigger` 런타임 주입 — 트리거 payload 데이터 소스와 shape

**맥락**
- spec/5-system/5-expression-language.md §4.1 표(line 183)는 `$trigger` 를 `Object | 트리거 데이터 (webhook payload 등)` 로 노출하면서 `{{ $trigger.body.event }}` 예시를 명시하나, 동일 행에 **"미구현 (Planned). 엔진 타입·에디터 자동완성에는 노출되나 실행 엔진의 컨텍스트 빌더가 아직 주입하지 않음"** 으로 표기한다.
- 엔진 평가기는 이미 지원한다: `codebase/packages/expression-engine/src/evaluator.ts:38` `ExpressionContext.$trigger?: Record<string, unknown>` 선언. `evaluateIdentifier`(evaluator.ts:165)는 `$`-prefix 식별자가 context 에 없으면 `EXPR_REFERENCE_ERROR`(`Undefined variable: $trigger`) 를 throw 한다.
- 그러나 백엔드 컨텍스트 빌더가 주입하지 않는다: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:79-108` `buildExpressionContext` 반환 객체에 `$trigger` 키가 **없다**. 또한 `ExecutionContext`(`codebase/backend/src/nodes/core/node-handler.interface.ts:4-171`)에 트리거 payload 를 담는 필드 자체가 없다 — `$execution.mode` 에 `webhook` 라벨만 있을 뿐(expression-resolver.service.ts:88) 실제 payload 는 어디에도 보관되지 않는다.
- 순결과: 사용자가 자동완성을 보고 `{{ $trigger.body.event }}` 를 입력하면 → 실행 시점에 resolver 가 던지는 `EXPR_REFERENCE_ERROR` → 노드 실행 실패(spec §6.2). 즉 "광고됐으나 실행 시 깨지는" UX 함정.

**옵션 A — ExecutionContext 에 트리거 필드 추가 + flat shape 노출**
- 설명: `ExecutionContext` 에 `triggerData?: { body; headers; query; event?; ... }` 신규 필드를 추가하고, `ExecutionContextService.createContext`(execution-context.service.ts)가 실행 진입점(webhook/schedule trigger)에서 받은 payload 를 채운다. `buildExpressionContext` 가 이를 `$trigger = { body, headers, query, event }` flat shape 으로 노출. spec §4.1 의 `$trigger.body.event` 예시와 직결.
- 장점: spec 의 명시 예시(`$trigger.body.event`)와 1:1 정합. 엔진 타입이 이미 `Record<string, unknown>` 이라 평가기 변경 0. webhook 트리거의 표준 HTTP 구성요소(body/headers/query)를 그대로 노출해 직관적.
- 단점: `ExecutionContext` 에 새 필드 + 모든 trigger 진입점(webhook/schedule/manual)에 threading 필요 — manual 실행은 `$trigger` 가 비는데 그 때 `undefined` vs `{}` 정책을 별도 결정해야 한다. headers 를 그대로 노출하면 `Authorization`/`Cookie` 등 민감 헤더가 표현식에 흘러들 수 있어 redaction 정책이 동반돼야 함.

**옵션 B — 최소 curated subset 만 노출**
- 설명: 전체 HTTP payload 대신 트리거 종류별로 의미 있는 최소 필드만 화이트리스트로 추린 shape (예: webhook `{ body, event }`, schedule `{ scheduledAt }`) 만 `$trigger` 로 노출. headers/query 등은 제외.
- 장점: 민감 헤더 유출 위험을 설계 단계에서 차단. 트리거 종류 추가 시 노출 surface 가 통제됨.
- 단점: spec §4.1 표가 이미 `$trigger.body.event` 외에 "webhook payload 등" 으로 광범위하게 약속 — subset 으로 좁히면 spec 본문도 함께 수정해야 하고, 사용자가 흔히 원하는 query string / 특정 헤더(예: `X-Signature`) 접근이 막혀 재차 확장 요구가 나올 공산. curated 목록 유지보수 비용.

**옵션 C — 구현 전까지 자동완성에서 숨김 (downscope)**
- 설명: 런타임 주입을 보류한 채, `expression-constants.ts` `ROOT_VARIABLES` 에서 `$trigger` 를 제거하고 spec §4.1 행도 제거(또는 명시적 "v2 예정" 으로 강등). 광고-구현 괴리를 자동완성 쪽을 내려서 해소.
- 장점: 가장 저비용·즉시. "광고됐으나 깨지는" UX 함정을 확실히 제거. 트리거 데이터 모델·보안 결정을 실제 수요가 생길 때로 미룰 수 있음.
- 단점: 기능 후퇴(사용자 가치 미제공). 향후 재도입 시 자동완성·spec·타입을 다시 flip 해야 함. `$thread`(2026-06-03 groom)처럼 "노출 먼저" 기조와 역행.

**권장안 — 옵션 A (단, headers redaction + manual 시 `{}` 정책 동반)**
- 근거: 엔진 타입·자동완성·spec 예시가 모두 이미 flat `$trigger.body/headers/query` 를 향하고 있어 정합 비용이 가장 낮고, 사용자가 webhook 트리거에서 실제로 원하는 것이 raw payload 접근이다. 다만 보안상 (a) `Authorization`/`Cookie`/`X-Api-Key` 등 민감 헤더는 주입 단계에서 redact 하고, (b) manual/schedule 실행처럼 webhook payload 가 없는 경로에서는 `$trigger` 를 `{}` 로 주입해 `EXPR_REFERENCE_ERROR` 대신 `$trigger.body` → `null`(optional chaining 친화) 로 graceful 하게 떨어지도록 한다. subset(옵션 B)은 향후 수요가 좁다고 확인될 때 축소하는 편이 확장보다 안전하다.

**트레이드오프**
- 비용: `ExecutionContext` 신규 필드 + trigger 진입점 threading(webhook/schedule/manual) + `buildExpressionContext` 주입 + headers redaction 헬퍼 + manual `{}` 폴백. 엔진 평가기(evaluator.ts)는 무변경 — 리스크는 전적으로 **주입 레이어**에 있다.
- 다운스트림: spec write 는 `project-planner` 가 §4.1 표의 "미구현 (Planned)" 마커를 flip 하고 redaction/빈-payload 동작을 §본문에 명시 → `consistency-check --spec` 통과 필요. resolver unit test + webhook trigger e2e 가 동반돼야 한다(빈 manual 실행에서 `$trigger.body` 가 throw 하지 않는지 회귀 포함).
- 함정: 지금 자동완성이 이미 `$trigger` 를 광고하므로 미구현 상태 방치 자체가 UX 함정 — 옵션 C 로 내리거나 A 로 구현하거나 둘 중 하나로 수렴해야 하며, "그대로 보류" 는 최악(광고-실패 지속).

### 결정 2: `$env` 런타임 주입 — self-hosting 환경 변수 보안 allowlist

**맥락**
- spec/5-system/5-expression-language.md §4.1 표(line 177)는 `$env` 를 `Object | 환경 변수 (셀프 호스팅)` 로 노출하고 `{{ $env.API_URL }}` 예시를 명시하나, 동일 행에 **"미구현 (Planned). 엔진 타입·에디터 자동완성에는 노출되나 실행 엔진의 컨텍스트 빌더가 아직 주입하지 않음"**. §8.5 보안 표(line 499)는 **"`$env` 는 셀프 호스팅에서만 허용 목록 기반 노출"** 을 명시적으로 약속한다.
- 엔진 평가기는 지원: `evaluator.ts:27` `$env?: Record<string, string>`. 미주입 시 `$trigger` 와 동일하게 `EXPR_REFERENCE_ERROR`.
- 백엔드 미주입: `buildExpressionContext`(expression-resolver.service.ts:79-108) 반환 객체에 `$env` 키 없음. 즉 사용자가 `{{ $env.API_URL }}` 입력 → 실행 시 참조 에러.
- 보안 민감도가 결정 1보다 높다: `process.env` 에는 `DATABASE_URL`·JWT secret·API key 등 비밀이 다수 — 무분별 노출 시 표현식이 곧 secret 유출 채널이 된다. spec §8.5 가 "allowlist 기반 + self-hosting only" 를 이미 invariant 로 못박은 이유.

**옵션 A — 명시적 allowlist env var (예: `EXPRESSION_ENV_ALLOWLIST`) + self-hosting only 게이팅**
- 설명: 새 환경 변수 `EXPRESSION_ENV_ALLOWLIST="API_URL,REGION,..."` (콤마 구분 키 목록)을 두고, self-hosting 모드(예: `DEPLOY_MODE=self_hosted` 또는 멀티테넌트 SaaS 가 아님)일 때만 `buildExpressionContext` 가 그 목록의 키에 한해 `$env = { API_URL: process.env.API_URL, ... }` 을 채운다. 목록에 없는 키는 절대 노출 안 함. SaaS 모드면 `$env = {}` (또는 자동완성에서도 숨김).
- 장점: 노출 surface 가 운영자가 명시 선언한 키로 정확히 한정 — secret 유출 표면이 0(opt-in). spec §8.5 의 "allowlist 기반, self-hosting only" 와 1:1. 운영자가 배포별로 통제 가능.
- 단점: 운영자가 allowlist 를 설정해야 동작 → 설정 누락 시 `$env` 가 조용히 빈 채로 동작(혼란 가능, 문서·경고 로그 필요). env var 한 줄에 키를 나열하는 UX 가 다수 키일 때 번거로움.

**옵션 B — prefix-convention allowlist (예: `WORKFLOW_PUBLIC_*`)**
- 설명: 키 목록을 일일이 나열하는 대신, 특정 prefix(예: `WORKFLOW_PUBLIC_`)를 가진 env var 만 자동으로 `$env` 에 노출(접두사 제거 여부는 별도 결정). secret 은 prefix 를 안 붙이면 자동 차단.
- 장점: 키가 늘어도 env var 한 줄 수정 불필요 — 새 변수에 prefix 만 붙이면 노출. 명명 규칙만 지키면 운영이 단순.
- 단점: prefix 명명 실수(`WORKFLOW_PUBLIC_DB_PASSWORD` 같은 오용)가 곧 유출 — allowlist 의 "명시적 opt-in" 안전성이 convention 준수에 의존해 약해진다. 기존 배포가 우연히 같은 prefix 를 쓰면 의도치 않은 노출. spec §8.5 의 "허용 목록(allowlist)" 문구와 다소 결이 다름(목록 vs 규칙).

**옵션 C — `$env` 를 언어에서 제거 (drop)**
- 설명: `$env` 를 엔진 타입·`ROOT_VARIABLES`·spec §4.1/§8.5 에서 모두 제거. 환경 의존 값은 Variable Declaration 노드나 Code 노드(자체 `$input`/`$vars` 런타임)로 우회.
- 장점: secret 유출 표면을 설계에서 영구 제거 — 가장 안전. 결정 1 과 달리 대체 경로(Variable/Code 노드)가 이미 존재.
- 단점: spec §4.1·§8.5 가 이미 `$env` 와 self-hosting allowlist 를 약속·문서화 — 제거 시 두 곳을 함께 걷어내야 하고, self-hosting 사용자의 정당한 수요(배포별 API_URL 주입 등)를 표현식에서 못 쓰게 됨. Rationale 연속성 측면에서 "한 번 약속한 allowlist 노출" 의 번복이라 `rationale-continuity-checker` 가 걸 수 있음.

**권장안 — 옵션 A (명시적 `EXPRESSION_ENV_ALLOWLIST` + self-hosting only)**
- 근거: 보안이 이 결정의 1순위다 — `$env` 는 **절대 secret 을 흘리면 안 된다**. 명시적 allowlist 는 opt-in 이라 기본값이 "아무것도 노출 안 함" 이고, 운영자가 선언한 키만 정확히 노출돼 유출 표면이 최소다. prefix convention(B)은 명명 실수가 곧 유출이라 "명시적 허용 목록" 이라는 spec §8.5 invariant 의 안전성을 희석한다. self-hosting only 게이팅(SaaS 모드에서 `$env = {}`)을 명시적 모드 플래그로 강제해, 멀티테넌트 환경에서 한 워크스페이스의 표현식이 호스트 env 를 들여다보는 일을 원천 차단한다.
- 보안 강조: allowlist 미설정 = 빈 `$env` (fail-closed). redaction 이 아니라 enumeration(허용된 키만 복사)이라 추가 secret 이 env 에 생겨도 자동 노출되지 않는다.

**트레이드오프**
- 비용: `EXPRESSION_ENV_ALLOWLIST` 파싱 + self-hosting 모드 판정 + `buildExpressionContext` 의 `$env` 채우기. 엔진 평가기(evaluator.ts:27 `$env?`)는 이미 eval 을 지원하므로 무변경 — 리스크는 **주입 레이어의 보안 게이팅**에 집중.
- 다운스트림: spec write 는 `project-planner` 가 §4.1 의 "미구현 (Planned)" 마커 flip + §8.5 보안 표에 allowlist env var 이름·self-hosting 판정 규칙·fail-closed 동작을 명문화 → `consistency-check --spec` 및 `rationale-continuity-checker`(§8.5 약속과의 연속성) 통과. SaaS 모드에서 `$env` 가 비는지 + secret 키가 allowlist 에 없으면 노출 안 되는지에 대한 보안 회귀 테스트 필수.
- 함정: 자동완성이 이미 `$env` 를 광고 중이라 미구현 방치는 UX 함정인 동시에 **사용자가 secret 노출을 기대하지 않더라도 "왜 안 되지" 혼란**을 부른다. A 로 구현하든 C 로 제거하든 수렴 필요. 단, 노출을 구현할 경우 보안 게이팅을 빠뜨린 부분 구현이 가장 위험(유출) — A 의 fail-closed 기본값이 그 위험을 막는다.
