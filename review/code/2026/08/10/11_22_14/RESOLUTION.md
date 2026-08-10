# RESOLUTION — `11_22_14` 라운드

forced 7명 전원 리포트 확보. **Critical 0**, WARNING 1건(maintainability)은 아래대로 조치했고
나머지는 INFO 다.

## 조치한 것

### WARNING — `_shared.ts` 의 공개 심볼 중 `repoRoot` 만 소유 모듈에서 방어된다 (maintainability)

**지적**: `shared.test.ts` 는 "소유 모듈에 회귀 테스트가 없고 소비자 스위트에만 간접
커버리지가 있으면, 소비자가 자기 사정으로 단언을 줄일 때 공유 프리미티브가 조용히 무방비가
된다" 는 근거로 신설됐는데, 함께 이관된 `listAtPath`/`blockRange`/`findKeyLine` 에는 그 원칙을
적용하지 않았다. 특히 `listAtPath` 는 소유권만 `_shared.ts` 로 옮겨졌고 테스트는 소비자
파일에 남아, 그 파일의 재export 를 "안 쓰는데 왜 있나" 로 정리하는 순간 커버리지가 함께
사라진다.

**판정: 유효**. 이 티켓에서 **같은 클래스가 세 번째**다 — R1(재export 로 없던 공개 표면
생성), R2(`repoRoot` DI 비대칭), R4(테스트 소유권). 내가 세운 방어를 자매에 안 미치는 형태이고,
이 저장소가 반복해 데인 지점이다.

**조치** (`76f9aa0f2`):
- `listAtPath` 합성 회귀 4건(중첩 경로·형제 키 격리·null·인라인 주석)을
  `internal-package-registration.test.ts` → `shared.test.ts` 로 **이동**. 총 82건 불변이
  복제가 아님을 보인다. 소비자 쪽에는 그 가드의 **소비 방식**(`packageDirsInPaths` 로
  거르기)만 남겼다.
- `blockRange`/`findKeyLine` 은 두 가드 어느 공개 표면도 아닌 내부 헬퍼라 `listAtPath`/
  `blockScalarAtPath` 를 통한 간접 검증을 유지하되, **실수가 아니라 판단임**을
  `shared.test.ts` 헤더에 명시했다(리뷰어가 요구한 "나중에 구분 가능하게").

### INFO — plan §1 제목이 실제 작업보다 좁다 (scope)

**판정: 유효**. §1 은 "이관" 만 적었는데 실제로는 `repoRoot` 주입점 개방까지 갔다.
**조치**: 제목을 "분리 + DI 대칭화" 로 바꾸고 확장 근거를 본문에 적었다. 다음에 diff 와
plan 을 대조할 사람이 좁은 단어에 걸리지 않게 하는 것이 목적이다.

## 조치하지 않은 것 (근거)

| reviewer | INFO | 사유 |
|---|---|---|
| documentation · maintainability | `loadTypescriptFrom` 의 반환 타입 근거가 JSDoc 밖 `//` 주석이라 IDE hover 에 안 뜬다 | 그 문단은 **왜 `unknown \| null` 을 버렸는가**라는 리팩터 이력이지 호출자가 알아야 할 계약이 아니다. 계약(미설치 시 `null`)은 JSDoc 안에 있다. hover 에 이력을 띄우면 계약이 묻힌다 |
| documentation | `repo-guards/__tests__/` 에 구조 개요 문서 부재 | 리뷰어 자신이 "필수 아님" 으로 판정했고 각 파일 헤더가 상호 참조로 항해 가능하다. **가드 3개 이상**이 트리거 |
| requirement | 이 harness 코드를 규정하는 `spec/` 문서 없음 | plan 의 `spec_impact: none` 과 일치. 전수 grep 0건, 성격상 정상적 부재 |
| security | 정규식 문자열 보간이 하드코딩 상수만 받음 · blind YAML/셸 파서의 설계상 경계 | 둘 다 의도된 설계다. blind 파서 경계는 `#970` 이 세운 "막는 쪽은 무지하게" 원칙 그대로 |
| side_effect | `_shared.ts` 가 종전 비공개 심볼 3개를 공개로 노출 | R1 에서 재export 를 이미 좁혔다. 남은 것은 `_shared` **자신의** export 이고 그건 이 모듈의 존재 이유다 |
| testing | INFO 2건 | 커버리지 갭 아님 |

## 검증 (조치 후)

- `pnpm --filter frontend exec vitest run src/lib/repo-guards/__tests__/` — 3 files / **82 passed**
- `pnpm --filter frontend exec tsc --noEmit` — 0 errors
- `pnpm --filter frontend exec eslint src/lib/repo-guards/__tests__/` — 0 errors / warning 1건
  (기존 `_drop`). 저장소 전체 16 warnings 는 main 이 `#1123` 을 흡수하며 들어온
  `plan-scan.test.ts` 쪽 증가분으로 **실측 확인**했다 — 내 변경분 신규 0.
