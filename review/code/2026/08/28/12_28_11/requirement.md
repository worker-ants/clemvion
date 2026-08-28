# 요구사항(Requirement) 리뷰 — eslint10-upgrade

## 검토 방법

이 브랜치는 `eslint 9→10` 상향(backend + `packages/*` 8개) 및 그에 따른 신규
`@eslint/js@10` recommended 룰(`no-useless-assignment`·`preserve-caught-error`) 대응
기계적 수정, `eslint-plugin-unicorn` 56→73 상향, 관련 가드(`parseGteFloor`) 확장,
문서(`dependabot.yml`/`PROJECT.md`/`eslint.config.mjs` 헤더/plan) 갱신으로 구성된다.
diff 64개 파일 중 상당수(약 30개)는 **이전 세 차례 리뷰/일관성검토 라운드
(`review/code/.../11_45_02`, `review/consistency/.../11_15_50`, `.../12_20_11`)의
산출물 자체**가 이번 커밋에 신규 파일로 포함된 것이며, 그 라운드가 지적한
Critical 1건 + Warning 2건은 `RESOLUTION.md`(`0f3b3e0c3`·`9bcbb7fa5`·`3a540aa81`)로
이미 코드에 반영돼 있다. 이번 리뷰는 그 수정 결과를 포함해 실제 애플리케이션
코드 변경 19개 파일(`codebase/**`)을 전수로 직접 `Read`/`Grep` 대조했다.

검증한 항목(문제 없음 확인, 상세는 아래):
- `let x: T = <default>;` → `let x: T;`(no-useless-assignment) 8개 지점 전부 — 모든 실행
  경로에서 사용 전 재할당됨을 직접 추적 확인
  (`ssrf-safe-url.util.ts:156`, `form-mode.ts:289`, `execution-engine.service.ts:4918`
  — catch 블록이 `return`, `public-webhook-throttle.guard.ts:67`,
  `kb-tool-provider.ts:239`, `information-extractor.handler.ts:332`,
  `web-chat-sdk/src/index.ts:63`).
- `ai-turn-executor.ts` — `finalSystemPrompt` 재할당 제거 2곳(단일턴 1583~1620,
  멀티턴 2038 부근)을 함수 스코프 끝까지 grep 으로 추적, 제거 후 그 지역변수가
  더 이상 참조되지 않음을 확인(단일턴 스코프 3회, 멀티턴 스코프 자체 `let` 은
  같은 스코프 내에서 계속 재할당돼 별개 변수로 정상 동작).
- `knowledge-base.service.ts:601` — `graphRequeued -= slice.length;` 제거 자리의
  새 주석("아래 `throw err` 로 반환 자체가 일어나지 않는다")이 실제 코드 흐름과
  일치함을 확인 — catch 블록은 무조건 `throw err;` 로 끝나 `graphRequeued` 값이
  호출자에게 반환되지 않는다.
- `parseGteFloor`(`eslint-unicorn-peer-guard.ts`) — `>=X`/`>=X.Y`/`>=X.Y.Z` 확장 정규식이
  의도대로 동작(`>=`, `>=x` 는 여전히 null → fail-closed 유지)하고, 대응 회귀
  테스트(`eslint-unicorn-peer.spec.ts`)가 형태(자릿수)별 discriminating fixture를
  갖춤을 확인.
- `secret-resolver.service.ts` — `eslint-disable-next-line preserve-caught-error`
  뒤에 저장소 관행대로 `-- <사유>` 인라인이 붙어 있음(이전 라운드 maintainability
  INFO 반영 확인). `secret-resolver.service.spec.ts` 신규 테스트가 실제로
  `decryptSecret`(AES-GCM authTag 검증 실패)을 트리거해 `catch` 분기에 도달함을
  암호 포맷 레벨에서 확인(IV 12B+ciphertext 4B+tag 16B 전부 0 — authTag 불일치로
  반드시 throw) — vacuous 아님.
- `text-chunker.ts`/`.spec.ts` — 제거된 `overlapBuffer = getOverlapText(...)` 가 바로
  다음 줄의 무조건 `overlapBuffer = '';` 로 덮어써지는 dead-store 였음을 확인. 신규
  테스트가 실제로 force-split 분기(문장 하나가 chunkSize 초과)에 진입함을 직접
  손으로 추적(`estimateTokens` 계산 재현)해 확인 — `chunks[0]` = 직전 문맥 flush,
  이후 조각들은 `longSentence` 부분 문자열만 포함하고 마지막 조각이 `'029'` 로
  끝남까지 일치.
- `.github/dependabot.yml` / `PROJECT.md:57` — ignore 블록 실제 항목 수(1건,
  `typescript` 만 남음)와 `PROJECT.md` 서술("현재 `typescript` 1건")이 일치함을
  직접 파일을 열어 대조.
