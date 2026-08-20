# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[CRITICAL]** `ExecutionDto.inputData` 의 Swagger JSDoc 이 여전히 "마스킹 대상이 아니다"라고 선언 — 이 PR 이 구현하는 마스킹 동작과 정반대
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:52` (JSDoc 블록 49~61행, `@ApiPropertyOptional` 대상은 68행 `inputData`)
  - 상세: 이 diff 는 같은 블록의 근거 인용문(54~55행)만 `` `ExecutionsService` 의 `MASKED_INPUT_DATA_REASON` `` → `` `ExecutionsService.toResponseExecution` `` 로 바꿨을 뿐, 바로 위 52행의 핵심 단정 — **"값-패턴 마스킹 대상이 아니다"** — 는 그대로 남겨 뒀다. 그런데 이 PR 은 정확히 `Execution.inputData` 를 마스킹 대상으로 전환하는 작업이고, 실제로 `toExecutionDto`(`executions.service.ts:1009`, `inputData: redactStoredDataForResponse(execution.inputData)`) 와 `toResponseExecution`(`executions.service.ts:1074`)이 이 필드를 마스킹한다. `nest-cli.json` 이 `@nestjs/swagger` 플러그인을 `introspectComments: true` 로 켜 두어, 이 JSDoc 은 **그대로 OpenAPI 스키마의 `description`** 이 된다 — 즉 배포되는 API 문서가 "이 필드는 원문이다"라고 단정하는데 실제로는 자격증명 패턴이 마스킹된 값이 나간다. 같은 파일 안의 자매 필드 `NodeExecutionSummaryDto.inputData`(172~179행)와 자매 파일 `background-run-response.dto.ts:51`은 정확히 새 정책("두 레벨이 같은 규칙")으로 다시 쓰였는데, 유독 최상위 `ExecutionDto.inputData` 한 곳만 리라이트가 누락됐다 — `review/consistency/.../naming_collision.md` 가 사전에 경고한 "6개 참조처 중 하나라도 누락하면 stale Swagger 설명이 SoT 로 계속 인용된다"는 리스크가 정확히 이 지점에서 현실화됐다.
  - 제안: 52~58행 전체를 "값-패턴 마스킹 대상이다(2026-08-20 부터, DB 원문과 다를 수 있음) — 종전엔 Re-run 프리필 재제출 때문에 제외했으나 프런트 마커 가드가 서면서 전환했다"는 취지로 재작성하고, 57행 "이 카브아웃은 `Execution` 레벨 한정이다" 대비 문장을 삭제(더 이상 카브아웃이 없으므로 대비할 대상이 없음).

- **[WARNING]** `MASKED_INPUT_DATA_REASON` 앵커 삭제 후 "카브아웃은 Execution 레벨 한정" 서술이 partial-edit 로 문법이 깨진 채 최소 2곳에 잔존
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:692` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:303-304`
  - 상세: `executions.service.ts:692` 는 `{@link MASKED_INPUT_DATA_REASON}` 참조만 지우고 "**노드 레벨 `inputData` 는 마스킹한다** — 카브아웃은 `Execution` 레벨 한정이다"라는 문장은 그대로 남았다 — 카브아웃이 이번 PR 로 완전히 폐지됐는데 "카브아웃은 Execution 레벨 한정"이라는, 더 이상 존재하지 않는 예외를 현재형으로 단정한다. `background-runs.service.ts:303-304` 는 더 심하다 — diff 가 결론 절만 교체해 "…**노드 레벨이라 `inputData` 도 마스킹한다** — 카브아웃은 / 2026-08-20 부터 `Execution` 레벨도 마스킹한다 — 두 레벨이 같은 규칙이다."라는, 주어("카브아웃은")와 서술어가 호응하지 않는 비문이 됐다. 두 곳 모두 `review/consistency/.../naming_collision.md`(CRITICAL)가 정확히 이 클래스의 위험("6개 참조처를 전부 동시에 새 방향으로 다시 쓰지 않으면…")으로 지목한 파일들이며, 실제로 부분 편집만 반영돼 남은 사례다. `executions.service.spec.ts:1248,1296`, `background-runs.service.spec.ts:265`에도 같은 "카브아웃은 Execution 레벨 한정" 잔존 표현이 있다(테스트 주석이라 상대적으로 낮은 우선순위).
  - 제안: 위 두 파일(및 스펙 테스트 3곳)의 해당 문단을 "카브아웃은 2026-08-20 이전엔 Execution 레벨 한정이었고, 지금은 두 레벨 모두 마스킹한다" 형태의 완전한 문장으로 재작성. 이런 부분-치환 누락을 다시 만들지 않으려면, 삭제 대상 앵커의 사용처를 grep 한 뒤 "문장 전체"를 단위로 리뷰하는 편이 안전하다(주석 반쪽만 diff 로 보면 문법 깨짐이 리뷰에서도 놓치기 쉽다).

- **[WARNING]** `rerun-modal.tsx` — 타입 재조정 이펙트와 마스킹-차단 게이트가 boolean 필드에서 의도치 않게 결합해 차단을 조용히 해제할 수 있음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` — 재조정 이펙트(294~309행 부근) vs `blockedByMaskedInput`(317~322행 부근, 함수명으로 특정)
  - 상세: 마스킹된 필드는 `splitMaskedParameters` 가 `prefill[k] = ""`(빈 문자열)로 채우고, `blockedByMaskedInput` 은 `paramValues[k] === "" || undefined || null` 일 때만 제출을 막는다. 그런데 스키마가 늦게 로드돼 `fields` 가 갱신되면, 기존 재조정 이펙트가 `coerceInput(f.type, v)` 로 문자열 값을 선언 타입에 맞게 강제 변환한다 — 필드 타입이 `boolean` 이면 `coerceInput('boolean', '')` 는 `'' === 'true'` → **`false`** 를 반환한다. 그 순간 `paramValues[k]` 는 `""` 에서 `false` 로 바뀌어 `blockedByMaskedInput` 의 세 조건(`"" | undefined | null`) 중 어느 것도 만족하지 않게 되고, 사용자가 실제 값을 입력하지 않았는데도 차단이 **조용히 풀린다**(체크박스는 unchecked=`false` 상태로 제출됨). 두 메커니즘은 각각 다른 커밋에서 서로 다른 목적으로 추가돼 지역적으로는 타당하지만(재조정 이펙트는 fallback string 오염 방지, 마스킹 게이트는 재제출 오염 방지), 서로의 존재를 모른 채 결합해 "타입이 boolean 인 마스킹 필드"라는 좁지만 실재하는 경로에서 §R17 "닫는 조건"이 요구하는 강제(재입력 강제)가 깨진다.
  - 제안: `blockedByMaskedInput` 판정에서 "coercion 이 적용된 적 있는 마스킹 키"를 별도로 추적하거나, 재조정 이펙트가 `maskedKeys` 에 속한 키는 건드리지 않도록 제외한다. 최소한 이 경로를 다루는 테스트 케이스(마스킹된 boolean 타입 필드가 스키마 로드 후에도 차단 유지되는지) 를 추가해 캐너리로 고정할 것을 권장.

