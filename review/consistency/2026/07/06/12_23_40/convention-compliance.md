# 정식 규약 준수 검토 — schedules-triggerid-deeplink-91c2cc

- 대상 커밋: `54f8aaac9` (`feat(schedules): 트리거→스케줄 역방향 딥링크(?triggerId=) 행 강조`)
- Diff: `git diff origin/main...HEAD` (참고: `origin/main` 은 이미 `c23e9d04d`(#832 FE-3 후속)까지 병합돼 있어, 실질 신규 변경은 `54f8aaac9` 한 커밋 — spec 2줄 + `schedules/page.tsx` 32줄 + 테스트 60줄)
- 대상 문서: `spec/2-navigation/3-schedule.md` §2.1 신설 딥링크 노트

## 발견사항

없음.

## 검토 근거

### 1. spec-link-integrity (cross-doc 앵커)

신설 노트의 링크:

```
[트리거 목록](./2-trigger-list.md#21-트리거-목록-항목)
```

- 대상 heading: `spec/2-navigation/2-trigger-list.md:48` `### 2.1 트리거 목록 항목`
- 렌더러 슬러그(`rehype-slug`/`github-slugger` 동등) 규칙상 `2.1 트리거 목록 항목` → `21-트리거-목록-항목` 로 정확히 일치. 링크 타깃 앵커 불일치 없음.
- `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 및 `spec-status-lifecycle.test.ts` 를 `cwd=codebase/frontend`, `../../node_modules/.bin/vitest run spec-link-integrity spec-status-lifecycle` 로 재확인 — **2 test files / 161 tests 전원 통과**.

### 2. spec-impl-evidence (frontmatter·code:·status 정합)

- `spec/2-navigation/3-schedule.md` frontmatter: `status: implemented` 유지, `code:` 배열에 `codebase/frontend/src/app/(main)/schedules/page.tsx` 가 이미 등재(변경 전부터). 이번 PR 이 그 파일을 수정한 것이므로 `code:` 갱신 불필요 — `git diff c23e9d04d..54f8aaac9 -- spec/2-navigation/3-schedule.md` 로 frontmatter 블록에 변경 없음(본문 2줄 삽입만) 확인.
- `pending_plans:` 필드 없음 — `status: implemented` 이므로 규약상 정상(§3 라이프사이클 표: `implemented` 는 `pending_plans` "없음").
- 코드-spec 정합: `schedules/page.tsx` 의 `focusTriggerId = searchParams.get("triggerId")` 파생값이 매칭 행에 `bg-[hsl(var(--accent))]` 강조 + `data-testid="schedule-focused-row"` + `scrolledFocusRef` 로 1회만 `scrollIntoView({ block: "center" })` 수행 — spec 노트가 서술하는 "강조 표시 + 한 번 스크롤", "현재 페이지에 그 행이 있을 때만 강조(서버 목록에 triggerId 필터 없음)", "강조는 시각 표시일 뿐 편집 다이얼로그 자동 오픈 안 함" 3가지 모두와 1:1 대응.
- 신설 테스트 `describe("SchedulesPage — inbound ?triggerId= deep-link (Spec §2.1)")` 3건이 spec 서술의 세 케이스(매칭 시 강조+스크롤 / 미매칭 시 비강조 / 파라미터 없을 시 비강조)를 정확히 커버 — `vitest run schedules-page` 로 17 tests 전원 통과 재확인.
- 이번 PR 이 코드+spec+테스트 동반 커밋이라 spec-impl 갭 없음(gap-free).

### 3. "미구현/Planned" 마커 오사용

- `grep -n -i "planned\|미구현" spec/2-navigation/3-schedule.md` 결과, 매치는 `## Rationale` 섹션의 과거 이력 서술(`### sort/order 쿼리 반영 — "미구현/Planned" 표기 해제 (2026-06-10)`) 뿐이며 이미 해제된 사안에 대한 역사적 기록. 신설 §2.1 노트에는 Planned/미구현 마커가 없음 — 실제 구현 완료된 동작을 서술한 것과 일치.

### 4. frontmatter 무변경

- `git diff origin/main...HEAD -- spec/2-navigation/3-schedule.md` 는 본문 2줄(신설 노트 1문단 + 빈 줄) 삽입만 포함. `id`/`status`/`code:` 등 frontmatter YAML 블록 변경 없음.

### 5. 문서 구조(3섹션 Overview/본문/Rationale) 및 기타 명명 규약

- 이번 diff 는 기존 §2.1 표 아래 인용 노트(`>`) 한 문단 추가뿐이라 문서 전체 구조(타이틀→관련 문서 링크→`## 1~5` 본문→`## Rationale`)에 영향 없음. 신설 노트는 기존 "더보기(⋮) 오버플로 메뉴" 노트와 동일한 인용구 스타일·코드 경로 병기 패턴을 재사용해 문서 내 형식 일관성 유지.
- plan/review 디렉토리 변경 없음(`git diff origin/main...HEAD --stat -- plan/ review/` 빈 결과) — 이번 PR 은 spec-doc + code + test 범위로 한정, plan 완료/frontmatter 관련 가드(§4.2 Gate C 등) 대상 아님.

## 요약

이번 PR 은 §2.1 에 인바운드 `?triggerId=` 딥링크 노트 한 문단을 추가하고 이를 뒷받침하는 코드(`schedules/page.tsx`)·테스트를 동반한 spec-doc 동기화다. 신설 cross-doc 앵커는 `2-trigger-list.md` 의 실제 heading 슬러그와 정확히 일치하고(`spec-link-integrity`/`spec-status-lifecycle` 161 tests 전원 통과), `status: implemented` frontmatter 는 무변경으로 유지되며 `code:` 는 이미 대상 파일을 포함하고 있어 spec-impl-evidence 갭이 없다. 코드 구현(강조·1회 스크롤·페이지 한계 명시·다이얼로그 미자동오픈)이 spec 서술과 정확히 대응하고, 신설 3개 테스트가 그 서술을 그대로 커버한다. "미구현/Planned" 마커 오사용도 없다. 정식 규약 관점에서 위반 사항을 발견하지 못했다.

## 위험도

NONE
