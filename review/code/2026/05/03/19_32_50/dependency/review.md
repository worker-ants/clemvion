### 발견사항

- **[INFO]** `conversation-inspector.tsx` 에 `output-shape.ts` 신규 내부 의존성 추가
  - 위치: `conversation-inspector.tsx:9` — `import type { RagSource } from "./output-shape";`
  - 상세: 동일 디렉터리 내 유틸 모듈 임포트이므로 순환 의존 위험은 없음. 단, Conversation UI 컴포넌트가 출력 스키마 파싱 레이어에 직접 타입 의존하게 됨.
  - 제안: 현재 구조(같은 `run-results/` 폴더)에서는 수용 가능. 단, `RagSource` 가 도메인 공용 타입으로 성장할 경우 별도 `types.ts`로 분리하면 역방향 결합을 예방할 수 있음.

- **[INFO]** `result-detail.tsx` 에서 `useEffect`, `useRef` 추가 임포트
  - 위치: `result-detail.tsx:1`
  - 상세: React에서 이미 제공하는 훅으로 외부 패키지 추가 없음. 기존 `import { useCallback, useState }` 에 두 훅 추가된 것.
  - 제안: 해당 없음.

- **[INFO]** 신규 외부 패키지 없음 확인
  - 위치: 전체 diff
  - 상세: `package.json` 변경 없음. 모든 새 임포트는 React 내장 훅 또는 동일 프로젝트 내부 모듈. 번들 사이즈·빌드 시간·라이선스·취약점 측면의 위험 없음.

---

### 요약

이번 변경은 신규 외부 패키지를 전혀 도입하지 않았다. 백엔드는 기존 `RagAccumulator`를 재사용해 turn-level 누적기를 추가했고, 프론트엔드는 React 내장 훅(`useEffect`, `useRef`)과 동일 폴더 내 `output-shape.ts`에서 타입만 끌어다 쓴다. `conversation-inspector.tsx`가 `output-shape.ts`에 새로 의존하는 점이 유일한 내부 결합 추가이나, 두 파일이 같은 `run-results/` 디렉터리에 위치하고 단방향(UI → 파서) 구조여서 현재 규모에서는 적절하다.

### 위험도

**NONE**