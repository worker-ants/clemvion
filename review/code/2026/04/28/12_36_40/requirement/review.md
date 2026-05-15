## 발견사항

### [WARNING] `llm-configs/page.tsx` — `const` 선언이 `import` 블록 사이에 위치
- **위치**: `llm-configs/page.tsx`, `const PAGE_SIZE = 20;` 라인
- **상세**: ESM 규칙상 `import` 구문은 모듈 최상단에 모여야 한다. `const PAGE_SIZE = 20;`가 `import { toast }` 뒤, `import { Plus, ... }` 앞에 삽입돼 있어 ESLint `import/first` 규칙 위반이며 TypeScript strict 모드 빌드 시 오류 가능성이 있다.
- **제안**: `PAGE_SIZE` 상수를 모든 `import` 뒤로 이동.

---

### [WARNING] 스펙 문서에 Integrations · Executions 엔드포인트 페이지네이션 기술 누락
- **위치**: `spec/2-navigation/` 디렉토리
- **상세**: `integrations/page.tsx`와 `workflows/[id]/executions/page.tsx`는 이번 변경에서 페이지네이션이 적용됐지만, 대응하는 Spec 문서 (`spec/2-navigation/4-integration.md` 등) 에 API 쿼리 파라미터(`page`, `limit`) 및 응답 형식이 추가되지 않았다. 나머지 6개 엔드포인트는 스펙이 업데이트된 것과 불일치한다.
- **제안**: `spec/2-navigation/` 내 integrations 스펙 및 executions 관련 스펙에 동일한 패턴으로 API 규약 참조를 추가.

---

### [WARNING] 마지막 아이템 삭제 후 빈 페이지에 고립되는 시나리오
- **위치**: `knowledge-bases/page.tsx`, `llm-configs/page.tsx` (createMutation/deleteMutation의 `onSuccess`)
- **상세**: page=3에서 마지막 아이템을 삭제하면 `invalidateQueries` 후 page=3 재요청 시 빈 배열이 반환된다. `collections.length === 0` 상태로 빈 상태 UI가 노출되고 페이지네이션도 숨겨지지만, URL의 `?page=3`은 그대로 남는다. 새로고침하면 동일한 빈 페이지가 유지된다.
- **제안**: deleteMutation의 `onSuccess`에서 현재 페이지에 아이템이 1개였을 경우 `setPage(Math.max(1, page - 1))` 호출.

---

### [WARNING] Schedules 캘린더 뷰에서 페이지네이션 데이터 불완전
- **위치**: `schedules/page.tsx`, 캘린더 뷰 분기(`viewMode === "calendar"`)
- **상세**: `schedulesQuery`는 `page` 파라미터를 포함해 서버에서 `PAGE_SIZE=20`개만 가져온다. 리스트 뷰는 페이지 단위로 표시하지만, 캘린더 뷰는 이 동일한 쿼리 데이터를 사용하므로 전체 스케줄이 아닌 현재 페이지 스케줄만 캘린더에 표시된다. 21번째 이후 스케줄은 캘린더에서 보이지 않는다.
- **제안**: 캘린더 뷰 전용 별도 쿼리(limit 없이 전체 조회) 사용 또는 뷰 전환 시 현재 페이지 제한을 안내.

---

### [INFO] `items.length` 폴백이 동일 버그 패턴을 공유
- **위치**: `knowledge-bases/page.tsx`, `llm-configs/page.tsx`, `schedules/page.tsx`, `triggers/page.tsx`의 `totalPages` 계산
- **상세**: 최종 폴백이 `items.length / PAGE_SIZE`로, 현재 페이지의 아이템 수(최대 PAGE_SIZE)를 기준으로 계산한다. `pagination` 객체가 아예 없는 레거시 API라면 전체 아이템을 한 번에 반환하므로 무해하다. 그러나 페이지네이션 객체 없이 부분 데이터만 반환하는 API라면 `totalPages=1`로 잘못 계산된다. `workflows/page.tsx`의 테스트가 바로 이 패턴을 회귀 테스트로 추가한 것과 대조적이다.
- **제안**: 비슷한 회귀 테스트를 knowledge-bases, llm-configs, schedules, triggers 각각에도 추가.

---

### [INFO] Executions 페이지는 URL 파라미터가 아닌 로컬 상태로 페이지 관리
- **위치**: `workflows/[id]/executions/page.tsx`, `const [page, setPage] = useState(1)`
- **상세**: 다른 목록 페이지들은 `usePageParam`으로 URL에 페이지 상태를 저장하지만, executions 페이지는 로컬 `useState`를 사용한다. 새로고침하거나 링크를 공유하면 page=1로 돌아간다. 워크플로우 하위 페이지라는 컨텍스트에서 의도적인 설계일 수 있으나, UX 일관성 관점에서 다른 페이지와 차이가 있다.
- **제안**: 기존 동작을 의도적으로 유지한다면 주석으로 이유를 명시. URL 공유가 필요하다면 `usePageParam` 전환 검토.

---

## 요약

이번 변경은 공용 `Pagination` 컴포넌트와 `usePageParam` 훅을 신설하고 7개 목록 페이지에 일관성 있게 적용한 점에서 요구사항 구현 방향은 올바르다. 핵심 로직(페이지 파싱/검증, 엘립시스 렌더링, 필터 변경 시 페이지 리셋)은 대체로 충족되며 단위 테스트도 주요 엣지 케이스를 커버한다. 다만 `llm-configs`의 import 순서 오류(빌드 파이프라인 위험), integrations/executions 스펙 누락(spec-code 정합성), 아이템 삭제 후 빈 페이지 고립, schedules 캘린더 뷰의 데이터 불완전성이 수정 없이 남아 있다.

## 위험도

**MEDIUM** — 빌드 파이프라인 위험(`import` 순서)과 스펙 불일치가 즉시 수정이 필요한 수준이며, 삭제 후 빈 페이지 고립은 사용자 경험에 직접 영향을 준다. 데이터 파괴나 보안 취약점은 없다.