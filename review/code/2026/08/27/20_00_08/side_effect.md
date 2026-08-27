# 부작용(Side Effect) 리뷰

## 검토 방법

프롬프트에 실린 33개 파일 diff 를 점검 관점 8개 기준으로 분석하고, 잘린 파일(`⚠️ 프롬프트 크기 제한`)은
`Read`/`grep` 으로 직접 열어 확인했다. 특히 rename·이동(move)이 있는 자리는 잔존 구-참조를 저장소 전체
grep 으로 재검증했다.

- `grep -rn "shared/testing/swagger-probe" codebase/backend/src | grep -v '\.spec\.ts'` → 0건 (프로덕션
  소비처 없음, `tsconfig.build.json` exclude 가 안전함을 실측 확인)
- `grep -rn "redactNodeExecutionRow\b" codebase/backend/src` → 0건 (구 이름 완전 소멸)
- `grep -rln "shared/utils/node-output-allowlist" codebase/backend/src spec` → 0건 (구 경로 완전 소멸)
- `grep -rln "allowlistNodeOutputKeys" codebase/backend/src` → 4건, 전부 신규 경로(`nodes/core/…`) 정의·자기
  spec·두 소비처(`websocket.service.ts`, `interaction.service.ts`)로 일관
- `websocket.service.spec.ts` 의 `beforeEach`(11번째 줄 `describe('WebsocketService')` 바로 아래, 51번째
  줄)는 최상위 스코프에 있어 `describe` 재배치(604→799번째 줄 인근)로 인한 테스트 lifecycle(mock 초기화
  등) 영향이 없음을 확인 — 형제 `describe` 간 이동일 뿐 부모 스코프를 벗어나지 않는다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** 순수 이동/리네임이지만 두 소비처 동시 갱신이 필요했던 자리 — 확인 결과 정합
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:46`,
    `codebase/backend/src/modules/websocket/websocket.service.ts:9`
  - 상세: `allowlistNodeOutputKeys` import 경로가 `../../shared/utils/node-output-allowlist` →
    `../../nodes/core/node-output-allowlist`(interaction.service.ts) /
    `../../nodes/core/node-output-allowlist`(websocket.service.ts) 로 바뀌었다. 함수 내용(`NODE_OUTPUT_ALLOWED_KEYS`
    상수·`allowlistNodeOutputKeys` 로직)은 파일 10/11(신설) vs 14/15(삭제) diff 대조상 바이트 단위로
    동일 — 이동만 있고 동작 변경은 없다. 두 소비처 다 갱신됐고 구 경로 잔존 0건(실측)이라 side-effect
    관점에서 실제 위험은 없다. 다만 이 이동이 계층 경계(`shared/utils/` → `nodes/core/`)를 넘는 것이라
    이후 이 함수를 참조하는 제3의 소비처가 생기면(예: 다른 `shared/` 유틸) 다시 상향 참조가 생길 수
    있음을 참고로 남긴다(신규 아님, 이미 파일 자체 주석이 이 트레이드오프를 명시).
  - 제안: 조치 불요.

- **[INFO]** `tsconfig.build.json` exclude 확장 — 파일시스템(빌드 산출물) 부작용이지만 의도된 방어
  - 위치: `codebase/backend/tsconfig.build.json:16-20`
  - 상세: `src/shared/testing/**` 를 프로덕션 빌드 대상에서 제외한다. `swagger-probe.ts` 가
    devDependency `@nestjs/testing`/`@nestjs/swagger`(`DocumentBuilder`, `SwaggerModule`)를 import 하므로,
    exclude 가 없으면 `dist/shared/testing/swagger-probe.js` 가 프로덕션 설치에서 `require` 실패를 내는
    지뢰가 된다. `grep` 으로 이 디렉토리를 프로덕션 코드가 참조하지 않음(0건)을 실측했고, 같은 디렉토리
    안 `.spec.ts` 파일은 이미 `**/*spec.ts` 로 별도 제외되므로 이번 항목의 실질 대상은 `swagger-probe.ts`
    한 파일뿐이다. `dist` 산출물이 "줄어드는" 방향의 변경이라 기존 소비처를 깨뜨릴 여지가 없다.
  - 제안: 조치 불요.

- **[INFO]** 함수 rename 은 시그니처 변경이지만 exported 범위가 저장소 내부로 닫혀 있음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(`export function
    redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`), 호출부
    `codebase/backend/src/modules/executions/executions.service.ts:704`(`return redactNodeExecutionRow(ne)`
    → `redactNodeExecutionRowForResponse(ne)`), docstring 표 `:1044`
  - 상세: 함수·인자·반환 타입(제네릭 `T`, copy-on-change 계약)은 전부 불변 — 이름만 바뀌었다. npm
    패키지로 배포되는 공개 API 가 아니라 monorepo 내부 backend 모듈이므로 "기존 사용자에 미치는 영향"은
    없다. 호출부는 `executions.service.ts` 유일(실측)이고 정상 갱신됨.
  - 제안: 조치 불요.

- **[INFO]** `websocket.service.spec.ts` 테스트 재배치는 프로덕션 이벤트/콜백 배선을 건드리지 않음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts` (750-799번째 줄 인근에서
    추가, 1261-1266번째 줄 인근에서 동일 내용 삭제)
  - 상세: 두 테스트(`llmCalls 없는 이벤트는 그대로 fanout`, `emitNodeEvent fanout 도 llmCalls 를 strip`)가
    같은 최상위 `describe('WebsocketService')` 안에서 형제 `describe` 로 옮겨졌을 뿐이며, 프로덕션
    `websocket.service.ts` 자체의 이벤트 발행·구독·콜백 순서는 이 파일에서 바뀌지 않았다(해당 파일 diff는
    import 경로 한 줄뿐). 직전 라운드(`19_36_17`)에서 지적된 JSDoc 오귀속(WARNING 2건)은 이번 diff 에
    이미 정정 반영돼 있다(`RESOLUTION.md` 참조, 791-798번째 줄에 올바른 위치로 재배치 확인).
  - 제안: 조치 불요.

