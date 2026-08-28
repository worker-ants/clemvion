# 문서화(Documentation) 리뷰 결과

## 검증 방법

이 diff 는 `eslint 10` `preserve-caught-error` 대응 인라인 주석 5곳(소스 3 + spec 2)을
"요약을 인라인에 두지 않고 정본(`spec/5-system/3-error-handling.md` §6.3.1)을 참조" 하는
형태로 정리한 문서화 전용 변경이며, 동시에 (1) 직전 코드 리뷰(`review/code/2026/08/29/01_07_51`)가
잡은 Warning 1건(C2 서술의 "민감" 한정어 탈락)을 자매 3곳 전수로 고친 결과, (2) developer 자신이
전 턴에 쓴 확신 주석("isolate 자기 realm")이 실측으로 반증되어 정정된 결과, (3) 직전 리뷰
라운드·이번 라운드의 consistency-check 산출물(SUMMARY/RESOLUTION/개별 reviewer 리포트, 총
19개 신규 파일)을 저장소에 커밋한 것, (4) plan 문서의 자기-정정 블록을 담고 있다.
아래를 저장소에서 직접 열어 뮤테이션 없이 교차검증했다:

- `spec/5-system/3-error-handling.md` §6.3.1 원문(C1/C2 표, `SecretResolverService.resolve` 를
  비부착 정본 사례로 지목하는 문장)을 직접 읽고 5곳 주석 인용과 정확히 일치함을 확인.
- `codebase/packages/expression-engine/src/errors.ts` 를 직접 읽어 `ExpressionError` 의 부가
  own property 가 `code`(ErrorCode enum)·`position`(정수 오프셋) 뿐임을 확인 —
  `expression-resolver.service.spec.ts:142-145`/`expression-resolver.service.ts:319-320` 의
  "민감 속성이 붙지 않는다"(한정어 포함) 서술과 정확히 일치. 과잉 일반화("속성이 없다") 잔존
  여부를 `grep -rn` 으로 저장소 전체 재확인 — 0건.
- `code.handler.ts:454-460` / `code.handler.spec.ts:198-231` 을 직접 읽어 "isolate 경계가 아니라
  Jest 의 vm sandbox realm 때문" 이라는 정정된 귀속이 실제 주석에 반영돼 있음을 확인. 정정 전
  문구("자기 realm")는 `code.handler.spec.ts:220`(정정 서술 인용문 내)과
  `plan/in-progress/deps-peer-gating-and-eslint10.md:337`(취소선 처리된 원문)에만 **의도적으로**
  남아 있고 둘 다 "이전에 이렇게 썼었다" 는 인용 맥락이라 잔존 오류가 아니다.
- `secret-resolver.service.ts:81-101` 을 직접 읽어 SS-SE-05 인용(`spec/conventions/secret-store.md:220`)과
  `#814` 인용이 실제로 정확함을 확인.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` frontmatter `worktree:` 가
  `eslint10-upgrade-5e3cf9` 로 실제 이번 작업 위치와 일치함을 확인(consistency-check
  `01_30_29` `plan_coherence` INFO #9 가 지적한 mismatch 를 같은 diff 안에서 실제로 고쳤다).
  참조된 `#1228`(`3c7b54555`) 커밋이 `spec-draft-error-cause-criterion.md` 를 `complete/` 로
  옮긴 사실, `#1230`(`44346ec81`) 이 §6.3.1 을 신설한 사실을 `git log`로 확인. 인용된
  `review/consistency/2026/08/29/00_13_01` 디렉터리 존재 확인.
