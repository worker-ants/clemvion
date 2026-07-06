# Scope Review — /schedules 역방향 딥링크 (commit 54f8aaac9)

대상: `git diff origin/main...HEAD`
변경 파일 3개, 총 +92/-2:
- `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` (+60/-0)
- `codebase/frontend/src/app/(main)/schedules/page.tsx` (+30/-2)
- `spec/2-navigation/3-schedule.md` (+2/-0)

## 발견사항

발견된 범위 이탈 없음.

- **[INFO]** 변경 파일이 선언된 범위(page.tsx 딥링크 로직 + 테스트 3건 + spec §2.1 노트 1개)와 정확히 일치
  - 위치: `git diff origin/main...HEAD --stat` 전체
  - 상세: 변경 파일이 정확히 3개이며 각각 리뷰 대상으로 명시된 범위(FE 페이지, 테스트, spec)에 1:1 대응한다. `codebase/backend/**` 변경 0건 확인(FE-only 요구 충족).
  - 제안: 없음.

- **[INFO]** `page.tsx` 의 삭제 2줄은 import 문 수정뿐, 로직 삭제/리팩토링 없음
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:4` (`useState, useMemo` → `useState, useMemo, useRef`), 및 `useSearchParams` import 추가(next/navigation)
  - 상세: 삭제된 2줄은 신규 기능(스크롤 1회성 ref, 딥링크 쿼리 파싱)에 필요한 훅 도입에 따른 import 목록 갱신일 뿐이다. 기존 로직(스케줄 CRUD, 다이얼로그, 페이지네이션, 캘린더뷰, 오버플로 메뉴)에 대한 수정은 diff에 나타나지 않는다.
  - 제안: 없음.

- **[INFO]** 추가된 코드는 `<tr>` 렌더 블록 내부에 국한되며 조건부(`isFocused`)로만 분기, 기존 렌더 경로는 무조건 통과
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx` (`isFocused`, `data-testid`, `ref`, `className={cn(isFocused && ...)}` 추가분)
  - 상세: `focusTriggerId` 가 없거나 매치되는 행이 없으면 `isFocused=false`가 되어 `data-testid`/`ref`/강조 class가 모두 비활성(undefined/no-op)이 되므로 기존 렌더링 동작에 대한 회귀 위험이 없다. 무관 영역(정렬, 필터, 다이얼로그 상태머신) 코드는 손대지 않았다.
  - 제안: 없음.

- **[INFO]** 테스트 파일은 파일 끝에 새 `describe` 블록만 추가(append-only)
  - 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx:531` 이후
  - 상세: diff가 기존 라인 531 이후에만 존재하며 기존 `describe`/`it` 블록에 대한 수정・삭제가 없다. 사용된 `useSearchParams` mock(`vi.mock("next/navigation", ...)`)과 `currentSearchParams` 변수는 이미 origin/main 파일 최상단(1~18행)에 존재하던 기존 테스트 인프라를 재사용한 것이며 새로 추가/변경되지 않았다.
  - 제안: 없음.

- **[INFO]** spec 변경은 `3-schedule.md` §2.1 안에 노트 1단락만 추가, frontmatter·타 섹션 미변경
  - 위치: `spec/2-navigation/3-schedule.md` (§2.1 기존 "⋮ 오버플로 메뉴" 문단 바로 뒤에 `> **inbound \`?triggerId=\` 딥링크**: ...` 신규 인용 문단 삽입)
  - 상세: diff는 정확히 2줄 추가(빈 줄 + 노트 문단)이며, §2.2(다이얼로그) 등 다른 섹션이나 frontmatter(code refs 등)에는 변경이 없다. 노트 내용도 구현(page.tsx)의 실제 동작(현재 페이지 매치 시에만 강조, cross-page 미지원, 다이얼로그 자동오픈 안 함)과 정합한다.
  - 제안: 없음.

## 요약
변경은 선언된 범위(schedules/page.tsx 인바운드 `?triggerId=` 행 강조/스크롤, 테스트 3건, spec §2.1 노트 1개)와 정확히 일치한다. 백엔드 코드는 전혀 건드리지 않았고(FE-only 충족), page.tsx의 로직 추가는 조건부 분기로 국한되어 기존 스케줄 목록·편집 다이얼로그·페이지네이션·캘린더뷰 경로를 변경하지 않았다. 테스트 추가는 파일 끝 append-only이며 기존 mock 인프라를 재사용했을 뿐 신규/변경이 아니다. spec 변경도 §2.1 노트 한 단락에 한정되어 frontmatter 및 다른 섹션은 그대로다. 무관한 리팩토링, 포맷팅 노이즈, 범위 외 파일 수정은 발견되지 않았다.

## 위험도
NONE
