# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 적재했다.

## 변경 파일 요약
리뷰 대상 9개 코드/테스트 파일은 모두 `codebase/backend/src/modules/{secret-store,triggers,workspaces}/**` 및 `codebase/backend/test/**` 에 국한된다. 나머지(파일 10~18)는 `plan/in-progress/**`, `review/consistency/**` 산출물로 코드가 아니다.

- `secret-resolver.service.ts` — JSDoc 주석만 갱신 (호출부 서술 정정)
- `chat-channel-binder.service.ts` — private 메서드 `teardownChannelConfig` → `teardownRegisteredChannel` 이름 변경 + JSDoc/로그 문구 정정
- `trigger-config-lock.ts` — JSDoc 주석만 갱신
- `trigger-resource-releaser.service.ts` / `.spec.ts` — 이름 변경 호출부 갱신 + 테스트 mock/기대값 이름 동기화
- `triggers.service.ts` / `.spec.ts` — 주석 정정 (동작 불변)
- `workspaces.service.spec.ts` — bare 리뷰 인용을 세션 경로 포함 형태로 정정
- `trigger-workflow-ref.e2e-spec.ts` — JSDoc 주석 정정

plan 파일(`plan/in-progress/trigger-release-stale-comments.md`)이 명시하는 대로 "**동작은 바꾸지 않는다 — 주석과 메서드 이름 하나**", `spec_impact: none` 이다. 실측 표(§실측)와 §비대상 표 모두 이 PR 이 `codebase/**` 내부 주석/네이밍 정합화에 한정됨을 확인해 준다.

## trigger 매칭 판정
매트릭스 21개 행을 전수 대조했다.

| trigger | 매칭 여부 | 사유 |
|---|---|---|
| 새 노드 추가 / 노드 schema 변경 (`codebase/backend/src/nodes/**`) | 불일치 | 변경 파일 없음 (`nodes/` 디렉터리 무관) |
| 신규 UI 문자열 (frontend `*.tsx`) | 불일치 | frontend 파일 변경 0건 |
| 신규 위젯 chrome 문자열 (`channel-web-chat`) | 불일치 | 해당 없음 |
| 통합/제공자 변경 | 불일치 | provider 설정·연동 로직 변경 없음 (secret store 내부 cleanup 뿐) |
| 유저 가이드 신규 섹션 디렉토리 | 불일치 | `content/docs/` 변경 없음 |
| 백엔드 API 추가·변경 (`*.controller.ts`, `dto/**`) | 불일치 | controller/DTO 변경 없음 |
| 신규 BullMQ 큐 | 불일치 | `system-status.constants.ts` 변경 없음 (BullMQ job 해제 로직 자체는 기존 로직 그대로, 주석만 정정) |
| 신규 warningCode / errorCode | 불일치 | `warningRules`, `error-codes.ts` 변경 없음 |
| 신규 cross-cutting enum / backend zod ui 값 / handler output field | 불일치 | 해당 없음 |
| 인증·권한·세션 흐름 변경 (`codebase/backend/src/modules/auth/**`) | 불일치 | `modules/auth/**` 변경 없음. `triggers`/`secret-store`/`workspaces` 는 이 trigger 의 glob·semantic 어느 쪽에도 해당하지 않음 — 트리거 **삭제 시 외부 자원 정리**(secret 삭제 타이밍, 메서드 이름) 문제이지 로그인·권한·세션 흐름이 아님 |
| AuthConfig type enum 변경 | 불일치 | 해당 없음 |
| 표현식 언어 변경 (`packages/expression-engine/**`) | 불일치 | 해당 없음 |
| 실행·디버깅 흐름 변경 | 불일치(grey 아님, 명확히 불일치) | 워크플로 실행 엔진/디버그 로깅이 아니라 트리거 **삭제** 시 사후 자원 회수 순서/이름 정리이며 동작 자체도 불변으로 명시됨 |
| 환경 변수·런타임 변경 | 불일치 | 해당 없음 |
| spec 신규/대규모 변경 (`spec/2-*/**` 등) | 불일치 | `spec/**` 변경 0건 (plan 은 `spec_impact: none` 명시, 직전 PR `e63a5bc5d`/`aaee17206` 가 이미 spec 을 현재형으로 갱신 완료했고 본 PR 은 그 뒤를 따르는 코드측 주석 정합화) |
| user-guide GUI 흐름 절 신규/변경 | 불일치 | `content/docs/02-nodes`, `06-integrations-and-config` mdx 변경 없음 |
| spec 자체 결함 발견 | 불일치 | plan 이 `--impl-prep spec/2-navigation/` 을 이미 BLOCK:NO 로 통과시켰고 이 PR 은 순수 comment/rename 이라 신규 spec 결함 제기 대상 아님 |

매칭되는 trigger가 하나도 없다. 이 변경 set 은 (1) private 메서드 이름 변경(외부 계약·API 아님, 클래스 내부 및 같은 모듈의 협력자 `trigger-resource-releaser.service.ts` 호출부만 영향), (2) JSDoc/테스트 주석의 사실 정합화, (3) 리뷰 인용 표기 정정으로만 구성되어 있으며, 노드/스키마/UI 문자열/에러코드/통합/인증흐름/표현식/실행-디버깅/신규 섹션 중 어느 것도 새로 만들거나 바꾸지 않는다. 사용자에게 노출되는 동작·문구·문서 어느 것도 변하지 않는다.

## 발견사항
없음.

## 요약
매트릭스 21개 trigger 행 중 매칭되는 항목이 없다 — 이번 변경 set(9개 backend 코드/테스트 파일)은 트리거 삭제 자원 정리(#1346)가 남긴 stale JSDoc 주석 정정과 private 메서드 `teardownChannelConfig`→`teardownRegisteredChannel` 이름 변경뿐이며, plan 자체가 "동작은 바꾸지 않는다"·`spec_impact: none` 을 명시한다. 노드/스키마/UI 문자열/warning·error 코드/통합·제공자/인증·세션/표현식/실행-디버깅/신규 문서 섹션 어느 trigger 도 매칭되지 않아 유저 가이드·i18n dict·backend-labels 동반 갱신 대상이 아니다.

## 위험도
NONE
