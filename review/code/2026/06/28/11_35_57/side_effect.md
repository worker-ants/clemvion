# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] 새 테스트의 `defaultOptions` 로컬 정의가 실제 프로덕션 `defaultOptions` 를 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/backend/src/common/cors/web-chat-cors.spec.ts` 라인 173–181 (새 `describe` 블록)
- 상세: 새로 추가된 스냅샷 테스트는 **테스트 내부에서 직접 정의한** `defaultOptions` 로컬 함수를 호출해 `exposedHeaders: ['X-Deleted-Count']` 가 포함된 결과를 검사한다. 그러나 실제 프로덕션 `defaultOptions` 는 `createWebChatCorsDelegate` 의 `deps.defaultOptions` 인자로 외부에서 주입되며, `web-chat-cors.ts` 자체에는 `defaultOptions` 구현이 없다. 이 테스트는 *테스트 코드 안에서 하드코딩한 값을 자기 자신이 검증*하는 동어반복(tautology) 구조다. 실제 어플리케이션 와이어링(예: `AppModule` 또는 `WebChatCorsModule` 에서 주입하는 `defaultOptions` 팩토리)이 `exposedHeaders: ['X-Deleted-Count']` 를 포함하지 않더라도 이 테스트는 통과하며, 의도한 회귀 방지 효과를 달성하지 못한다.
- 제안: 테스트가 실제로 회귀를 잡으려면 두 가지 중 하나여야 한다. (a) 실제 앱 레벨 `defaultOptions` 팩토리를 import 해 그 반환값에 `exposedHeaders` 가 포함되는지 검증하거나, (b) `createWebChatCorsDelegate` 에 실제 `defaultOptions` 를 주입한 후 비-웹채팅 경로 요청을 발행해 반환된 `opts.exposedHeaders` 를 검증한다.

### [INFO] 기존 `createWebChatCorsDelegate` describe 블록의 `defaultOptions` 와 이름 충돌 없음 — 스코프 분리 확인
- 위치: 라인 78 (기존 블록 로컬 `const defaultOptions`) vs 라인 174 (신규 블록 로컬 `const defaultOptions`)
- 상세: 두 `defaultOptions` 는 각각 별개의 `describe` 블록 내 로컬 스코프에 있어 서로 섀도잉하지 않는다. 기존 테스트들이 신규 블록의 `defaultOptions` 로 오염되는 부작용은 없다.
- 제안: 특별한 조치 불필요.

### [INFO] spec 문서(`17-agent-memory.md`) 변경은 런타임 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/spec/5-system/17-agent-memory.md`
- 상세: 순수 Markdown 명세 문서 변경이다. 테이블 셀 단순화, AGM-13 요구사항 ID 텍스트 보강, Rationale 섹션 추가 — 모두 런타임 상태·전역 변수·파일시스템·API 시그니처에 영향을 주지 않는다.
- 제안: 이슈 없음.

### [INFO] `CorsOptionsLike` 인터페이스에 `exposedHeaders?: string[]` 필드 추가 여부
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/ai-mem-admin-rebase-df13f9/codebase/backend/src/common/cors/web-chat-cors.ts` 라인 29
- 상세: `exposedHeaders` 는 `?` 선택적 필드로 추가돼 있으며, 기존 코드에서 `CorsOptionsLike` 를 생성·소비하는 모든 부분은 이 필드를 생략해도 TypeScript 컴파일이 통과한다. 기존 호출자에 대한 파괴적 변경이 없다. `HOOKS_PATH_RE` 분기와 `external` 분기의 인라인 CORS 객체 리터럴(`{ origin: true, credentials: false }` 등)도 `exposedHeaders` 를 포함하지 않으므로 기존 동작은 변하지 않는다.
- 제안: 이슈 없음.

---

## 요약

이번 변경은 테스트 파일에 새 `describe` 블록을 추가하고 spec 문서를 보강하는 것으로 구성된다. 전역 변수 도입, API 시그니처 파괴적 변경, 네트워크 호출, 파일시스템 부작용, 환경 변수 읽기/쓰기는 없다. 다만 신규 스냅샷 테스트(`AGM-13 회귀 방지`)는 테스트 내부에서 직접 정의한 `defaultOptions` 를 자기 자신이 검증하는 동어반복 구조로, 실제 어플리케이션의 `defaultOptions` 와이어링을 커버하지 못한다. 회귀 방지 목적을 달성하려면 실제 앱 레벨 팩토리를 대상으로 검증해야 한다.

## 위험도

LOW
