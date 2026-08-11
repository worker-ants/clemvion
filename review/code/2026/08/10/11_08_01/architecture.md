# 아키텍처(Architecture) Review

## 대상

- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (신규)
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain-guard.ts`
- `codebase/frontend/src/lib/repo-guards/__tests__/typescript-toolchain.test.ts`
- `plan/in-progress/typescript-toolchain-followups.md`

이번 변경은 직전 리뷰에서 나온 아키텍처 WARNING(§1: `typescript-toolchain-guard.ts` 가 무관한
책임을 가진 `internal-package-registration-guard.ts` 의 전체 export 표면에 결합)과 INFO(§2:
fail-closed throw 가 실 I/O 와 결합돼 합성 입력으로 겨냥 불가)를 해소하는 후속 리팩터다.

## 발견사항

- **[INFO]** `internal-package-registration-guard.ts` 가 `_shared.ts` 의 심볼을 재export 하면서
  같은 심볼(`ROOT`/`listAtPath`/`repoRoot`/`PackageManifest`)에 대해 두 개의 유효한 import 경로가
  생겼다 — `./_shared` 직접, 또는 `./internal-package-registration-guard` 경유.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration-guard.ts:48` (`export { ROOT, listAtPath, repoRoot };`)
  - 상세: `internal-package-registration.test.ts` 는 여전히 `listAtPath` 를
    `internal-package-registration-guard.ts` 에서 가져온다(파일 3, import 블록). 코드 주석이
    "소비처를 한 번에 갈아엎지 않고 소유권만 옮기는 게 목적" 이라고 그 이유를 명시하고 있어
    의도된 과도기적 절충으로 보이며, 지금 당장 문제를 일으키지는 않는다. 다만 이 파사드가
    영구화되면 "진짜 소유자가 어디인가" 에 대한 혼동 표면이 하나 늘어난 채로 고정된다.
  - 제안: `internal-package-registration.test.ts` 를 다음에 손댈 때 import 를 `./_shared` 직접
    참조로 옮기고, 그 시점에 `internal-package-registration-guard.ts` 의 재export 4종을 제거해
    단일 진입점으로 수렴시키는 것을 후속 정리 항목으로 남겨두면 좋다(지금 이 PR 의 범위를 넘는
    선택이므로 CRITICAL/WARNING 이 아니라 INFO).

