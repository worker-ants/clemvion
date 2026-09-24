# Rationale 연속성 검토 — spec/5-system (--impl-prep)

## 검토 대상과 실제 변경 범위의 대조

이번 impl-prep 이 참조하는 계획은 `plan/in-progress/jest-esm-native-load.md` (`spec_impact: none`)
다. 실측(`git status`, `git diff --stat origin/main...HEAD`) 결과 이 worktree 의 유일한 변경은
plan 문서 1건 추가뿐이며, `spec/5-system/**` 를 포함한 어떤 spec 파일도 아직 수정되지 않았다.
계획이 예고하는 실제 구현은:

1. jest 실행 커맨드를 `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` 로 변경
2. `transformIgnorePatterns` 를 허용목록에서 기본값(`['/node_modules/']`)으로 되돌림

둘 다 **테스트 러너의 모듈 로딩 방식**에 관한 하네스/툴링 변경이며, NestJS 런타임 코드·API 계약·
인증 흐름 등 `spec/5-system` 이 기술하는 어떤 제품 동작도 바꾸지 않는다 (plan §E 의 명시:
"backend 를 ESM 패키지로 전환 — 필요 없다. 런타임은 그대로 CJS 이고 바뀌는 것은 테스트 러너의
모듈 로딩 방식뿐이다").

## 관련 Rationale 대조

`1-auth.md`, `2-api-convention.md`, `3-error-handling.md` 전문과 관련 Rationale 발췌
(`0-overview.md`, `1-data-model.md`, `2-navigation/*`)를 grep/열람했다. jest·CJS/ESM·
`transformIgnorePatterns`·의존성 버전 고정 정책을 언급하는 Rationale 항목은 이 스코프에
존재하지 않는다. 유일하게 근접한 항목 둘은 오히려 계획과 **정합**한다:

- **1.4.J — TOTP 라이브러리: `otplib` v13** (`spec/5-system/1-auth.md`): "v13 은 complete
  rewrite (**ESM-only**...)" 라고 이미 명시하고 있다. 현재 저장소는 이 ESM-only 특성을
  `transformIgnorePatterns` 허용목록(주석: "uuid >=12, p-limit >=4, yocto-queue; otplib >=13
  …")으로 우회해 왔다. 계획은 이 우회 메커니즘을 **네이티브 ESM 로딩**으로 교체하는 것이지,
  otplib v13 채택이라는 결정 자체를 번복하지 않는다 — 오히려 그 결정이 이미 전제한 ESM-only
  특성을 더 직접적으로 지원하는 방향이다.
- **1.4.H — WebAuthn 도메인 모듈 분리** 인근의 라이브러리 선정 근거: "`@simplewebauthn/*` ...
  Node 18+ 에서 ESM/CJS 모두 동작한다." 이 진술과도 충돌하지 않는다 (해당 라이브러리는 계획이
  건드리는 허용목록 대상에 포함되어 있지 않다).

`2-api-convention.md`·`3-error-handling.md` 의 Rationale 항목(§5.3 410 코드 미채택, §10.4
재연결 위임, 413 vs 도메인 코드 공존, `ACCOUNT_LOCKED` 423→401 정정 등)은 모두 API 응답
계약·에러 코드에 관한 것으로 테스트 하네스 변경과 접점이 없다.

## 발견사항

없음. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도
target 스코프 내에서 관측되지 않았다 —애초에 이번 계획이 `spec/5-system` 이 기술하는 어떤
결정도 변경 대상으로 삼지 않기 때문이다.

### 참고 (INFO, 비차단)

- **[INFO]** impl-prep 스코프 선정이 실제 diff 표면과 느슨하다
  - target 위치: 워크플로 스코프 선택 (`--impl-prep spec/5-system`)
  - 과거 결정 출처: 해당 없음 (스코프 선정 로직 자체에 대한 관찰)
  - 상세: 이번 변경은 jest 설정/실행 스크립트에 국한되며 `spec/5-system/*.md` 의 `code:`
    frontmatter 가 가리키는 어떤 소스 파일도 건드리지 않는다. `spec/5-system` 을 스코프로 잡은
    근거가 plan 에 명시되어 있지 않아, 이 리뷰가 실제로 검증할 대상이 없는 채 형식적으로
    통과한다.
  - 제안: 차단 사유는 아니다. 다만 plan 체크리스트의 `/consistency-check --impl-prep
    spec/5-system` 항목을 실행할 때, 이 게이트가 "해당 없음(스코프 불일치)"으로 통과했다는
    점을 결과에 남겨두면 다음 사람이 "정말 검토됐는지"를 재추적하지 않아도 된다.

## 요약

이번 impl-prep 대상인 `spec/5-system`(특히 전문이 번들된 `1-auth.md`·`2-api-convention.md`·
`3-error-handling.md`)의 Rationale 은 jest 테스트 러너의 모듈 로딩 방식이나
`transformIgnorePatterns` 정책과 접점이 없으며, 계획된 구현(네이티브 ESM 로딩 전환)은 spec 이
기록한 어떤 결정도 재도입·번복·우회하지 않는다. 유일하게 관련된 두 Rationale 항목(otplib v13
ESM-only, WebAuthn 라이브러리의 ESM/CJS 호환성)은 계획과 정합적이며 오히려 계획이 그 전제를
더 잘 지지한다. 이번 변경은 `spec_impact: none` 이 타당하다.

## 위험도

NONE
