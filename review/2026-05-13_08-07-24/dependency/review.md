## 의존성 리뷰 결과

### 발견사항

- **[INFO]** 신규 외부 의존성 없음
  - 위치: 전체 변경 파일
  - 상세: 추가된 모든 패키지(`react-hook-form`, `zod`, `@hookform/resolvers/zod`, `axios`, `@tanstack/react-query`, `sonner`, `lucide-react`)가 이미 프로젝트에 존재하는 의존성이다. `package.json` 변경 없음.
  - 제안: 없음.

- **[WARNING]** `axiosMessage` 유틸 함수 3중 중복
  - 위치: `change-password/page.tsx:24`, `profile-info-card.tsx:36`, `profile-preferences-card.tsx:28`
  - 상세: 동일한 함수가 세 파일에 복사되어 있다. 내부 모듈 의존 관계상 향후 axios 에러 처리 정책이 바뀌면 세 곳을 모두 수정해야 하는 드리프트 리스크가 생긴다.
  - 제안: `@/lib/api/error.ts` 등 공유 유틸로 추출.

- **[INFO]** `axios` 를 `isAxiosError` 단 하나를 위해 직접 임포트
  - 위치: `change-password/page.tsx:8`, `profile-info-card.tsx:5`, `profile-preferences-card.tsx:5`
  - 상세: `apiClient`는 이미 내부적으로 axios 인스턴스를 사용하고 있다. 세 파일이 `axios` 패키지를 직접 임포트하는 이유는 `isAxiosError` 타입 가드뿐이다. 현재는 동일 버전이므로 문제 없지만, 위의 `axiosMessage` 공유 유틸로 묶으면 이 임포트도 단 한 곳으로 줄어든다.
  - 제안: `axiosMessage` 유틸 추출 시 자연히 해소됨.

- **[INFO]** `import type React from "react"` — 사용처 미확인
  - 위치: `profile-info-card.test.tsx:4`
  - 상세: 테스트 파일에서 `type React`를 임포트하고 있으나 해당 타입이 직접 쓰이는 표현식이 보이지 않는다. `renderCard` 함수 파라미터 타입은 인라인으로 선언되어 있다. 미사용 임포트는 타입 체커가 잡지 않는 경우가 있다.
  - 제안: `npm run typecheck`에서 통과된다면 무해하지만, 불필요하면 제거.

- **[INFO]** 내부 의존 그래프 — 단방향 무순환 구조 확인
  - 위치: 전체 컴포넌트 계층
  - 상세: `page.tsx` → `profile-info-card.tsx` / `profile-preferences-card.tsx` → `confirm-diff-dialog.tsx` 순의 단방향 DAG. 순환 없음. 경계도 명확하다.
  - 제안: 없음.

---

### 요약

이번 변경에서 외부 의존성 추가는 전혀 없다. 기존 프로젝트 스택(`react-hook-form`, `zod`, `@tanstack/react-query`, `sonner`, `lucide-react`, `axios`) 만을 활용해 신규 컴포넌트를 구성했고, 내부 모듈 간 의존 관계도 단방향 계층 구조로 깔끔하게 설계되었다. 주요 관찰 사항은 `axiosMessage` 함수가 세 파일에 복사된 것으로, 현재는 동작 상 문제가 없으나 향후 에러 처리 정책 변경 시 드리프트 리스크를 만들 수 있다. 공유 유틸 모듈로 추출하면 `axios` 직접 임포트 중복 문제도 함께 해소된다.

### 위험도

**LOW**