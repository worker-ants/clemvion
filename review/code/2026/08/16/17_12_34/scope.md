# 변경 범위(Scope) 리뷰

## 방법론 노트

프롬프트가 컨텍스트 예산으로 여러 파일의 diff 를 생략(`... 원본 파일 참조 ...`)했다. 생략된
파일(`executions.service.spec.ts`, `eia-terminal-emit-facade.md` 등)과 스코프 판정에 필요한
근거는 저장소에서 `git diff origin/main..HEAD -- <path>` 로 직접 열어 대조했다. 아래 위치는
전부 실제 소스 파일의 줄 번호(게이트) 또는 함수/블록명으로 표기한다.

## 발견사항

- **[INFO]** `.claude/docs/plan-lifecycle.md` 컨벤션 문서 보강이 백엔드 보안 수정 PR 에 동봉됨
  - 위치: `.claude/docs/plan-lifecycle.md:80-96` (신규 `pending_plans` 표·캐비엇)
  - 상세: 이번 PR 의 핵심 의도는 `Execution.error`/`nodeExecutions[].error` 내부 REST 읽기
    경로 마스킹(`redact-stored-error.ts` + 4개 서비스 반환 경로)이다. `plan-lifecycle.md` 의
    `pending_plans` 필드 의미(스펙 레벨 vs plan 레벨) 정의 추가는 그 코드 변경과 직접
    관련이 없는 별개 관심사다. 다만 이 변경은 임의 리팩터링이 아니라 (a) 이번 PR 이 신설한
    `plan/in-progress/eia-internal-rest-error-masking.md` 자신의 frontmatter 가
    `pending_plans:` 키를 쓰고 있고, (b) 같은 세션의 `--impl-prep` consistency-check
    (`review/consistency/2026/08/16/16_48_55/convention_compliance.md` "pending_plans 의
    선언 방향이 실제 관계와 반대로 읽힐 소지" INFO)에 대한 직접 응답으로 추가됐다 —
    즉 이번 PR 자신의 산출물(신규 plan 파일)과 이번 PR 자신의 리뷰 게이트가 만든 요구다.
    scope-creep 이라기보다 "이번 PR 이 새로 도입한 관행을 같은 PR 에서 정의" 하는
    패턴이며, 저장소 관행(코드와 그 코드가 쓰는 문서를 같은 커밋에 갱신)과 일치한다.
  - 제안: 조치 불필요. 다만 향후에도 이런 메타/툴링 문서 변경은 "왜 이 PR 에 포함됐는지"
    한 줄 근거(frontmatter 사용처 또는 리뷰 발견 ID)를 커밋 메시지나 plan 체크리스트에
    남기면 추적이 쉬워진다.

- **[INFO]** plan 라이프사이클 하우스키핑(6개 plan `complete/` 이동 + 역참조 8곳 갱신)이 보안
  수정 커밋과 같은 브랜치에 포함됨
  - 위치: `plan/complete/eia-stalled-atomicity.md`(신규), `plan/in-progress/eia-stalled-atomicity.md`(삭제)
    외 `eia-terminal-emit-facade.md`·`eia-terminal-error-sanitize.md`·
    `spec-draft-eia-error-masking-catalog.md`·`spec-draft-eia-r8-alignment.md`·
    `spec-draft-ws-types-canonical-location.md` 동일 패턴 + `backend-lint-gate-broken-on-main.md`·
    `retry-turn-terminal-guard.md`·`spec-draft-eia-notification-payload-contract.md`·
    `spec-sync-external-interaction-api-gaps.md`·`ws-event-types-extract.md` 의 링크 경로
    (`./X.md` → `../complete/X.md`) 수정
  - 상세: 이 변경군은 별도 커밋(`fafb57e46 chore(plan): mark 6 EIA plans complete — 머지된
    PR 이 in-progress 에 stale 로 남아 있었다`)으로 명확히 분리돼 있고, 커밋 메시지 자체가
    사유(이미 머지된 PR 들의 plan 문서가 `in-progress/` 에 stale 로 남아 있었음)를 밝힌다.
    역참조 갱신은 `plan-lifecycle.md` §3 "인입 참조" 규칙(plan 을 `complete/` 로 옮기면
    가리키던 링크도 같은 커밋에서 갱신)의 직접적 요구 사항이라 임의 확장이 아니다. 다만
    이 하우스키핑 자체는 "내부 REST 마스킹" 이라는 이번 PR 의 핵심 서사와는 별개 관심사이며,
    이론적으로는 독립 PR 로 분리할 수도 있었던 항목이다.
  - 제안: 조치 불필요 — 별도 커밋으로 이미 분리돼 있어 리뷰·되돌리기 단위가 명확하다.
    향후 유사 상황에서도 "코드 수정"과 "plan 이동/링크 정정" 을 별도 커밋으로 유지하는
    현재 관행을 유지할 것.

## 스코프 안에서 확인한 사항 (참고, 문제 없음)

- 핵심 코드 변경(`redact-stored-error.ts`/`.spec.ts` 신규, `executions.service.ts`,
  `background-runs.service.ts` 및 각 `.spec.ts`)은 `plan/in-progress/eia-internal-rest-error-masking.md`
  에 문서화된 설계·표면 전수(①~⑤)와 1:1로 대응한다. `stripPrivateRelations` →
  `toResponseExecution` 개명, `stop()`/`stopInternal()` 분리는 리팩터링처럼 보이지만
  둘 다 "모든 반환 지점이 같은 마스킹 관문을 통과" 시키기 위한 설계의 필수 요소이며
  plan 문서(`executions.service.ts:905-921` 부근 JSDoc, `:767-772` 부근)가 그 이유를
  명시한다 — 무관한 리팩토링이 아니다.
- import 추가(`executions.service.ts`, `background-runs.service.ts` 의
  `redactStoredErrorForResponse`)는 전부 실제로 호출되며, 정리성 unused-import 변경은
  없었다.
- `spec/2-navigation/14-execution-history.md`·`spec/4-nodes/1-logic/12-background.md`·
  `spec/5-system/6-websocket-protocol.md`·`spec/5-system/14-external-interaction-api.md`·
  `spec/conventions/secret-store.md` 의 spec 변경은 전부 plan 문서 체크리스트의
  "planner 턴 ⓐ~ⓕ" 항목과 1:1 대응하며, `--impl-prep`(`16_03_57`)이 이 spec 갱신을
  "같은 PR 의 완료 조건" 으로 명시적으로 승격한 결과다. 임의로 넓어진 spec 변경은
  발견되지 않았다.
- `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55}/**` 아티팩트(SUMMARY.md,
  `_retry_state.json`, checker 산출물, `meta.json`)는 프로젝트 컨벤션상 `review/` 가
  gitignore 대상이 아니라 커밋되는 것이 정상이며, 3회 라운드는 이 PR 자체의
  `--impl-prep`/`--spec` 게이트 반복 실행 이력이다 — 무관한 산출물이 아니다.
- 포맷팅 전용 diff, 불필요한 주석 추가/삭제, 설정 파일(`package.json`, tsconfig, CI 등)
  변경은 발견되지 않았다.

## 요약

이번 diff 는 "내부 REST/WS 읽기 경로의 `Execution.error` 마스킹"이라는 단일 목적에
거의 완벽하게 정렬돼 있다 — 코드·테스트·spec 문서·plan 트래커 갱신이 모두 신설 plan 문서
(`eia-internal-rest-error-masking.md`)에 명시된 설계·체크리스트 항목과 1:1 대응하고, plan
문서 자신이 "범위 밖" 항목(`NodeExecution.error` 잔여 emit 경로, `inputData`/`outputData`)을
명시적으로 나열해 조용한 확장을 피했다. 유일하게 눈에 띄는 것은 (1) `plan-lifecycle.md`
컨벤션 문서 보강과 (2) 이미 머지된 6개 plan 을 `complete/` 로 옮기는 하우스키핑인데, 둘 다
별도 커밋으로 분리돼 있고 각각 이번 PR 자신의 산출물/리뷰 발견 또는 저장소 규약(§3 인입
참조)에 근거가 있어 무관한 변경이라 보기 어렵다. CRITICAL/WARNING 급 스코프 이탈은
발견하지 못했다.

## 위험도

LOW
