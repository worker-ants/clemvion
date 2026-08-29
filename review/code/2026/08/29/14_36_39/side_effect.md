# 부작용(Side Effect) 리뷰

## 검토 범위

- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 신규 테스트 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` — `extractLinks()` 를 줄 단위 매칭에서 마스킹된 전문(全文) 매칭으로 재구현
- `plan/in-progress/harness-review-gate-followups.md` — 체크박스 갱신 + 해소 근거 서술 추가

뮤테이션 없이 정적 분석만 수행했다 (저장소 트리 변경 없음, `git status --short` 로 확인 — 세션 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** 공개 함수 `extractLinks()` 의 반환값 계약이 넓어진다 (동작 변경, 시그니처는 동일)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:131` (`export function extractLinks`)
  - 상세: 시그니처(`(absPath: string): MdLink[]`)는 그대로이지만, 링크 텍스트가 여러 줄에 걸친 경우를 이제 포착한다. 내부 호출자는 `findBrokenLinksInFiles`(같은 파일 267행) 하나뿐이고, 이를 통해 `findBrokenLinks` / `findBrokenGovernanceLinks` / `findBrokenSpecLinksInSources` / `findBrokenPlanLinks` 네 공개 진입점 모두가 이번 변경으로 더 많은 링크를 검사 대상에 포함시킨다. 이 네 진입점은 `spec-link-integrity.test.ts`, `plan-frontmatter.test.ts` 등 라이브 저장소를 스캔하는 기존 가드 테스트에서 이미 소비되고 있어, 반환값이 넓어지면 그 가드들이 새로 RED 가 될 수 있는 구조다.
  - 다만 `plan/in-progress/harness-review-gate-followups.md` 에 실측(뮤테이션 3건 + 라이브 트리 전수 GREEN 확인)이 기록되어 있어, 이번 변경 시점 기준으로는 부작용이 실현되지 않았음을 확인했다. 이후 이 폭이 넓어진 채로 남는다는 점만 인지하고 있으면 된다.
  - 제안: 별도 조치 불요 — 근거가 이미 plan 문서에 기록되어 있음. 참고용으로 기재.

- **[INFO]** 모듈 스코프의 공유 가변 정규식(`LINK_RE`, `g` 플래그)이 계속 유지된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:82` (`const LINK_RE = ...`), 사용처 169~171행
  - 상세: `LINK_RE` 는 파일 스코프 상수이며 `g` 플래그로 인해 `lastIndex` 상태를 갖는다. 매 `extractLinks()` 호출마다 `LINK_RE.lastIndex = 0` 으로 초기화하므로 현재의 동기·단일 스레드 호출 패턴(파일별 순차 for-loop, `findBrokenLinksInFiles` 251~322행)에서는 상태 누수가 없다. 이 패턴 자체는 diff 이전에도 동일하게 존재했고(예전엔 줄마다 리셋, 지금은 전체 텍스트에 대해 1회 리셋), 이번 변경이 새로 도입한 위험은 아니다 — 향후 `extractLinks` 가 병렬/재진입 호출로 확장될 경우에만 문제가 될 수 있는 잠재 리스크로만 기록한다.
  - 제안: 현재 호출 패턴에서는 조치 불필요. 향후 병렬화 시 `lastIndex` 공유를 재검토할 것.

- **[INFO]** 테스트 픽스처의 파일시스템 부작용은 저장소 밖(OS 임시 디렉터리)에 격리되어 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:277-281`, `337-346` (신규 `describe` 블록의 `beforeAll`/`afterAll`)
  - 상세: 신규 테스트 두 블록 모두 `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 저장소 밖 임시 디렉터리를 만들고 `afterAll` 에서 `fs.rmSync(root, { recursive: true, force: true })` 로 정리한다. 기존 파일의 다른 `describe` 블록과 동일한 패턴이라 저장소 트리에 대한 의도치 않은 쓰기·삭제는 없다.
  - 제안: 없음 (양호).

## 시그니처/인터페이스/전역변수/환경변수/네트워크/이벤트 관점 요약

- 시그니처 변경: 없음. `extractLinks`, `findBrokenLinks`, `findBrokenGovernanceLinks`, `findBrokenSpecLinksInSources`, `findBrokenPlanLinks` 모두 매개변수·반환 타입 동일.
- 새 전역 변수: 없음. `LINK_RE`, `FENCE_RE` 는 기존에도 모듈 스코프 상수였고, 정규식 리터럴 내용만 바뀌었다.
- 환경 변수 읽기/쓰기: 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 (순수 동기 함수, 콜백 등록·해제 없음).
- plan 문서(`harness-review-gate-followups.md`) 변경은 체크박스·서술 텍스트뿐이며 코드 실행에 영향 없음.

## 요약

이번 변경은 `extractLinks()` 를 줄 단위 정규식 매칭에서 마스킹된 전문 매칭으로 재구현한 순수 리팩터링으로, 함수 시그니처·전역 상태 도입·파일시스템/네트워크/환경변수 접근 패턴에 새로운 부작용을 만들지 않는다. 유일하게 주목할 지점은 `extractLinks()` 의 반환값이 의미적으로 넓어져(멀티라인 링크 포착) 그 위에 있는 4개의 공개 가드 함수 전부가 더 많은 링크를 검사하게 된다는 점인데, 이는 의도된 변경이고 plan 문서에 뮤테이션 검증과 라이브 트리 전수 재확인(모두 GREEN) 근거가 이미 남아 있다. 저장소를 오염시키는 뮤테이션 작업 없이 정적 검토만 수행했으며 `git status --short` 로 저장소가 깨끗함을 확인했다.

## 위험도

NONE
