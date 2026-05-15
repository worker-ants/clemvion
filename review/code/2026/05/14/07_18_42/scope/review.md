## 발견사항

### [WARNING] `mcp-server-selector.tsx` — 기능 요건 이상의 UI 전면 재설계
- **위치**: `mcp-server-selector.tsx` L187–L226 (available 목록 렌더링 블록)
- **상세**: cafe24를 필터에 추가하는 기능 요건을 충족하면서 동시에 단일 flat 리스트를 그룹 레이아웃으로 전면 재구성했다. 최소 변경은 `serviceType === 'mcp'` 조건에 `|| 'cafe24'`를 추가하고 기존 `<button>` 렌더링을 그대로 유지하는 것이었다. 그러나 실제 구현은 `({ key, heading, items })` 그룹 구조 도입, 섹션별 `<div>` 래퍼와 group-heading 렌더링, 이모지 하드코딩, spacing 변경(`space-y-0.5` → `space-y-1.5`)까지 포함한 레이아웃 리팩토링이다.
- **제안**: 기능 요건만 충족한다면 기존 단일 리스트 구조를 유지하면서 `serviceType` 필터만 확장하는 방식이 더 적합하다. 그룹 UI가 의도된 요건이라면 별도 PR로 분리하거나, 이모지 대신 i18n 키를 사용해야 한다.

### [WARNING] `mcp-server-selector.tsx` — 쿼리 캐시 키 변경
- **위치**: `mcp-server-selector.tsx` L65, `queryKey: ["integrations", "mcp"]` → `["integrations", "mcp-capable"]`
- **상세**: cafe24를 필터에 추가하는 것만으로도 데이터 요건은 충족된다. 쿼리 키 변경은 기존에 `["integrations", "mcp"]`로 캐시 무효화(`invalidateQueries`)를 수행하는 다른 컴포넌트·뮤테이션이 있을 경우 무효화가 더 이상 적용되지 않는 부작용을 낳는다. 이는 cafe24 추가와는 별개의 행동 변경이다.
- **제안**: 기존 키를 유지하거나, 변경 전 프로젝트 전체에서 `["integrations", "mcp"]` 키를 참조하는 `invalidateQueries` 호출 여부를 확인한다.

### [INFO] `integrations.ts` — 과도한 인라인 주석
- **위치**: `integrations.ts` L171–L176, `oauthBegin` 파라미터 타입 블록 내 4줄 주석
- **상세**: `mallId?`, `appType?`, `clientId?`, `clientSecret?` 네 필드 추가는 자명하다. 4줄 주석(Cafe24-only 필드 설명, 백엔드 동작, Private/Public 앱 차이)은 타입 정의 수준에서 필요한 정보를 초과한다. CLAUDE.md 규약("WHY가 비자명할 때만 주석")과 상충한다.
- **제안**: 주석 전체 제거 또는 `// Cafe24 Private 앱 전용 — Public은 서버 env에서 읽음` 한 줄로 축약.

### [INFO] `plan/in-progress/spec-update-send-email-port.md` — 신규 plan이 cafe24 작업과 무관
- **위치**: `plan/in-progress/spec-update-send-email-port.md` (신규 파일)
- **상세**: `send_email` 포트명 불일치를 추적하는 plan이 cafe24 구현 worktree에 생성됐다. 파일 자체의 내용("본 cafe24 작업에 미치는 영향: 없음")이 범위 외 작업임을 명시하고 있다. plan frontmatter의 `worktree: cafe24-integration-a3f5e2` 도 이 작업 맥락에서 생성됨을 기록한다.
- **제안**: 파일 자체는 발견 경위를 적절히 기록하고 있으며 독립 처리 가능함을 명시했다. 현재 구조로 유지 가능하나, 다음 작업 착수 시 별도 worktree로 이관 권장.

### [INFO] `review/2026-05-14_01-33-42/` — rate-limit 아티팩트 디렉토리
- **위치**: `review/2026-05-14_01-33-42/` 하위 13개 파일
- **상세**: 각 파일 내용이 `"You've hit your limit · resets 4:40am (Asia/Seoul)"` 한 줄뿐인 빈 리뷰 결과물이다. `meta.json`은 정상이나 실제 리뷰 내용은 없다. 이 디렉토리는 정보적 가치 없이 `review/` 경로를 오염시킨다.
- **제안**: 해당 디렉토리 제거 또는 `meta.json`만 남겨 실패 기록으로 보존.

---

## 요약

전체 변경사항은 Cafe24 통합 구현이라는 목적에 일관되게 집중되어 있다. 범위를 벗어난 핵심 변경은 `mcp-server-selector.tsx`의 두 가지다: (1) 단순 필터 확장 대신 flat 리스트를 이모지 헤더 그룹 레이아웃으로 전면 재구성한 것, (2) 다른 소비자에게 영향을 줄 수 있는 쿼리 캐시 키 변경. 나머지 변경들(문서, plan, review 아티팩트, `mcp-capable-service-types.ts` 추상화)은 ai-review RESOLUTION 범위 내에 포함되거나 적절한 프로젝트 관리 산출물이다. 이미 `review/2026-05-14_01-29-47/scope/review.md`에서도 동일한 두 항목을 [INFO]로 지적한 바 있다.

## 위험도

**LOW**