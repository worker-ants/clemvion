# 부작용(Side Effect) 리뷰 — 4회차 (`15_55_00`)

## 검토 범위 및 방법

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 를 줄 단위 매칭에서
  마스킹된 전문(全文) 매칭으로 재구현(`buildMaskedDoc`/`lineForOffset` 신설).
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 링크 회귀 테스트 추가.
- `plan/in-progress/harness-review-gate-followups.md` — 해소 서술·체크박스 갱신, 신규 백로그 항목.
- `review/code/2026/08/29/{14_36_39,15_01_34,15_30_59}/**` — 앞선 세 리뷰 라운드 산출물이 그대로
  신규 커밋에 포함됨(코드 아님, 기록 데이터).

저장소를 뮤테이션하지 않고 `Read`/`grep`/`git diff --stat`/`git status --short` 등 읽기 전용
명령만 사용했다. 시작·종료 시점 모두 `git status --short` 확인 — 이 세션 산출물 디렉터리
(`review/code/2026/08/29/15_55_00/`) 외 변경 없음.

## 발견사항

- **[INFO]** `extractLinks()` 의 반환 계약이 의미적으로 넓어졌다 (시그니처는 불변)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:204` (`export function extractLinks(absPath: string): MdLink[]`), 인터페이스 `:73-77` (`MdLink`), `:261-266` (`LinkViolation`).
  - 상세: `MdLink.line`/`LinkViolation.line` 의 의미가 "그 줄"에서 "링크가 **시작한** 줄"로,
    `MdLink.raw` 가 "단일행"에서 "개행을 포함할 수 있음"으로 바뀌었다. 직접 grep 으로
    재확인(`grep -rn "\.raw\b" codebase/frontend/src/lib/docs/` → 소비처 0건, `extractLinks`
    호출부는 `spec-links.ts` 자신·`plan-frontmatter.test.ts`(`.length`만 사용)·
    `spec-area-index.test.ts`(`.target`만 사용) 셋뿐이고 전부 `.raw`/`.line` 의미 변화에
    영향받지 않는 사용 패턴이다). 함수 시그니처(매개변수·반환 타입) 자체는 동일하므로
    타입 체커가 잡을 파손은 없고, 필드 옆에 새 계약을 설명하는 주석도 이미 추가돼 있다.
  - 제안: 조치 불요. 라운드 1~3 이 이미 같은 결론에 도달했고 이번 라운드에서 grep 으로
    재검증했다.

- **[INFO]** 모듈 스코프 공유 가변 정규식(`LINK_RE`, `g` 플래그)의 `lastIndex` 상태 — 신규 위험 아님
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82` (`const LINK_RE = /\[([^\]]*)\]\(([^)\n]+)\)/g;`), 사용 직전 리셋 `:213` (`LINK_RE.lastIndex = 0`).
  - 상세: `g` 플래그 정규식은 호출 간 `lastIndex` 를 들고 가는 전역 가변 상태이지만, 매
    `extractLinks()` 호출 직전에 명시적으로 0 으로 리셋하고 `findBrokenLinksInFiles`
    (`:288-359`)의 파일별 순차 `for`-루프 안에서만 호출되므로 동시 접근·재진입이 없다.
    diff 이전에도 존재하던 패턴(예전엔 줄마다 리셋)이라 이번 변경이 새로 만든 위험은 아니다.
  - 제안: 조치 불요. 향후 `extractLinks` 가 병렬/재진입 경로로 확장되면 재검토.

- **[INFO]** 신규 테스트 fixture 의 파일시스템 부작용은 저장소 밖(OS 임시 디렉터리)에 격리됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 `describe`
    블록들의 `beforeAll`/`afterAll` (예: `fs.mkdtempSync(path.join(os.tmpdir(), "extract-links-ml-"))`,
    `fs.mkdtempSync(path.join(os.tmpdir(), "ml-broken-"))`).
  - 상세: 각 블록이 서로 다른 prefix 로 `mkdtempSync` 를 호출해 고유한 임시 경로를 받고
    `afterAll` 에서 `fs.rmSync(root, { recursive: true, force: true })` 로 정리한다. 전역
    변수·모듈 스코프 상태를 공유하지 않으므로 병렬 워커 간 충돌·잔존 파일 위험이 없다.
    저장소 트리에 대한 의도치 않은 쓰기·삭제는 없다.
  - 제안: 없음 (양호).

