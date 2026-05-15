## 발견사항

### [WARNING] `integration.dto.ts` — JSDoc 검증 설명과 실제 데코레이터 불일치
- **위치**: `OAuthBeginDto.mallId` 필드 JSDoc (`+  * Validation /^[a-z0-9-]{3,50}$/`)
- **상세**: JSDoc 주석에 "SSRF 방어 + Cafe24 mall_id 규약"을 위한 정규식 검증이 DTO 레벨에 있다고 암시하지만, 실제 데코레이터는 `@IsString()` + `@MaxLength(50)` 뿐이며 `@Matches()` 데코레이터가 없음. 정규식 검증이 서비스 레이어에서만 이루어진다면 주석이 오해를 유발함.
- **제안**: `@Matches(/^[a-z0-9-]{3,50}$/)` 데코레이터 추가, 또는 JSDoc을 "서비스 레이어에서 검증"으로 명확히 수정.

---

### [WARNING] 신규 환경변수(`CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`) 문서화 누락
- **위치**: `integration-oauth.service.cafe24.spec.ts` (`process.env.CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`), `OAUTH_STUB_MODE`
- **상세**: 세 개의 새 환경변수가 사용되지만 diff 범위 내에서 README, `.env.example`, 또는 설정 가이드 업데이트가 보이지 않음. 특히 `CAFE24_CLIENT_ID/SECRET`는 public 앱 운영에 필수이며, `OAUTH_STUB_MODE`는 테스트 동작을 바꾸는 중요한 플래그.
- **제안**: `.env.example`에 세 변수 추가 및 README 또는 `spec/` 문서에 Cafe24 설정 가이드 추가.

---

### [WARNING] `application.ts` 이름 충돌 경고 주석 — 참조 spec 파일 미확인
- **위치**: `metadata/application.ts` 상단 JSDoc (`spec/conventions/cafe24-api-metadata.md §1` 참조)
- **상세**: `spec/conventions/cafe24-api-metadata.md`가 여러 파일에서 참조되지만 diff에 해당 파일 생성이 포함되어 있지 않음. "Application" 이름 혼동이 실제 문서에 설명되어 있는지 확인 필요.
- **제안**: `spec/conventions/cafe24-api-metadata.md` 파일이 존재하는지 확인하고, 없다면 생성 또는 기존 spec에 §1 내용 추가.

---

### [WARNING] `Cafe24Config` 컴포넌트 — Operation 필드 자유입력의 discoverability 부족
- **위치**: `integration-configs.tsx` `Cafe24Config` 컴포넌트, Operation `ExpressionInput`
- **상세**: Operation은 자유입력 텍스트 필드로, `hint` 속성에 예시 몇 개만 있음. 유효한 operation ID 목록 전체(18개 리소스 × 수십 개 operation)에 대한 안내가 없음. 사용자가 오타나 잘못된 ID를 입력할 가능성이 높음.
- **제안**: hint를 드롭다운 셀렉터로 교체하거나, 최소한 해당 리소스의 operation 목록을 hint에 동적으로 노출하는 방향으로 주석에 향후 개선 TODO 추가.

---

### [INFO] `CAFE24_RESOURCES` 목록 중복 — 정규 출처 명시 필요
- **위치**: `metadata/types.ts:CAFE24_RESOURCES` (백엔드 정규 소스) vs `integration-configs.tsx:CAFE24_RESOURCES` (프론트엔드 복사본)
- **상세**: 18개 리소스 목록이 양쪽에 독립적으로 선언되어 동기화 오류 가능성 있음. 현재 두 목록은 일치하나, 향후 리소스 추가 시 누락될 수 있음.
- **제안**: 프론트엔드 배열 위에 "이 목록은 backend/src/nodes/integration/cafe24/metadata/types.ts의 CAFE24_RESOURCES와 동기화되어야 합니다" 주석 추가.

---

### [INFO] `cafe24.component.ts` — `deps.cafe24ApiClient` undefined 케이스 무문서화
- **위치**: `cafe24.component.ts:15`, `node-component.interface.ts` (`cafe24ApiClient?: ...`)
- **상세**: `HandlerDependencies.cafe24ApiClient`는 optional(`?`)이지만 `cafe24NodeComponent.createHandler`에서 null 체크 없이 핸들러에 전달됨. AI Agent 컴포넌트(`ai-agent.component.ts`)는 이 케이스를 `if (deps.cafe24ApiClient)` 로 명시적으로 처리하나, `cafe24.component.ts`는 조용히 `undefined`를 넘김. 이 차이에 대한 설명이 없음.
- **제안**: 주석으로 "Cafe24 node requires cafe24ApiClient — ExecutionEngineService는 항상 wiring하므로 실행 중 undefined가 될 수 없음" 명시.

---

### [INFO] mcp-server-selector.tsx — 프로덕션 코드 내 이모지 사용
- **위치**: `mcp-server-selector.tsx:195,200` (`🌐 Generic MCP`, `🛒 Cafe24 stores`)
- **상세**: 그룹 헤딩 문자열에 이모지가 포함됨. i18n이나 접근성 관점에서 문제가 될 수 있으며, 다른 UI 컴포넌트와의 일관성도 확인 필요. 기능적 문제는 아니지만 코딩 컨벤션 관점에서 주석이나 설계 의도 명시가 필요.

---

### [INFO] CHANGELOG 업데이트 없음
- **상세**: Cafe24 통합은 신규 서비스 추가에 해당하는 주요 기능이나 diff 내에 CHANGELOG 업데이트가 없음.
- **제안**: 팀 컨벤션에 따라 CHANGELOG 또는 릴리스 노트 항목 추가 검토.

---

## 요약

전반적으로 이번 변경의 문서화 수준은 양호하다. SQL 마이그레이션의 `COMMENT ON COLUMN`과 상세 인라인 주석, `metadata/types.ts`의 설계 근거 설명, AI Agent 컴포넌트의 ordering constraint 주석, service-registry의 Cafe24 JSDoc은 모두 모범적이다. 주요 개선점은 세 가지다: (1) `OAuthBeginDto.mallId`의 JSDoc이 실제 구현되지 않은 DTO 레벨 검증을 암시하는 부정확한 설명 수정, (2) `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET`/`OAUTH_STUB_MODE` 환경변수에 대한 운영 문서 추가, (3) `spec/conventions/cafe24-api-metadata.md` 참조 파일 존재 여부 확인.

## 위험도

**LOW**