- **[INFO]** 같은 마커-가드 정책의 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리)가 서로 다른 강제 수준으로 구현돼 있음
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (`initialValueFor`, 331~340행) vs `rerun-modal.tsx`/`editor-toolbar.tsx`
  - 상세: `dynamic-form-ui.tsx` 는 마커면 프리필만 건너뛸 뿐, 제출 차단은 필드별 `required` 속성(LLM 이 만드는 `formConfig` 가 그 필드를 `required: true` 로 채웠을 때만) 에 전적으로 의존한다 — `required` 가 없는 필드는 빈 값 그대로 조용히 제출될 수 있다. 반면 `rerun-modal.tsx`/`editor-toolbar.tsx` 는 마커 잔존 여부로 명시적 `role="alert"` + 제출 버튼 `disabled` 하드 게이트를 건다. 이 비대칭은 이번 diff 가 새로 만든 것은 아니다(`dynamic-form-ui.tsx` 쪽 로직 자체는 #1181에서 이미 존재, 이번엔 import 위치만 `lib/utils/masked-markers.ts` 로 이동) — 다만 이번 PR 이 §R17 "닫는 조건"을 "세 소비처가 전부 갖췄다"고 통합 서술로 마무리하는 시점이라, 세 표면의 실제 강제력 차이를 아키텍처 문서(§R17 또는 이 plan)에 한 줄 명시해 두는 편이 향후 재발(강제력이 약한 표면부터 우회 벡터가 발견되는 패턴)을 줄인다.
  - 제안: 필수 조치는 아님. `dynamic-form-ui.tsx` 도 마스킹된 필드에 대해 명시적 required 강제(현재 LLM 스키마의 `required` 여부와 무관하게)를 검토하거나, 최소한 "이 표면은 약한 가드"라는 caveat 을 spec/코드 주석에 남길 것을 권고.

## 요약

이번 변경은 `Execution.inputData` egress 마스킹 카브아웃을 폐지하면서, 프런트 마커 판별 로직을 컴포넌트 내부(`dynamic-form-ui.tsx`)에서 `lib/utils/masked-markers.ts` 로 승격해 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리)가 서로를 몰라도 되게 만든 리팩터로, 의존성 방향(컴포넌트→공용 유틸)과 backend 의 단일 관문 패턴(`toResponseExecution`/`toExecutionDto`)을 그대로 유지·확장한 점은 설계적으로 탄탄하다. `splitMaskedParameters`/`hasMaskedMarkerLeaf` 같은 순수 함수 분리, backend 세 컬럼(`error`/`outputData`/`inputData`) copy-on-change 최적화 유지도 코드 품질이 높다. 다만 카브아웃 폐지가 여러 레이어(서비스 로직·DTO Swagger 문서·주석)에 걸쳐 있음에도 그 전파가 완전하지 않았다 — 특히 `ExecutionDto.inputData` 의 Swagger 설명이 자동으로 OpenAPI 문서에 노출되는데도 옛 "마스킹 안 함" 단정이 그대로 남아 있는 것은, 이 저장소의 consistency 리뷰가 사전에 정확히 예측한 위험(`naming_collision.md` CRITICAL: 앵커 반전 시 참조처 전수 미갱신)이 실제로 한 지점 이상에서 발생했음을 보여준다. 프런트 쪽 `rerun-modal.tsx` 에서는 새 마스킹-차단 게이트가 기존 타입-재조정 이펙트와 결합해 boolean 필드에서 조용히 풀릴 수 있는 좁은 결합도 이슈도 발견됐다. 구조적 설계 방향 자체를 재고할 필요는 없으며, 위 CRITICAL 1건(Swagger 계약 정정)과 WARNING 2건(주석 스윕 완결·boolean 결합 케이스)을 반영하면 충분하다.

## 위험도

HIGH
