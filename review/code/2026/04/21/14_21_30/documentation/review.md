## 문서화 리뷰

### 발견사항

---

**[INFO]** `workspaces.controller.ts` — Swagger 데코레이터 충분히 작성됨
- 위치: `@Patch(':id')`, `@Delete(':id')`, `@Post(':id/leave')` 엔드포인트
- 상세: 세 신규 엔드포인트 모두 `@ApiOperation`, `@ApiParam`, 응답 데코레이터가 갖춰져 있어 Swagger 문서화 수준은 양호함
- 제안: 없음

---

**[WARNING]** `workspaces.service.ts` — `renameWorkspace` 에러 코드 불일치
- 위치: `renameWorkspace` 메서드 내 길이 검증 (line ~268)
- 상세: 이름이 너무 짧거나 길 때 `ConflictException`을 throw하면서 코드는 `WORKSPACE_NAME_TOO_SHORT`로 설정함. 100자 초과도 같은 코드를 사용하므로 코드가 실제 에러 상황을 정확히 설명하지 않음. 메서드 주석(`/** 워크스페이스 이름 변경 (Admin+). */`)도 유효 범위(2~100자)를 언급하지 않음
- 제안: 에러 코드를 `WORKSPACE_NAME_INVALID`로 통일하거나, 길이 초과 시 `WORKSPACE_NAME_TOO_LONG`으로 분리. 주석에 제약사항 명시: `/** 워크스페이스 이름 변경 (Admin+). 이름은 2~100자. */`

---

**[WARNING]** `workspaces.service.ts` — `deleteWorkspace` 주석과 구현 불일치
- 위치: `deleteWorkspace` 메서드 JSDoc (line ~282)
- 상세: 주석에 "멤버·초대는 cascade 또는 외부 정리에 의존한다"고 명시되어 있으나, 실제로 cascade가 DB 스키마에 설정되어 있는지, 외부 정리 로직이 어디에 있는지 확인 불가. 미래 개발자가 이를 신뢰하고 cascade 없이 배포할 경우 orphan 레코드 발생 위험
- 제안: `/** ... cascade ON DELETE 설정 필요 (workspace_member.workspace_id FK). 미설정 시 orphan 발생. */` 로 명확히 경고 추가

---

**[INFO]** `workspaces.controller.ts` — `update` 메서드의 no-op 분기 미문서화
- 위치: `update` 메서드 내 `if (dto.name === undefined)` 분기 (line ~118)
- 상세: `dto.name`이 `undefined`일 때 현재 워크스페이스 상태를 그대로 반환하는 no-op 동작이 Swagger 문서나 인라인 주석에 전혀 설명되지 않음. API 소비자 입장에서 빈 PATCH가 현재 상태를 반환하는 동작은 예상 밖일 수 있음
- 제안: `@ApiOperation.description`에 "body를 생략하면 현재 상태를 그대로 반환합니다" 추가

---

**[INFO]** `update-workspace.dto.ts` — DTO 주석이 한국어로만 작성됨
- 위치: `@ApiPropertyOptional` description 필드
- 상세: `description: '새 워크스페이스 이름 (2~100자)'` — 다른 DTO 파일들의 패턴과 다를 경우 혼란 가능성 있음. 프로젝트가 한/영 혼용인지 확인 필요
- 제안: 프로젝트 내 다른 DTO의 설명 언어 패턴에 맞춰 통일

---

**[INFO]** `sidebar.tsx` — `roleLabelKey` 함수 중복 정의
- 위치: `sidebar.tsx` 상단, `settings/page.tsx` 상단
- 상세: 동일한 `roleLabelKey(role: WorkspaceRole): TranslationKey` 함수가 두 파일에 각각 정의됨. 유틸리티 추출이 필요하나 문서화보다는 코드 품질 문제
- 제안: `frontend/src/lib/workspace-utils.ts` 등 공유 모듈로 추출하고 단일 출처 주석 작성

---

**[INFO]** `providers.tsx` — 기존 주석이 새 코드 블록을 포함하지 않음
- 위치: `useEffect` 내 workspace 전환 로직 (line ~44)
- 상세: `resetQueries()` 사용 이유를 설명하는 블록 주석이 잘 작성되어 있으나, 새로 추가된 `toast.success` 알림 로직은 주석 범위 밖에 무설명으로 추가됨. 일관성이 떨어짐
- 제안: 기존 주석에 "전환 시 사용자에게 toast 알림 표시" 한 줄 추가

---

**[INFO]** `en.ts` / `ko.ts` — `dangerLeaveOnlyOwner` 키 미사용
- 위치: i18n 사전 파일 양쪽 모두
- 상세: `dangerLeaveOnlyOwner` 번역 키가 양쪽 사전에 추가되어 있으나, `settings/page.tsx` 어디에서도 참조되지 않음 (실제 sole-owner 에러는 백엔드 `SOLE_OWNER_CANNOT_LEAVE` 코드로 처리됨). 미사용 번역 키는 사전 유지보수 부담을 높임
- 제안: 프론트엔드에서 에러 코드 파싱 후 해당 메시지를 표시하도록 연결하거나, 사용 계획이 없으면 키 제거

---

**[INFO]** `role-legend.tsx` — 컴포넌트 props 인터페이스 미문서화
- 위치: `RoleLegend` 컴포넌트 export
- 제안: 소규모 컴포넌트이므로 큰 문제 아님. 단, `className` prop이 선택적임을 인터페이스 정의만으로 알 수 있어 현재 수준은 허용 가능

---

### 요약

전반적으로 이번 변경셋의 문서화 수준은 양호하다. Swagger 데코레이터가 신규 엔드포인트 전반에 일관되게 적용되었고, 서비스 메서드에 단문 JSDoc이 붙어 있으며, i18n 키도 한·영 양쪽에 빠짐없이 추가되었다. 주요 리스크는 두 가지다: (1) `deleteWorkspace`의 cascade 의존 사실이 주석에 명시되어 있지만 실제 DB 스키마 보장 없이 "의존한다"고만 기술되어 있어 orphan 레코드 위험을 과소평가할 수 있고, (2) `renameWorkspace`의 에러 코드 `WORKSPACE_NAME_TOO_SHORT`가 "이름이 너무 길 때"도 동일하게 발생하여 오해를 유발한다. 그 외 `roleLabelKey` 중복과 미사용 i18n 키는 향후 유지보수 부담 요인이지만 즉각적 위험은 없다.

### 위험도

**LOW**