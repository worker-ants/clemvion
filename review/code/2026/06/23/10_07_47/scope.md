### 발견사항

**[INFO] 테스트 파일의 미사용 임포트 — `fireEvent`**
- 위치: `codebase/frontend/src/app/(main)/web-chat/__tests__/web-chat-page.test.tsx` line 57
- 상세: `fireEvent`가 `@testing-library/react`에서 임포트되어 있으나 파일 전체에서 단 한 번도 사용되지 않는다. 4개의 테스트 케이스 모두 `render`, `screen`, `act`, `cleanup`만 사용한다.
- 제안: `fireEvent` 임포트 제거. 현재 작업 범위인 RBAC·필터·스니펫 검증 테스트에서 불필요한 임포트가 혼입된 상태.

**[INFO] i18n dict의 미사용 키 — `list.manage`, `list.active`, `list.inactive`**
- 위치: `codebase/frontend/src/lib/i18n/dict/en/webChat.ts` 및 `codebase/frontend/src/lib/i18n/dict/ko/webChat.ts` 내 `list.manage`, `list.active`, `list.inactive` 키
- 상세: 현재 구현된 `page.tsx`의 인스턴스 목록 버튼에는 인스턴스 이름과 워크플로우 레이블만 표시하며, `manage`·`active`·`inactive` 키를 사용하는 컴포넌트가 이 PR 내에 존재하지 않는다. 증분 2를 위한 예비 키로 보이나, 구현 없는 i18n 키 추가는 범위 소 초과에 해당한다.
- 제안: 실제 사용 시점에 추가하거나, 증분 1 범위임을 주석으로 명시.

### 요약

변경 전체는 PR 제목에 명시된 "웹채팅 운영 콘솔 증분 1(인스턴스 관리·외형 빌더·설치 스니펫)"의 의도된 범위 내에 잘 집중되어 있다. 신규 파일 21개 모두 web-chat 기능·테스트·i18n에 한정되고, 기존 파일 수정은 sidebar.tsx(아이콘 1행 + navItem 1행)와 i18n index(import 1행 + export 1행) 추가에 그쳐 무관한 코드 변경이 없다. 단, `web-chat-page.test.tsx`의 `fireEvent` 미사용 임포트와 i18n dict의 현재 미사용 키(`list.manage/active/inactive`) 두 건이 범위 소 초과의 흔적으로 남아 있으나 기능에 영향을 주지 않는 수준이다.

### 위험도

LOW
