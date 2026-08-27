# 부작용(Side Effect) 리뷰 — `masking-residuals-0b195b` (`14_10_42`, 6라운드 누적본)

## 검토 방법

이 diff(`origin/main...HEAD`)는 `10_53_52`→`11_25_15`→`12_00_05`→`12_28_26`→`12_52_43` 5라운드
code-review 산출물과 `19_26_06`/`13_25_45`/`13_47_15` consistency-check 산출물을 전부 포함한
누적본이다. 직전 side_effect 라운드(`12_52_43`)가 CRITICAL 0 · WARNING 1(비차단, RESOLUTION 에서
"오늘 도달 불가"로 처분)로 LOW 수렴 판정했다. `git log`로 대조한 결과 그 이후 실제 `codebase/`
변경은 `websocket.service.ts` JSDoc 1줄(문구 교체)뿐이고, 나머지 신규 파일은 전부 spec 정정
2건(`6af73b2c8`, `69802a686`)과 그 자신의 review/consistency 산출물이다. 따라서 이번 라운드는
직전 라운드의 결론을 독립적으로 재검증하고, 5라운드가 다루지 않은 각도(단일 노드 디버그 재실행의
predecessor 시딩 경로)를 하나 추가 탐색했다.

핵심 소스를 `Read`/`grep`으로 직접 재대조했다: `mask-sensitive-fields.util.ts`,
`handler-output.adapter.ts`, `execution-context.service.ts`, `websocket.service.ts`,
`sanitize-error-message.ts`(`DEEP_REDACT_CACHE`), `execution-engine.service.ts`
(`seedSingleNodePredecessorOutputs`, diff 대상 아님 — 참조용).

## 발견사항

- **[INFO]** 직전 라운드(`12_52_43`) 이후 실제 코드 변경은 주석 1줄뿐 — 재검증 결과 동작 변화 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:448`
  - 상세: `git log 006b8aa2e..HEAD -- codebase/`로 대조한 결과 이 라운드에서 `codebase/` 아래
    유일하게 바뀐 줄이 이 JSDoc 한 줄이다 — `"boundary masking parity"` → `"egress masking
    parity"` (원칙명 개명 전파, `6af73b2c8`/`69802a686`이 처리). 실행 코드·시그니처·이벤트 발생은
    전혀 바뀌지 않았다. `adaptHandlerReturn`(핵심 boundary 마스킹 제거), `setStructuredOutput`
    참조-저장 aliasing, `DEFAULT_SENSITIVE_KEYS` export 등 5라운드가 이미 상세 추적한 항목은
    이 라운드에서 코드 레벨로 재현·재확인했으며 상태 불변임을 확인했다(`adaptHandlerReturn` 호출부
    6곳 — `execution-engine.service.ts:6047,6625` · `ai-turn-orchestrator.service.ts:835,1086,
    1129,1194` — grep 재확인, 신규 호출부 없음. `maskSensitiveFields` 런타임 소비처는
    `explore-tools.service.ts` 단 하나로 grep 재확인).
  - 제안: 없음(재확인 완료, 신규 조치 불요).

- **[INFO]** (신규 관찰, 비차단) 단일 노드 디버그 재실행의 predecessor 시딩 경로는 storage-time
  마스킹 제거의 혜택을 **과거에 저장된 실행에는** 소급 적용하지 못한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `seedSingleNodePredecessorOutputs`(~6596행) → `adaptHandlerReturn(storedOutput)` 호출부
    (~6624-6626행) — **이 파일은 이번 diff 대상이 아니다**(참조용 인접 코드, 줄 번호는 `Read`로
    직접 확인한 현재 파일 기준. 게이트 표기 대상 아님).
  - 상세: `spec/5-system/13-replay-rerun.md` C3(단일 노드 테스트, `spec/3-workflow-editor/
    3-execution.md §1.3`)는 previousExecutionId 의 직속 predecessor `NodeExecution.outputData`를
    읽어 `adaptHandlerReturn`으로 정규화한 뒤 `setStructuredOutput`/`setNodeOutput`에 시딩한다.
    이번 PR로 `adaptHandlerReturn`은 `config`에 더 이상 어떤 처리도 하지 않는 순수 pass-through가
    됐다(`config: r.config ?? {}`). 그런데 이 경로가 읽는 `storedOutput`은 **DB에 이미 저장된**
    과거 실행 row다 — 이 PR 배포 **이전**에 기록된 row라면 그 `config`는 여전히 boundary에서
    마스킹된 값(`****abcd`)이며, `adaptHandlerReturn`은 그것을 그대로 캐리한다. 그 결과 이
    predecessor 값을 참조하는 현재 노드의 표현식(`$node["X"].config.<field>`)은 이 PR이
    고치려 한 바로 그 증상(리터럴 `****abcd`)을 **과거 실행을 predecessor로 쓰는 단일 노드
    테스트에 한해** 계속 보게 된다. 이는 이 PR이 만든 신규 결함이 아니라 — 마스킹이 저장 시점에
    일어나던 시절 이미 그렇게 기록된 데이터의 자연스러운 잔존(어떤 storage-format 전환도 과거
    row를 소급 재작성하지 않는 한 공유하는 한계)이다. CHANGELOG(파일 1, 9-13행)의 "운영 영향"
    문단이 REST/WS egress와 DB 저장 형태 전환만 언급하고 이 내부 재시딩 경로는 다루지 않는다.
  - 제안: 차단 사유 아님. 실질 영향은 "이 PR 배포 이후 새로 생성된 실행"이 predecessor로 쓰이면
    자연히 사라지는 과도기적 잔존이라 별도 백필이 불필요해 보이나, 트래커(예:
    `spec-sync-external-interaction-api-gaps.md` 또는 `13-replay-rerun.md` C3 항목)에 한 줄
    "이 PR 이전 실행을 predecessor로 시딩하면 config 가 여전히 마스킹값" 을 부기해 다음 사람이
    단일 노드 테스트에서 예상 밖 `****` 값을 보고 재조사하는 시간을 아끼길 권장한다.

