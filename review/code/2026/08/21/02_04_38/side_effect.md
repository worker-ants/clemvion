# 부작용(Side Effect) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (라운드5 — repo-guard 추가)

## 검토 범위

`git show --stat 54142453c` 로 이번 라운드(직전 `01_38_26` 이후)의 실질 diff를 확정했다. 신규
코드는 두 파일뿐이다:

- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규, 순수 스캔/판정 로직)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규, 소비 spec)

나머지 15개 변경 파일은 전부 `review/code/2026/08/21/01_38_26/**` 산출물(직전 라운드의 리뷰
기록)이라 실행 경로 코드가 아니다.

애플리케이션 런타임 코드(`executions.service.ts`, `workflows.controller.ts`,
`reject-masked-resubmission.ts`, `sanitize-error-message.ts`, `trigger-parameter.types.ts`)는
이번 라운드에서 **변경되지 않았다** — 직전 세 라운드(`00_03_57`/`00_39_27`/`01_15_47`)와
그 side-effect 리뷰(`01_38_26/side_effect.md`, 위험도 LOW, CRITICAL/WARNING 0)가 이미 독립
재검증을 마친 상태 그대로다. `Read`로 실물 대조해 그 결론이 여전히 유효함을 확인했다 —
`MASKED_MARKERS` 는 `Object.freeze(new Set(...))` 로 export 되어 있고(`sanitize-error-message.ts:150`),
두 호출부는 여전히 `resolveTriggerParametersRejectingMasked` 로 drop-in 치환된 상태다.

## 발견사항

- **[INFO]** 신규 repo-guard 가 테스트 시점에 `src/` 트리 전체를 재귀적으로 파일시스템 읽기(fs.readdirSync/fs.readFileSync)한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수 `listSourceFiles`(41~56행), `findUnexpectedCallers`(85~94행)
  - 상세: `findUnexpectedCallers` → `listSourceFiles(srcDir)` 가 `node_modules`/`dist` 를 제외한 `backend/src` 하위 모든 `.ts` 를 순회하며 각 파일을 `fs.readFileSync` 로 읽는다. 쓰기·삭제·이름변경은 없고 전부 읽기 전용이다. 같은 디렉터리의 기존 자매 가드(`eslint-unicorn-peer-guard.ts` + `eslint-unicorn-peer.spec.ts`)가 이미 같은 패턴(파서 순수 로직 분리 + 전체 트리 스캔)을 쓰고 있어, 이번 변경이 새로운 부작용 클래스를 도입하는 것이 아니라 기존 규약을 그대로 따른 것임을 확인했다.
  - 제안: 조치 불요. 참고 등재만.

- **[INFO]** 신규 export(`BASE_FN`, `ALLOWED_DIRECT_CALLERS`, `listSourceFiles`, `importsBaseFn`, `findUnexpectedCallers`)는 전부 테스트 전용 신규 심볼이라 기존 공개 인터페이스에 영향이 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 전체
  - 상세: 파일 자체가 신규이므로 기존 시그니처 변경·호출자 영향이 없다. `ALLOWED_DIRECT_CALLERS` 는 `readonly string[]` 이고 모듈 스코프 상수로만 존재해 런타임에 다른 모듈이 이를 공유·변형할 경로가 없다(egress 마스킹의 `MASKED_MARKERS` 처럼 프로세스 전역에서 여러 판정기가 공유하는 상태가 아니다).
  - 제안: 조치 불요.

- **[INFO]** `webhook`/`schedule` 두 어댑터는 이번 라운드에서도 여전히 base `resolveTriggerParameters` 를 직접 호출 — grep 으로 재확인
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:183`, `codebase/backend/src/modules/schedules/schedule-runner.service.ts:78,88`
  - 상세: 두 파일 모두 이번 diff 밖이며, 신규 가드의 `ALLOWED_DIRECT_CALLERS` 허용목록에 명시적으로 등재되어 있다. 가드 캐너리(`[캐너리] 허용목록 항목이 전부 실제 스캔에 잡힌다`)가 이 두 경로가 실제로 base 를 import 하는지를 매 실행 시 재검증하므로, 두 파일이 옮겨지거나 이름이 바뀌면 죽은 항목으로 잡혀 이 side-effect 경계(Manual 경로만 거부, 외부 저작 페이로드는 배제)가 조용히 무너지는 것을 막는다.
  - 제안: 조치 불요. 의도된 스코프 경계가 이번 라운드로 오히려 더 견고해졌다.

## 요약

이번 라운드의 실질 diff는 순수 스캔/판정 로직(파일시스템 **읽기 전용**, 네트워크·환경변수·전역
가변 상태 없음)을 담은 repo-guard 테스트 파일 2개뿐이며, 기존 자매 가드(`eslint-unicorn-peer-*`)와
동일한 검증된 패턴을 그대로 따른다. 애플리케이션 런타임 코드(엔드포인트 시그니처, 에러 봉투,
마스킹 판정 함수)는 이번 라운드에서 손대지 않았고, 직전 라운드(`01_38_26`)가 독립적으로 재검증해
LOW/무발견으로 수렴한 상태가 그대로 유지됨을 실물 대조로 확인했다. 새 가드는 오히려
`resolveTriggerParametersRejectingMasked` 를 우회해 마커 거부를 건너뛰는 미래의 회귀(세 번째
Manual 경로가 base 를 잘못 import)를 컴파일 타임이 아니라 테스트 타임에 잡아, "허용되지 않은
곳에서 부작용이 조용히 사라지는" 시나리오를 오히려 좁힌다. 부작용 관점에서 새로 도입된 위험은
없다.

## 위험도

NONE
