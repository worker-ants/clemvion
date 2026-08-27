# 테스트(Testing) 리뷰 — eia-misc-hygiene (2026-08-27 19:36:17)

## 개요

이 변경은 "다음에 이 파일을 열 때 처리" 로 미뤄뒀던 5건의 위생 항목을 묶은 리팩터 커밋(`044a2e19e`)이다:
① `interaction.guard.ts` JSDoc 오기 정정, ② `redactNodeExecutionRow` → `…ForResponse` 리네임(자매
3개와 통일), ③ `websocket.service.spec.ts` 의 allowlist 캐너리를 이름이 맞는 `describe` 블록으로 분리,
④ `node-output-allowlist.ts` 를 `shared/utils/` → `nodes/core/` 로 재배치, ⑤ 4개 Swagger DTO 스펙이
반복하던 `SwaggerModule.createDocument` 보일러플레이트를 `shared/testing/swagger-probe.ts` 공유
헬퍼로 추출. 새 프로덕션 로직은 없고 전부 리네임·이동·추출·주석 정정이다.

직접 저장소를 열어 다음을 실측했다 (프롬프트에 전체 컨텍스트가 잘린 파일 포함):
- `grep -rn "shared/utils/node-output-allowlist"` — plan 문서의 과거 서술 인용 1건 외 코드 잔존 0건.
- `grep -rn "redactNodeExecutionRow\b"` (구 이름, `ForResponse` 접미사 제외) — 저장소 전체 0건.
- `redactNodeExecutionRowForResponse` 사용처 3파일(선언·자기 spec·`executions.service.ts`),
  합계 12회 — 리네임이 누락 없이 완결됐다.
- `interaction.service.ts` · `websocket.service.ts` 의 `allowlistNodeOutputKeys` import 경로가
  둘 다 `../../nodes/core/node-output-allowlist` 로 갱신돼 있다.
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 를 `git show 044a2e19e --` 로
  직접 대조 — 두 `llmCalls strip` 테스트는 원래 있던(이름이 안 맞는) 블록 안에서 **위로** 이동해
  제자리 `describe('llmCalls strip — …')` 에 남았고, 그 아래 allowlist 캐너리들은 새 형제
  `describe('nodeOutput allowlist · fanout 파이프라인 불변식', …)` 로 분리됐다 — 커밋 메시지의
  "63→63 불변" 주장과 구조가 일치한다.
- `executions.service.spec.ts` 에 `findById` 의 `nodeExecutions[].error`/`.outputData` 마스킹을
  검증하는 블랙박스 통합 테스트(⑤, ⑤-b 등)가 이미 존재 — 내부 함수명이 뭐든 공개 동작으로
  리네임 회귀를 잡는 방어선이 이중으로 있다.
- `tsconfig.build.json` 에 추가된 `src/shared/testing/**` exclude 는 **이미 존재하는** repo-guard
  `production-build-devdep.spec.ts` (`findDevDepLeaks`) 가 빌드 대상 파일을 실제로 파싱해
  devDependency(`@nestjs/testing`, `package.json` 상 devDependencies 확인됨) 유출을 검사하므로,
  이 exclude 항목이 나중에 조용히 지워지거나 좁혀져도 CI 가 잡는다 — "문서·수동 확인만으로는
  보장이 안 지켜진다" 는 이 저장소 자신의 반복 교훈을 이 PR 자체가 이미 만족시키고 있다.

## 발견사항

