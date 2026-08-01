# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `.github/dependabot.yml`
- `PROJECT.md`
- `codebase/backend/eslint.config.mjs`
- `codebase/backend/package.json`
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-fixture.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts` (신규)
- `plan/in-progress/eslint-unicorn-peer-restore.md` (신규)
- `pnpm-lock.yaml` (자동 생성, N/A)
- `review/code/2026/08/01/12_27_15/*` (직전 리뷰 라운드 산출물, 신규 커밋 — 리뷰 대상 코드 아님, N/A)

`eslint-plugin-unicorn` 을 dependabot 이 잘못 올린 `^72.0.0`(unmet peer)에서 의도된 `^56.0.1` 로 되돌리고,
재발 방지용 dependabot ignore 항목 + 상시 회귀 가드(신규 jest spec)를 추가한 변경이다. 직전 리뷰 라운드
(12_27_15)에서 나온 WARNING(동일 registry 표가 3곳에 중복 기재)과 testing 리뷰의 WARNING(자동 회귀 가드
부재)이 이번 라운드에 실제로 반영되어 있는지를 중심으로 확인했다.

### 발견사항

- **[INFO]** 직전 라운드 WARNING("registry 표 3곳 중복")은 이번 커밋에서 실제로 해소됨 — 확인 완료, 조치 불요
  - 위치: `.github/dependabot.yml:87-92`, `PROJECT.md:51`, `plan/in-progress/eslint-unicorn-peer-restore.md:40-42`, SoT 지정처 `codebase/backend/eslint.config.mjs:22-24`
  - 상세: 이전 라운드(`review/code/2026/08/01/12_27_15/maintainability.md`)는 unicorn 버전별 eslint peer floor 실측 표가 `dependabot.yml`·`eslint.config.mjs`·plan 문서 3곳에 손으로 복제되어 있고 그중 한 곳(`dependabot.yml`)은 이미 세분화 수준이 달라 drift 위험이 있다고 지적했다. 이번 커밋을 실제로 열어 대조한 결과, `eslint.config.mjs` 가 유일하게 전체 표(56.x~66+ 6구간)를 갖고 있고 "이 저장소의 SoT" 라고 명시하며, `dependabot.yml`·`PROJECT.md`·plan 문서는 전부 "SoT 는 `eslint.config.mjs` — 여기서는 중복 기재하지 않는다. 결론만: 66 이상은 eslint 9 자체를 배제" 형태로 참조만 하도록 바뀌었다. 값 갱신이 필요할 때 한 곳(`eslint.config.mjs`)만 고치면 되는 구조로 정리되어, 이 PR 이 원래 고치려던 "코드-문서 drift" 사고 클래스를 문서 레벨에서 재도입하던 문제가 해소됐다.
  - 제안: 없음(이미 반영됨).

- **[INFO]** `eslint-unicorn-peer-guard.ts` 의 `parseGteFloor`/`parseCaretFloor`/`parseVersion` 세 함수가 거의 동일한 구조를 반복(경미한 DRY 여지)
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts:14-17`(`parseGteFloor`), `:20-23`(`parseCaretFloor`), `:26-29`(`parseVersion`)
  - 상세: 세 함수 모두 "정규식 `exec` → 매치되면 3개 캡처그룹을 `Number()` 로 변환한 튜플, 아니면 `null`" 이라는 동일한 골격을 접두 패턴(`>=`, `^`, 없음)만 바꿔 반복한다. 순수 DRY 관점에서는 `parseTriple(pattern: RegExp, s: string)` 같은 공통 헬퍼로 추출할 수 있다. 다만 세 함수 각각이 서로 다른 외부 포맷(registry 의 `>=X.Y.Z`, `package.json` 의 caret pin, 설치본 실측 버전)에 대응하는 도메인 개념이라 이름으로 구분해 두는 것도 합리적인 트레이드오프이며, 함수당 3~4줄로 매우 작아 실질적인 유지보수 부담은 낮다.
  - 제안: 지금 리팩터링이 필수는 아니다. 네 번째 포맷이 추가되는 시점이 오면 공통 헬퍼 추출을 고려.

- **[INFO]** `eslint.config.mjs` 신규 주석 블록의 문단 구분 스타일이 같은 파일의 다른 주석 블록과 다름 (직전 라운드에서 이미 지적된 항목, 재확인 결과 여전히 유효 — 의도적으로 미수정)
  - 위치: `codebase/backend/eslint.config.mjs:16-34` (특히 18, 21, 25, 29행의 빈 `//` 줄)
  - 상세: 이번에 확장된 unicorn pin 근거 주석은 빈 `//` 줄로 문단을 구분하는데, 같은 파일의 다른 주석 블록(예: `no-floating-promises` 주석 53-55행, `no-unnecessary-type-assertion` 주석 62-67행, `catch-error-name` 주석 87-91행)은 빈 줄 없이 연속 문단으로 작성돼 있어 파일 내 스타일이 일관되지 않다. 직전 라운드 리뷰(`review/code/2026/08/01/12_27_15/maintainability.md`)가 이미 INFO 로 지적했고 "지금 고칠 필요는 없다" 는 판단이었으며, 이번 라운드에도 그 판단이 유지된 것으로 보인다(RESOLUTION 대상 Warning 목록에 포함되지 않음). 사소한 스캔성 저하 외에 실질적 유지보수 리스크는 없다.
  - 제안: 우선순위 낮음. 다음에 이 주석 블록을 손댈 기회가 있으면 파일 내 기존 스타일(빈 `//` 줄 없는 연속 문단)에 맞추는 것을 고려.

- **[INFO]** 신규 backend 회귀 가드(`eslint-unicorn-peer-guard.ts` + `eslint-unicorn-peer.spec.ts` + `eslint-unicorn-peer-fixture.ts`)는 frontend 형제 가드(`typescript-toolchain-guard.ts`/`.test.ts`)와 동일한 "순수 파서/판정 로직 분리 + 실측 대조 + 합성 fixture" 구조를 따르고 있어 저장소 컨벤션과 일관적이다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고(가장 긴 함수 `lintFixtureText` 도 25줄 내외), 각 `describe` 블록이 책임을 명확히 분리해(실발화 확인 / peer range 정합 / 합성 파서 단위테스트) 281줄 분량에도 가독성이 유지된다. 매직 넘버 없음(버전 숫자는 전부 도메인 실측값으로 주석에 근거가 붙어 있음). 특별한 결함 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer.spec.ts`, `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts`
  - 상세: 해당 없음(긍정 확인).
  - 제안: 없음.

- **[INFO]** `PROJECT.md` 신규 결속(binding) 문구가 저장소 기존 관례(값 변경 시 2곳 이상 동시 갱신 요구)를 잘 따름
  - 위치: `PROJECT.md:49`
  - 상세: "이 개수는 `.github/dependabot.yml` 의 해당 `ignore` 블록 항목 수와 항상 같아야 한다 ... 2-place 편집" 문구는 이미 `PROJECT.md:48`(override 값 변경 시 `check-pnpm-security-config.py` 의 `EXPECTED_*` 동시 갱신)에 쓰인 것과 같은 패턴이다. 실측(dependabot.yml ignore 항목 수 2건 = `typescript`+`eslint-plugin-unicorn`)과 문구의 "2건" 이 정확히 일치함을 확인했다.
  - 제안: 없음.

### 요약

이번 변경셋은 의존성 버전 되돌리기 + dependabot ignore 추가 + 그 계약을 상시 검증하는 신규 backend jest 가드(순수 파서 모듈 + 실측/합성 테스트) 로 구성된다. 함수 길이·중첩 깊이·순환 복잡도 관점에서 구조적 리스크는 없고, 신규 가드는 frontend 형제 가드와 동일한 분리 규약(파서/소비 spec 분리)을 따라 일관성이 좋다. 직전 리뷰 라운드가 지적한 유일한 실질 결함(registry 실측 표 3곳 중복, WARNING)은 SoT 를 `eslint.config.mjs` 한 곳으로 모으고 나머지는 참조만 하는 형태로 이번 커밋에서 실제로 해소되었음을 직접 대조해 확인했다. 남은 항목은 모두 INFO 수준의 경미한 스타일/DRY 여지(신규 guard.ts 의 3개 파서 함수 간 경미한 구조적 유사성, eslint.config.mjs 신규 주석 블록의 문단 구분 스타일이 파일 내 다른 블록과 다름 — 후자는 직전 라운드에서 이미 인지되고 의도적으로 낮은 우선순위로 남겨진 항목)이며 차단 사유가 되는 것은 없다.

### 위험도
NONE
