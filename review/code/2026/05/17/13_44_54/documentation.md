# 문서화(Documentation) 리뷰 결과

## 발견사항

### 1. 삭제된 인라인 주석 — `pending_install` 진단 맥락 소실

- **[WARNING]** `status-badge.tsx` diff 에서 `pending_install` 분기의 인라인 주석 블록이 제거되었다.
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, diff 기준 `-35 ~ -41` 행 (삭제된 7줄)
  - 상세: 제거된 주석은 `pending_install` 상태에서 `lastError.message` 를 우선하고 `statusReason` 을 fallback 으로 쓰는 이유 (`spec/2-navigation/4-integration.md §10.4`), 그리고 UI 동작 이유를 설명하고 있었다. 해당 로직 자체(`pickErrorMessage` 호출)는 남아 있으나 왜 두 필드를 이 순서로 쓰는지에 대한 맥락이 사라졌다.
  - 제안: 삭제된 주석을 간결하게라도 복구하거나, `pickErrorMessage` 함수 자체의 JSDoc 에 선택 근거를 추가한다.

### 2. 삭제된 인라인 주석 — `expired + install_timeout` 진단 맥락 소실

- **[WARNING]** 같은 파일 `expired` 분기에서도 `install_timeout` 의 Cafe24 Private 맥락 주석이 제거되었다.
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, diff 기준 `-52 ~ -53` 행
  - 상세: `install_timeout` 이 Cafe24 Private 전용이며 Reauthorize 진입점이 없어 삭제 후 재등록이 강제된다는 설명이 제거되어, 이후 이 분기를 읽는 개발자가 맥락을 spec 문서를 직접 찾아야 알 수 있다.
  - 제안: 코드에 짧은 한 줄 주석(`// Cafe24 Private only — no reauthorize entry, must delete and re-register. §10.4`)을 유지하거나, `INSTALL_TIMEOUT_REASON` 상수 선언부에 이 맥락을 명시한다.

### 3. `humanizeUntil` 함수의 JSDoc 부재

- **[WARNING]** `humanizeUntil` 은 `status-badge.tsx` 에서 `export` 되어 `page.tsx` 에서도 import 해서 사용하는 공개 유틸 함수이나, 블록 JSDoc 없이 단순 인라인 주석(한 줄 `//` 형식)만 있다.
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, `humanizeUntil` 함수 선언부 (약 라인 2650)
  - 상세: 반환 형식(예: `"2h 30m"`, `"less than a minute"`, `""`)과 엣지케이스(과거 시각, NaN) 처리가 JSDoc `@param` / `@returns` 없이 인라인 주석으로만 설명되어 있다. export 된 함수이므로 IDE 자동완성과 타입 힌트에 JSDoc 이 유리하다.
  - 제안: 다음 형태로 JSDoc 추가:
    ```ts
    /**
     * Human-friendly remaining time until `at`.
     * Short (< 1h): minutes only. Medium (< 24h): hours + minutes. Long: days.
     * Returns empty string for past or invalid timestamps.
     */
    export function humanizeUntil(at: string): string {
    ```

### 4. `ServiceDefinition.supportsTokenAutoRefresh` 의 서비스 목록이 코드와 불일치 위험

- **[INFO]** `service-registry.ts` 의 `supportsTokenAutoRefresh` JSDoc 에 "Currently `cafe24` ... and `google`" 이라고 구체 서비스 이름을 명시했다. 향후 새 서비스(예: `notion`, `slack`)가 `supportsTokenAutoRefresh: true` 로 추가될 때 이 JSDoc 이 outdated 가 될 수 있다.
  - 위치: `backend/src/modules/integrations/services/service-registry.ts`, `supportsTokenAutoRefresh` 필드 JSDoc
  - 상세: 열거형 JSDoc 은 코드보다 빠르게 stale 해지는 경향이 있다. 서비스 목록을 JSDoc 에 박제하면 추가/제거 시 문서 업데이트가 누락될 위험이 있다.
  - 제안: 구체 서비스 이름 대신 "services that issue `refresh_token` and have an active refresh mechanism" 처럼 추상적인 기준으로 서술하고, 구체 목록은 `SERVICE_REGISTRY` 배열의 각 항목 `supportsTokenAutoRefresh: true` 선언에 책임을 넘긴다.

### 5. `IntegrationDto.autoRefresh` JSDoc 의 구체 서비스 목록 동일 이슈

- **[INFO]** `frontend/src/lib/api/integrations.ts` 와 `backend/.../integration-response.dto.ts` 의 `autoRefresh` 필드 주석에도 "현재 cafe24·google 만 true" 라고 명시되어 있다. 이 설명은 서비스 추가 시 stale 해진다.
  - 위치: `frontend/src/lib/api/integrations.ts` 라인 2851, `backend/.../integration-response.dto.ts` 라인 100
  - 상세: 프론트엔드 DTO 는 백엔드 응답을 미러링하는 클라이언트 타입이므로, 구체 서비스 목록보다 동작 의미("백엔드가 해당 서비스에 자동 갱신 메커니즘을 운영 중이면 `true`")를 서술하는 것이 더 내구성이 높다.
  - 제안: "현재 cafe24·google 만 true" 를 "백엔드 service registry 에서 `supportsTokenAutoRefresh: true` 로 등록된 서비스만 true" 로 대체.

