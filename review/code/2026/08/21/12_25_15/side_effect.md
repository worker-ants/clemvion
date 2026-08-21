# 부작용(Side Effect) 리뷰 — masked-marker-contract (라운드3, 12_25_15)

## 검토 방법

전체 diff(37개 non-review 파일) 대상. 프롬프트가 diff 를 생략한 신규/기존 repo-guard 파일
(`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
`.test.ts`)은 `Read` 로 현재 저장소 상태를 직접 열어 확인했다. 본 PR 은 앞선 두 라운드
(`11_27_29`, `11_53_49`)에서 이미 side_effect 리뷰를 거쳤고 그때 WARNING 은 0건(위험도 LOW)이었다
— 이번 라운드는 그 두 라운드 사이·이후에 발생한 fix 커밋(`bf0618a7d`, `1f63bbbef`)이 새 부작용을
들여왔는지에 집중했다.

## 발견사항

- **[INFO]** 신규 미러 소멸 가드(backend·frontend 양쪽)가 `codebase/*/src` 하위 전체를 매 테스트
  실행마다 재귀 순회하며 파일을 읽는다 — 부작용은 없으나(순수 read), 이 순회가 리포지토리
  성장에 따라 계속 커진다는 점만 기록
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수
    `listSourceFiles`(재귀 `fs.readdirSync`)· `findMirrorRedeclarations`(각 파일 `fs.readFileSync`) /
    frontend 쪽 동일 이름 함수(`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`)
  - 상세: 두 가드 모두 `resolveScanDirs`→`listSourceFiles`→`fs.readFileSync` 로 `codebase/backend/src`·
    `codebase/frontend/src`·`codebase/channel-web-chat/src` 전체(.ts/.tsx, node_modules·dist 제외)를
    디스크에서 읽는다. 쓰기·삭제·네트워크·환경변수 접근은 전혀 없어 "부작용"은 아니다. 다만 이
    파일 I/O 는 `SOT_DIR`(=`codebase/packages/masked-markers`) 자기 제외 분기가 **현재 도달 불가**
    (`codebase/packages/src` 디렉터리가 존재하지 않아 `resolveScanDirs` 결과에 `packages` 자체가
    걸리지 않음, 직접 확인: `ls codebase/` → `backend/channel-web-chat/frontend/packages` 뿐)라는
    이전 라운드에서 이미 INFO 로 기록된 사실과 같은 갈래다 — 새로운 위험은 아니고 재확인.
  - 제안: 조치 불요(이미 두 라운드 전 리뷰에서 동일 결론).

- **[INFO]** `pnpm-lock.yaml` 에 이번 라운드에도 PR 의도(마커 SoT 패키지 추출)와 무관한
  `eslint-config-next` peer-dependency 해석 그래프 재구성이 남아 있다 — 버전 변경 없음, 이전 두
  라운드의 동일 판정을 재확인
  - 위치: `pnpm-lock.yaml` — `git diff origin/main...HEAD -- pnpm-lock.yaml` 기준 총 128줄 변경 중
    `masked-markers` 문자열을 포함하는 줄은 5줄뿐이고 나머지 123줄이 `eslint-config-next@16.3.0(...)`
    /`eslint-import-resolver-typescript`/`eslint-plugin-import` 의 peer-resolution 괄호 체인
    재구성·`devDependencies` 블록 이동이다(직접 `git diff` 로 재확인).
  - 상세: `eslint-config-next` 자체 버전(`16.3.0`)은 불변이고, 신규 workspace 패키지 추가로
    `pnpm install` 이 peer-dep variant 트리를 재계산한 부수효과다. `11_27_29`/`11_53_49` 두 라운드
    모두 이 항목을 INFO·조치불요로 판정했고, 라운드3 에서도 동일 결론 — 새 회귀 없음.
  - 제안: 조치 불요.

- **[INFO]** frontend `MASKED_MARKERS` 의 재export 타입이 `ReadonlySet<string>` → `readonly string[]`
  로 바뀐 것(이전 라운드에서 이미 지목, 재확인만)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56` (`export { isMaskedMarker, MASKED_MARKERS };`)
  - 상세: `grep -rn "MASKED_MARKERS" codebase/frontend/src` 로 현재 소비처를 재확인 — `dynamic-form-ui.test.tsx`,
    `lib/utils/__tests__/masked-markers.test.ts` 둘 다 `[...MASKED_MARKERS]` 스프레드만 사용해 `Set`/배열
    양쪽에서 동일 동작. `.has(...)` 호출부는 저장소 전체에 없다. 실제 파손 없음 — 이전 라운드 판정 유지.
  - 제안: 조치 불요.

- **[INFO]** `.github/workflows/frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 를
  추가한 것은 그 워크플로가 **트리거되는 조건 자체**를 넓히는 부작용을 가지지만, 의도된 것이고
  올바르게 스코프됨(재확인)
  - 위치: `.github/workflows/frontend-checks.yml` (`with: pathspecs:` 블록, `codebase/channel-web-chat/**` 추가)
  - 상세: 이 파일을 편집한 잡(`frontend-checks`)은 web-chat 전용 변경에도 이제 항상 실행된다 —
    "이벤트/트리거 변경"에 해당하는 부작용이지만, 그 목적이 정확히 이번 PR 의 핵심(마커 미러
    소멸 가드가 세 번째 스택에서도 최소 한 번은 실행되게 하는 것)과 일치하고, `web-chat-checks.yml`
    이 이 가드를 대신 돌릴 수 없다는 사실(그 잡은 `channel-web-chat...` 만 설치)도 `11_53_49`
    라운드에서 실측·기록됐다. 부작용의 방향(더 많이 실행됨)이 안전한 쪽이라 위험 아님.
  - 제안: 조치 불요.

## 확인했으나 문제 없음으로 판정한 항목 (참고)

- **backend 소비처 시그니처·값 불변**: `websocket.service.ts`(`DEPTH_MASK_MARKER`/`KEY_MASK_MARKER`),
  `reject-masked-resubmission.ts`(`MAX_REDACT_DEPTH`/`isMaskedMarker`), `interaction.service.ts`
  (`MAX_REDACT_DEPTH`) 세 소비처 모두 여전히 `shared/utils/sanitize-error-message` 에서 import 하며
  (`grep` 으로 import 경로 재확인), 값(`MAX_REDACT_DEPTH === MAX_MASK_DEPTH === 10`, 마커 리터럴
  3종)과 `isMaskedMarker(v: unknown): boolean` 시그니처가 이관 전후로 동일함을 확인 — 호출자
  영향 없음.
- **repo-guard 신규 파일의 `typescript` import**: `__tests__`/`repo-guards` 경로 아래라 프로덕션
  빌드 제외 — 직전 라운드 RESOLUTION 이 `production-build-devdep` 가드(36/36 GREEN)로 이미 실측
  검증.
- **환경 변수 읽기/쓰기**: 이번 diff 범위(37 파일) 전체에서 `process.env` 접근 신규 도입 없음.
- **네트워크 호출**: 신규/변경 코드 어디에도 없음(순수 값 상수·AST 파싱·파일시스템 read-only).
- **전역 변수**: `MASKED_MARKERS`(`Object.freeze` 된 배열)·`SOT_SYMBOLS`(모듈 최상위 상수, 파생값)는
  모듈 스코프 상수이고 런타임에 재할당되지 않는다. 테스트가 `push()` 시도를 `toThrow(TypeError)`
  로 직접 검증.

## 요약

라운드1(`11_27_29`)·라운드2(`11_53_49`)에서 이미 side_effect 관점 WARNING 은 0건이었고, 두 라운드
사이 fix 커밋(경로 게이팅 재도입 수정, 감시 목록 파생화, 세 번째 스택 커버)은 CI 트리거 표면과
가드 감시 목록을 바꿨을 뿐 시그니처·인터페이스·전역 상태·환경변수·네트워크 축에서 새 부작용을
들여오지 않았다. `Read`/`grep` 으로 재확인한 현재 코드 상태(신규 repo-guard 두 파일 포함) 는 전부
read-only 파일시스템 스캔(테스트 전용, 빌드 제외)이고, backend/frontend 재export shim 은 기존
소비처의 import 경로·시그니처·값을 정확히 보존한다. 남은 항목은 전부 이전 라운드에서 이미
식별·판정된 INFO(무관한 lockfile peer-dep 재정렬, `Set`→배열 타입 변화이나 무영향, 의도된 CI
트리거 확장)의 재확인이며 신규 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도
LOW