- **[INFO]** `DEEP_REDACT_CACHE`(identity 기반 `WeakMap`) staleness 가설은 `12_52_43` WARNING의
  처분(오늘 도달 불가)이 코드로 재확인됨
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202,222-231` (참조용,
    diff 대상 아님) / `codebase/backend/src/shared/utils/redact-stored-error.ts:107-108`
  - 상세: `redactStoredDataForResponse(row.outputData)`가 매 REST 요청마다 새로 조회한
    엔티티(`row`)의 필드를 넘기므로 동일 identity 가 서로 다른 시점에 재진입할 경로가 없고,
    WS 변형(`deepRedactSecretsPreserving`)은 이 캐시를 아예 쓰지 않는다(코드 주석이 이유를
    명시). `setStructuredOutput`이 핸들러 원본 객체를 장기 캐시에 참조로 눕히는 이번 PR의
    aliasing 변경과 이 캐시가 실제로 교차하는 지점은 찾지 못했다 — `12_52_43` RESOLUTION 의
    처분과 일치.
  - 제안: 없음(재확인 완료).

- **[INFO]** `review/**`, `spec/**`, `plan/**` 신규·수정 파일은 리뷰 도구·planner 턴의 정상
  산출물 — 애플리케이션 런타임 파일시스템 부작용 아님
  - 위치: 파일 목록 12-89(review/code, review/consistency), 10-11(plan), 90-97(spec)
  - 상세: 이 저장소 관례(`.claude/docs/*`, CLAUDE.md)상 `/ai-review`·`/consistency-check`
    산출물과 `spec/` 정정 커밋을 diff에 포함해 감사 추적을 남기는 것이 표준 워크플로다. 런타임
    코드가 실행 중 파일을 쓰는 로직은 diff 어디에도 추가되지 않았다.
  - 제안: 없음.

## 각 점검 관점별 요약

1. **의도치 않은 상태 변경**: `structuredOutputCache` aliasing(참조 저장)은 의도된 설계이고
   캐너리로 고정됨. 위 INFO(predecessor 시딩)는 신규 상태 변경이 아니라 과거 데이터의 자연 잔존.
2. **전역 변수**: `DEFAULT_SENSITIVE_KEYS`가 `const`→`export const`로 가시성만 확장. 신규 전역
   상태 없음.
3. **파일시스템 부작용**: 코드 로직 변경 없음. review/spec 산출물은 저장소 관례상 정상 아티팩트.
4. **시그니처 변경**: `adaptHandlerReturn`/`maskSensitiveFields`/`setStructuredOutput` 시그니처
   불변 — 반환값 **내용 정책**만 변경, 6개 호출부 전수 재확인.
5. **인터페이스 변경**: `DEFAULT_SENSITIVE_KEYS` export는 additive. `NodeExecution.outputData.
   config`의 DB 표현(마스킹값→원문)이라는 **데이터 계약** 변경은 CHANGELOG·spec R-5에 명시됐고,
   REST/WS egress가 그 앞에서 계속 마스킹해 외부 API 계약은 불변.
6. **환경 변수**: 관련 변경 없음.
7. **네트워크 호출**: 관련 변경 없음.
8. **이벤트/콜백**: WS emit 호출 시점·인자 구조 불변, payload 내용(config 마스킹 여부)만 변경되고
   egress 마스킹이 그 자리에서 재적용됨.

## 요약

직전 5라운드(`10_53_52`~`12_52_43`)가 이미 핵심 부작용(`adaptHandlerReturn` 계약 변경 전파,
`setStructuredOutput` aliasing, `DEFAULT_SENSITIVE_KEYS` export, `DEEP_REDACT_CACHE` identity
가설)을 상세히 추적·처분했고, 이번 라운드가 코드를 직접 재대조한 결과 그 결론은 모두 유효하다.
이 라운드에서 실제로 바뀐 코드는 JSDoc 1줄(문구 교체)뿐이라 신규 CRITICAL/WARNING 급 부작용은
발견되지 않았다. 새로 탐색한 각도(단일 노드 디버그 재실행이 이 PR 이전 실행을 predecessor로 시딩할
때 여전히 마스킹된 config를 표현식에 노출) 하나를 INFO로 추가했다 — 이는 이 PR이 만든 결함이
아니라 storage-format 전환이 과거 row에 소급 적용되지 않는다는 일반적 한계이며, 트래커 한 줄
부기를 권장하는 수준의 비차단 관찰이다.

## 위험도

LOW