### 6. `InfoRow` 컴포넌트 `tooltip` prop — spec 참조 번호 불일치

- **[INFO]** `page.tsx` 의 `InfoRow` JSDoc 에서 spec 참조가 `§4.2` 로 기재되어 있으나, 다른 파일들(`status-badge.tsx`, `integrations.ts`)에서는 같은 맥락의 spec 참조가 `§9.1` 또는 `§4.1` 로 표기된다.
  - 위치: `frontend/src/app/(main)/integrations/[id]/page.tsx`, `InfoRow` prop 타입 JSDoc (`tooltip?: string` 주석, 라인 1684)
  - 상세: `§4.2` 가 실제로 "Token Expires 행" 관련 spec 섹션인지 확인이 필요하다. 일관성 없는 spec 참조는 문서 탐색 시 혼란을 유발한다.
  - 제안: spec 문서에서 실제 섹션을 확인 후 `§4.1` 또는 `§9.1` 로 통일. 다른 파일의 참조 패턴(`§4.1 헤더 정책`)을 기준으로 삼는다.

### 7. `needsAttention` 에 `autoRefresh` 가드 미적용 — 주석으로 후속 작업 표기 필요

- **[INFO]** 커밋 메시지에 "본 PR 범위 밖 — `needsAttention()` 의 autoRefresh 가드" 가 후속 PR 로 명시되어 있다. 그러나 `status-badge.tsx` 의 `needsAttention` 함수 코드에는 이 미완 상태를 알리는 주석이 없다.
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, `needsAttention` 함수 (라인 2665~2668)
  - 상세: `needsAttention` 은 현재 `autoRefresh=true` 통합도 만료 임박 시 `attention` 으로 분류한다. 헤더 배지는 올바르게 수정되었으나, 목록 뷰 필터(`?status=attention`) 및 배너 집계는 아직 이 분기를 거치지 않는다. 코드를 읽는 다음 개발자가 이 불일치를 놓칠 수 있다.
  - 제안: 함수 위에 `// TODO(후속 PR): autoRefresh=true 통합을 expiring 집계에서 제외 — plan/in-progress/integration-token-ui-autorefresh.md` 주석을 추가한다.

### 8. spec 문서 업데이트 참조가 "PR #139 / PR #142" 로 지연됨

- **[INFO]** 커밋 메시지에 spec 업데이트 작업이 "PR #139 / PR #142" 로 별도 PR 에 위임되어 있다. 현재 코드의 JSDoc 들이 `spec/2-navigation/4-integration.md §9.1` 과 `spec/1-data-model.md §2.10` 을 참조하는데, 해당 섹션이 아직 실제 spec 파일에 존재하지 않는다면 참조가 broken 상태다.
  - 위치: 전 파일 JSDoc 의 `spec/2-navigation/4-integration.md §9.1` 참조
  - 상세: 구현 PR 이 먼저 merge 되고 spec PR 이 나중에 들어오는 경우, 중간 기간 동안 코드의 spec 참조가 실제 문서와 불일치한다. 이는 이 프로젝트의 SDD 방법론(spec 선행)과도 배치된다.
  - 제안: spec PR(#139, #142)이 이 PR 보다 먼저 merge 되거나, 적어도 동시에 merge 되는 순서를 확보한다. 또는 코드 주석에 "spec §9.1 — PR #139 에서 추가 예정" 임을 명시적으로 표기한다.

---

## 요약

이번 변경은 `autoRefresh` derived 필드 도입이라는 신규 기능 추가로, 백엔드의 `ServiceDefinition`, `IntegrationDto`, `PublicIntegration` 타입과 프론트엔드의 `IntegrationDto`, `StatusView`, `computeStatus`, `humanizeUntil`, `InfoRow` 에 걸친 포괄적 변경이다. 전반적으로 문서화 수준은 양호하다 — 새로 추가된 모든 공개 필드(`autoRefresh`, `supportsTokenAutoRefresh`, `subLabel`, `humanizeUntil`, `InfoRow.tooltip`)에 JSDoc 또는 인라인 주석이 달려 있고, spec 참조도 일관되게 기재되었다. 그러나 기존에 존재하던 `pending_install`·`expired+install_timeout` 분기의 맥락 주석이 리팩토링 과정에서 삭제되어 미래 독자에게 "왜 이 순서로 진단 메시지를 선택하는가"에 대한 설명이 사라진 점이 아쉽다. 또한 `humanizeUntil` 은 export 된 공개 함수임에도 블록 JSDoc 없이 한 줄 인라인 주석만 보유하고 있으며, 여러 JSDoc 에 박제된 구체 서비스 이름 목록(`cafe24·google 만 true`)은 서비스 추가 시 쉽게 stale 해질 위험이 있다. `needsAttention` 의 미완 상태(autoRefresh 가드 미적용)에 대한 TODO 주석이 없어 불일치 원인을 추적하기 어렵고, spec 문서 업데이트가 별도 PR로 지연된 상태에서 코드가 먼저 merge 되면 spec 참조가 broken 상태가 되는 순서 문제도 주의가 필요하다.

## 위험도

LOW
