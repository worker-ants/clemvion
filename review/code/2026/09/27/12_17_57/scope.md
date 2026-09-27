# 변경 범위(Scope) 리뷰 — folders-contract-e2e (2R)

## 검토 방법

`git diff --stat origin/main...HEAD`(32개 파일)로 프롬프트의 파일 목록과 1:1 대조했다. 이번 라운드(2R)는 1R
(`review/code/2026/09/27/11_53_51`)에서 지적된 W1(DRY 관용구 복제) 처분으로 추가된 커밋(`692f1e8fd` 헬퍼 추출,
`55aaf0e1e` plan/트래커 반영, `1b3cb2543` 1R 리뷰 산출물 커밋)까지 포함한 전체 diff를 대상으로 한다. 저장소는 조회만
했고(`git status --short`, `git diff --stat`) 뮤테이션은 하지 않았다.

## 발견사항

이번 diff의 핵심 축(폴더 모듈 PATCH 부분 본문 응답 결함 수정·`FolderDto.parentId` §5.4 정합화·e2e/단위/캐너리
신설·CHANGELOG·트래커)은 plan(`plan/in-progress/folders-contract-e2e.md`) "방향" §1~7과 1:1 대응하며, 1R scope
리뷰에서 이미 확인한 범위를 벗어나지 않는다. 2R에서 새로 추가된 부분은 1R WARNING #1(maintainability, DRY 복제
확산)에 대한 처분으로 전량 설명 가능하다.

- **[INFO]** `omitUndefined` 헬퍼 추출이 원래 PR 축(폴더 모듈)을 벗어나 `codebase/backend/src/modules/triggers/triggers.service.ts`
  까지 수정한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (import 추가 1줄 + `update()` 내부 `defined` 변수
    할당부 치환), `codebase/backend/src/common/utils/omit-undefined.ts`(신규) · `omit-undefined.spec.ts`(신규)
  - 상세: `git diff origin/main...HEAD -- .../triggers.service.ts`로 실측 — 변경은 `import { omitUndefined } ...` 1줄
    추가와, 기존 인라인 필터(`Object.fromEntries(Object.entries(rest).filter(...))`) 및 그 위 장문 주석을 헬퍼 호출
    한 줄 + 축약 주석으로 치환한 것뿐이다. 트리거 모듈의 다른 로직·메서드는 무변경. 이 수정은 1R
    `maintainability.md` WARNING #1("관용구가 두 곳에 통째 복제, 세 번째 사본이 생기기 전 추출 권장")에 대한 직접
    응답이며, `RESOLUTION.md`·plan §뮤턴트(H1~H4)·트래커(`spec-draft-nullable-notation-followups.md` "공용 헬퍼는
    생겼다" 문단)에 모두 근거가 남아 있다. CLAUDE.md는 구현 완료 후 `/ai-review` Critical/Warning에 대한 같은 턴
    fix를 상시 승인된 강제 의무로 규정하므로, 원 PR의 선언된 축(폴더 모듈)을 기술적으로 넘어서지만 스코프 위반이
    아니라 이 저장소의 명시된 리뷰 워크플로에 부합하는 처분이다.
  - 제안: 조치 불요. 다만 다음 리뷰어가 "폴더 PR인데 트리거 파일이 왜 바뀌었나"로 오탐하지 않도록 참고 기록.

- **[INFO]** `review/code/2026/09/27/11_53_51/**`(8개)·`review/consistency/2026/09/27/10_39_26/**`(8개) 리뷰·검토
  산출물이 기능 커밋과 같은 PR에 함께 실린다.
  - 위치: 두 디렉터리 전체(각 `SUMMARY.md`·`meta.json`·`_retry_state.json` 등).
  - 상세: 1R scope 리뷰(`review/code/2026/09/27/11_53_51/scope.md`)가 이미 이 패턴을 확립된 관행(선행 커밋
    `e20756844`)으로 실측 확인했다. 이번 라운드에서도 동일하게 적용되며 CLAUDE.md 저장 위치 표(`review/code/**`,
    `review/consistency/**`)와 일치한다.
  - 제안: 조치 불요.

- 개별 파일 재확인 결과 스코프 이탈 없음:
  - `folders.service.ts`: `update()` 내부 `Object.assign(folder, data)` → `Object.assign(folder, omitUndefined(data))`
    1줄 치환 + import 1줄. 다른 메서드 무변경.
  - `folder-response.dto.ts`: `parentId` 데코레이터/타입만 변경, `ApiPropertyOptional` import 제거는 그 변경의
    직접 결과.
  - `folders.service.spec.ts`: 신규 테스트 2건(undefined 필드 비덮어쓰기·빈 본문) + 기존 "allows moving to root"
    테스트의 단언을 `toBeDefined()` → `expect(result.parentId).toBeNull()`로 강화 — 모두 1R INFO 8·9의 직접 처분.
  - `omit-undefined.ts`/`.spec.ts`: 신규 헬퍼와 그 테스트만, 기능 확장(추가 옵션·파라미터) 없이 1R 이전의 인라인
    로직을 그대로 옮긴 것.
  - `swagger-dto-contract.spec.ts`: 래칫 배열에서 `folder-response.dto.ts:FolderDto.parentId` 1행 제거만 — DTO
    변경의 직접 귀결, 다른 래칫 항목 무변경.
  - `plan/in-progress/*.md` 2개: 이번 PR의 실측·리뷰 처분·뮤턴트 결과를 기록하는 문서 갱신이며, 코드 스코프 확장이
    아니다.

포맷팅 뒤섞기·불필요한 임포트 정리·미사용 기능 추가·무관한 설정 변경은 발견하지 못했다.

## 요약

2R diff는 1R에서 지적된 유일한 Warning(DRY 관용구 복제)을 헬퍼 추출로 해소한 것이 전부이며, 그 처분이 폴더 모듈
밖(`triggers.service.ts`)까지 미친 것도 리뷰 워크플로가 명시적으로 요구하는 "같은 턴 fix" 의무에 정확히 해당해
스코프 위반으로 보지 않는다. 나머지 파일들은 1R 검토와 동일하게 plan이 선언한 방향과 1:1 대응하며 의도 이상의
추가 수정·리팩토링·기능 확장은 발견되지 않았다.

## 위험도

NONE