## 확인한 항목 (부작용 없음으로 판정)

- `interaction.guard.ts:27` — JSDoc 한 줄(`EIA-AU-09` 오기 제거)만 변경, `canActivate`/`deny`/토큰 검증
  로직은 무변경.
- `allowlistNodeOutputKeys` — 원본 미변이(copy-on-change), `null`/원시값/배열은 그대로 통과, `__proto__`
  오염 방어 — 신설 `.spec.ts`(`nodes/core/node-output-allowlist.spec.ts`)가 캐너리로 고정.
- Swagger 프로브 헬퍼(`swagger-probe.ts`) — `Test.createTestingModule(...).compile()` → `app.init()` →
  `SwaggerModule.createDocument(...)` → `finally { app.close() }` 패턴은 4개 소비 스펙이 각자 갖고 있던
  기존 로직을 추출한 것으로, 새 네트워크 호출·새 리소스 누수 경로가 생기지 않는다. 앱 close 가
  `finally` 로 보장되는 것도 기존과 동일.
- `re-run.dto.spec.ts` / `execution-status-response.dto.spec.ts` / `interact-ack-response.dto.spec.ts` /
  `workflows-execute-body.spec.ts` — 헬퍼 호출로 대체된 것 외 단언(assertion) 내용 자체는 무변경(diff 상
  `expect(...)` 라인 재확인).
- `spec/5-system/14-external-interaction-api.md`(`code:` frontmatter), `spec/conventions/egress-masking.md`,
  `spec/conventions/node-output.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 전부
  코드 이동/rename 을 뒤따르는 문서 미러 갱신이며 그 자체로 새 부작용을 도입하지 않는다.
- `review/code/2026/08/27/19_36_17/**` 신규 파일 다수 — 이전 라운드 리뷰 산출물(및 그 `RESOLUTION.md`)이
  저장소에 커밋된 것으로, 애플리케이션 코드에 영향 없는 문서/기록성 파일이다.
- 전역 변수 도입·환경 변수 읽기/쓰기·네트워크 호출·이벤트 발행 순서 변경 — 33개 파일 전체에서 해당 패턴
  0건.

## 요약

이번 diff 는 함수 rename(`redactNodeExecutionRow`→`redactNodeExecutionRowForResponse`) 1건과 모듈 재배치
(`node-output-allowlist.ts`: `shared/utils/`→`nodes/core/`) 1건을 포함한 순수 위생(hygiene) 리팩터로,
둘 다 시그니처/경로 변경이지만 내부 monorepo 범위로 닫혀 있어 외부 사용자 영향이 없고 grep 실측으로
구 이름·구 경로 잔존 참조가 0건임을 확인했다. `tsconfig.build.json` exclude 확장은 devDependency 의
`dist` 유출을 막는 방어적 파일시스템 변경이며 프로덕션 소비처가 없어 안전하다. `websocket.service.spec.ts`
의 테스트 재배치는 최상위 lifecycle 훅 스코프를 벗어나지 않아 부작용이 없고, 직전 리뷰 라운드가 지적한
JSDoc 오귀속(WARNING 2건)도 이번 diff 에 이미 반영돼 있다. 새로운 전역 상태 변경, 환경 변수 접근, 네트워크
호출, 이벤트/콜백 배선 변경은 발견되지 않았다.

## 위험도

NONE