- `pnpm-lock.yaml` — `codebase/backend` importer 는 `eslint 10.9.1`, `codebase/frontend`
  importer 는 `eslint 9.39.5` 로 고정돼 있어 plan/리뷰 서술("backend+packages 9개는
  10.x, frontend·channel-web-chat 은 9.x 잔류")과 실측이 일치.

## 발견사항

- **[INFO]** `expression-resolver.service.ts`/`code.handler.ts` 에 신설된
  `{ cause: err }` 계약(원본 예외가 `cause` 로 보존된다)을 잠그는 테스트가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` (diff 게이트 316~318줄), `codebase/backend/src/nodes/data/code/code.handler.ts` (diff 게이트 454줄). 대응 스펙 파일(`expression-resolver.service.spec.ts`, `code.handler.spec.ts`)에 `cause` 문자열 grep 0건 확인.
  - 상세: 이전 라운드(`review/code/.../11_45_02/testing.md`)가 이미 이 갭을 INFO 로 지적했고, 담당 plan(`plan/in-progress/deps-peer-gating-and-eslint10.md` "후속, INFO" 항목)이 developer SKILL §수렴 예외 근거(동작 결함 아님·두 리뷰어가 독립적으로 cause 부착 안전성을 실측 확인·fix 가 spec-linked 파일 재리뷰를 강제)와 함께 이번 턴에 의도적으로 유예했음을 확인했다. 새로운 결함이 아니라 기존에 문서화된 미결 항목의 재확인이다.
  - 제안: plan 이 이미 기록한 대로 다음 턴에 두 지점에 `expect((thrown as Error).cause).toBe(originalError)` 류 단언을 추가하면 된다 — 이번 라운드에서 추가 조치 불요(수렴 조건 충족 확인).

- **[INFO]** `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트 최상위
  `- [ ] TEST WORKFLOW + /ai-review` 항목이, 하위 lint/unit/build/e2e/`/ai-review`/
  `/consistency-check --impl-done` 전부가 `[x]` 로 체크된 상태에서도 미체크로 남아
  있다.
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트 섹션(하위 5~6개 항목 바로 위 부모 항목).
  - 상세: 하위 항목이 전부 완료 표시됐는데 부모 항목만 미체크인 것은 단순 정리 누락으로 보이며, 기능적 결함은 아니다.
  - 제안: 다음에 이 plan 파일을 만질 때 부모 체크박스도 함께 정리(사소, 비차단).

- **[INFO] spec fidelity**: 이번 변경 영역(`.github/dependabot.yml`, `eslint.config.mjs` 3종, 각 워크스페이스 `package.json`, `pnpm-lock.yaml`, `PROJECT.md`, repo-guard 테스트)은 순수 CI/lint 툴체인 설정이며 `spec/**` 어느 문서도 이 영역(버전 pin 정책·의존성 상향 절차)을 요구사항 ID·행위 명세 수준으로 규정하지 않는다(`PROJECT.md` "버전 핀 정책"이 유일하게 관련된 정식 규약이며, 위에서 확인한 대로 caret 기본값·exact/tilde 사유 주석 규칙과 실제 diff — `^10.9.1`/`^73.0.0` 모두 caret — 가 일치한다). 코드 변경분(`no-useless-assignment`/`preserve-caught-error` 대응 12개 파일)도 spec 이 규정하는 필드·엔드포인트·상태 전이를 건드리지 않아 대응 spec 문서 자체가 없다 — 회색지대로 판단해 조치 불필요.

## 요약

핵심 애플리케이션 코드 변경(19개 backend/packages 파일)은 전부 eslint 10 상향이
새로 활성화한 recommended 룰(`no-useless-assignment`, `preserve-caught-error`) 대응을
위한 기계적 수정이며, 각 지점을 직접 코드 흐름 추적으로 재검증한 결과 동작 변화가
없음을 확인했다(dead-initializer/dead-store 제거는 모든 경로에서 사용 전
재할당·조기 종료가 보장됨). `parseGteFloor` 파서 확장은 fail-closed 설계를
유지하면서 실제 registry 표기(`>=10.4`)를 정확히 포착하고, 회귀 테스트가 형태별
분기를 갖췄다. 직전 리뷰 라운드가 지적한 Critical(`PROJECT.md` 카운트 drift)과
Warning 2건(force-split 분기·secret 복호화 실패 분기 테스트 부재)은 모두 코드로
수정되어 있고, 그 수정 코드 자체를 재검증한 결과 vacuous 하지 않음을 확인했다.
남은 것은 이미 plan 이 의도적으로 유예를 기록해 둔 INFO 1건(`cause` 보존 테스트
부재)과 plan 체크리스트 사소한 정리 미비 1건뿐이며, 둘 다 기능적 결함이나 spec
불일치가 아니다. 관련 spec 문서 자체가 이 툴체인 영역을 규정하지 않아(회색지대)
spec fidelity 관점의 CRITICAL/WARNING 판정도 없다.

## 위험도

LOW
