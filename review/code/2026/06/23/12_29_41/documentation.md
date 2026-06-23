# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `statistics.ts` — 공개 인터페이스에 JSDoc 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/statistics.ts` — `StatsSummary`, `ExecutionDataPoint`, `ErrorEntry`, `TopWorkflow`, `NodeStat`, `LlmUsageByModel`, `LlmUsageSummaryResponse` 인터페이스
- 상세: `dashboard.ts`와 `schedules.ts`는 각 공개 인터페이스에 `/** ... */` 단행 JSDoc을 달았으나, `statistics.ts`의 7개 인터페이스에는 주석이 없다. 모듈 상단 블록 주석은 존재하지만 개별 타입 설명이 누락됐다. 동일 파일 내 `StatisticsQueryParams`에는 인라인 주석이 있는 반면 나머지 인터페이스엔 없어 일관성이 어긋난다.
- 제안: `dashboard.ts`의 `/** GET /dashboard/summary 응답 — ... */` 패턴을 따라 각 인터페이스에 단행 JSDoc 추가. 예: `/** GET /statistics/summary 응답 — 요약 카드 지표. */`

### [INFO] `schedules.ts` — `CreateScheduleBody.name` 필드 필수 여부 주석 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/schedules.ts` — `CreateScheduleBody` 인터페이스 `name: string`
- 상세: `RawSchedule`의 `name?: string`은 선택적이나 `CreateScheduleBody`의 `name: string`은 필수다. 이 비대칭은 백엔드 계약상 이유가 있겠으나 필드 주석이 없어 호출자가 혼동할 수 있다. 특히 기존 페이지 코드에서 name은 formName 폼 상태에서 왔는데 필수 여부에 대한 안내가 없다.
- 제안: `/** @required POST 시 필수; 수정(PATCH)은 UpdateScheduleBody 사용 */` 등 간단한 주석 추가, 또는 인터페이스 레벨 JSDoc에 부연.

### [INFO] `schedules/page.tsx` — 기존 인라인 주석 내용 갱신
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/schedules/page.tsx` 라인 ~218 (삭제된 `RawSchedule` 정의 직전)
- 상세: 삭제된 `interface RawSchedule` 블록에 붙어 있던 `// Raw row shape from /schedules — only the fields we map` 주석이 `// Raw row shape from /schedules lives in lib/api/schedules (RawSchedule).` 로 갱신됐다. 변경 내용은 정확하며 독자를 올바른 위치로 안내하고 있다. 추가 조치 불필요.
- 제안: 해당 없음 (이미 적절히 처리됨).

### [INFO] `statistics/page.tsx` — 잔류 `apiClient` import가 cross-domain 목적임을 주석으로만 알림
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/app/(main)/statistics/page.tsx` 라인 ~224, `schedules/page.tsx` 라인 ~256
- 상세: `/workflows` 직접 호출에 `// /workflows: cross-domain — workflows 트랙에서 이전 예정` 주석이 추가됐다. 이 주석은 임시 잔류 이유를 잘 설명하며 후속 작업을 추적 가능하게 한다. 단, `apiClient` 임포트가 두 페이지에서 여전히 필요하지만 이 목적만을 위한 것이라는 점이 임포트 라인 자체에는 표시되지 않는다.
- 제안: 선택적으로 `import { apiClient } from "@/lib/api/client"; // TODO: /workflows cross-domain — workflows 트랙 이전 후 제거` 형태로 임포트 라인에도 TODO 주석 추가 가능. 현재도 충분히 추적 가능하므로 선택 사항.

### [INFO] 신규 `lib/api/*.ts` 파일들 — 모듈 수준 JSDoc 품질 양호, 개선 여지 소폭 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-m2-page-api/codebase/frontend/src/lib/api/dashboard.ts`, `statistics.ts`, `schedules.ts` 모듈 상단 블록 주석
- 상세: 세 파일 모두 모듈 상단에 한국어로 작성된 블록 JSDoc이 있으며, 출처 페이지·패턴·의도를 설명한다. `dashboard.ts`와 `schedules.ts`는 개별 메서드에도 `/** ... */` JSDoc이 있다. `statistics.ts`의 메서드 JSDoc도 모두 단행 형태로 존재한다. `StatisticsQueryParams` 타입의 인라인 주석은 있으나 허용값(period 값 예: `"7d"`, `"30d"`)에 대한 힌트는 없다.
- 제안: `StatisticsQueryParams` 주석에 `period` 허용값 예시 추가 선택적 고려. 예: `// period: "1d"|"7d"|"30d"|"custom"`.

### [INFO] 테스트 파일 — 문서로서의 역할 충분, 추가 주석 없어도 무방
- 위치: `dashboard.test.ts`, `schedules.test.ts`, `statistics.test.ts`
- 상세: `describe`/`it` 명세 문자열이 충분히 자체 문서화되어 있다. `fakeAxios` 헬퍼는 단순하나 주석이 없다. 테스트 파일의 mock 설정 상단 주석(`// ─── mock apiClient before importing the module under test ───`)은 hoisting 이슈를 명확히 설명한다.
- 제안: 현재 수준으로 충분. 추가 조치 불필요.

### [INFO] CHANGELOG / README 업데이트 — 프로젝트 관례상 해당 없음
- 위치: 프로젝트 루트
- 상세: 이 프로젝트는 `spec/` + `plan/` 기반의 SDD 방식으로 변경 추적을 하며 별도 CHANGELOG 파일이 없다. `plan/in-progress/refactor/02-architecture.md`의 m-2 항목이 이미 완료 상태로 갱신됐다. README 파일의 frontend API 카탈로그 섹션 업데이트는 현 변경이 내부 리팩터링이고 외부 API 계약 변경이 아닌 점에서 필수는 아니다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 frontend 페이지 컴포넌트에서 `apiClient` 직접 호출을 `lib/api/{dashboard,statistics,schedules}.ts` 카탈로그 모듈로 집중시키는 내부 리팩터링이다. 문서화 관점에서 세 신규 카탈로그 파일 모두 모듈 수준 블록 주석과 메서드별 단행 JSDoc을 갖추고 있으며, 페이지 내 잔류 cross-domain 호출에는 추적용 주석이 달려 있다. `plan/in-progress/refactor/02-architecture.md`의 상태도 완료로 갱신됐다. 유일한 일관성 흠은 `statistics.ts`의 공개 인터페이스들에 JSDoc이 없는 점이며, `dashboard.ts`·`schedules.ts`와 비교할 때 미완성으로 보인다. 나머지 발견사항은 모두 선택적 개선 수준이다.

## 위험도

LOW
