# 부작용(Side Effect) 리뷰

## 검증 방법

`git diff --stat origin/main...HEAD`(98 files, +6726/-393)를 확인한 뒤, 실질 코드 변경분
(`codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` 신규,
`guide-identifier-scan.ts` 신규, `guide-error-code-existence.test.ts`/`guide-error-code-scan.ts`
삭제, `guide-sanitized-message-parity.test.ts` 주석 4줄 수정)을 현재 워크트리에서 직접 `Read` 로
열어 재검증했다. 이번 changeset 은 이전 두 라운드(`review/code/2026/09/13/14_41_14`,
`15_03_06`, `15_24_12`)가 이미 검토한 코드에 대한 **fix 반영 누적본**이므로, 그 라운드들이
side_effect 관점에서 지적한 항목이 실제로 해소됐는지를 우선 확인했다. 저장소는 뮤테이션하지
않았다(`git status --short` — 이 세션 산출물 2개 디렉터리 외 변경 없음).

## 발견사항

해당 없음 — CRITICAL/WARNING 없음. 이전 라운드가 지적한 두 WARNING 은 아래와 같이 해소가
직접 확인된다.

- **[INFO]** (해소 확인) 리네임 후 자매 파일의 죽은 파일명 참조 — 라운드 1 WARNING
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16`
  - 상세: 라운드 1(`14_41_14/side_effect.md` WARNING#1)이 지적한 자리다. 현재 소스를 직접
    열어 확인한 결과 `` 자매 `guide-identifier-existence.test.ts`(`#1330` 당시
    `guide-error-code-existence.test.ts`)는 `` 로 신·구 이름이 병기돼 있다. `grep -rn
    "guide-error-code" codebase/ CHANGELOG.md PROJECT.md spec/ plan/` 재실행 결과 남은 참조는
    전부 의도된 역사 서술(`guide-identifier-scan.ts:9` 주석, `CHANGELOG.md:77`, `plan/**` 트래커
    문서)뿐이고 활성 참조(예: import·실행 경로)는 0건이다.
  - 제안: 없음(해소).

- **[INFO]** (해소 확인) `composeTexts` 가 저장소 루트의 모든 `.yml`/`.yaml`(락파일 포함)을
  읽던 스코프 과다 — 라운드 1 WARNING
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:55-58`
  - 상세: 라운드 1(`14_41_14/side_effect.md` WARNING#2)이 지적한 "이름·JSDoc 은 compose 파일을
    말하는데 구현은 확장자만 본다" 문제다. 현재 코드는
    `.filter((f) => /^docker-compose.*\.ya?ml$/.test(f))` 로 파일명까지 좁혀졌고, 바로 위
    주석이 종전 판의 문제(`pnpm-lock.yaml` 784KB 포함)와 변경 근거를 함께 남기고 있다. 이제
    저장소 루트에 새 비-compose YAML(CI 워크플로 사본, k8s 매니페스트 등)이 추가돼도 이
    스캐너의 읽기 대상에 조용히 편입되지 않는다.
  - 제안: 없음(해소).

- **[INFO]** 신규 모듈은 순수 함수 + 읽기 전용 파일시스템 접근만 사용
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 전체,
    `guide-identifier-existence.test.ts` 전체
  - 상세: `scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations` 모두 인자로
    받은 텍스트만 다루는 순수 함수다. 부작용은 `fs.readFileSync`/`fs.readdirSync`/
    `fs.existsSync` 를 통한 **읽기**뿐이며, `writeFile`/`unlink`/`rmSync`/`mkdirSync`/
    `appendFile`/`process.env` 쓰기를 grep 했으나 매치 0건이다. 네트워크 호출(`fetch`/`axios`
    등)도 없다. 신규 모듈-레벨 export `GUIDE_EXTERNAL_VOCABULARY` 는 `readonly` 배열이고
    다른 파일에서 import 되지 않으며(grep 확인) 어디서도 원소를 push/splice 하지 않는다 —
    새 가변 전역이 아니다.
  - 제안: 없음(정보성).

- **[INFO]** 삭제된 모듈에 대한 잔존 참조 없음 — 시그니처/인터페이스 삭제가 다른 호출자에
  영향 없음
  - 위치: 저장소 전수 grep(`guide-error-code-scan`/`guide-error-code-existence` import 참조)
  - 상세: `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` 를 import 하던 곳은
    그 두 파일(둘 다 이번 changeset 에서 함께 삭제) 뿐이었다. `.claude/**`(하네스 스크립트)에도
    옛 파일명을 참조하는 곳이 없다.
  - 제안: 없음(정보성).

## 요약

이번 changeset(누적 5개 커밋)의 실질 코드는 문서 검증용 vitest 정적 스캐너의 리네임·재설계
(`guide-error-code-*` → `guide-identifier-*`, 환경변수 축 추가, 허용목록 4강제 도입)이며,
전부 순수 함수 + 읽기 전용 파일시스템 접근으로 구성되어 있다. 프로덕션 런타임 경로·전역
가변 상태·환경변수 쓰기·네트워크 호출·이벤트/콜백 어느 것도 건드리지 않는다. 라운드 1이
지적한 두 부작용성 WARNING(자매 파일의 죽은 이름 참조, `composeTexts` 의 의도보다 넓은 파일
스코프)은 현재 소스에서 직접 재확인한 결과 라운드 2에서 실제로 고쳐졌다. 신규 발견된
CRITICAL/WARNING 은 없다.

## 위험도

NONE
