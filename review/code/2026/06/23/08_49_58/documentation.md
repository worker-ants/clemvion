# 문서화(Documentation) 리뷰 결과

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `triggersApi.delete` JSDoc 적절
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m8-trigger-drawer/codebase/frontend/src/lib/api/triggers.ts` — `delete` 메서드
  - 상세: `/** DELETE /triggers/:id — 트리거 삭제 (Spec §3). cascade(schedule·notification·interaction)는 backend. */` — spec 참조와 cascade 부담 명시. 신설 메서드치고 적절한 수준.
  - 제안: 없음.

- **[INFO]** `triggersApi.getHistory` JSDoc 적절
  - 위치: 동 파일 `getHistory` 메서드
  - 상세: 배열 root / `{ items }` envelope 정규화 동작, R-6/R-7 한정 사용 맥락이 명시돼 있어 소비자가 drawer 에서의 호출 금지를 파악할 수 있다.
  - 제안: `params` 파라미터의 `limit` 기본값 부재(undefined 시 backend 기본값에 위임)를 JSDoc 에 한 줄 추가하면 더 명확하지만 필수 수준은 아님.

- **[INFO]** `TriggerDeleteDialog` JSDoc 내용 여전히 정확
  - 위치: `trigger-delete-dialog.tsx` L122–135
  - 상세: "캐시 무효화 책임" 블록이 `triggersApi.delete` 이후에도 그대로 유효하다. import 교체만 이뤄졌으므로 주석 갱신 불필요.
  - 제안: 없음.

- **[INFO]** `TriggerHistoryDialog` JSDoc 내용 여전히 정확
  - 위치: `trigger-history-dialog.tsx` L369–377 (컴포넌트 JSDoc)
  - 상세: spec 참조(`§2.1`, `R-6`)와 usage 제약("풀 상세 보기로 승격하려면 푸터의 `onOpenFullDetail`") 설명이 변경된 구현과 일치한다.
  - 제안: 없음.

### 인라인 주석 정확성

- **[INFO]** `trigger-history-dialog.tsx` — 이전 인라인 `res.data.data ?? res.data` / `Array.isArray` 로직이 제거되고 `triggersApi.getHistory` 호출로 대체됐다. 관련 인라인 주석 자체가 없었으므로 오래된 주석 잔류 문제 없음.
  - 제안: 없음.

- **[INFO]** `trigger-delete-dialog.tsx` L155 — `// 동시 삭제 시 404 — 결과적으로는 이미 사라졌으므로 silent invalidate + 안내 1회.` 는 `triggersApi.delete` 변경 후에도 의미가 유지된다.
  - 제안: 없음.

### 테스트 문서화

- **[INFO]** `triggers.test.ts` 새 `describe` 블록 이름("triggersApi.getHistory — array/envelope normalization")이 정규화 동작을 명확히 설명하며, 각 `it` 케이스도 예상 시나리오를 자명하게 서술한다.
  - 제안: 없음.

### API 문서 / Spec 등재

- **[WARNING]** `lib/api/triggers.ts` 가 `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 에 미등재 (consistency 보고서 W-2와 동일 지적)
  - 위치: `spec/2-navigation/2-trigger-list.md` frontmatter
  - 상세: 신설 typed API 카탈로그 파일이 spec-impl 트레이서빌리티 목록에 없다. `spec/conventions/spec-impl-evidence.md` 등재 의무 미충족. developer 가 직접 spec 을 수정할 수 없으므로 project-planner 위임이 필요하며 이는 비차단이지만 누락 시 이후 spec-coverage 감사에서 지속 재보고된다.
  - 제안: project-planner 세션에서 `code:` 목록에 `codebase/frontend/src/lib/api/triggers.ts` 추가.

- **[INFO]** `TriggerListParams` 에 `search`/`sort`/`order` 파라미터 누락 — spec §3 계약과 부분 불일치 (consistency 보고서 W-1 재확인)
  - 위치: `codebase/frontend/src/lib/api/triggers.ts` `TriggerListParams` 인터페이스
  - 상세: 현재 인터페이스 JSDoc(`/** GET /triggers 쿼리 파라미터 (Spec §3). type/status 는 허용 enum 으로 제한. */`)이 생략된 필드를 언급하지 않아 소비자가 spec §3 의 전체 파라미터 목록을 알 수 없다. 의도적 생략인지 단순 미반영인지 불분명.
  - 제안: 인터페이스 JSDoc 에 `// 현재 클라이언트는 search/sort/order 미전송 — spec §3 참고` 주석을 추가하거나, `search?: string; sort?: string; order?: "asc" | "desc"` 선택적 필드를 인터페이스에 포함.

### README / CHANGELOG

- **[INFO]** 이번 변경은 내부 리팩터(API 직접 호출 → typed 카탈로그 경유)이며 외부 사용자 노출 API 는 변경되지 않았다. README 또는 CHANGELOG 업데이트 대상 아님.
  - 제안: 없음.

### 설정 문서

- **[INFO]** 새 환경변수·설정 옵션 추가 없음. 설정 문서 업데이트 불필요.

### 예제 코드

- **[INFO]** `triggersApi.getHistory` 는 제네릭(`<T>`)을 수용하는 공개 함수다. 소비자(`trigger-history-dialog.tsx`)에서 `triggersApi.getHistory<TriggerHistoryEntry>(triggerId, { limit })` 호출 예가 이미 실 코드에 존재하므로 별도 예제 불필요.
  - 제안: 없음.

### plan 문서

- **[INFO]** `plan/in-progress/refactor/02-architecture.md` M-8 1단계 항목이 이번 커밋에서 `getHistory`/`delete` 포함 전체 커버리지로 갱신됐다. 내용이 실제 구현과 일치한다.
  - 제안: 없음.

---

## 요약

이번 변경(`triggersApi.delete` / `getHistory` 신설 + 두 다이얼로그 이전)은 전반적으로 문서화 품질이 양호하다. 신설 메서드에는 spec 참조와 동작 제약이 명시된 JSDoc 이 있고, 기존 컴포넌트 주석은 구현 변경 후에도 여전히 정확하다. 유일하게 조치가 필요한 사항은 `lib/api/triggers.ts` 의 spec frontmatter `code:` 미등재(W-2, project-planner 위임)와 `TriggerListParams` 의 의도적 생략 미주석(INFO) 두 가지이며, 둘 다 비차단 수준이다.

## 위험도

LOW