- **[INFO]** 신설 중립 모듈명 `_shared.ts` 가 스코프를 이름에 싣지 못하는 제네릭한 이름이다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts:1`
  - 상세: 파일 헤더 주석이 "여기 두는 기준: 두 가드가 실제로 공유하는 것만" 이라는 경계를
    상세히 문서화해 지금 시점에는 스코프 크리프를 잘 방어하고 있다. 다만 `_shared` 라는 이름
    자체는 향후 기여자에게 "뭐든 공유할 것 같으면 여기" 라는 유인을 줄 수 있어, 실제 내용
    (워크스페이스 루트 탐색 + YAML 서브셋 추출기)을 이름에 반영했다면(예: `_workspace-yaml.ts`)
    경계가 코드 자체에서 더 강제됐을 것이다. 헤더 주석이 이미 그 역할을 하고 있어 심각도는 낮다.
  - 제안: 강제 조치 불필요. 세 번째 가드가 생겨 이 모듈에 무관한 것이 추가되려는 시도가 보이면
    그때 이름/헤더 기준으로 되돌아볼 신호로 남겨둔다.

## 평가 근거 (점검 관점별)

- **SOLID**: `_shared.ts` 분리는 SRP·ISP 개선이 뚜렷하다. `typescript-toolchain-guard.ts` 가
  더 이상 무관한 책임(패키지 발견, bash 파서, 워크플로 매트릭스 대조)을 가진 형제 모듈의 전체
  표면에 의존하지 않고 실제로 쓰는 3개 심볼만 좁게 의존한다(`typescript-toolchain-guard.ts:19`,
  `import { ROOT, listAtPath, type PackageManifest } from "./_shared";`). `discoverWorkspaceDirs`
  의 리팩터(`validateWorkspacePatterns` 분리 + `readLines` 주입)는 같은 파일의 기존 관례
  (`expandWorkspaceGlobs(readDir)`, `typescriptDecls(readManifest)`)와 동일한 DI 패턴을 따라
  DIP 를 일관되게 적용했다.
- **결합도/응집도**: 개선 방향이 명확하다. 이전에는 `toolchain-guard → registration-guard`
  직접 의존(무관 책임 포함)이었으나, 이제 `toolchain-guard → _shared ← registration-guard`
  형태의 hub-and-spoke 구조로 바뀌어 두 가드 사이의 결합이 완전히 끊겼다. `_shared.ts` 자체의
  응집도도 높다 — 워크스페이스 루트 탐색과 YAML 서브셋 파서라는 밀접하게 연관된 책임만 담는다.
- **레이어 책임**: 이 코드는 애플리케이션 프레젠테이션/비즈니스/데이터 레이어가 아니라 저장소
  개발 도구(repo guard) 영역이지만, 유사한 3계층 분리가 유지된다 — 중립 프리미티브(`_shared.ts`)
  → 가드별 파서·판정 순수 로직(`*-guard.ts`) → 실측/합성 fixture 단언(`*.test.ts`). 이번 diff가
  이 구조를 흩트리지 않고 오히려 강화했다.
- **디자인 패턴**: "공유 커널(shared kernel)" 추출이 적절히 쓰였다. 안티패턴(무차별 유틸 덤핑
  모듈)을 피하기 위한 명시적 포함 기준 주석도 갖췄다. 재export를 통한 하위호환 파사드는 과도기
  절충으로 합리적(위 INFO 참고).
- **순환 의존성**: 없음을 확인했다 — `_shared.ts` 는 `node:fs`/`node:path` 외 어떤 로컬 모듈도
  import 하지 않고, 두 가드 모두 `_shared.ts` 로만 향하는 단방향 의존이다.
- **추상화 수준**: 적절하다. 완전한 YAML 파서 대신 "알려진 경로만 다루는 서브셋 추출기" 로
  한정한 기존 결정을 유지했고(js-yaml 을 전이 의존으로 끌어오면 install 모드 변화에 조용히
  깨진다는 근거가 헤더에 명시), `blockRange`/`findKeyLine` 처럼 순수 헬퍼로 이미 존재하던 것만
  옮기고 새 공개 표면을 만들지 않도록 의도적으로 절제했다(`internal-package-registration-guard.ts:44-47`
  주석 참고).
- **모듈 경계**: `_shared.ts` 헤더가 포함 기준을 코드로 명문화해("두 가드가 실제로 공유하는
  것만") 향후 스코프 크리프를 억제하는 장치를 마련했다. `PACKAGES_DIR`/`TEST_STAGES` 는
  등록 가드 전용, `WORKSPACE_YAML` 은 툴체인 가드 전용으로 남겨 경계가 명확하다.
- **확장성**: 세 번째 가드가 추가되더라도 `_shared.ts` 에 필요한 공통 프리미티브만 옮기면 되는
  구조가 됐다. `validateWorkspacePatterns`/`readLines` 주입 패턴은 fail-closed 검증 로직을
  I/O 와 분리하는 재사용 가능한 관례를 세워, 유사한 향후 가드에도 같은 틀을 적용할 수 있다.

## 요약

직전 리뷰 WARNING(무관 책임 모듈에 대한 과도한 결합)을 정확히 겨냥해 해소한 리팩터다. 공유
프리미티브를 새 중립 모듈로 뽑으면서 순환 의존 없이 hub-and-spoke 구조로 전환했고, 재export 를
통해 기존 소비처 계약을 깨지 않으면서도 API 표면이 부산물로 넓어지는 것을 의도적으로 차단했다.
`validateWorkspacePatterns` 추출 + `readLines` 주입은 같은 파일의 기존 DI 관례를 그대로 따라
일관성이 높고, fail-closed 로직을 I/O 로부터 분리해 실제로 합성 테스트가 겨냥할 수 있게 만들었다.
남은 지적은 재export 파사드의 과도기적 이중 경로와 `_shared.ts` 라는 이름의 스코프 비명시성뿐이며
둘 다 지금 문제를 일으키지 않는 INFO 수준이다. 전반적으로 아키텍처 관점에서 개선 방향이
뚜렷하고 부작용이 없는 변경이다.

## 위험도

LOW
