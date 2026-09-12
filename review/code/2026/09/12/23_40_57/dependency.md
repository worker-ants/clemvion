# 의존성(Dependency) 리뷰

## 검토 범위

리뷰 대상 7개 파일(`CHANGELOG.md`, `codebase/backend/src/modules/auth/login-history.service.{ts,spec.ts}`,
`codebase/backend/src/modules/executions/background-runs/background-runs.service.{ts,spec.ts}`,
`plan/in-progress/keyset-cursor-uuid-validation.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)
중 `package.json`·`pnpm-lock.yaml`·`pnpm-workspace.yaml` 등 매니페스트/락파일 변경은 **없다**.
실질 코드 변경은 두 서비스 파일에서 keyset 커서의 `id` 성분을 검증하는 분기(`if (!isUuidShaped(...))`)
추가뿐이다.

## 발견사항

- **[INFO]** 새 검증 로직이 신규 외부 의존성 대신 저장소 내부 기존 유틸을 재사용한다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:8` (import), `:65` (호출) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:22` (import), `:178` (호출)
  - 상세: 두 파일 모두 `import { isUuidShaped } from '.../common/utils/uuid'` 를 추가해 기존 내부 유틸(`codebase/backend/src/common/utils/uuid.ts`, refactor 02 M-7 때 이미 shared util 로 승격된 함수)을 재사용한다. `uuid` npm 패키지나 별도 검증 라이브러리를 새로 끌어오지 않았다. 이는 8번 관점(내부 의존성)에서 바람직한 형태 — 표준 정규식 기반 자체 구현을 그대로 재사용해 5번 관점(불필요한 의존성)도 문제없다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** 산문 주석 중복 — 의존성 관점 외 사안이나 참고
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`두 커서 디코더에 같은 근거 주석이 복제됐다` 항목, developer 2026-09-12 등재)
  - 상세: 두 서비스 파일에 `isUuidShaped` 선택 근거를 설명하는 ~12줄 분량의 JSDoc성 주석이 거의 동일하게 복제되어 있다. 이는 코드 중복이 아니라 문서(주석) 중복이며, 이미 후속 plan 항목으로 등재되어 있어 별도 지적 불필요.
  - 제안: 별도 조치 불요(이미 트래킹됨).

- **[INFO]** 신규 의존성/버전 변경/라이선스/취약점/번들 크기/호환성 이슈 해당 없음
  - 위치: 전체 diff (7개 파일)
  - 상세: 이번 변경 셋에는 `package.json` 계열 파일이 포함되지 않았고, import 대상은 전부 저장소 내부 모듈(`../../common/utils/uuid`, `../../../common/utils/uuid`)이다. CHANGELOG.md 에 과거(별도 커밋) pnpm override·`next`/`nodemailer` 등 보안 패치 이력이 서술돼 있으나, 이는 이번 diff 의 변경 대상이 아니라 이미 반영된 과거 작업의 기록(문서 텍스트)이므로 이번 PR 의 의존성 위험 평가 대상이 아니다.
  - 제안: 해당 없음.

## 요약

이번 변경 셋은 keyset 커서의 `id` 성분에 대한 UUID-shape 검증을 두 서비스에 추가하는 순수 애플리케이션 로직 변경이며, 신규 외부 패키지 도입·버전 변경·락파일 재해소가 전혀 없다. 검증 로직은 이미 저장소에 존재하는 내부 유틸(`isUuidShaped`)을 그대로 재사용해 불필요한 의존성 증가나 호환성·라이선스·취약점 리스크가 발생하지 않는다. 의존성 관점에서는 지적할 결함이 없다.

## 위험도

NONE
