# 문서화(Documentation) 리뷰 결과

리뷰 대상: `llm-model-config.controller.ts`, `plan/complete/web-chat-loader-queue-replay-arguments.md`, `plan/in-progress/refactor/02-architecture.md`

---

## 발견사항

### 발견 1
- **[WARNING]** `ParseEnumPipe` 도입으로 인한 API 행동 변경이 문서화되지 않음
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — `listModels` 핸들러 `@Query('type')` (L218 인근)
  - 상세: 변경 전에는 `type` 쿼리 파라미터에 `chat`/`embedding` 이외의 값이 들어와도 서비스로 그대로 전달되거나 무시되었다. 변경 후 `ParseEnumPipe(['chat', 'embedding'], { optional: true })` 도입으로 유효하지 않은 값은 400 Bad Request를 반환한다. Swagger `@ApiQuery`는 이미 `enum: ['chat', 'embedding']`을 선언하고 있어 API 문서와의 정합성은 좋아졌으나, 서버 측 유효성 검사 강화로 인한 행동 변경(invalid input 처리 방식 변경)임은 컨트롤러 JSDoc이나 plan 문서에 명시되지 않았다.
  - 제안: 클래스 JSDoc 또는 `listModels` 인라인 주석에 "ParseEnumPipe 도입으로 비표준 type 값은 이제 400 반환(이전: 서비스 전달)" 한 줄을 추가하거나, plan 완료 문서 또는 CHANGELOG에 behavior change로 기록한다. `@ApiBadRequestResponse`가 `listModels`에 없으므로 Swagger 문서에도 추가하면 일관성이 향상된다.

### 발견 2
- **[INFO]** `spec_impact` frontmatter 값의 형식 변경 — 스키마 일관성 검토 필요
  - 위치: `plan/complete/web-chat-loader-queue-replay-arguments.md` — frontmatter L7
  - 상세: `spec_impact: []`(빈 배열)에서 `spec_impact: none`(문자열 스칼라)으로 변경되었다. `.claude/docs/plan-lifecycle.md`에 정의된 frontmatter 스키마와 일치하는지 확인이 필요하다. 코드베이스의 다른 `plan/complete/` 문서들이 `spec_impact: []`를 사용하고 있다면 일관성 문제가 발생한다.
  - 제안: `plan-lifecycle.md`의 frontmatter 스키마 명세에서 `spec_impact: none`이 공식 허용 값인지 확인하고, 허용 값이라면 스키마 명세에 명문화하거나 기존 문서들을 일괄 정렬한다.

### 발견 3
- **[INFO]** `PROVIDER_PROBE_THROTTLE` 상수 — 제한값 근거 미서술
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` — L44-45
  - 상세: 인라인 주석이 "과금·rate-limit 보호용 단일 SoT"라는 목적을 잘 설명하고 있다. 다만 `limit: 10, ttl: 60_000`(분당 10회)의 수치 근거(어떤 provider 정책 또는 비용 기준으로 설정됐는지)가 명시되지 않아, 향후 값 변경 시 판단 기준을 찾기 어렵다.
  - 제안: 주석에 "// 분당 10회 — provider API 호출 비용·속도제한 여유분 기준 (spec §3 R-7 참조)" 등 한 줄 근거를 추가하면 유지보수 시 변경 판단에 도움이 된다. 선택적 개선 사항이다.

### 발견 4
- **[INFO]** `plan/in-progress/refactor/02-architecture.md` PR 번호 추가 — 충분한 자기문서화
  - 위치: `plan/in-progress/refactor/02-architecture.md` — cluster 4 항목
  - 상세: "PR 대기" → "PR #714 `000d8963` 머지 완료" 및 "PR #716 `3e102ed3` 머지 완료" 업데이트는 계획 추적 문서로서의 역할을 충실히 수행한다. 커밋 해시·PR 번호·authz follow-up 결과까지 기록되어 이력 추적성이 높다. 별도 조치 불필요.
  - 제안: 현행 수준 유지.

---

## 요약

전체적인 문서화 수준은 양호하다. `LlmModelConfigController` 클래스 JSDoc은 설계 의도, 모듈 배치 근거, spec 참조를 상세히 서술하고 있으며 Swagger 데코레이터도 일관성 있게 관리되고 있다. 핵심 주의 사항은 `ParseEnumPipe` 도입이 `GET :id/models?type=` 엔드포인트에서 무효 type 값에 대해 400을 반환하는 행동 변경을 일으킨다는 점으로, 이 변경이 컨트롤러 주석이나 plan 문서에 명시적으로 기록되지 않아 API 소비자 관점에서 Breaking Change를 인지하기 어렵다. `plan/complete/` frontmatter의 `spec_impact` 값 형식 변경은 스키마 일관성 관점에서 검토가 필요하다.

---

## 위험도

LOW
