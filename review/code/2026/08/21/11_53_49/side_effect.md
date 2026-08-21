# 부작용(Side Effect) 리뷰 — masked-marker-contract-7d2e14 (11_53_49)

이 세션은 직전 라운드(`11_27_29`)의 WARNING 3건에 대한 RESOLUTION 적용분(backend 미러 가드 신설,
spec R17 갱신, 리터럴 pin 테스트 추가)을 포함한 최종 diff다. 신규로 추가된 부분(특히 backend
`repo-guards` 스캐너)을 중심으로 재검증하고, 기존에 이미 검증된 항목은 재확인만 수행했다.

## 발견사항

- **[INFO]** 신규 backend repo-guard(`masked-marker-mirror-guard.ts`)가 저장소 세 트리(backend/
  frontend/channel-web-chat) 전체를 재귀 `fs.readdirSync`/`fs.readFileSync` 로 스캔하는 test-time
  파일시스템 부작용을 추가한다 — 프로덕션 비침투 여부를 직접 확인했다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 함수
    `listSourceFiles`(45행대)·`findMirrorRedeclarations`(105행대)
  - 상세: 이 스캔은 Jest 실행 시에만 발동하며, `codebase/backend/tsconfig.build.json:16` 에
    `"src/repo-guards/**"` 가 build exclude 목록에 있음을 직접 grep 으로 확인해 프로덕션 번들에
    새지 않음을 재검증했다(RESOLUTION.md 의 "production-build-devdep 가드 36/36 GREEN" 주장과
    일치). frontend 형제 파일(`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`)
    도 동일 패턴이며 `__tests__/` 디렉터리는 Next.js 앱 코드에서 import 되지 않으므로 번들 유입
    경로가 없다. 런타임 영향 없음 — 확인 기록.
  - 제안: 조치 불요.

- **[INFO]** 두 스택의 미러-소멸 캐너리 테스트가 `os.tmpdir()` 아래 임시 디렉터리를 만들고
  파일을 쓴다 — 정리 경로가 실패 시에도 보장됨을 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (`it('[캐너리] 실제
    재선언을 지목한다 (합성 fixture)', ...)`, `fs.mkdtempSync`~`finally { fs.rmSync(...) }` 블록) /
    형제 파일 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` 동일 구조
  - 상세: `mkdtempSync` → `writeFileSync` ×2 → 단언 → `finally { fs.rmSync(tmp, { recursive: true,
    force: true }) }`. 단언이 던져도 `finally` 가 실행되어 임시 파일이 남지 않는다. 저장소 소스
    트리 밖(OS 임시 디렉터리)에서만 쓰고 지우므로 실제 저장소에 대한 파일시스템 부작용은 없다.
  - 제안: 없음(정상 패턴 확인용 기록).

- **[INFO]** frontend `MASKED_MARKERS` 의 타입이 `ReadonlySet<string>` → `readonly string[]` 로
  바뀌는 인터페이스 변경 — 기존 소비처 전수 확인 결과 무해
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:56` (`export { isMaskedMarker,
    MASKED_MARKERS };` — `@workflow/masked-markers` 의 `readonly string[]` 를 그대로 재export)
  - 상세: 이전에는 프런트 로컬 정의가 `new Set([...])` 였다. `grep -rn "MASKED_MARKERS"
    codebase/frontend/src` 로 정의 파일 밖 소비처를 전수 확인한 결과 `dynamic-form-ui.test.tsx:601`
    과 `masked-markers.test.ts:27,34` 단 둘이며, 둘 다 `[...MASKED_MARKERS]` 스프레드만 사용해
    `Set`/배열 어느 쪽에서도 동일하게 동작한다. `.has()` 를 쓰는 소비처는 없다 — 이번 diff 안에서
    실제 파손은 없다. (직전 라운드 side_effect.md 가 이미 지적한 항목이며 독립적으로 재확인했다.)
  - 제안: 조치 불요. 향후 이 모듈을 새로 소비하는 코드가 `.has()` 를 가정하면 컴파일 타임에
    걸리므로 런타임 위험은 없다.

- **[INFO]** backend `sanitize-error-message.ts` 의 re-export 전환이 이름·값·시그니처를 전부
  보존함을 직접 대조로 확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:10-17`(import),
    `:128`(`export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;`), `:130-137`(`export { VALUE_MASK_MARKER,
    KEY_MASK_MARKER, DEPTH_MASK_MARKER };`), `:167`(`export { MASKED_MARKERS };`),
    `:176`(`export { isMaskedMarker };`)
  - 상세: `isMaskedMarker(v: unknown): boolean` 시그니처, 마커 리터럴(`'***'`/`'[REDACTED]'`/
    `'[REDACTED_DEPTH]'`), `MAX_REDACT_DEPTH` 값(10) 전부 이관 전후 동일함을 `codebase/packages/
    masked-markers/src/index.ts` 원본과 직접 대조해 확인했다. export 되는 심볼 이름·개수도
    변경 없음 — 기존 소비처(EIA §R17 재제출 거부 가드, WS emit 마스킹 등) 영향 없음.
  - 제안: 없음(긍정 확인).

- **[INFO]** `pnpm-lock.yaml` 에 이 PR 의도(마커 SoT 추출)와 무관한 `eslint-config-next` peer-dep
  해석 재정렬이 여전히 동반됨 (직전 라운드에서 이미 지적·검증된 항목의 재확인)
  - 위치: `pnpm-lock.yaml` — 신규 workspace 항목(`codebase/packages/masked-markers:` 섹션,
    `@workflow/masked-markers` workspace 링크) 외에 `eslint-import-resolver-typescript`/
    `eslint-module-utils`/`eslint-plugin-import` 스냅샷 키 재구성 hunk
  - 상세: 이전 리뷰 라운드가 `git log -- pnpm-lock.yaml` 로 버전 불변·`pnpm install` 재해석
    부산물임을 이미 확인했고, 이번 최종 diff 에도 동일 형태로 남아 있다. 네트워크 호출·버전
    변경 없음.
  - 제안: 조치 불요.

## 요약

이번 diff 는 시그니처·인터페이스·전역 상태·환경 변수·네트워크 호출 어느 축에서도 CRITICAL/WARNING
급 부작용을 만들지 않는다. 핵심은 backend/frontend 에 손으로 복제되던 마커 상수·판정 함수·깊이
상한을 `@workflow/masked-markers` 로 추출하고 두 소비처는 이름을 유지한 채 재export 하는 것이며,
값·시그니처(`isMaskedMarker(v: unknown): boolean`, 마커 리터럴 3종, 깊이 상한 10)를 원본과 직접
대조해 동일함을 확인했다. 유일한 인터페이스 변화(`MASKED_MARKERS`: `ReadonlySet` → `readonly
string[]`)는 소비처 전수 확인(스프레드만 사용)으로 실질 파손이 없음을 검증했다. 이번 라운드에서
새로 추가된 backend `repo-guards` 미러 가드는 test-time 에만 저장소 전체를 재귀 스캔하는 fs
부작용을 갖지만 프로덕션 빌드 exclude(`tsconfig.build.json`)로 격리돼 있고, 캐너리가 만드는 임시
파일은 `finally` 로 항상 정리된다. 남은 항목(`pnpm-lock.yaml` 무관 재정렬)은 이미 검증된 노이즈의
재확인이다. 전부 INFO 수준이며 조치 불필요.

## 위험도
LOW
