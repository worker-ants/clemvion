# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 파일 1: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`

- **[INFO]** 주석 업데이트 — 배너의 데이터 출처 차이 설명 추가
  - 위치: diff line 35-38
  - 상세: 기존 단행 주석에 2줄을 추가해 배너가 `kb.reembedStatus`(REST+WS)를, 진행 박스가 `embeddingStats`(폴링)를 본다는 의도적 불일치를 명시. `unsearchable-banner.tsx` 리팩토링 작업과 연동되어 맥락 설명으로 정당성이 있다.
  - 제안: 범위 내 허용.

### 파일 2: `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`

- **[INFO]** 테스트 확장 — `admin` 단일 케이스를 `it.each(["admin", "owner"])` 으로 교체
  - 위치: diff line 87-88
  - 상세: 기존 `admin` 역할 회귀 가드 테스트가 `owner` 역할도 포함하도록 확장됐다. `RoleGate(minRole="editor")` 가 `admin`뿐 아니라 `owner` 도 통과해야 한다는 역할 계층 검증의 자연스러운 보완이다. `setRole` 함수 시그니처가 이미 `"owner"` 를 허용하고 있으므로 불필요한 타입 변경도 없다. 추가 기능이 아니라 기존 회귀 가드의 완결성 강화.
  - 제안: 범위 내 허용.

### 파일 3: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`

- **[WARNING]** 범위를 넘는 리팩토링 — `STATE_CONFIG` 룩업 테이블 도입 + 인터페이스 이름 변경
  - 위치: 전체 컴포넌트 (diff 전체)
  - 상세: 변경의 핵심인 `reembedStatus` 타입 확장(`"idle" | "in_progress"` → 도메인 파생 `ReembedStatus`)은 정당한 범위다. 그러나 동시에 다음이 함께 수행됐다:
    1. `interface Props` → `interface UnsearchableBannerProps` 이름 변경
    2. `cn()` 유틸 추가 import, `LucideIcon` 타입 import 추가
    3. `const STATE_CONFIG` 룩업 테이블 추출 — JSX 내 `inProgress` 삼항 분기를 테이블 조회로 교체
    4. JSX 구조 단순화 (`inProgress` 변수 제거, `Icon` 동적 컴포넌트 패턴)
    5. 함수 파라미터 멀티라인 포맷팅 변경

    이 중 1·3·4·5는 버그 수정이나 `reembedStatus` 타입 확장과 직접 관련 없는 리팩토링이다. 특히 `STATE_CONFIG` 테이블 패턴과 `Icon` 동적 컴포넌트는 의미 있는 구조 변경으로, 정확성·가독성 개선 목적이지만 현 PR 범위(신호화 + 타입 확장)를 초과한다.
  - 제안: `STATE_CONFIG` 리팩토링은 원칙적으로 별도 커밋/PR로 분리하는 것이 이상적이다. 다만 기능적으로 동등하고, 테스트가 통과하며, `in_progress` 상태 처리 로직이 정확히 보존됐으므로 즉각적인 버그 위험은 없다. "범위 초과"로 기록하되 동작 정확성 문제는 없음.

## 요약

변경의 핵심은 `UnsearchableBanner` 컴포넌트의 `reembedStatus` 타입을 하드코딩된 리터럴에서 도메인 API 타입(`KnowledgeBaseData["reembedStatus"]`)으로 교체하고, 관련 테스트에 `owner` 역할 케이스를 추가하며, page.tsx 주석에 데이터 출처 불일치 설명을 추가한 것이다. 타입 교체 자체는 범위 내이고, page.tsx 주석 및 테스트 확장도 연관성이 있어 정당하다. 그러나 `unsearchable-banner.tsx` 에서 `STATE_CONFIG` 룩업 테이블 도입, `Props` 인터페이스 이름 변경, `cn()` 유틸 추가, `Icon` 동적 컴포넌트 패턴 등 직접 관련 없는 리팩토링이 함께 포함되어 변경 범위를 넘는다. 기능 동등성은 유지되어 있어 동작상 위험은 낮지만, 범위 기준으로 경고 수준이다.

## 위험도
LOW
