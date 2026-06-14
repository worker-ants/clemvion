# Documentation Review — impl-schedule-gaps (§2.2 timezone fallback backend)

## 발견사항

### 독스트링/JSDoc

- **[INFO]** `resolveTimezone` 프라이빗 메서드에 JSDoc 이 있으나 `@param`/`@returns` 태그 없이 산문만 작성됨
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` lines 469–483
  - 상세: `§2.2` spec 참조는 명확하나, 파라미터 의미(`explicit` = DTO 에서 온 명시값)와 반환 타입이 태그로 표현되어 있지 않음. 프라이빗 메서드이므로 현행 수준도 허용 범위지만 팀 코드베이스가 공개 메서드에도 산문 JSDoc 만 쓰는 패턴이면 일관성상 문제 없음.
  - 제안: 현행 유지 가능. 파라미터 명을 `explicit`에서 `explicitTimezone`으로 바꾸면 읽기 쉬워짐.

- **[INFO]** `isValidIanaTimezone` 이 `export` 된 공개 함수임에도 `@param`/`@returns`/`@example` 태그가 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` lines 1912–1920
  - 상세: 단일 줄 JSDoc(`/** IANA 타임존 유효성 — ... */`)만 존재. export 된 유틸이므로 외부 소비(테스트·다른 모듈) 시 타입 힌트 외 문서가 없음.
  - 제안: `@param tz IANA 타임존 문자열 (예: 'Asia/Seoul')`, `@returns 유효하면 true` 태그 추가 권장.

- **[INFO]** `getWorkspaceSettings` JSDoc 이 `interactionAllowedOrigins` 만 반환한다고 구버전 설명을 유지하고 있음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` lines 2231–2233
  - 상세: 주석 "워크스페이스 설정 조회 — `interactionAllowedOrigins` 만 반환." 은 이번 변경으로 `timezone` 도 추가 반환하게 되어 부정확해짐.
  - 제안: "워크스페이스 설정 조회 — `interactionAllowedOrigins` 와 `timezone`(설정된 경우)을 반환." 으로 수정.

### 주석 정확성

- **[WARNING]** `updateWorkspaceSettings` JSDoc 이 오래된 설명을 포함함
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` lines 2181–2184
  - 상세: "현재는 `interactionAllowedOrigins` 만 갱신한다." 는 이번 PR 에서 `timezone` 갱신이 추가되어 사실이 아님. 이 주석은 변경된 코드와 직접 불일치함.
  - 제안: "현재는 `interactionAllowedOrigins` 와 `timezone` 을 갱신한다." 로 수정.

### API 문서

- **[INFO]** `spec/2-navigation/3-schedule.md` §4 API 테이블에 `PATCH /api/workspaces/:id/settings` 의 `timezone` 필드가 기술되어 있지 않음
  - 위치: `spec/2-navigation/3-schedule.md` §4 API 테이블 (스케줄 API 만 기술)
  - 상세: §2.2 타임존 테이블 셀에서 `PATCH /api/workspaces/:id/settings` 의 `timezone` 파라미터를 언급하지만, workspace settings API 는 schedule spec 문서 범위 밖임. 워크스페이스 spec(`spec/3-settings/` 또는 해당 spec 파일)에 `timezone` 필드를 추가해야 완전한 API 문서가 됨.
  - 제안: workspace settings spec 파일에서 `UpdateWorkspaceSettingsDto.timezone` 항목 문서화 여부를 확인하고 누락 시 추가. 현재 리뷰 범위 내에서는 schedule spec 이 충분히 교차 참조를 제공함 — 낮은 우선순위.

### 인라인 주석

- **[INFO]** `updateWorkspaceSettings` 내 타임존 분기 블록 주석(`// 타임존: 제공 시 IANA 유효성 검증 후 병합. 빈 문자열은 설정 해제(undefined)로 처리.`)은 적절하고 충분함.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` line 2207
  - 상세: 조건 분기(빈 문자열 → 키 제거, 유효 → 병합, 무효 → throw)가 복잡하므로 인라인 주석이 적절히 배치됨.

- **[INFO]** `schedules.service.spec.ts` 테스트 describe 레이블에 `(§2.2)` spec 참조가 포함되어 추적성이 좋음. 별도 개선 불필요.

### README 업데이트

- **[INFO]** 프로젝트 README 에 workspace 설정에 `timezone` 옵션이 추가됨을 반영하는 내용이 없을 수 있음
  - 위치: 프로젝트 루트 또는 `codebase/backend/README.md` (리뷰 범위 외)
  - 상세: `timezone` 은 신규 API 파라미터이므로 운영 매뉴얼·개발자 가이드가 있다면 업데이트 필요. 이 프로젝트는 spec 이 단일 진실 소스이므로 README 보다 spec 업데이트가 우선 — spec 은 이미 갱신됨.
  - 제안: spec 이 충분히 업데이트되었으므로 별도 README 변경은 불필요.

### 변경 이력

- **[INFO]** CHANGELOG 파일이 있다면 "workspace settings.timezone 추가" 항목이 필요하나, 이 프로젝트는 `plan/` 기반 추적을 사용하므로 별도 CHANGELOG 는 불필요.

### 설정 문서

- **[INFO]** 새 환경변수 추가 없음 — `Intl.DateTimeFormat` 런타임 의존성은 Node.js 내장이므로 별도 설정 문서 불필요.

### spec 문서 일관성

- **[INFO]** `spec/2-navigation/3-schedule.md` §2.2 타임존 셀 설명이 길고 밀도가 높음
  - 위치: `spec/2-navigation/3-schedule.md` line 2709 (파일 내 해당 행)
  - 상세: 단일 테이블 셀에 fallback 규칙, API 경로, Planned 표기가 모두 포함되어 가독성이 떨어짐. 향후 정보가 더 늘어날 경우 별도 하위 섹션으로 분리할 것을 고려. 현재는 허용 범위.
  - 제안: 장기적으로 `§2.2.2 타임존 결정 우선순위` 소절로 분리.

---

## 요약

이번 변경은 §2.2 스케줄 타임존 workspace fallback 의 backend 구현이다. `resolveTimezone` 메서드, `isValidIanaTimezone` 유틸, `UpdateWorkspaceSettingsDto.timezone`, spec 문서, plan 체크박스 모두 일관되게 갱신되었고, 테스트 describe 레이블에 `§2.2` 참조가 포함되어 추적성이 우수하다. 다만 `updateWorkspaceSettings` 의 JSDoc 과 `getWorkspaceSettings` JSDoc 두 곳이 `timezone` 을 다루지 않아 코드와 불일치하며, 그 중 `updateWorkspaceSettings` 주석("현재는 `interactionAllowedOrigins` 만 갱신한다")은 직접적인 오류다. `isValidIanaTimezone` 이 export 된 공개 함수임에도 파라미터·반환 태그가 없는 점도 소폭 개선 여지가 있다.

## 위험도

LOW
