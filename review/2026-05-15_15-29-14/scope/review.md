### 발견사항

---

**[WARNING]** `cancelled` 상태가 타입에 정의되어 있으나 실제로 생성되는 코드 경로 없음

- 위치: `background-run-response.dto.ts` · `executions.ts` (frontend) · `background-runs.service.ts`
- 상세: `BackgroundRunStatus`에 `'cancelled'`가 포함되지만 `deriveBackgroundRunStatus()`는 `pending/running/completed/failed`만 반환하고, `BackgroundExecutionProcessor`도 해당 값을 emit하지 않는다. 실제 `maxDurationMs` 초과 처리도 현재 구현에서는 timeout 후 throw로 `failed`로 처리된다.
- 제안: 실제 cancelled 처리 로직이 구현될 때 타입을 추가하거나, 현재는 타입에서 제거 후 구현 시 함께 도입한다.

---

**[WARNING]** `QueryBackgroundRunDto` JSDoc과 실제 cursor 직렬화 형식 불일치

- 위치: `query-background-run.dto.ts:9` (JSDoc 주석) vs `background-runs.service.ts` `CursorPayload`
- 상세: DTO 주석은 `{ lastCreatedAt, lastId }`를 직렬화한다고 설명하지만, 실제 서비스는 `{ s: startedAt, i: id }` 형식을 사용한다.
- 제안: 주석을 `{ s: lastStartedAt (ISO8601), i: lastId }` 또는 실제 필드명으로 수정.

---

**[INFO]** `NodeExecutionsList`의 무의미한 `useMemo`

- 위치: `background-run-section.tsx:199`
- 상세: `const sorted = useMemo(() => nodes, [nodes]);`는 변환 없이 `nodes`를 그대로 반환한다. 정렬·필터 같은 실제 연산이 없어 불필요한 코드이다.
- 제안: `sorted` 제거 후 직접 `nodes`를 사용.

---

**[INFO]** 테스트 편의를 위한 서비스 모듈에서 엔티티 re-export

- 위치: `background-runs.service.ts:403` — `export { NodeExecutionStatus };`
- 상세: 서비스 파일이 테스트 편의용으로 엔티티 enum을 re-export하고 있다. 테스트는 원래 위치(`node-execution.entity`)에서 직접 import할 수 있으며, 서비스 API 표면을 불필요하게 확장한다.
- 제안: re-export 제거. 테스트에서 직접 import 경로 사용.

---

**[INFO]** `plan/in-progress/background-monitoring-api.md`의 § 1 API 설계 체크박스 미갱신

- 위치: `plan/in-progress/background-monitoring-api.md` — `### 1. API 설계` 섹션
- 상세: 섹션 2·3·4는 `[x]`로 완료 표기됐으나, 섹션 1의 엔드포인트·응답스키마·권한·WebSocket 항목이 모두 `[ ]`로 남아 있다. 계획 라이프사이클 규약상 미체크 항목이 있으면 `in-progress/` 유지가 맞지만, 이미 결정·구현 완료된 사항이므로 plan 문서가 실제 상태를 반영하지 못하고 있다.
- 제안: 구현이 완료된 설계 결정들(`[ ]` → `[x]`)을 갱신. 섹션 5(매뉴얼) 일부와 섹션 6(review)만 미완인 상태가 정확한 현황.

---

### 요약

전반적으로 변경 범위는 Background 본문 모니터링 API 구현이라는 의도에 집중되어 있다. 백엔드 API·마이그레이션·WebSocket 채널·프론트엔드 컴포넌트·스펙·문서 모두 해당 기능의 직접 구현물이며, 관련 없는 파일 수정이나 무관한 리팩토링은 없다. 다만 실제 코드 경로가 없는 `cancelled` 상태 타입 선언, JSDoc과 구현 간 cursor 필드명 불일치, 무의미한 `useMemo`, 서비스 파일 내 테스트용 re-export, plan 문서 체크박스 미갱신 등 소규모 일관성 문제가 발견된다.

### 위험도

**LOW**