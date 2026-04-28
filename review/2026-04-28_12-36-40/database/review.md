### 발견사항

- **[INFO]** Offset 기반 페이지네이션 계약 (page/limit)
  - 위치: 모든 변경 파일의 API 호출부 (e.g., `knowledge-bases/page.tsx:48`, `triggers/page.tsx:84`)
  - 상세: 프론트엔드가 `page` + `limit` 파라미터를 백엔드에 전달하는 구조는 SQL 레벨에서 `OFFSET (page-1)*limit LIMIT limit`으로 변환된다. 대용량 테이블(수십만 건 이상)에서 높은 page 번호로 이동할수록 DB가 읽어야 할 row 수가 증가해 성능이 저하된다. 현재 목록들(integrations, knowledge-bases 등)은 당장 문제가 될 규모는 아니지만, 실행 이력(executions)은 누적 데이터가 많으므로 중기적으로 주의가 필요하다.
  - 제안: 단기적으로는 백엔드의 `ORDER BY` 컬럼에 복합 인덱스가 있는지 확인할 것. 장기적으로는 cursor/keyset 기반 페이지네이션 도입을 검토.

- **[WARNING]** `collections.length`를 `totalItems` 대체값으로 사용하는 fallback 계산
  - 위치: `knowledge-bases/page.tsx:54`, `llm-configs/page.tsx:68`, `schedules/page.tsx:529`, `triggers/page.tsx:120`
  - 상세: 세 번째 fallback `data?.pagination?.totalItems ?? collections.length`에서 `collections.length`는 **현재 페이지에 담긴 아이템 수**다. 예를 들어 서버가 `pagination` 블록 없이 items 20개만 반환하면 `totalPages = Math.ceil(20 / 20) = 1`로 계산되어 2페이지 이후가 숨겨진다.
  - 제안: 마지막 fallback을 `collections.length`가 아닌 `Infinity`(혹은 다음 페이지 버튼 활성 유지)로 처리하거나, 백엔드가 항상 `pagination` 객체를 반환하도록 계약을 강제하는 편이 안전하다.

- **[INFO]** 필터 변경 시 page 리셋 누락 (schedules 페이지)
  - 위치: `schedules/page.tsx` (diff 전체)
  - 상세: `triggers/page.tsx`에는 탭·상태 필터 변경 시 `setPage(1)` 리셋이 추가되어 있지만(`+onClick={() => { setActiveTab(tab); setPage(1); }}`), `schedules/page.tsx`에는 동일한 패턴이 없다. 검색 필터가 추가되면 page가 리셋되지 않아 빈 결과를 보여줄 수 있다.
  - 제안: `schedules/page.tsx`의 검색·필터 변경 핸들러에도 `setPage(1)` 추가.

---

### 요약

변경된 파일들은 순수 프론트엔드 레이어(UI 컴포넌트, 훅, 페이지)이므로 직접적인 DB 스키마·트랜잭션·인덱스 변경은 없다. 데이터베이스 관점에서의 실질적 위험은 하나다: `pagination` 블록이 없는 레거시 API 응답에서 `collections.length`를 `totalItems` 대체값으로 쓰는 fallback 로직이 totalPages를 과소 계산해 2페이지 이후 데이터를 노출하지 않을 수 있다. offset 기반 페이지네이션의 대용량 스캔 비용은 현 도메인 규모에서는 낮지만 executions 테이블은 모니터링이 필요하다.

### 위험도
**LOW**