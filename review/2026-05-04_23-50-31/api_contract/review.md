### 발견사항

- **[INFO]** `triggerSource` 필드 추가 — 기존 응답에 없던 필드이므로 additive change, 하위 호환성 유지
  - 위치: `dashboard-response.dto.ts`, `dashboard.service.ts:RecentExecution`
  - 상세: `GET /dashboard/recent-executions` 응답에 `triggerSource`(required), `triggerLabel`(optional) 필드가 추가됨. JSON 소비 클라이언트는 추가 필드를 무시하므로 breaking change 아님. 단, 강타입 SDK를 자동 생성해 배포한 외부 클라이언트가 있다면 재생성 필요.
  - 제안: Swagger 문서(OpenAPI spec)가 이미 `@ApiProperty`로 업데이트돼 있어 별도 조치 불필요. 외부 SDK 배포 환경이라면 CHANGELOG에 additive change 기재 권장.

- **[WARNING]** `triggerLabel` 타입 불일치 — 서비스 인터페이스와 DTO 간 선택성(optionality) 불일치
  - 위치: `dashboard.service.ts:RecentExecution` (line: `triggerLabel: string | null`) vs `dashboard-response.dto.ts:RecentExecutionDto` (`triggerLabel?: string | null`)
  - 상세: 서비스 인터페이스에서 `triggerLabel`은 required(nullable), DTO에서는 optional(`?`). 실제 서비스 구현은 항상 값을 채우므로 런타임 이슈는 없으나, Swagger 클라이언트가 `triggerLabel`을 absent 가능 필드로 생성해 불필요한 방어 코드를 유발할 수 있음.
  - 제안: DTO를 `triggerLabel: string | null`(non-optional)로 통일. Swagger `@ApiProperty({ nullable: true })`로 "있되 null 가능"을 명확히 표현.

- **[WARNING]** `TriggerCell`에서 알 수 없는 `source` 값 처리 미비
  - 위치: `trigger-cell.tsx:TRIGGER_ICON` 레코드 조회
  - 상세: `TRIGGER_ICON[source]`가 `undefined`를 반환하면 `<Icon …>`에서 런타임 오류 발생. 백엔드가 `unknown`을 fallback으로 보내주지만, API 버전 불일치 또는 장래 새 source 타입 추가 시 프론트엔드 배포 전에 오류가 발생할 수 있음.
  - 제안: `const Icon = TRIGGER_ICON[source] ?? HelpCircle;`로 방어 처리.

- **[INFO]** 페이지네이션 없는 목록 엔드포인트 — `.limit(10)` 하드코딩
  - 위치: `dashboard.service.ts:getRecentExecutions` (`.limit(10)`)
  - 상세: 현재 대시보드 API는 고정 10건 반환이며, 이는 설계 의도(위젯)로 보임. 하지만 API 문서에 이 제한이 명시되지 않으면 클라이언트가 전체 목록을 기대할 수 있음.
  - 제안: Swagger에 `@ApiQuery({ name: 'limit', required: false, maximum: 10, default: 10 })` 또는 응답 메타에 `"limit": 10` 명시.

- **[INFO]** `loadParentWorkflowNames` 유틸 추출 — API 계약 변화 없음
  - 위치: `load-parent-workflow-names.ts`
  - 상세: 서비스 내 private 메서드를 공유 유틸로 추출. 인터페이스 시그니처(`repo, executions`)가 의존성을 명시적으로 받아 테스트 친화적. API 외부 계약에 영향 없음.

---

### 요약

이번 변경은 대시보드 및 실행 목록 API 응답에 `triggerSource`/`triggerLabel` 두 필드를 추가하는 전형적인 additive extension이다. 기존 필드는 삭제·변경되지 않았고 URL 구조와 HTTP 메서드도 유지되어 하위 호환성이 보장된다. 주요 위험은 DTO와 서비스 인터페이스 간 `triggerLabel`의 선택성 불일치(Swagger 스키마 혼란)와 프론트엔드 `TriggerCell`의 미지 source 값에 대한 방어 부재다. 두 항목 모두 단순 수정으로 해소 가능하며, 전반적인 설계(선택 조인으로 민감 필드 제외, 배치 IN 쿼리로 N+1 방지)는 API 계약 관점에서 양호하다.

### 위험도
**LOW**