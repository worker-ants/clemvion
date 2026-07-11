### 발견사항

없음.

target 구현 변경(`git diff origin/main...HEAD`)은 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 단일 파일에 한정된 순수 내부 리팩터링이다. `findBrokenLinks` 와 `findBrokenSpecLinksInSources` 두 공개 함수의 중복 스캔 로직을 `findBrokenLinksInFiles`(module-private) 로 추출하고, 옵션을 `LinkScanOptions`(module-private interface) 로 파라미터화했을 뿐이며 두 공개 함수의 이름·시그니처·동작(export 표면)은 변경되지 않았다.

신규로 도입된 식별자는 다음 2건뿐이며 모두 해당 파일 내부 스코프(비-export)로 격리되어 있다:
- `interface LinkScanOptions` (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:161`)
- `function findBrokenLinksInFiles(...)` (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:181`)

코드베이스 전체(`codebase/`, `spec/`) grep 결과 두 식별자 모두 이 파일에서만 정의·참조되며, 기존 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로 어느 카테고리와도 이름이 겹치지 않는다. target spec(`spec/conventions/spec-impl-evidence.md`) 본문 자체는 이번 diff 로 변경되지 않았고("없음"으로 표시), 새 요구사항 ID 나 spec 식별자를 부여하지도 않는다. 따라서 신규 식별자 충돌 관점에서 검토할 표면이 실질적으로 없다.

### 요약
이번 변경은 spec-link 무결성 테스트 헬퍼의 DRY 리팩터링으로, 새로 도입된 `LinkScanOptions`/`findBrokenLinksInFiles` 는 파일 내부에만 국한된 비공개 식별자이고 기존 요구사항 ID·엔티티·API·이벤트·ENV·spec 경로 어느 것과도 겹치지 않는다. 신규 식별자 충돌 위험은 없다.

### 위험도
NONE
