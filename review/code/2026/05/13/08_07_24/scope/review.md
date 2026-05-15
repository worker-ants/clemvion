## 발견사항

### [INFO] `axiosMessage` 함수 3중 복제
- **위치**: `change-password/page.tsx:24`, `profile-info-card.tsx:34`, `profile-preferences-card.tsx:31`
- **상세**: 동일한 함수가 신규 3개 파일에 각각 복사되어 있음. 계획서에 공유 유틸리티 추출이 명시되지 않아 범위 위반은 아니나, 단일 `lib/api/errors.ts` 등으로 빼기 적절한 시점.
- **제안**: 현재로서는 허용 가능. 후속 리팩토링 follow-up 항목으로 추적.

---

### [INFO] `isError || !user` 가드 추가 — 계획서 미명시 변경
- **위치**: `profile/page.tsx:57`
- **상세**: 원래 `isError` 단독 체크에서 `isError || !user`로 변경. 계획서에 명시되지 않은 방어적 개선이나 `useQuery`가 `undefined`를 반환하는 엣지 케이스(stale-while-revalidate 중 오류)를 막는 타당한 수정.
- **제안**: 범위 이탈보다는 부수적 버그 수정으로 수용. 문제없음.

---

### [INFO] `import type React` 미사용 임포트
- **위치**: `profile-info-card.test.tsx:4`
- **상세**: `import type React from "react";`가 선언되어 있으나 테스트 파일에서 직접 참조되지 않음. 최신 JSX Transform 환경에서 불필요.
- **제안**: 해당 라인 제거.

---

### [WARNING] `eslint-disable-next-line react-hooks/exhaustive-deps` 억제
- **위치**: `profile-preferences-card.tsx:148`
- **상세**: `useMemo` deps에 `themeLabel`, `localeLabel` 함수가 누락되어 있고 eslint 경고를 억제로 처리. 두 함수는 `t`에만 의존하며 `t`가 deps에 포함되어 있으므로 실질적 stale closure 위험은 낮음. 그러나 eslint suppress는 관행적으로 기술 부채 신호.
- **제안**: `themeLabel`, `localeLabel`을 컴포넌트 외부로 이동하고 `t`를 인자로 받는 순수 함수로 추출하면 deps 문제와 suppression 모두 해소됨. 단, 현재 범위에서 필수 수정은 아님.

---

### [INFO] `executions-list-test-regression.md` 신규 plan 파일
- **위치**: `plan/in-progress/executions-list-test-regression.md`
- **상세**: `profile-safer-edit` 범위와 무관한 workflows 영역 회귀 버그 추적 문서. 본 브랜치 작업 중 발견한 사전 존재 버그를 별도 plan으로 격리한 것은 올바른 관행. 코드 변경 없음, 문서만 추가.
- **제안**: 원칙적으로 profile-safer-edit 브랜치 범위 외 파일이나, 손실 방지 목적의 문서이므로 허용 가능.

---

## 요약

변경사항 전체가 계획서(`plan/in-progress/profile-safer-edit.md`) Phase 1~2에 명시된 범위(spec 갱신, 신규 컴포넌트 4종 + 테스트, page.tsx 조립, i18n 14키 추가)를 충실히 이행하고 있다. 명시적 비범위인 백엔드 변경 및 2FA/세션 페이지에는 손대지 않았다. `isError || !user` 가드처럼 부수적 방어 개선이 소수 포함되어 있으나 기능 확장이나 불필요한 리팩토링에 해당하지 않는다. 주요 잠재 문제는 `axiosMessage` 3중 복제(DRY 부채)와 `profile-preferences-card`의 `eslint-disable` 억제(themeLabel/localeLabel 함수 deps 누락)이며, 두 항목 모두 런타임 오류보다는 유지보수 품질 이슈다.

## 위험도

**LOW**