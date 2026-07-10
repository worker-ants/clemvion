# 보안(Security) 코드 리뷰

- 대상: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts`,
  `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts`
  (+ 참고용 `review/consistency/2026/07/10/22_52_18/*.md` 산출물)
- 변경 요약: `#501` llm_usage_log attribution 회귀의 후속 하드닝. (1) resume-turn
  `llmContext` object literal 에 명시 타입 주석(`LlmCallContext`) 추가 — TS
  excess-property check 를 강제해 `nodeExecutionID` 류 오탈자를 컴파일 타임에
  차단, (2) information-extractor 의 collection-retry 2번째 chat 호출에도 동일
  attribution 이 전달되는지 검증하는 유닛 테스트 신설. 런타임 로직/제어 흐름 변경
  없음(순수 타입 강화 + 테스트 추가).

## 발견사항

조사 결과 이번 diff 자체에서 새로 도입된 보안 취약점은 없다. 아래는 인접 코드
경로까지 추적해 확인한 근거와, 향후 유사 변경 시 참고할 만한 INFO 수준 관찰이다.

- **[INFO]** `llmContext` 필드(workflowId/executionId/nodeExecutionId)는 사용자
  입력이 아닌 서버 내부 식별자
  - 위치: `ai-turn-executor.ts:2599-2603`, `llm.service.ts:41-45,186-195`,
    `retry-turn.service.ts:344-352`
  - 상세: `nodeExecutionId` 는 `spawnedRow.id`(엔진이 방금 생성한 DB row PK),
    `workflowId`/`executionId` 는 `Execution`/`Node` 엔티티에서 조회된 값으로
    귀속(attribution) 목적으로만 `llm_usage_log` insert 에 흘러간다.
    `LlmUsageLogService.record()` 는 TypeORM `repository.insert()`(파라미터
    바인딩)를 사용해 raw SQL 문자열 조합이 없으므로 SQL 인젝션 경로가 없다.
    이 값들은 클라이언트가 직접 주입할 수 있는 경로가 아니라 실행 엔진이
    생성·소유하는 값이라 로그 위조(attribution spoofing) 우려도 낮다.
  - 제안: 현행 유지. 별도 조치 불필요.
  - 근거(참고): 이번 diff 는 이 흐름 자체를 바꾸지 않고, 해당 object literal 에
    타입만 명시해 필드명 오탈자를 컴파일 타임에 잡는 것이 전부.

- **[INFO]** `state.workflowId as string | undefined` / `state.nodeExecutionId as string | undefined` 캐스팅은 이번 diff 이전부터 존재
  - 위치: `ai-turn-executor.ts:2600,2602`
  - 상세: `as` 타입 단언은 런타임 검증을 우회한다. 다만 이 값들이 신뢰 경계
    바깥(사용자 입력)에서 오지 않고, 최악의 경우에도 영향 범위는 내부 사용량
    로그 컬럼의 attribution 정확도(비즈니스 정확성)일 뿐 인가·데이터 노출
    범위를 넓히지 않는다. 새로 추가된 코드가 아니라 이번 변경(명시 타입 주석)의
    스코프 밖.
  - 제안: 조치 불필요(스코프 아님). 추후 별도 리팩터에서 `resume-state.schema.ts`
    의 zod 스키마로 이 필드들의 런타임 파싱을 추가하면 방어적으로 더 견고해지나,
    이번 PR 의 목적(#501 attribution 하드닝)과는 별개 작업.

- **[INFO]** 신설 테스트(`information-extractor.handler.spec.ts`)는 순수 mock 기반 유닛 테스트
  - 위치: `information-extractor.handler.spec.ts:651-691`
  - 상세: 실제 네트워크 호출·시크릿·자격증명이 없고, `mockLlmService.chat` 을
    스텁해 `llmContext` 3개 필드(exec-attr-2/wf-attr-2/nodeexec-row-2)가 재시도
    호출에도 동일하게 전달되는지만 단언한다. 하드코딩된 시크릿·토큰·API 키
    없음. 픽스처 값도 실제 식별자 형식이 아닌 테스트 전용 리터럴.
  - 제안: 조치 불필요.

- **[INFO]** 에러 처리/민감정보 노출 — 이번 diff 범위 밖, 기존 안전장치 재확인
  - 위치: `ai-turn-executor.ts:168-183` (`sanitizeToolError`), `llm.service.ts`
    (`sanitizeLlmErrorMessage` import 존재)
  - 상세: 파일 전체 컨텍스트에 포함된 `sanitizeToolError` 는 예외 메시지에서
    첫 줄만 노출하고 200자로 truncate 해 DB 커넥션 문자열/내부 호스트명/스택 등의
    노출을 이미 방지하고 있다(이번 diff 로 변경되지 않음, 기존 방어 확인 차원).
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 산출물 파일(`review/consistency/2026/07/10/22_52_18/*.md`)
  - 위치: 파일 3~8
  - 상세: 코드가 아닌 consistency-check 리포트(markdown)이며, 하드코딩된
    시크릿·자격증명·PII 등 민감정보 포함 여부를 확인했으나 발견되지 않았다.
    보안 관점에서 실행 가능한 공격 표면 변경 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경은 `#501` LLM 사용량 로그 attribution 회귀에 대한 순수 하드닝(TS
excess-property check 를 활성화하는 명시 타입 주석 1개 + 회귀 방지 유닛 테스트
1개)으로, 인젝션·인증/인가·시크릿·암호화·에러 노출·의존성 어느 축에서도 새로운
공격 표면이나 취약점을 도입하지 않는다. `llmContext` 로 전달되는 식별자들은
사용자 입력이 아닌 서버 내부에서 생성·조회된 값이며, 최종 DB insert 는 TypeORM
파라미터 바인딩을 사용해 SQL 인젝션 경로가 없다. 신설 테스트 역시 mock 기반이라
시크릿 노출이나 새 런타임 경로가 없다. 전반적으로 보안 리스크는 없다.

## 위험도

NONE
