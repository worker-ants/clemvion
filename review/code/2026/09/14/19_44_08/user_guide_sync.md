# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 22행)을 SSOT 로 Read, `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표(163행대)를 보조로 Read 완료.

## 리뷰 대상 커밋 확인

`review 대상 파일` 절에 나열된 11개 파일은 orchestrator 가 조립한 diff 조각이며, 실제로는 HEAD 커밋(`c7a9c107e "fix(triggers): 1라운드 수정이 만든 새 lost update + 웹훅 hot path 의 같은 fail-open"`) 단일 커밋의 변경분과 일치함을 `git show --stat -1 HEAD` 로 확인했다. 변경 파일 전체:

- `CHANGELOG.md`
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (신규)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`
- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` / `.spec.ts` (spec 신규)
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts`
- `plan/in-progress/trigger-config-lost-update.md`
- `review/code/2026/09/14/19_07_43/**` (직전 리뷰 라운드 산출물)

## trigger 매칭 분석

각 매트릭스 행에 대해 실제 diff 내용(전문 확인, `git show HEAD -- <path>`)까지 열어 판단했다:

| 매트릭스 행 | 매칭 여부 | 근거 |
| --- | --- | --- |
| 새 노드 추가 / 노드 schema 변경 (`codebase/backend/src/nodes/**`) | 불일치 | 변경 경로는 `src/modules/hooks/`, `src/modules/triggers/` — `src/nodes/` 하위 아님 |
| 신규 UI 문자열 (`frontend/src/**/*.tsx`) | 불일치 | frontend 파일 변경 없음 |
| 신규 위젯 chrome 문자열 (`channel-web-chat/src/**/*.tsx`) | 불일치 | 해당 없음 |
| 통합 신규/제공자 변경 (semantic) | 불일치 | `chat-channel-binder.service.ts`·`chat-channel-input-rules.ts` 변경은 신규 필드/신규 provider 도입이 아니라, 기존 `inboundSigningRef` 추출 로직을 `extractInboundSigningRef()` 헬퍼로 중복 제거한 리팩터(behavior 동일). 사용자 대면 설정 절차·필드 변경 없음 |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | `content/docs/` 변경 없음 |
| 백엔드 API 추가·변경 (`*.controller.ts`, `dto/**`) | 불일치 | `triggers.controller.ts`·DTO 파일 변경 없음. 응답 shape 도 동일(`relations: ['workflow']` 추가는 기존에 `findById` 가 이미 로드하던 관계를 재읽기 쿼리에도 맞춘 것 — 새 필드 노출 아님) |
| 신규 warningCode / errorCode 발행 | 불일치 | `warningRules`·`error-codes.ts` 변경 없음 |
| 인증·권한·세션 흐름 변경 (`codebase/backend/src/modules/auth/**`) | 불일치 | `auth/` 모듈 미변경. 이 커밋은 `triggers`/`hooks` 모듈의 advisory-lock 동시성 수정이며, 웹훅 **서명 검증**(`ChatChannelInboundAuthenticator`)이 fail-open 되던 통로를 닫는 수정이지만, 대상 모듈 자체는 `auth/**` 밖 |
| 표현식 언어 변경 (`packages/expression-engine/**`) | 불일치 | 해당 없음 |
| 실행·디버깅 흐름 변경 (semantic) | 불일치 | 실행 엔진(`execution-engine.service.ts`) 이나 디버그 로깅이 아니라 트리거 PATCH/웹훅 hot path 의 DB 쓰기 방식(`save`→`update`, lock 안 재읽기) 변경 — run/debug 사용자 흐름과 무관 |
| user-guide GUI 흐름 절 신규/변경 (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) | 불일치 | 해당 mdx 미변경 |
| spec 신규/대규모 변경 | 불일치 | `spec/**` 미변경. (커밋 본문이 "`spec` `code:` glob 미포함" 을 W6 후속 항목으로 planner 에 등재한다고 명시 — 이번 커밋 자체는 spec 파일을 건드리지 않음, 별도 planner 턴 대상) |

## 판정

이 커밋은 순수하게 **동시성 버그 수정**이다 — 같은 트리거에 대한 동시 PATCH/웹훅 요청이 서로의 `config`·상태 컬럼을 되돌려(lost update) 인입 서명 검증이 fail-open 되던 경로를, advisory lock + 재읽기 + 컬럼 한정 `update()` 로 닫는다. 변경 내용은:

1. 내부 헬퍼 추출(`acquireTriggerConfigLock`, `extractInboundSigningRef`) — 순수 리팩터, 동작 동일
2. `hooks.service.ts` 의 `save(trigger)` → `update({id},{lastTriggeredAt})` 컬럼 한정화 — API 응답 shape·필드 변경 없음
3. `triggers.service.ts` 의 저장 대상을 `trigger` → `fresh ?? trigger` 로 교체 — 응답 DTO 필드 구성 변화 없음(오히려 기존에 의도됐던 `workflow` relation 누락을 막는 방향)
4. 신규 테스트 파일(`trigger-config-lock.spec.ts`, `trigger-transaction-mock.ts`) — 테스트 인프라

사용자에게 노출되는 노드 목록·필드·placeholder·에러/경고 문구·통합 제공자 설정 안내·표현식 언어 문법·실행/디버그 UI·인증 플로우 UI 중 어느 것도 바뀌지 않았으므로, 매트릭스의 22개 trigger 중 어느 것에도 매칭되지 않는다. 동반 갱신 누락 항목 없음.

## 요약

매트릭스 trigger 22개 전건 검토 — 매칭 0건(순수 backend 동시성 버그 수정 + 리팩터 + 테스트, 노드/스키마/UI 문자열/제공자/문서 섹션/인증 플로우/표현식 언어/실행-디버깅 흐름/warning·error 코드 어느 축도 건드리지 않음), 따라서 동반 갱신 누락도 0건이다. 유저 가이드 동반 갱신 관점에서 이 변경은 완전히 "해당 없음".

## 위험도

NONE
