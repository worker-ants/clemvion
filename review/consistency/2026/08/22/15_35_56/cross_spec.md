# Cross-Spec 일관성 검토 — `codebase/backend/src/shared/utils/` (impl-prep)

## 컨텍스트 메모 (검토 범위 특이사항)

target 문서 본문이 `(없음)` — 아직 draft/diff 가 없는 순수 impl-prep 사전 점검이다. 브랜치명
(`backend-redact-depth-boundary`)과 `plan/in-progress/masked-marker-shared-package.md` 의
"후속 (이 PR 밖)" 항목("**backend `deepRedactSecrets` 깊이 경계 테스트**")을 근거로, 착수 대상은
`sanitize-error-message.ts`/`redact-stored-error.ts` 의 **깊이 상한(depth) 경계**를 backend
`.spec.ts` 에 정밀 고정(canary)하는 작업으로 추정하고 그 관점에서 기존 spec/코드 정합성을 점검했다.
(target 본문이 없으므로 이 추정이 실제 착수 내용과 다르면 아래 발견사항의 적용 가능성만 재확인하면
된다 — 새로 발견한 모순은 없다.)

## 발견사항

- **[WARNING] 세 개의 "깊이 10" 이 서로 다른 불변식이다 — 신규 테스트가 잘못된 상수/연산자를 겨냥할 위험**
  - target 위치: (착수 예정) `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts`
  - 충돌 대상:
    - `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`MAX_REDACT_DEPTH`, `deepRedactCore`: `if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;`)
    - `codebase/backend/src/modules/websocket/websocket.service.ts` (`MAX_SANITIZE_DEPTH`, `if (depth > MAX_SANITIZE_DEPTH) return DEPTH_MASK_MARKER;`)
    - `codebase/packages/masked-markers/src/index.ts` (`MAX_MASK_DEPTH = 10`, canonical)
    - `spec/5-system/14-external-interaction-api.md` §R17 ("마커 집합과 깊이 상한의 SoT 는 공유 패키지")
    - `plan/in-progress/masked-marker-shared-package.md` (`MAX_SANITIZE_DEPTH` 통합을 명시적으로 기각)
  - 상세: 저장소에는 값 `10` 을 쓰는 depth 상한이 최소 두 갈래로 갈린다 — (a) `MAX_REDACT_DEPTH`(=`MAX_MASK_DEPTH`, REST 경로 `deepRedactSecrets`, 비교 연산자 `>=`, 마커가 놓이는 최대 깊이 **10**)과 (b) `MAX_SANITIZE_DEPTH`(WS `sanitizePayloadForWs`, 비교 연산자 `>`, 마커가 놓이는 깊이 **11**, WS 전용 별개 불변식으로 **의도적으로 통합하지 않음** — `masked-marker-shared-package.md` Rationale "*MAX_SANITIZE_DEPTH 까지 통합 — 위 실측대로 다른 불변식이다. 통합하면 WS 마스킹 깊이가 11→10 으로 바뀌는 동작 변경이 근거 없이 끼어든다*"). 프런트 `masked-markers.test.ts` 는 `nest(10)→true` / `nest(11)→false` 로 **`MAX_MASK_DEPTH`/`MAX_REDACT_DEPTH`** 경계를 정밀 고정하는데, 이는 WS 의 `MAX_SANITIZE_DEPTH` 경계(한 칸 다름)와 **다른 숫자를 겨냥한다**. 신규 backend 캐너리가 프런트 테스트를 그대로 이식하면서 좌표계를 착각하면(예: `>` 로 검증하거나 깊이 11 에서 치환을 기대) "정밀 고정"이 오히려 **잘못된 불변식을 고정**하게 된다.
  - 제안: 신규 테스트는 명시적으로 `MAX_REDACT_DEPTH`(`>=`)를 import 해 사용하고, 어서션 이름/주석에 "이 테스트는 `MAX_SANITIZE_DEPTH`(WS, `websocket.service.spec.ts` 가 별도로 고정)와 다른 불변식이다" 를 명시해 다음 사람이 두 상수를 합치려는 재발 시도를 막을 것. (이미 `strip-external-only-fields.ts` §"경계 연산자는 이 함수가 `>` 로 고정한다"가 같은 취지의 경고를 남겨 두었으므로 그 문구를 재사용하는 것을 권장.)

- **[INFO] `deepRedactSecrets` 의 depth-cutoff 마커는 `VALUE_MASK_MARKER`(`'***'`)다 — `DEPTH_MASK_MARKER`(`'[REDACTED_DEPTH]'`) 가 아니다 (의도된 동작, 오해 소지만 남음)**
  - target 위치: (착수 예정) 동일 파일의 depth 경계 테스트
  - 충돌 대상: `codebase/packages/masked-markers/src/index.ts` 의 `DEPTH_MASK_MARKER` 주석("깊이 상한을 넘은 서브트리가 치환되는 마커")과 `strip-external-only-fields.ts` §29-42 표(마스크 토큰 열: REST=`'***'`, WS=`'[REDACTED]'`+깊이초과는 `'[REDACTED_DEPTH]'`)
  - 상세: `DEPTH_MASK_MARKER` 라는 이름과 그 재export 주석만 보면 "깊이 초과 시 이 마커가 나온다"로 읽히기 쉽지만, 실제로 REST 경로(`deepRedactCore`)는 깊이 초과 시 `VALUE_MASK_MARKER`(`'***'`)를 반환한다(`git show 9ef97854f` 기준 최초 구현부터 리터럴 `'***'`). `DEPTH_MASK_MARKER` 를 실제로 emit 하는 곳은 WS `sanitizePayloadForWs` 뿐이다. `strip-external-only-fields.ts` 는 이미 "그 경계에서 서브트리를 non-object 로 collapse(`'[REDACTED_DEPTH]'` / `'***'`)한다" 고 두 갈래를 명시해 뒀으므로 **모순은 아니다** — 다만 신규 backend 캐너리가 "깊이 초과니까 `DEPTH_MASK_MARKER` 를 기대"라는 자연스러운 오해로 작성되면 즉시 RED 가 나서 잘못 고치려는 유혹(REST 경로를 `DEPTH_MASK_MARKER` 로 바꾸는)이 생길 수 있다. 그 변경은 `manual-trigger.md`/EIA §R17 의 "세 마커 모두 정확 일치로 감지"라는 소비 쪽 계약을 깨지는 않지만(어차피 `isMaskedMarker` 는 집합 멤버십만 본다), 근거 없는 동작 변경이므로 지양 대상.
  - 제안: 새 테스트는 `'***'`(=`VALUE_MASK_MARKER`)를 명시적으로 기대값으로 적어 "REST 경로는 `DEPTH_MASK_MARKER` 를 쓰지 않는다"는 사실을 캐너리로 고정할 것. `DEPTH_MASK_MARKER` 로의 변경을 시도하는 후속 PR 이 있다면 별도 결정(spec R17 업데이트 포함)이 필요하다.

- **[INFO] `redact-stored-error.spec.ts` 에 별도 깊이 경계 테스트를 중복 생성하지 말 것**
  - target 위치: `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (현재 depth/MAX_ 관련 테스트 없음 — 확인됨)
  - 충돌 대상: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (신설 예정 캐너리)
  - 상세: `redactStoredErrorForResponse`/`redactStoredDataForResponse` 는 `deepRedactSecrets` 에 그대로 위임하는 얇은 wrapper 라, depth 경계 검증은 `sanitize-error-message.spec.ts` 한 곳에 두면 충분히 전이(transit)된다. 이 저장소는 "같은 불변식을 두 곳에서 각자 테스트하다 한쪽만 갱신되어 미러가 갈라지는" 패턴을 반복해 겪었다(마커 리터럴 미러, `strip-external-only-fields` 경계 연산자 등, 모두 plan/코드 주석에 기록됨). `redact-stored-error.spec.ts` 에 독립된 depth 캐너리를 새로 추가하면 향후 `MAX_REDACT_DEPTH` 값이 바뀔 때 두 파일을 동시에 갱신해야 하는 새 미러가 하나 더 생긴다.
  - 제안: `redact-stored-error.spec.ts` 는 "얇은 위임" 사실 자체(예: 반환값이 `deepRedactSecrets` 의 결과와 동일 참조/동일 형태인지)만 검증하고, depth 경계의 정본 캐너리는 `sanitize-error-message.spec.ts` 단일 장소에 유지할 것.

## 요약

target 은 아직 draft 본문이 없는 순수 impl-prep 사전 점검이라 직접 비교할 신규 데이터 모델·API 계약·요구사항 ID·RBAC 는 없다. 대신 착수 예정 영역(backend `redactStoredError`/`sanitize-error-message` 의 depth 경계)을 실측하니, 이 저장소는 이미 EIA spec §R17·`@workflow/masked-markers` 공유 패키지·`strip-external-only-fields.ts` 의 방대한 Rationale 을 통해 "REST(`MAX_REDACT_DEPTH`, `>=`) vs WS(`MAX_SANITIZE_DEPTH`, `>`)는 별개 불변식이며 통합하지 않는다"는 결정을 명시적으로 고정해 두었다. Cross-spec 관점의 CRITICAL 모순은 발견되지 않았다 — 다만 두 깊이 상수가 같은 숫자(10)를 쓰면서 연산자·emit 마커가 미묘하게 다르다는 점은 신규 정밀 테스트를 작성할 때 좌표계를 혼동하기 쉬운 지점이므로, 어떤 상수·마커를 겨냥하는지 테스트 코드/주석에 명시할 것을 WARNING/INFO 로 남긴다.

## 위험도

LOW
