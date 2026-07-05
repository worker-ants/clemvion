# 의존성(Dependency) 리뷰 — trigger-param-type-consolidate

## 발견사항

- **[INFO]** 새 외부 패키지 없음, 순수 내부 타입 리팩터
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` (`TriggerParameterType`, `TriggerParameterDefinition` 신설), `trigger-configs.tsx`, `rerun-modal.tsx`
  - 상세: 이번 변경은 `package.json` 등 의존성 매니페스트 변경이 전혀 없고, 두 소비처에 각각 중복 정의돼 있던 로컬 타입(`TriggerParameter` in trigger-configs.tsx / `ParamType`+`TriggerParameterDefinition` in rerun-modal.tsx)을 `lib/api/triggers.ts` 한 곳으로 단일화(canonical화)한 것뿐이다. 런타임 동작 변화 없음(type-only import, `import type`). 버전 고정·라이선스·취약점·번들 크기 항목은 해당 없음(N/A).
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 관계 — import 방향 적절
  - 위치: `trigger-configs.tsx:6`, `rerun-modal.tsx:31-34`
  - 상세: 두 UI 컴포넌트(`components/editor/settings-panel/node-configs/trigger-configs.tsx`, `components/executions/rerun-modal.tsx`)가 모두 `@/lib/api/triggers`를 `import type`으로 참조하는 단방향 구조다. `lib/api/*` → `components/*` 로 향하는 역방향 참조는 없음을 확인했다(`lib/api/triggers.ts`는 `./client`, `./paginated`만 import). `lib/api`가 도메인 타입의 canonical 홈이 되고 두 UI 계층(에디터 설정 패널, 실행 이력 rerun 모달)이 그 아래에서 소비하는 것은 프로젝트의 기존 계층 구조(`lib/api/executions.ts` 등도 동일 패턴)와 일치하는 정상적인 방향이다.
  - 제안: 없음(그대로 유지).

- **[INFO]** 순환 의존(circular dependency) 없음 확인
  - 위치: `lib/api/triggers.ts` ↔ `trigger-configs.tsx` / `rerun-modal.tsx`
  - 상세: `trigger-configs.tsx`, `rerun-modal.tsx` 어느 쪽도 `lib/api/triggers.ts`에서 역참조되지 않는다. `grep -rln "trigger-configs\|rerun-modal" lib/api/` 결과 `triggers.ts` 자체가 매치됐으나 이는 JSDoc 주석 내 텍스트("에디터 trigger-configs·Re-run 모달 공용")일 뿐 실제 import 문이 아님을 라인 단위로 확인(triggers.ts:18, 주석). 두 컴포넌트 간 직접 의존도 없음(서로 import하지 않음, 공통 타입만 공유). 그래프는 `components/* → lib/api/triggers.ts → lib/api/{client,paginated}` 트리 형태로, cycle 없음.
  - 제안: 없음.

- **[INFO]** backend 타입과의 shape 정합 — 크로스 레이어 의존 아님(의도적 중복)
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` vs `codebase/frontend/src/lib/api/triggers.ts`
  - 상세: 두 `TriggerParameterDefinition` 인터페이스는 이름·필드가 동일(`name/type/required?/defaultValue?/description?`)하지만 backend 는 실제 코드 의존(import) 없이 프런트가 spec(0-common §1)을 근거로 독립 재정의한 것이다. frontend가 backend 소스를 import하는 구조가 아니므로 모노레포 계층 경계(frontend는 backend 코드를 직접 import하지 않는다는 원칙) 위반이 아니다. 다만 `type` 필드의 union이 frontend는 리터럴 5종 하드코딩, backend는 `CoercibleType` alias 참조라 두 정의가 향후 벌어질 경우(backend 타입 확장 시) 프런트가 자동으로 따라가지 못하는 소극적 결합(느슨한 동기화, 코드로 강제되지 않음)이 존재한다.
  - 제안: 현재로선 문제 없음(둘 다 5-값 enum이고 spec이 SoT). 이후 `CoercibleType`이 확장될 경우 프런트 `TriggerParameterType`도 함께 갱신해야 한다는 점을 `lib/api/triggers.ts`의 기존 JSDoc(이미 "backend ... 와 이름·shape 정합"이라고 명시)에 이어서 참고하면 충분 — 별도 조치 불필요.

- **[INFO]** plan 문서 변경(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`)
  - 위치: 파일 4
  - 상세: 코드/설정 파일이 아닌 작업 추적 문서 갱신(체크박스 완료 표시)으로, 의존성 관점에서 검토 대상 아님.
  - 제안: 없음.

## 요약

이번 변경은 새 외부 패키지 도입이 전혀 없는 순수 TypeScript 타입 리팩터(중복 로컬 타입 3곳 → `lib/api/triggers.ts` 단일 canonical 타입)이며, 버전 고정·라이선스·취약점·번들 크기 항목은 해당 사항이 없다(N/A). 내부 모듈 의존성 관점에서는 두 UI 컴포넌트(`trigger-configs.tsx`, `rerun-modal.tsx`)가 `lib/api/triggers.ts`를 `import type`으로 단방향 참조하는 구조로, 기존 `lib/api/*` 계층 관례와 일치하며 역방향 참조나 순환 의존은 발견되지 않았다(직접 확인 완료). backend `trigger-parameter.types.ts`와는 import 관계가 아닌 독립적 shape 재정의(의도적 정합)이므로 계층 경계 위반도 아니다. 전반적으로 의존성 리스크는 없다.

## 위험도

NONE