- **[INFO]** (라운드 2·3에서 이미 WARNING 으로 보고 후 두 차례 "무조치" 로 처분됨 — 현재도
  안전함을 재확인만 함, carry-forward) 이 PR 이 스스로 두 번 겪은 트리거 문자열
  (`` [a]`code`(b) `` 계열: 인라인 코드 마스킹이 예시 문구를 진짜 링크로 재구성하는 패턴)이
  같은 커밋에 포함되는 과거 리뷰 산출물 안에 펜스 없이 여전히 남아 있다.
  - 위치: `review/code/2026/08/29/14_36_39/RESOLUTION.md:19`, `review/code/2026/08/29/14_36_39/SUMMARY.md:10`,
    `review/code/2026/08/29/14_36_39/requirement.md:18`·`:68`, `review/code/2026/08/29/15_01_34/requirement.md`
    상단, `review/code/2026/08/29/15_01_34/documentation.md:12`, `review/code/2026/08/29/15_01_34/side_effect.md:15-16`
    등 (인용 형태로 재인용된 곳 다수).
  - 상세: 이번 라운드에서 직접 재확인 — 이 4개 공개 스캔 진입점(`findBrokenLinks`,
    `findBrokenGovernanceLinks`, `findBrokenSpecLinksInSources`, `findBrokenPlanLinks`)은
    현재도 전부 `review/**` 를 스캔 대상에서 제외한다: `collectGovernanceMarkdown`
    (`:393-403`)의 루트 수집이 `recurse: false`(`:394-397`)라 `review/` 하위로 내려가지
    않고, `collectLivePlanMarkdown`(`plan-scan.ts:78-80`)은 `plan/in-progress` 비재귀,
    `collectSpecMarkdown`(`:252-257`)·`collectCodebaseSources`(`:473-478`)는 애초에 다른
    트리만 본다. 따라서 이 문자열들은 지금도 실행 경로에 닿지 않아 안전하다. 다만 이
    사실은 **명시된 계약이 아니라 네 스코프 함수 코드를 직접 읽어야만 알 수 있는 암묵적
    전제**이며, 라운드 2(Warning #4)·라운드 3(Warning #2, "무조치" 로 명시 처분)이 이미
    같은 결론과 같은 처분("과거 라운드 산출물은 역사적 기록으로 보존, 스코프 확장 시
    재검토")에 도달했다. 이번 라운드에서도 새로운 인스턴스나 새로운 위험은 발견되지 않았다.
  - 제안: 즉시 조치 불요(2회 연속 명시적으로 처분된 사안). `collectGovernanceMarkdown`
    근처에 "이 배제가 깨지면 `review/**` 안의 과거 리뷰 산출물 트리거 문자열이 위험해진다"
    는 한 줄 교차 참조를 남기면 향후 스코프 확장 시 재조사 없이 드러나겠지만, 이 제안
    자체가 이미 두 라운드 연속 미반영으로 남아 있어 이번에도 blocking 사유로 격상하지
    않는다.

## 시그니처/인터페이스/전역변수/환경변수/네트워크/이벤트 관점 요약

- **시그니처 변경**: 없음. `extractLinks`, `findBrokenLinks`, `findBrokenGovernanceLinks`,
  `findBrokenSpecLinksInSources`, `findBrokenPlanLinks` 모두 매개변수·반환 타입 동일.
- **새 전역 변수**: 없음. `LINK_RE`/`FENCE_RE`는 기존에도 모듈 스코프 상수였고 `LINK_RE`
  리터럴 내용만 바뀌었다. 신규 `MaskedDoc` 인터페이스·`buildMaskedDoc`/`lineForOffset` 헬퍼는
  순수 함수이며 모듈 스코프 상태를 새로 만들지 않는다.
- **파일시스템 부작용**: 테스트는 OS 임시 디렉터리(`os.tmpdir()`)에만 쓰고 `afterAll` 에서
  정리한다. `review/**` 신규 파일은 프로젝트 관례에 부합하는 의도된 산출물이다.
- **환경 변수**: 읽기/쓰기 없음(`process.env` 참조 0건, grep 확인).
- **네트워크 호출**: 없음(`fetch`/`http`/`https` 참조 0건, grep 확인).
- **이벤트/콜백**: 없음 — 순수 동기 함수, 콜백 등록·해제 없음.
- `plan/in-progress/harness-review-gate-followups.md` 변경은 체크박스·서술 텍스트뿐이며 코드
  실행에 영향 없음.

## 요약

핵심 코드 변경(`extractLinks()` 재구현)은 함수 시그니처를 그대로 유지하고, 새 전역 상태를
도입하지 않으며, 파일시스템·네트워크·환경변수 접근 패턴에 새로운 부작용을 만들지 않는다.
반환값이 의미적으로 넓어진 것(멀티라인 링크 포착, `raw` 의 개행 포함 가능)은 의도된 변경이고
grep 전수 확인 결과 외부 소비처에 실질 파급이 없다. 3회에 걸친 이전 라운드가 반복 검증한
`LINK_RE.lastIndex` 상태·테스트 fixture 격리 항목도 이번 라운드에서 재확인했고 이상 없다.
유일하게 남는 관찰은 이 PR 이 두 차례 스스로 겪은 트리거 문자열이 같은 커밋의 과거 리뷰
산출물(`14_36_39`/`15_01_34`) 안에 펜스 없이 남아 있다는 점인데, 4개 스캔 진입점 코드를 직접
읽어 지금도 `review/**` 가 전부 스코프 밖임을 재확인했고, 이 사안은 이미 두 라운드 연속
"무조치" 로 명시 처분돼 있어 이번에도 blocking 사유로 올리지 않는다. 저장소를 뮤테이션하지
않고 읽기 전용 검증만 수행했으며 `git status --short` 로 시작·종료 시점 모두 저장소가
깨끗함을 확인했다(세션 산출물 디렉터리 외 변경 없음).

## 위험도

NONE
