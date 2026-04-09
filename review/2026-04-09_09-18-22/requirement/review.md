### 발견사항

---

**[WARNING]** `waiting_for_input` 상태 필터 버튼 요구사항 미충족
- 위치: `spec/2-navigation/6-execution-history.md` §2.3 vs 구현 `executions/page.tsx`
- 상세: Spec §2.3 필터 테이블에 `Waiting (waiting_for_input)` 항목이 명시되어 있으나, 구현의 `FILTER_BUTTONS` 배열에 누락. `STATUS_LABEL`에는 해당 상태가 정의되어 있어 표시 인프라는 존재하지만 필터 기능이 빠짐.
- 제안: `{ label: "Waiting", value: "waiting_for_input" }` 항목을 `FILTER_BUTTONS`에 추가

---

**[WARNING]** API Error와 Not Found 상태를 구분하지 않음
- 위치: `spec/2-navigation/6-execution-history.md` §3.5 vs `[executionId]/page.tsx`
- 상세: Spec §3.5에서 두 상태를 명확히 구분:
  - `API Error` → "Failed to load execution. Please try again." + Back 버튼
  - `Not Found` → "Execution not found." + Back 버튼
  
  현재 구현은 API 호출 실패(`isError`) 시에도 "Execution not found." 메시지를 표시하여 사용자가 네트워크 장애인지 데이터 부재인지 판단 불가.
- 제안: `executionQuery.isError` 체크를 별도 분기로 처리하여 에러 원인에 따른 메시지 구분

---

**[WARNING]** `adjacentQuery` currentIndex === -1 시 잘못된 항목 반환
- 위치: `spec/2-navigation/6-execution-history.md` §3.6 vs `[executionId]/page.tsx:137-143`
- 상세: Spec은 "같은 워크플로우의 시간 순서 기준으로 이전/다음 실행으로 이동"을 요구. 현재 실행이 조회된 100건 목록에 없을 때(`currentIndex === -1`), `items[-1 + 1]` = `items[0]`이 반환되어 엉뚱한 실행을 "다음"으로 표시하는 오작동 발생.
- 제안:
  ```ts
  if (currentIndex === -1) return { prev: null, next: null };
  ```

---

**[WARNING]** Spec 화면 구성과 테이블 정의 간 `Trigger` 컬럼 불일치
- 위치: `spec/2-navigation/6-execution-history.md` §2.1(ASCII art) vs §2.4(테이블 정의)
- 상세: §2.1 화면 구성 ASCII art에는 `Trigger` 열이 명시(`│ Trigger        │`)되어 있으나, §2.4 테이블 정의에서는 `Status`, `Started At`, `Duration`, `Nodes` 4개 컬럼만 정의하여 `Trigger` 컬럼이 누락. 구현에서 어느 쪽을 따랐는지 기준이 불명확.
- 제안: §2.4 테이블 정의에 `Trigger` 컬럼 추가 또는 §2.1 ASCII art에서 `Trigger` 제거하여 스펙 내부 일관성 확보

---

**[WARNING]** Preview 탭 노드 유형별 렌더링 구현 여부 불명확
- 위치: `spec/2-navigation/6-execution-history.md` §3.4
- 상세: Spec §3.4는 노드 유형별 Preview 탭 렌더링을 상세히 정의:
  - Presentation 노드(carousel, table, chart, template 등): 에디터 실행 시와 동일한 시각적 렌더링
  - 버튼 노드: `buttonConfig.buttons`에서 전체 버튼 목록, 선택된 버튼 하이라이트
  - AI Agent 노드: 채팅 스레드 형태
  - 일반 노드: 상태 + Duration 표시
  
  현재 구현의 Preview 탭이 이 요구사항을 충족하는지 테스트 코드로 검증되지 않았으며, 리뷰어들도 "NodeResultsTab input/output/error 탭 전환 테스트 없음"만 지적.
- 제안: 각 노드 유형별 Preview 탭 렌더링 테스트 추가 및 구현 검토

---

**[WARNING]** 기본 선택 탭 로직 구현 여부 미검증
- 위치: `spec/2-navigation/6-execution-history.md` §3.3
- 상세: Spec §3.3에서 노드 상세의 기본 선택 탭을 명시: "outputData가 있으면 Preview, 에러면 Error, 그 외 Output". 현재 side_effect 리뷰어가 Timeline에서 노드 클릭 시 `nodeDetailTab`이 초기화되지 않는 이슈를 발견 — 에러가 없는 노드에서 에러 있는 노드로 이동 시 이전 "error" 탭이 유지될 수 있어 Spec의 기본 탭 선택 요구사항과 충돌.
- 제안: `onNodeClick` 핸들러에서 선택된 노드의 상태에 따라 `nodeDetailTab`을 스펙 정의대로 초기화

---

**[INFO]** Prev/Next 네비게이션의 100건 제한이 Spec에 미정의
- 위치: `spec/2-navigation/6-execution-history.md` §3.6 vs `[executionId]/page.tsx:128`
- 상세: Spec §3.6은 이전/다음 네비게이션 기능만 정의하고 구현 방식에 대한 제약은 없음. 현재 `limit: 100`으로 전체를 조회하는 방식은 100건 초과 시 네비게이션이 실패하는 기능적 버그를 내포하지만 Spec에서 이 한계를 명시하지 않아 요구사항 미충족에 해당.
- 제안: Spec §3.6에 구현 한계를 명시하거나, 백엔드에 adjacent 엔드포인트 추가를 Spec에 반영

---

**[INFO]** 페이지네이션 방식 Spec 미정의
- 위치: `spec/2-navigation/6-execution-history.md` §2.6
- 상세: §2.6에서 "이전/다음 버튼 + 페이지 번호 버튼"으로만 명시. 현재 구현은 `Array.from({ length: totalPages })`로 모든 페이지를 렌더링하는 방식인데, 다수 리뷰어가 `totalPages`가 많을 때 UI 파손을 경고. Spec에서 슬라이딩 윈도우 방식 여부가 명확히 정의되지 않아 구현 기준 부재.
- 제안: Spec §2.6에 "현재 페이지 ±2 범위 + 처음/마지막" 등 구체적 페이지네이션 방식 명시

---

### 요약

핵심 기능(실행 내역 조회, 상세 보기, 노드 결과 탐색)은 Spec과 대체로 일치하나, `waiting_for_input` 필터 버튼 누락, API Error와 Not Found 미구분, `currentIndex === -1` 엣지 케이스의 잘못된 네비게이션 반환, Timeline 경유 노드 클릭 시 탭 초기화 미흡은 Spec 요구사항을 직접적으로 위반한다. 특히 Spec 자체의 내부 불일치(`Trigger` 컬럼의 ASCII art vs 테이블 정의 불일치)와 prev/next 네비게이션의 100건 제한에 대한 Spec 미정의는 구현 기준의 모호성을 초래한다. Preview 탭의 노드 유형별 렌더링 요구사항(§3.4)이 복잡하고 상세하게 정의되어 있지만 이에 대한 테스트 커버리지가 전무한 점도 요구사항 검증 관점에서 위험하다.

### 위험도

**MEDIUM**