- `CHANGELOG.md` 를 열어 "운영 영향이 있는 변경만 기록" 하는 관례를 직접 확인(최근 항목 전부
  사용자 관측 가능한 동작 변화만 기록) — `git log --oneline -- CHANGELOG.md`·eslint 관련 커밋
  이력 대조 결과 과거 eslint/lint tooling 대응 커밋(`#1226`·`#1219`·`#1104` 등) 어느 것도
  CHANGELOG 에 등재되지 않아, "이번 건도 등재 불요" 판단이 이 저장소의 실제 관례와 일치함을
  확인.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 체크박스가 전부 단일 `## 체크리스트`
  섹션(15개) 안에 있고 별도 "본문 체크박스" 목록이 중복 존재하지 않음을 확인 — 이번 diff 가
  추가한 신규 백로그 2건(`- [ ]`)도 기존 "(후속, INFO) `cause` 부착 판단 근거" 항목 하위에
  중첩돼 있어 이 저장소가 과거 겪었던 "체크리스트 두 군데 비동기화" 결함 형태가 아니다.

## 발견사항

없음. (직전 라운드가 지적한 유일한 Warning — `expression-resolver.service.spec.ts` 의 C2
한정어 탈락 — 은 자매 2곳(`code.handler.ts`·`code.handler.spec.ts`)까지 전수로 세어 이번 diff
에서 정정됐고, 실측 대조 결과 3곳 모두 정확하다.)

## 그 외 점검 관점별 확인 (이상 없음)

- **독스트링/JSDoc**: 새 공개 함수·클래스 없음. 기존 JSDoc 무변경.
- **README/API 문서**: 새 기능·엔드포인트·설정 옵션 없음 — 업데이트 불요.
- **CHANGELOG**: 사용자 관측 가능한 동작 변화 없음(주석 전용). 이 저장소 관례(운영 영향만
  등재)와 정확히 일치 — 실측으로 확인.
- **주석 정확성**: 5곳 전부 정본(§6.3.1)과 실제 코드/타입 shape 을 대조해 불일치 없음. 이전
  라운드가 만든 새 결함(과잉 일반화)과 developer 자신의 오귀속(realm)이 모두 이 diff 로
  교정됐고, 정정 이력이 취소선+실측 근거로 투명하게 남았다.
- **인라인 주석**: `isolated-vm` cross-realm 설명이 `code.handler.ts`↔`code.handler.spec.ts`
  양쪽에서 대칭적으로 일치. `secret-resolver.service.ts` 의 비부착 사유 주석은 형제 3곳과
  구조가 다르지만(2줄 "C1—…C2—…" 대신 1문장) §6.3.1 이 AND 조건이라 논리적으로 정확 —
  기존에 이미 INFO 로 잡혀 있고 "선택, 비강제" 로 유예된 사항이며 이번 라운드에서도 여전히
  차단 사유가 아니다(스타일 통일 여부일 뿐).
- **설정 문서**: 새 환경변수 없음.
- **예제 코드**: 신규 사용 패턴 없음 — 불요.
- **plan/review 문서 위생**: plan 자기-정정 블록이 "조건부 처분을 봉인된 `complete/` 에
  남기면 유실된다" 는 이 저장소의 기존 교훈을 실제로 재현·정정한 사례이며, 취소선 보존 +
  실측 근거 + 후속 백로그를 같은 in-progress 문서에 재등재하는 관례를 정확히 따른다.
  `review/code/**`·`review/consistency/**` 신규 산출물(19개 파일)은 프로젝트 컨벤션대로
  nested-ISO 타임스탬프 디렉터리에 커밋됐고, `SUMMARY.md`/`RESOLUTION.md` 의 서술이 각
  서브리포트·실제 코드 상태와 대조해 어긋나지 않는다.

## 요약

이번 diff 는 신규 기능이 아니라, 앞선 리뷰 라운드가 잡은 인라인 주석 결함(§6.3.1 요약 과잉
일반화 + developer 자신의 realm 오귀속)을 정정하고, 그 리뷰·consistency-check 산출물을
저장소 관례대로 커밋한 문서화/위생 PR이다. spec 인용·PR 번호·plan 이동 이력·타입 shape 을
모두 저장소에서 직접 열어 대조했고 전부 일치했다. 새로 발견된 사항은 없으며, 기능·README·
API·CHANGELOG·설정 문서·plan 체크리스트 동기화 어느 관점에서도 갱신 누락이 없다.

## 위험도

NONE
