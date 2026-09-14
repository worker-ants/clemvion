# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 범위

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) 을 SSOT 로 Read 하고
`PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 + "자주 누락되는 항목" 산문) 을 보조로 Read 했다.
변경 set 은 `meta.json`(`review/code/2026/09/14/18_17_44/meta.json`) 기준 다음과 같다:

- `codebase/backend/src/modules/hooks/hooks.service.ts` / `hooks.service.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규) / `.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts` / `.web-chat.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` / `.spec.ts` / fixture
- `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
- `CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`, `review/**` (산출물)

**frontend 파일(`codebase/frontend/**`), docs(`content/docs/**`), dict(`lib/i18n/dict/**`),
`backend-labels.ts`, `error-codes.ts`, `warningRules`, `expression-engine`, `modules/auth/**`,
`content/docs/<NN>-*/` 신규 디렉토리 — 변경 set 에 0건.**

## Trigger 매칭 분석

매트릭스 21개 행 중 glob/semantic 으로 이번 변경 파일에 매칭되는 것이 있는지 전수 확인했다.

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일은 전부
  `modules/triggers`, `modules/hooks`, `repo-guards` 아래이며 `src/nodes/` 트리 밖이다.
- **신규 UI 문자열 (TSX)** — 매칭 없음. `*.tsx` 변경 0건 (전부 backend `.ts`/`.md`/`.json`).
- **통합/제공자 변경** — provider 어댑터(`*-adapter.ts`) 자체는 변경되지 않았다. `chat-channel-binder.service.ts`
  는 provider 무관 공용 바인더이고, 이번 diff 는 `save()` → `rewriteTriggerConfigLocked()` 로
  쓰기 경로만 바꿨을 뿐 provider 별 설정 흐름·필드는 그대로다. provider 신규/변경 아님.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 신규 디렉토리 없음. 매칭 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`, semantic) — glob 미매칭
  (`modules/auth/**` 아래 파일 0건). 의미적으로도 재검토했다: 이 PR 이 다루는 `inboundSigningRef`
  는 **인입 웹훅(트리거) 요청의 HMAC 서명 검증**에 쓰이는 값이지, 사용자 로그인·워크스페이스
  권한·세션(`07-workspace-and-team/` 이 다루는 영역)과는 다른 계층이다. `02-nodes/triggers.mdx:130`
  이 이미 "서버가 서명을 검증한다" 고 문서화하고 있고, 이번 PR 은 **그 문서화된 보장이 동시성
  경합으로 깨지던 버그를 고쳐 문서와 실제 동작을 일치**시키는 것이다 — 문서가 약속한 동작 자체가
  바뀐 것이 아니라 그 약속을 지키지 못하던 내부 결함을 닫은 것이므로 이 trigger 로 보지 않는다.
- **AuthConfig type enum 변경** — `AuthConfig` 엔티티·enum 변경 없음. 매칭 없음.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음.
- **실행·디버깅 흐름 변경** — execution engine·디버그 로깅 변경 없음 (트리거 웹훅 인입 레이어만
  변경). 매칭 없음.
- **신규 warningCode/errorCode 발행** — `warningRules`·`error-codes.ts` 변경 없음. `api_contract.md`
  리뷰(같은 세션, `review/code/2026/09/14/18_17_44/api_contract.md`)도 "새 에러 코드·상태 코드
  없음" 을 확인했다. 매칭 없음.
- **신규 backend zod ui.label/hint/group/itemLabel** — zod schema 변경 없음. 매칭 없음.
- **신규 handler output field** — `output.result.*` 변경 없음. 매칭 없음.
- **신규 BullMQ 큐** — `system-status.constants.ts` 변경 없음. 매칭 없음.
- **백엔드 API 추가·변경** (semantic, controller/DTO) — 컨트롤러·DTO 는 건드리지 않았다(같은 세션
  `api_contract.md` 가 확인). 매칭 없음.
- **spec 신규/대규모 변경** — `spec/**` 변경 0건. 매칭 없음.

이번 변경은 서비스/영속성 계층의 **동시성 버그 수정**(lost-update 방지)이며, 사용자에게 노출되는
신규 필드·신규 에러 코드·신규 UI·신규 문서 섹션·API 계약 변경이 전혀 없다. 매트릭스의 어떤
trigger 에도 확정 매칭되지 않는다.

## 발견사항

없음 (해당 없음).

## 요약

매트릭스 21개 trigger 전수를 이번 변경 파일 목록(backend `modules/triggers`·`modules/hooks`·
`repo-guards` + 테스트/e2e/plan/CHANGELOG/review 산출물)에 대조했으나 매칭되는 trigger 가 없다
(0/21). frontend·docs·dict·backend-labels·nodes·expression-engine·auth 모듈 변경이 전무하고,
`inboundSigningRef` lost-update 수정은 `02-nodes/triggers.mdx` 가 이미 문서화한 "웹훅 서명은
항상 검증된다" 는 보장을 실제로 지키게 만드는 내부 동시성 버그 수정이라 문서 갱신 대상이 아니다.
유저 가이드 동반 갱신 관점에서 조치할 사항 없음.

## 위험도

NONE
