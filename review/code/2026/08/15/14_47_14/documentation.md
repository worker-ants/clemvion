# 문서화(Documentation) 리뷰

## 사전 확인 — 직전 라운드(`13_58_27`) WARNING 2건 재검증

이번 diff 에는 직전 문서화 리뷰(`review/code/2026/08/15/13_58_27/documentation.md`)가 낸 WARNING 2건에
대한 후속 조치가 포함돼 있어, 우선 실제로 해소됐는지 소스를 직접 열어 대조했다.

- **W8 (spec §6.5 취소선 대신 완전 삭제)** — `spec/5-system/14-external-interaction-api.md:816-824` 를
  직접 Read 로 확인. 트래커 링크 + "알려진 갭은 invariant 옆에 적는다" 근거 문장이 이번 라운드에서
  `~~...~~` 취소선으로 복원되고 `(해소됨 — 상세 이력은 같은 링크에 남아 있다.)` 노트가 붙었다. **해소 확인**.
- **W9 ("트래커 등재" 주장이 실제로는 미등재)** — `plan/in-progress/eia-db-wire-invariant.md` 의
  "## 범위 밖 (등재됨)" 절(파일 내 100-105행)에 `Execution` 엔티티 nullable 불일치 항목이 실제로
  추가됐고, `interaction.service.spec.ts:95-98` 주석도 `plan/in-progress/eia-db-wire-invariant.md §범위 밖`
  으로 구체적 파일·절을 명시하도록 고쳐졌다. **해소 확인**.

두 건 모두 코드가 아니라 문서/plan 자체의 정정이었고, 이번 라운드에서 실제로 반영된 것을 직접 열어
검증했다. 재발 없음.

## 발견사항

- **[INFO]** `CHANGELOG.md` 신규 항목이 같은 파일 안에서 REST 엔드포인트 경로를 두 가지 형태로 섞어 쓴다
  - 위치: `CHANGELOG.md:17` (`... GET /executions/:id 에는 필드가 없어 ...`)
  - 상세: 방금 추가된 이 줄은 경로를 `GET /executions/:id` 로 줄여 쓰는데, 바로 26줄 아래 기존 항목
    (`CHANGELOG.md:43`, `~~REST GET /api/external/executions/:id 에는 아직 없다~~`)과 `spec/5-system/14-external-interaction-api.md`
    (EIA-IN-04, `GET /api/external/executions/:executionId`)·`interaction.controller.ts:166`(`@Get(':executionId')`)
    는 모두 전체 경로(`/api/external/executions/:executionId`)와 파라미터명(`:executionId`)을 정확히 쓴다.
    같은 파일 다른 위치(`CHANGELOG.md:515`)에도 과거 축약형 선례가 있어 이 저장소 CHANGELOG 관행 자체가
    완전히 엄격하진 않지만, 이번에 새로 쓴 문장이 바로 옆 문장과 형태가 다른 것은 굳이 만들 필요 없는
    사소한 불일치다. 실제 혼동 위험은 낮다(같은 문단 안에 정본 경로를 쓰는 자매 항목이 있고, spec 이
    SoT 이므로).
  - 제안: `GET /executions/:id` → `GET /api/external/executions/:id`(또는 `:executionId`)로 통일. 급하지
    않음 — 선택적 정리.

## 양호한 점 (참고)

- `execution-engine.service.ts` `finalizeCancelledExecution` JSDoc(함수 시작부)이 "종전엔 무조건 emit
  했다 → 그 근거는 여전히 유효하다 → 그러나 무조건 발행이 반대편 결함을 낳았다" 순서로 **정정 이력을
  삭제하지 않고 누적**해 서술한다. 이 저장소가 반복해서 강조하는 "문서한 보장이 구현보다 넓으면 안
  된다"·"보존 원칙" 관행을 정확히 따른다.
- `spec/conventions/node-cancellation.md` §2.4 Rationale(파일 내 213-217행)의 정정도 `~~원문~~` +
  `**(2026-08-15 정정)**` 패턴으로 동일하게 처리됐고, §2.4 매트릭스에 없던 `finalizeCancelledExecution`
  행이 새로 추가돼(198행) "왜 이 표에 이 함수가 없었는가"라는 이전 라운드 지적도 함께 닫혔다.
  같은 라운드에서 code comment · spec Rationale · plan 문서 셋이 같은 사실 정정을 서로 다른 위치에서
  일관되게 서술한다 — 교차 검증했을 때 셋 다 서로 모순 없음을 확인했다.
  - `execution-engine.service.ts:4990-4992`(`finalizeFailedExecution` 옆 주석 "형제와 동일한 guarded
    경로")도 재확인했다: 이제 두 함수 모두 `updateExecutionStatus` 반환값을 실제로 읽으므로 "guarded
    경로가 같다"는 주장 자체는 참이 됐다. 0행일 때의 **정확한 동작**(한쪽은 무조건 skip, 다른 쪽은
    live status 재확인 후 조건부 emit — 극성이 다름)까지는 이 주석이 주장하지 않으므로 과대서술이
    재발하지 않았다.
- `terminal-duration.ts` 의 신규 `toPersistedDate`(파일 내 80-96행) JSDoc 이 자매 `toFiniteNumber` 를
  `{@link}` 로 명시 참조하고, 이 헬퍼가 필요해진 이유(`13_58_27 maintainability W6`)를 리뷰 라운드
  식별자까지 남겨 추적성이 높다.
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `triggers.en.mdx` 두 언어본이 같은 위치에
  같은 의미의 문장을 대칭으로 추가했고, `durationMs` 의 종결 전 `null` 캐비엇도 양쪽 다 명시했다 —
  KO/EN 문서 drift 없음.
- `execution-status-response.dto.ts` 의 신규 `durationMs` JSDoc·Swagger description·`spec §5.3` 응답
  예시(`4242`) 세 곳의 example 값·null 규약이 서로 일치한다(직접 대조 완료).
- `Execution` 엔티티의 `finishedAt: Date`/`durationMs: number` 선언이 실제로는 둘 다
  `@Column({ nullable: true })` 라는, 테스트 주석의 주장을 `execution.entity.ts:56-63` 을 직접 열어
  실측 검증했다 — 정확한 서술이었다.

## 요약

이번 라운드는 직전 문서화 리뷰가 지적한 WARNING 2건(§6.5 취소선 미보존, "트래커 등재" 허위 주장)을 모두
실제로 소스에서 확인 가능한 형태로 해소했다. CHANGELOG·spec(§5.3/§6.5)·plan(정본 트래커 동기화 포함)·
JSDoc·인라인 주석·KO/EN 유저 가이드가 서로 교차 참조되고 내용이 일관되며, 이력 보존(취소선+정정 노트)
관행도 이번 라운드 전 지점에서 올바르게 적용됐다. 새로 발견된 것은 `CHANGELOG.md` 한 줄의 REST 경로
표기 축약(같은 파일 내 형태 불일치, 이 저장소에 선례가 있는 수준의 사소한 문제) 하나뿐이며 기능·계약에
영향이 없다.

## 위험도

NONE
