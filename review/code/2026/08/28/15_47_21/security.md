# 보안(Security) 리뷰

## 리뷰 범위 요약

이번 diff 는 5개 파일 — `codebase/backend/package.json`(devDependency 제거),
`expression-resolver.service.spec.ts` / `code.handler.spec.ts`(테스트 추가),
`plan/in-progress/deps-peer-gating-and-eslint10.md`(계획 문서),
`pnpm-lock.yaml`(락파일) — 로 구성되며, **프로덕션 소스 코드 변경은 포함되어 있지 않다**.
실질 내용은 eslint 9→10 상향에 따른 devDependency 정리 + `preserve-caught-error` 규칙 대응으로
이미 반영된 `cause: err` 부착의 안전성을 잠그는 회귀 테스트 추가다.

## 발견사항

- **[INFO]** `preserve-caught-error` 대응 `cause: err` 부착의 정보 노출 여부를 직접 확인함 — 안전 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:141` (신규 테스트), 대응 프로덕션 코드 `expression-resolver.service.ts` (`cause: err`, diff 밖) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts:202` (신규 테스트), 대응 `code.handler.ts` (`cause: err`, diff 밖)
  - 상세: 두 서비스 모두 `throw new Error(\`...: ${message}\`, { cause: err })` 형태로, wrapping 메시지가 이미 `err.message` 를 포함하므로 `cause` 가 추가 정보를 노출하지 않는다는 plan 문서의 주장을 직접 소스에서 확인했다. 또한 `codebase/backend/src` 전체에서 `.cause` 를 참조/직렬화하는 다운스트림 코드가 `telegram-client.ts` 한 곳(무관 도메인) 뿐임을 grep 으로 확인 — 이 두 catch 경로의 `cause` 가 로그·API 응답으로 재직렬화되는 지점이 없다. `secret-resolver.service.ts` 는 반대로 `eslint-disable-next-line preserve-caught-error`(SS-SE-05, `#814` 근거)로 `cause` 부착을 명시적으로 억제해 crypto 에러 상세가 Activity API 로 노출되지 않도록 구분 처리하고 있다. 이번 diff 는 이 기존(리뷰 완료) 동작에 대한 **잠금 테스트만 추가**하며, 신규 위험을 도입하지 않는다.
  - 제안: 조치 불필요 — 오히려 방어적 회귀 테스트로 긍정적 변경. `spec/conventions/` 에 이 판별 기준("message 가 원문을 이미 담고 있으면 cause 안전, 아니면 disable")을 명문화하는 후속 작업(plan 에 이미 planner 턴으로 등재됨)은 계속 진행 권장.

- **[INFO]** devDependency `@eslint/eslintrc` 제거 — 공격 표면 축소, 부작용 없음
  - 위치: `codebase/backend/package.json` (devDependencies), `pnpm-lock.yaml` (`importers.codebase/backend.devDependencies` 및 `snapshots` 섹션 `@jest/core@30.4.2` 무파라미터 항목 제거 등 연쇄 정리)
  - 상세: eslint 10 이 더 이상 `@eslint/eslintrc` 를 번들하지 않는 상황에서 사용처 0건(plan 문서에 grep 근거 기재)인 devDependency 를 제거한 것으로, 런타임 프로덕션 코드에는 영향이 없고 오히려 불필요한 전이 의존성(및 그로 인한 향후 dependabot 취약점 알림 노이즈)을 줄인다. `pnpm-lock.yaml` 의 나머지 변경(`jest-config`/`jest-cli`/`jest@30.4.2` 의 `ts-node` 파라미터화)도 dedupe 성격의 락파일 정리로 보이며 새로운 패키지 도입이나 의심스러운 registry/tarball 참조는 없다.
  - 제안: 없음. 락파일 변경이 CI(`pnpm install --frozen-lockfile`)를 통과했는지만 확인되면 충분하다(별도 리뷰어가 커버할 영역).

- **[INFO]** 신규 테스트 코드 내 시크릿·자격증명 없음
  - 위치: `expression-resolver.service.spec.ts:141-156` (신규 `it` 블록), `code.handler.spec.ts:202-224` (신규 `it` 블록)
  - 상세: 두 신규 테스트 모두 하드코딩된 API 키/토큰/패스워드를 포함하지 않으며, 의도적으로 유효하지 않은 표현식(`{{ $input. }}`)과 문법 오류 코드(`this is ( not valid js`)만 사용해 에러 경로를 유도한다. 기존 파일에 있던 `Bearer secret-token`/`x-api-key` 같은 값은 diff 대상 밖(기존 테스트 픽스처)이며 실제 시크릿이 아닌 마스킹 검증용 더미 값이다.
  - 제안: 없음.

## 요약

이번 변경은 실질적으로 devDependency 정리(eslint 10 상향에 따른 `@eslint/eslintrc` 제거) + 이미 프로덕션에 반영되어 있던 `preserve-caught-error` 대응 `cause: err` 부착의 안전성(정보 노출 없음)을 검증하는 회귀 테스트 2건 추가로 구성된다. 프로덕션 소스 코드 자체는 변경되지 않았고, 새로 추가된 테스트가 참조하는 두 catch 경로 모두 wrapping 메시지가 원본 오류 메시지를 이미 포함하고 있어 `cause` 부착이 추가 정보 노출을 만들지 않음을 직접 소스와 grep 으로 확인했다. `secret-resolver.service.ts` 는 반대로 `cause` 부착을 의도적으로 억제해 crypto 에러 상세 노출을 막고 있으며 이 구분이 유지되고 있다. 인젝션·인증/인가·암호화·에러 처리 노출 관점에서 이 diff 자체로 인해 새로 생기는 취약점은 발견되지 않았고, 오히려 회귀를 막는 방어적 테스트와 불필요 의존성 제거로 보안 자세가 소폭 개선되었다.

## 위험도

NONE