- **[INFO]** `shared/testing/swagger-probe.ts` 에 고아 JSDoc 블록 3개가 연속으로 남아 있다 — 중간
  블록은 실제로는 `schemaOf` 를 설명하는 내용인데 `schemasOf` 바로 위에 붙어 있어 다음 사람이
  "왜 이 함수가 이 문구로 던지는지" 를 헷갈릴 수 있다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:58-75` (전체 파일 컨텍스트 게이트
    기준 — `/** components.schemas 레코드 전체 … */` → `/** 생성 문서에서 DTO 스키마 하나를 꺼낸다 … */`
    → `/** components.schemas 레코드 전체 … (중복) */` 세 블록이 `schemasOf` 선언 직전에 나란히 있다)
  - 상세: 이 파일은 테스트 인프라 헬퍼 그 자체(`shared/testing/`)이므로 "테스트 가독성" 관점에서
    직접적인 대상이다. 세 블록 중 두 번째("왜 던지나")는 `schemaOf`(단수)의 에러 메시지 설계를
    설명하는 문장인데 `schemasOf`(복수) 선언 앞에 붙어 있어 독자가 함수를 혼동할 여지가 있다.
    기능에는 영향 없음(주석뿐) — 리뷰가 아니었다면 남았을 편집 잔재로 보인다.
  - 제안: 세 블록을 하나로 합치거나, 두 번째 블록을 `schemaOf` 선언 위(현재 그 함수엔 JSDoc 이 없다)로
    옮긴다.

- **[INFO]** `buildSwaggerDocument` 의 핵심 안전 보장("`createDocument` 가 던져도 `app.close()` 가
  `finally` 로 실행돼 Jest 가 열린 핸들에 매달리지 않는다")이 JSDoc 에는 명시돼 있지만, 이를
  직접 검증하는 회귀 테스트가 없다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:36-44` (`buildSwaggerDocument` JSDoc)
    / `codebase/backend/src/shared/testing/swagger-probe.spec.ts` (해당 케이스 부재)
  - 상세: `swagger-probe.spec.ts` 는 `schemasOf`/`schemaOf`/`propertyOf` 의 에러 경로는 꼼꼼히
    캐너리로 고정했지만(존재 이유를 스스로 "에러 경로가 존재 이유" 라고 명시할 만큼), 정작
    `buildSwaggerDocument` 자신의 존재 이유로 든 try/finally 동작은 테스트 대상에서 빠져 있다.
    현재 구현이 단순해 회귀 가능성은 낮지만, 이 저장소가 반복해 지적해 온 "문서한 보장이
    구현/테스트보다 넓다" 패턴과 형태가 같다.
  - 제안: `SwaggerModule.createDocument` 가 던지는 컨트롤러(예: 순환 참조나 잘못된 데코레이터)를
    프로브로 세워 `app.close()`(또는 `moduleRef` 정리)가 호출됨을 spy 로 확인하는 케이스를
    하나 추가하면 이 헬퍼의 "존재 이유" 문서화가 스스로 세운 기준(행복 경로가 아니라 실패 경로를
    고정한다)에 완전히 부합한다. 다만 우선순위는 낮다 — 순수 위생 PR 범위를 넘는 신규 커버리지다.

## 요약

프로덕션 로직 변경이 없는 리네임·이동·추출 위주 위생 PR 이며, 테스트 관점에서 실제로 검증했을 때
리네임 누락·stale 참조·구조적 회귀가 하나도 없었다(구 함수명·구 import 경로 grep 전수 0건, 타입
캐스팅 정합성 확인, `websocket.service.spec.ts` 구조 재편이 테스트 수를 보존한 것도 커밋 메시지와
소스 대조로 확인). 특히 인상적인 것은 이 PR 이 스스로 두 가지 방어 실패 패턴 — Jest 의 타입 스트립
때문에 타입 전용 리팩터 실수를 유닛 테스트가 못 잡는 문제(별도 typecheck ratchet 이 잡음), 그리고
"컴포넌트가 undefined 면 TypeError" 라는 검증 안 된 에러 가정 — 를 스스로 실측해 정정한 점이다.
남은 두 항목(고아 JSDoc, `buildSwaggerDocument` try/finally 미검증)은 모두 INFO 수준으로, 새 공유
테스트 헬퍼(`shared/testing/`)의 문서·커버리지 완결성에 대한 사소한 흠이지 이번 diff 가 도입한
회귀는 아니다.

## 위험도
LOW
