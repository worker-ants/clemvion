# 변경 범위(Scope) 리뷰

## 발견사항

### 주석 변경 — WARNING

- **[WARNING]** `status-badge.tsx`의 `pending_install` 분기에서 설명용 주석 2블록 삭제
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, diff 행 2434~2449 (`-` 라인)
  - 상세: `pending_install` 분기에 있던 "callback failure diagnostic" 안내 주석과 `expired` 분기의 "install_timeout is Cafe24-private-specific" 설명 주석이 삭제됐다. 이 주석들은 코드 동작 자체는 변경하지 않지만, 향후 유지보수 맥락을 제공하는 중요한 설명이었다. 변경 의도(autoRefresh 처리)와 직접적인 관련이 없는 삭제이며, 결과 파일의 전체 컨텍스트를 보면 두 주석 모두 누락된 상태다.
  - 제안: 삭제된 두 블록의 주석(`pending_install` 분기 진단 설명, `expired` 분기 install_timeout 설명)을 복원하거나, 삭제가 의도적이라면 commit 메시지에 명시해야 한다.

### INFO — 범위 내 주석 정리로 볼 수 있으나 추적 필요

- **[INFO]** `StatusView` 인터페이스에 `label` 필드 주석 신규 추가
  - 위치: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`, `StatusView.label` 필드
  - 상세: 기존 `label: string` 에 `/** Main status label rendered next to the colored dot. */` 주석이 추가됐다. `detail`·`subLabel` 필드에도 상세 주석이 붙은 시점이라 대칭 맞추기 목적으로 추가된 것으로 보이며, 오해를 줄이는 방향이다. 엄밀히는 현재 작업과 무관한 주석 추가이지만 해악이 없고 맥락상 자연스럽다.
  - 제안: 허용 가능. 단, 범위 문서(`plan/in-progress/...`)에 명시 없이 추가된 주석 정리임을 인지하고 RESOLUTION에 기록해두면 충분하다.

- **[INFO]** 테스트 픽스처에 `appUrl: null` 필드 추가
  - 위치: `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`, diff 행 1877~1878
  - 상세: `row()` 헬퍼의 기본값에 `appUrl: null`이 추가됐다. `IntegrationDto`에 `appUrl`은 이전 PR에서 추가된 기존 필드이며, 이번에 타입에 `autoRefresh`가 추가되면서 TypeScript 컴파일러가 필수 필드를 요구했을 가능성이 높다. 따라서 타입 정합성 유지를 위한 필수 수정으로 분류된다. 실질적 기능 변경 없음.
  - 제안: 범위 내 수정. 조치 불필요.

- **[INFO]** `integrations.service.spec.ts` 테스트 케이스 설명 불일치
  - 위치: `backend/src/modules/integrations/integrations.service.spec.ts`, 행 577
  - 상세: `'returns false for cafe24 Private 도 동일 (mall-aware refresh 가 동작 — autoRefresh=true 유지)'`라는 제목에 "returns false"로 시작하지만 내용은 `expect(result.autoRefresh).toBe(true)`를 검증한다. 테스트 로직은 올바르지만 테스트 제목이 잘못됐다.
  - 제안: 테스트 이름을 `'returns true for cafe24 Private (mall-aware refresh — autoRefresh=true)'`로 수정한다.

## 요약

변경 범위는 commit 메시지에 선언된 내용(autoRefresh derived 필드 추가, 자동 갱신 통합 UI 친화 표기)과 전반적으로 일치한다. 10개 파일 모두 autoRefresh 기능 체인(service-registry → integrations.service → DTO → frontend 타입 → status-badge → page.tsx → i18n → 테스트)을 직접 구성하는 파일이며, 관련 없는 파일이 포함되거나 불필요한 리팩토링이 수행된 흔적은 없다. 다만 `status-badge.tsx`에서 `pending_install`·`expired` 분기의 기존 설명 주석 2블록이 삭제된 점은 이번 작업의 의도 범위 밖이라 WARNING으로 분류한다. 테스트 케이스 제목 불일치(INFO)는 동작에 영향 없으나 혼란을 줄 수 있으므로 후속 수정 권장이다.

## 위험도

LOW
